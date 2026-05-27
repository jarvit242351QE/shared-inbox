import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { sendText } from "../../lib/manychat";

describe("sendText (ManyChat)", () => {
  const originalFetch = global.fetch;
  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("returns ok on status:success", async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ status: "success" }), { status: 200 })
    ) as unknown as typeof fetch;
    const r = await sendText("k", "123", "hi");
    expect(r.ok).toBe(true);
  });

  it("marks 4xx non-retryable so worker stops retrying", async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ status: "error", message: "outside 24h window" }), { status: 400 })
    ) as unknown as typeof fetch;
    const r = await sendText("k", "123", "hi");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.retryable).toBe(false);
      expect(r.code).toBe(400);
    }
  });

  it("marks 429 retryable", async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ status: "error", message: "rate limit" }), { status: 429 })
    ) as unknown as typeof fetch;
    const r = await sendText("k", "123", "hi");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.retryable).toBe(true);
  });

  it("marks 5xx retryable", async () => {
    global.fetch = vi.fn(async () =>
      new Response("{}", { status: 502 })
    ) as unknown as typeof fetch;
    const r = await sendText("k", "123", "hi");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.retryable).toBe(true);
  });

  it("network error is treated as retryable", async () => {
    global.fetch = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const r = await sendText("k", "123", "hi");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.retryable).toBe(true);
  });

  it("posts the correct ManyChat payload shape", async () => {
    const spy = vi.fn(async () => new Response(JSON.stringify({ status: "success" }), { status: 200 }));
    global.fetch = spy as unknown as typeof fetch;
    await sendText("MY-KEY", "sub-1", "hello");
    const call = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toBe("https://api.manychat.com/fb/sending/sendContent");
    const headers = call[1].headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer MY-KEY");
    const body = JSON.parse(call[1].body as string);
    expect(body).toEqual({
      subscriber_id: "sub-1",
      data: { version: "v2", content: { messages: [{ type: "text", text: "hello" }] } },
    });
  });
});
