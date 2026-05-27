import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../../../db/client";
import { pages } from "../../../../db/schema";
import { requireOwner } from "../../../../lib/auth";
import { encrypt } from "../../../../lib/crypto";

const Patch = z.object({
  name: z.string().min(1).optional(),
  apiKey: z.string().min(10).optional(),
  claudeSystemPrompt: z.string().optional(),
  claudeModel: z.string().optional(),
});

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try { await requireOwner(); } catch { return NextResponse.json({ ok: false }, { status: 401 }); }
  const { id } = await ctx.params;
  const rows = await db
    .select({
      id: pages.id,
      name: pages.name,
      webhookToken: pages.webhookToken,
      claudeSystemPrompt: pages.claudeSystemPrompt,
      claudeModel: pages.claudeModel,
    })
    .from(pages)
    .where(eq(pages.id, id))
    .limit(1);
  if (!rows[0]) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true, page: rows[0] });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try { await requireOwner(); } catch { return NextResponse.json({ ok: false }, { status: 401 }); }
  const { id } = await ctx.params;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.apiKey !== undefined) patch.manychatApiKeyEncrypted = encrypt(parsed.data.apiKey);
  if (parsed.data.claudeSystemPrompt !== undefined) patch.claudeSystemPrompt = parsed.data.claudeSystemPrompt;
  if (parsed.data.claudeModel !== undefined) patch.claudeModel = parsed.data.claudeModel;
  await db.update(pages).set(patch).where(eq(pages.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try { await requireOwner(); } catch { return NextResponse.json({ ok: false }, { status: 401 }); }
  const { id } = await ctx.params;
  await db.delete(pages).where(eq(pages.id, id));
  return NextResponse.json({ ok: true });
}
