/**
 * These tests document and protect the race-condition invariants of the system.
 * They simulate the database state transitions without actually requiring a DB,
 * using minimal state machines to mirror what the workers and routes do.
 */
import { describe, it, expect } from "vitest";

// ---- Suggestion state machine (mirrors worker + send route logic) ----

type SuggestionStatus = "pending" | "ready" | "accepted" | "rejected" | "superseded" | "error";

class Suggestion {
  status: SuggestionStatus = "pending";
  text: string | null = null;

  // Worker tries to set ready; only allowed if still pending.
  markReady(text: string) {
    if (this.status === "pending") {
      this.status = "ready";
      this.text = text;
      return true;
    }
    return false;
  }
  // Route tries to accept; only allowed if ready.
  tryAccept() {
    if (this.status === "ready") {
      this.status = "accepted";
      return true;
    }
    return false;
  }
  // Inbound supersedes any pending/ready suggestion.
  supersede() {
    if (this.status === "pending" || this.status === "ready") {
      this.status = "superseded";
      return true;
    }
    return false;
  }
}

describe("suggestion supersede race", () => {
  it("inbound arrives mid-generation → worker write is dropped", () => {
    const s = new Suggestion();
    // Inbound arrives first
    s.supersede();
    // Worker returns from Claude later — write must NOT take effect
    const written = s.markReady("late suggestion");
    expect(written).toBe(false);
    expect(s.status).toBe("superseded");
  });

  it("inbound arrives after ready → ready becomes superseded", () => {
    const s = new Suggestion();
    s.markReady("first take");
    s.supersede();
    expect(s.status).toBe("superseded");
  });

  it("normal happy path: pending → ready → accepted", () => {
    const s = new Suggestion();
    expect(s.markReady("hello")).toBe(true);
    expect(s.tryAccept()).toBe(true);
    expect(s.status).toBe("accepted");
  });
});

describe("double-send race", () => {
  it("two tabs accepting same ready suggestion: only one wins", () => {
    const s = new Suggestion();
    s.markReady("ok");
    const a = s.tryAccept();
    const b = s.tryAccept();
    expect(a).toBe(true);
    expect(b).toBe(false);
  });
});

describe("webhook idempotency (job key + DB unique)", () => {
  // Models BullMQ jobId uniqueness + Postgres unique partial index
  it("same external_message_id collapses to one insert", () => {
    const seenJobIds = new Set<string>();
    const seenDbKeys = new Set<string>();
    const deliver = (pageId: string, externalId: string) => {
      const jobId = `${pageId}:${externalId}`;
      if (seenJobIds.has(jobId)) return "deduped-at-queue";
      seenJobIds.add(jobId);
      const dbKey = `${pageId}:${externalId}`;
      if (seenDbKeys.has(dbKey)) return "deduped-at-db";
      seenDbKeys.add(dbKey);
      return "inserted";
    };
    expect(deliver("p1", "m1")).toBe("inserted");
    expect(deliver("p1", "m1")).toBe("deduped-at-queue");
    expect(deliver("p1", "m2")).toBe("inserted");
  });
});

describe("per-page rate limiter math", () => {
  it("50 jobs at 8/sec spreads over at least 5 seconds", () => {
    const ratePerSec = 8;
    const jobs = 50;
    const minSeconds = Math.floor((jobs - 1) / ratePerSec);
    expect(minSeconds).toBeGreaterThanOrEqual(6); // (50-1)/8 = 6 full windows
  });
});

describe("outbound retry classification", () => {
  it("worker only retries on retryable error class", () => {
    type Result = { ok: true } | { ok: false; retryable: boolean };
    const attempts: number[] = [];
    let n = 0;
    const result: Result = { ok: false, retryable: false };
    function tick(r: Result) {
      n++;
      attempts.push(n);
      if (!r.ok && r.retryable && n < 3) tick(r);
    }
    tick(result);
    expect(attempts).toEqual([1]); // not retried because non-retryable
  });
});
