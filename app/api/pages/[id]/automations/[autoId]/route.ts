import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../../../../../db/client";
import { automations } from "../../../../../../db/schema";
import { requireOwner } from "../../../../../../lib/auth";

const Patch = z.object({
  name: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; autoId: string }> }
) {
  try { await requireOwner(); } catch { return NextResponse.json({ ok: false }, { status: 401 }); }
  const { id, autoId } = await ctx.params;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.content !== undefined) patch.content = parsed.data.content;
  if (parsed.data.sortOrder !== undefined) patch.sortOrder = parsed.data.sortOrder;
  await db
    .update(automations)
    .set(patch)
    .where(and(eq(automations.id, autoId), eq(automations.pageId, id)));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; autoId: string }> }
) {
  try { await requireOwner(); } catch { return NextResponse.json({ ok: false }, { status: 401 }); }
  const { id, autoId } = await ctx.params;
  await db
    .update(automations)
    .set({ archivedAt: new Date() })
    .where(and(eq(automations.id, autoId), eq(automations.pageId, id)));
  return NextResponse.json({ ok: true });
}
