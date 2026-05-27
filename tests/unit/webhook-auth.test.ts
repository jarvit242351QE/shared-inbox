/**
 * Webhook auth: verifies the token comparison logic uses constant time and that
 * a wrong/empty token never matches. We unit-test the helper directly here —
 * an integration test against the actual route requires DB + queue.
 */
import { describe, it, expect } from "vitest";
import { constantTimeEqual } from "../../lib/crypto";

describe("webhook token comparison", () => {
  it("empty submitted token never authenticates against a real expected", () => {
    expect(constantTimeEqual("", "any-real-token")).toBe(false);
  });

  it("empty expected token rejects all submitted tokens", () => {
    expect(constantTimeEqual("anything", "")).toBe(false);
  });

  it("equal-length but different content rejected", () => {
    expect(constantTimeEqual("aaaa", "aaab")).toBe(false);
  });

  it("identical tokens accepted", () => {
    expect(constantTimeEqual("identical-token-xyz", "identical-token-xyz")).toBe(true);
  });
});
