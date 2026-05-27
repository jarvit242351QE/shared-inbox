import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";

describe("crypto", () => {
  beforeAll(() => {
    process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  });

  it("round-trips encrypt/decrypt", async () => {
    const { encrypt, decrypt } = await import("../../lib/crypto");
    const enc = encrypt("hello-secret-api-key");
    expect(enc.split(".").length).toBe(3);
    expect(decrypt(enc)).toBe("hello-secret-api-key");
  });

  it("decrypt fails cleanly with a wrong key", async () => {
    const { encrypt } = await import("../../lib/crypto");
    const enc = encrypt("payload");
    process.env.APP_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    // Re-import to pick up new key
    const fresh = await import(`../../lib/crypto?bust=${Date.now()}`).catch(async () => {
      // Node ESM cache may keep module; force via dynamic require fallback
      const path = await import("node:path");
      const url = path.resolve("lib/crypto.ts");
      return await import(url + `?bust=${Date.now()}`);
    });
    expect(() => (fresh as typeof import("../../lib/crypto")).decrypt(enc)).toThrow();
  });

  it("constantTimeEqual handles length differences and equality", async () => {
    const { constantTimeEqual } = await import("../../lib/crypto");
    expect(constantTimeEqual("a", "ab")).toBe(false);
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
  });

  it("randomToken produces base64url with no padding", async () => {
    const { randomToken } = await import("../../lib/crypto");
    const t = randomToken(16);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(t.length).toBeGreaterThan(0);
  });
});
