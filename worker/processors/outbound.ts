import type { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { messages, pages } from "../../db/schema";
import type { OutboundJob } from "../../lib/queues";
import { decrypt } from "../../lib/crypto";
import { sendText } from "../../lib/manychat";
import { publish } from "../../lib/realtime";

export async function processOutbound(job: Job<OutboundJob>): Promise<void> {
  const { messageId, conversationId, pageId, subscriberId, text } = job.data;

  const page = await db
    .select({
      key: pages.manychatApiKeyEncrypted,
    })
    .from(pages)
    .where(eq(pages.id, pageId))
    .limit(1);

  if (!page[0]) {
    await db
      .update(messages)
      .set({ status: "failed", error: "page not found" })
      .where(eq(messages.id, messageId));
    await publish({
      type: "message-status",
      conversationId,
      messageId,
      status: "failed",
    });
    return;
  }

  const apiKey = decrypt(page[0].key);
  const result = await sendText(apiKey, subscriberId, text);

  if (result.ok) {
    await db
      .update(messages)
      .set({ status: "sent", error: null })
      .where(eq(messages.id, messageId));
    await publish({
      type: "message-status",
      conversationId,
      messageId,
      status: "sent",
    });
    return;
  }

  // Non-retryable → mark failed, surface to UI, swallow the error so BullMQ doesn't retry.
  if (!result.retryable) {
    await db
      .update(messages)
      .set({ status: "failed", error: `${result.code} ${result.status}: ${result.message}` })
      .where(eq(messages.id, messageId));
    await publish({
      type: "message-status",
      conversationId,
      messageId,
      status: "failed",
    });
    return;
  }

  // Retryable — throw so BullMQ backs off and retries.
  throw new Error(`manychat retryable error ${result.code} ${result.status}: ${result.message}`);
}
