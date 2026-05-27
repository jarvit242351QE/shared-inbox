import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../../../../db/client";
import { pages } from "../../../../../db/schema";
import { constantTimeEqual } from "../../../../../lib/crypto";
import { getInboundQueue } from "../../../../../lib/queues";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PayloadSchema = z
  .object({
    subscriber_id: z.union([z.string(), z.number()]).transform(String),
    first_name: z.string().optional().nullable(),
    last_name: z.string().optional().nullable(),
    ig_username: z.string().optional().nullable(),
    text: z.string().default(""),
    ts: z.string().optional(),
    external_message_id: z.union([z.string(), z.number()]).optional().nullable().transform((v) => (v == null ? undefined : String(v))),
  })
  .passthrough();

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ pageId: string }> }
) {
  const { pageId } = await ctx.params;
  const token = req.nextUrl.searchParams.get("token") ?? "";

  // Constant-time compare: look up the page and compare its token in-memory.
  // We must accept the cost of one DB hit even on bad tokens, but we never
  // disclose whether the page exists vs. token is wrong.
  const row = await db
    .select({ id: pages.id, token: pages.webhookToken })
    .from(pages)
    .where(eq(pages.id, pageId))
    .limit(1);

  const expected = row[0]?.token ?? "";
  const ok = expected.length > 0 && constantTimeEqual(token, expected);
  if (!ok) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const parsed = PayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  await getInboundQueue().add(
    "incoming",
    { pageId, payload: parsed.data },
    {
      // Idempotency: ManyChat retries — same external_message_id should collapse at job level too.
      ...(parsed.data.external_message_id
        ? { jobId: `${pageId}--${parsed.data.external_message_id}` }
        : {}),
    }
  );

  return NextResponse.json({ ok: true });
}
