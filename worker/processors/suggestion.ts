import type { Job } from "bullmq";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { conversations, messages, pages, suggestions } from "../../db/schema";
import type { SuggestionJob } from "../../lib/queues";
import { generateSuggestion, type ThreadTurn } from "../../lib/anthropic";
import { publish } from "../../lib/realtime";
import { getOutboundQueue, outboundGroupKey } from "../../lib/queues";

// Auto-send a just-generated suggestion, mirroring the manual "send
// suggestion" UI action (app/api/conversations/[id]/send/route.ts): claim
// the suggestion atomically (loses the race cleanly if a human clicks send
// at the same instant), insert the outbound message row, and enqueue it on
// the same outbound queue/worker/rate-limiter every other send path uses.
async function autoSendSuggestion(args: {
  suggestionId: string;
  conversationId: string;
  pageId: string;
  subscriberId: string;
  text: string;
}): Promise<void> {
  const { suggestionId, conversationId, pageId, subscriberId, text } = args;

  const claimed = await db
    .update(suggestions)
    .set({ status: "accepted", updatedAt: new Date() })
    .where(and(eq(suggestions.id, suggestionId), eq(suggestions.status, "ready")))
    .returning({ id: suggestions.id });
  if (!claimed[0]) return;

  const now = new Date();
  const [inserted] = await db
    .insert(messages)
    .values({
      conversationId,
      direction: "out",
      sender: "claude",
      text,
      status: "queued",
      suggestionId,
    })
    .returning({ id: messages.id });

  await db
    .update(conversations)
    .set({ lastMessageAt: now, unreadCount: 0 })
    .where(eq(conversations.id, conversationId));

  await getOutboundQueue().add(
    "send",
    { messageId: inserted!.id, conversationId, pageId, subscriberId, text },
    { jobId: `${outboundGroupKey(pageId)}--${inserted!.id}` }
  );

  await publish({ type: "message", conversationId, pageId });
}

export async function processSuggestion(job: Job<SuggestionJob>): Promise<void> {
  const { conversationId, triggeredByMessageId } = job.data;

  // Use job id as suggestion natural key for idempotency on worker retry.
  const jobId = job.id ?? `${conversationId}--${triggeredByMessageId}`;

  // If this exact job already produced a suggestion (worker crash retry), bail.
  const existing = await db
    .select({ id: suggestions.id, status: suggestions.status })
    .from(suggestions)
    .where(eq(suggestions.jobId, jobId))
    .limit(1);
  if (existing[0] && existing[0].status !== "pending") return;

  // Get conversation, its page (for system prompt + model), and full thread.
  const convRow = await db
    .select({
      conversation: conversations,
      page: pages,
    })
    .from(conversations)
    .innerJoin(pages, eq(conversations.pageId, pages.id))
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (!convRow[0]) throw new Error(`conversation ${conversationId} not found`);
  const { conversation, page } = convRow[0];

  // Don't generate if a newer inbound has arrived since this job was enqueued.
  const latestInbound = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), eq(messages.direction, "in")))
    .orderBy(desc(messages.createdAt))
    .limit(1);
  if (latestInbound[0] && latestInbound[0].id !== triggeredByMessageId) {
    // Mark our row superseded if exists, else create one as superseded.
    await db
      .insert(suggestions)
      .values({
        conversationId,
        triggeredByMessageId,
        jobId,
        status: "superseded",
      })
      .onConflictDoNothing();
    return;
  }

  // Ensure a pending row exists so the UI can show "thinking..."
  const upserted = await db
    .insert(suggestions)
    .values({
      conversationId,
      triggeredByMessageId,
      jobId,
      status: "pending",
    })
    .onConflictDoUpdate({
      target: suggestions.jobId,
      set: { status: "pending", updatedAt: new Date() },
    })
    .returning({ id: suggestions.id });
  const suggestionId = upserted[0]!.id;
  await publish({ type: "suggestion", conversationId, status: "pending" });

  // Pull thread (last 30 messages is plenty for context, keeps prompt size sane)
  const rows = await db
    .select({
      direction: messages.direction,
      sender: messages.sender,
      text: messages.text,
    })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt))
    .limit(120);

  const thread: ThreadTurn[] = rows.map((m) => ({
    role: m.direction === "in" ? "user" : "assistant",
    content: m.text,
  }));

  // Anthropic requires the first turn to be a user message. If the conversation starts with us, prepend a system note.
  if (thread.length === 0 || thread[0]!.role !== "user") {
    thread.unshift({ role: "user", content: "(conversation begins)" });
  }

  // Inject lead context (name/handle) into the system prompt
  const ctxBits: string[] = [];
  if (conversation.firstName) ctxBits.push(`first name: ${conversation.firstName}`);
  if (conversation.igUsername) ctxBits.push(`ig: @${conversation.igUsername}`);
  const ctx = ctxBits.length ? `\n\n[Lead context — ${ctxBits.join(", ")}]` : "";

  try {
    const result = await generateSuggestion({
      systemPrompt: page.claudeSystemPrompt + ctx,
      thread,
      model: page.claudeModel,
    });

    // Don't overwrite if another worker / hand-action already terminalized this suggestion.
    const readyRows = await db
      .update(suggestions)
      .set({
        status: "ready",
        text: result.text,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        updatedAt: new Date(),
      })
      .where(and(eq(suggestions.id, suggestionId), eq(suggestions.status, "pending")))
      .returning({ id: suggestions.id });

    await publish({ type: "suggestion", conversationId, status: "ready" });

    // Auto-send by default (page.autoSendEnabled). Skip if the update above
    // affected no rows -- a newer inbound superseded this suggestion while
    // Claude was generating, so sending it now would reply to a stale turn.
    if (readyRows[0] && page.autoSendEnabled) {
      await autoSendSuggestion({
        suggestionId,
        conversationId,
        pageId: conversation.pageId,
        subscriberId: conversation.subscriberId,
        text: result.text,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(suggestions)
      .set({ status: "error", error: message, updatedAt: new Date() })
      .where(eq(suggestions.id, suggestionId));
    await publish({ type: "suggestion", conversationId, status: "error" });
    throw err; // let BullMQ retry per its policy
  }
}
