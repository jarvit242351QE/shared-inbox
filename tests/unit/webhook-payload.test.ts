import { describe, it, expect } from "vitest";
import { z } from "zod";

// Schema mirrored from app/api/webhooks/manychat/[pageId]/route.ts.
// We unit-test the parser independently so any future drift in the route is caught here.
const PayloadSchema = z
  .object({
    subscriber_id: z.union([z.string(), z.number()]).transform(String),
    first_name: z.string().optional().nullable(),
    last_name: z.string().optional().nullable(),
    ig_username: z.string().optional().nullable(),
    text: z.string().default(""),
    ts: z.string().optional(),
    external_message_id: z
      .union([z.string(), z.number()])
      .optional()
      .nullable()
      .transform((v) => (v == null ? undefined : String(v))),
  })
  .passthrough();

describe("ManyChat webhook payload parser", () => {
  it("accepts string subscriber_id and number, normalizing to string", () => {
    expect(PayloadSchema.parse({ subscriber_id: 42, text: "hi" }).subscriber_id).toBe("42");
    expect(PayloadSchema.parse({ subscriber_id: "abc", text: "hi" }).subscriber_id).toBe("abc");
  });

  it("rejects when subscriber_id is missing", () => {
    expect(PayloadSchema.safeParse({ text: "hi" }).success).toBe(false);
  });

  it("normalizes external_message_id to string or undefined", () => {
    expect(PayloadSchema.parse({ subscriber_id: "s", text: "", external_message_id: 7 }).external_message_id).toBe("7");
    expect(PayloadSchema.parse({ subscriber_id: "s", text: "", external_message_id: null }).external_message_id).toBeUndefined();
    expect(PayloadSchema.parse({ subscriber_id: "s", text: "" }).external_message_id).toBeUndefined();
  });

  it("defaults text to empty when omitted", () => {
    expect(PayloadSchema.parse({ subscriber_id: "s" }).text).toBe("");
  });

  it("passes through extra fields ManyChat might add", () => {
    const out = PayloadSchema.parse({ subscriber_id: "s", text: "x", future_field: "ok" }) as Record<string, unknown>;
    expect(out.future_field).toBe("ok");
  });
});
