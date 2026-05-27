import { NextResponse, type NextRequest } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../../../../db/client";
import { conversations, messages, suggestions } from "../../../../../db/schema";
import { requireOwner } from "../../../../../lib/auth";
import { getSuggestionQueue } from "../../../../../lib/queues";
import { publish } from "../../../../../lib/realtime";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await requireOwner();
  } catch {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const { id: conversationId } = await ctx.params;

  const conv = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!conv[0]) return NextResponse.json({ ok: false }, { status: 404 });

  // Find latest inbound (lead) message — that's what we want to respond to.
  const lastInbound = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), eq(messages.direction, "in")))
    .orderBy(desc(messages.createdAt))
    .limit(1);

  if (!lastInbound[0]) {
    return NextResponse.json({ ok: false, error: "no inbound to reply to" }, { status: 400 });
  }
  const triggeredByMessageId = lastInbound[0].id;

  // Don't enqueue if a pending/ready suggestion already exists for this trigger.
  const existing = await db
    .select({ status: suggestions.status })
    .from(suggestions)
    .where(
      and(
        eq(suggestions.conversationId, conversationId),
        eq(suggestions.triggeredByMessageId, triggeredByMessageId),
        sql`${suggestions.status} IN ('pending', 'ready')`
      )
    )
    .limit(1);
  if (existing[0]) {
    return NextResponse.json({ ok: true, status: existing[0].status });
  }

  await getSuggestionQueue().add(
    "suggest",
    { conversationId, triggeredByMessageId },
    {
      // Stable id keeps idempotency across worker retries
      jobId: `${conversationId}--${triggeredByMessageId}`,
    }
  );

  return NextResponse.json({ ok: true, status: "queued" });
}

// DELETE: rejects the latest pending/ready suggestion (the "Dismiss" button).
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await requireOwner();
  } catch {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const { id: conversationId } = await ctx.params;
  await db
    .update(suggestions)
    .set({ status: "rejected", updatedAt: new Date() })
    .where(
      and(
        eq(suggestions.conversationId, conversationId),
        sql`${suggestions.status} IN ('pending', 'ready')`
      )
    );
  await publish({ type: "suggestion", conversationId, status: "rejected" });
  return NextResponse.json({ ok: true });
}
