import { NextResponse, type NextRequest } from "next/server";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../../../../db/client";
import { automations } from "../../../../../db/schema";
import { requireOwner } from "../../../../../lib/auth";

const Body = z.object({
  name: z.string().min(1).max(120),
  content: z.string().min(1).max(4000),
});

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try { await requireOwner(); } catch { return NextResponse.json({ ok: false }, { status: 401 }); }
  const { id } = await ctx.params;
  const rows = await db
    .select({
      id: automations.id,
      name: automations.name,
      content: automations.content,
      sortOrder: automations.sortOrder,
    })
    .from(automations)
    .where(and(eq(automations.pageId, id), sql`${automations.archivedAt} IS NULL`))
    .orderBy(asc(automations.sortOrder));
  return NextResponse.json({ ok: true, automations: rows });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try { await requireOwner(); } catch { return NextResponse.json({ ok: false }, { status: 401 }); }
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  // Append to end
  const max = await db
    .select({ v: sql<number>`COALESCE(MAX(${automations.sortOrder}), -1)` })
    .from(automations)
    .where(eq(automations.pageId, id));
  const [row] = await db
    .insert(automations)
    .values({
      pageId: id,
      name: parsed.data.name,
      content: parsed.data.content,
      sortOrder: (max[0]?.v ?? -1) + 1,
    })
    .returning({ id: automations.id });
  return NextResponse.json({ ok: true, id: row!.id });
}
