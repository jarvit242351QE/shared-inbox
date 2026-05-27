import type { Job } from "bullmq";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { conversations, messages, suggestions } from "../../db/schema";
import type { InboundJob } from "../../lib/queues";
import { publish } from "../../lib/realtime";

export async function processInbound(job: Job<InboundJob>): Promise<{ messageId: string }> {
  const { pageId, payload } = job.data;
  const subscriberId = String(payload.subscriber_id);
  const text = (payload.text ?? "").toString();
  const externalId = payload.external_message_id?.toString() || null;
  const now = new Date();

  // Upsert conversation by (page_id, subscriber_id)
  const conv = await db
    .insert(conversations)
    .values({
      pageId,
      subscriberId,
      igUsername: payload.ig_username ?? null,
      firstName: payload.first_name ?? null,
      lastName: payload.last_name ?? null,
      lastInboundAt: now,
      lastMessageAt: now,
      unreadCount: 1,
      status: "open",
    })
    .onConflictDoUpdate({
      target: [conversations.pageId, conversations.subscriberId],
      set: {
        igUsername: sql`COALESCE(EXCLUDED.ig_username, ${conversations.igUsername})`,
        firstName: sql`COALESCE(EXCLUDED.first_name, ${conversations.firstName})`,
        lastName: sql`COALESCE(EXCLUDED.last_name, ${conversations.lastName})`,
        lastInboundAt: now,
        lastMessageAt: now,
        unreadCount: sql`${conversations.unreadCount} + 1`,
        status: sql`CASE WHEN ${conversations.status} = 'closed' THEN 'open'::conversation_status ELSE ${conversations.status} END`,
      },
    })
    .returning({ id: conversations.id });

  const conversationId = conv[0]!.id;

  // Insert message — idempotent via the partial unique index on (conversation_id, external_message_id).
  const inserted = await db
    .insert(messages)
    .values({
      conversationId,
      direction: "in",
      sender: "lead",
      text,
      externalMessageId: externalId,
      status: "sent",
    })
    .onConflictDoNothing()
    .returning({ id: messages.id });

  if (inserted.length === 0) {
    // Duplicate webhook delivery (ManyChat retry). No-op.
    return { messageId: "duplicate" };
  }

  // Supersede any pending/ready suggestion for this conversation — a fresher message arrived.
  await db
    .update(suggestions)
    .set({ status: "superseded", updatedAt: new Date() })
    .where(
      and(
        eq(suggestions.conversationId, conversationId),
        sql`${suggestions.status} IN ('pending', 'ready')`
      )
    );

  await publish({ type: "message", conversationId, pageId });

  return { messageId: inserted[0]!.id };
}
