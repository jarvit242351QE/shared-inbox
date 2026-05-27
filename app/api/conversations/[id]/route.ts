import { NextResponse, type NextRequest } from "next/server";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../../../../db/client";
import { automations, conversations, messages, pages, suggestions } from "../../../../db/schema";
import { requireOwner } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireOwner();
  } catch {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const { id } = await ctx.params;

  const conv = await db
    .select({
      id: conversations.id,
      pageId: conversations.pageId,
      pageName: pages.name,
      subscriberId: conversations.subscriberId,
      igUsername: conversations.igUsername,
      firstName: conversations.firstName,
      lastName: conversations.lastName,
      status: conversations.status,
      lastInboundAt: conversations.lastInboundAt,
      lastMessageAt: conversations.lastMessageAt,
    })
    .from(conversations)
    .innerJoin(pages, eq(conversations.pageId, pages.id))
    .where(eq(conversations.id, id))
    .limit(1);
  if (!conv[0]) return NextResponse.json({ ok: false }, { status: 404 });

  // Reset unread count on open
  await db.update(conversations).set({ unreadCount: 0 }).where(eq(conversations.id, id));

  const msgs = await db
    .select({
      id: messages.id,
      direction: messages.direction,
      sender: messages.sender,
      text: messages.text,
      status: messages.status,
      error: messages.error,
      createdAt: messages.createdAt,
      suggestionId: messages.suggestionId,
      automationId: messages.automationId,
    })
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt))
    .limit(500);

  const autos = await db
    .select({ id: automations.id, name: automations.name, content: automations.content })
    .from(automations)
    .where(and(eq(automations.pageId, conv[0].pageId), sql`${automations.archivedAt} IS NULL`))
    .orderBy(asc(automations.sortOrder));

  const latestSuggestion = await db
    .select({
      id: suggestions.id,
      status: suggestions.status,
      text: suggestions.text,
      error: suggestions.error,
      triggeredByMessageId: suggestions.triggeredByMessageId,
      updatedAt: suggestions.updatedAt,
    })
    .from(suggestions)
    .where(eq(suggestions.conversationId, id))
    .orderBy(desc(suggestions.updatedAt))
    .limit(1);

  return NextResponse.json({
    ok: true,
    conversation: conv[0],
    messages: msgs,
    automations: autos,
    suggestion: latestSuggestion[0] ?? null,
  });
}
