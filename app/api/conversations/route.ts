import { NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "../../../db/client";
import { conversations, pages } from "../../../db/schema";
import { requireOwner } from "../../../lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireOwner();
  } catch {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const rows = await db
    .select({
      id: conversations.id,
      pageId: conversations.pageId,
      pageName: pages.name,
      subscriberId: conversations.subscriberId,
      igUsername: conversations.igUsername,
      firstName: conversations.firstName,
      lastName: conversations.lastName,
      status: conversations.status,
      unreadCount: conversations.unreadCount,
      lastMessageAt: conversations.lastMessageAt,
      lastInboundAt: conversations.lastInboundAt,
      lastMessageText: sql<string | null>`(
        SELECT m.text FROM messages m
        WHERE m.conversation_id = ${conversations.id}
        ORDER BY m.created_at DESC
        LIMIT 1
      )`,
    })
    .from(conversations)
    .innerJoin(pages, eq(conversations.pageId, pages.id))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(200);

  return NextResponse.json({ ok: true, conversations: rows });
}
