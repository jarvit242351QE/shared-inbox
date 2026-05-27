import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../../../../db/client";
import { automations, conversations, messages, suggestions } from "../../../../../db/schema";
import { requireOwner } from "../../../../../lib/auth";
import { getOutboundQueue, outboundGroupKey } from "../../../../../lib/queues";
import { publish } from "../../../../../lib/realtime";
import { renderTemplate } from "../../../../../lib/automation-template";

const Body = z.object({
  source: z.enum(["manual", "automation", "suggestion"]),
  text: z.string().trim().optional(),
  automationId: z.string().uuid().optional(),
  suggestionId: z.string().uuid().optional(),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await requireOwner();
  } catch {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const { id: conversationId } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }
  const { source, text, automationId, suggestionId } = parsed.data;

  const convRows = await db
    .select({
      id: conversations.id,
      pageId: conversations.pageId,
      subscriberId: conversations.subscriberId,
      firstName: conversations.firstName,
      lastName: conversations.lastName,
      igUsername: conversations.igUsername,
    })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  const conv = convRows[0];
  if (!conv) return NextResponse.json({ ok: false }, { status: 404 });

  let finalText = (text ?? "").trim();
  let resolvedAutomationId: string | null = null;
  let resolvedSuggestionId: string | null = null;

  if (source === "automation") {
    if (!automationId) return NextResponse.json({ ok: false }, { status: 400 });
    const a = await db
      .select({ id: automations.id, content: automations.content })
      .from(automations)
      .where(and(eq(automations.id, automationId), eq(automations.pageId, conv.pageId)))
      .limit(1);
    if (!a[0]) return NextResponse.json({ ok: false, error: "automation not found" }, { status: 404 });
    finalText = renderTemplate(a[0].content, {
      first_name: conv.firstName,
      last_name: conv.lastName,
      ig_username: conv.igUsername,
    }).trim();
    resolvedAutomationId = a[0].id;
  } else if (source === "suggestion") {
    if (!suggestionId) return NextResponse.json({ ok: false }, { status: 400 });
    // Optimistic claim: only one tab can accept; second gets 409.
    const claimed = await db
      .update(suggestions)
      .set({ status: "accepted", updatedAt: new Date() })
      .where(and(eq(suggestions.id, suggestionId), eq(suggestions.status, "ready")))
      .returning({ text: suggestions.text });
    if (!claimed[0]) {
      return NextResponse.json({ ok: false, error: "suggestion no longer available" }, { status: 409 });
    }
    if (text && text.trim().length) {
      finalText = text.trim();
    } else {
      finalText = (claimed[0].text ?? "").trim();
    }
    resolvedSuggestionId = suggestionId;
  } else {
    // manual
    if (!finalText) return NextResponse.json({ ok: false, error: "empty text" }, { status: 400 });
  }

  if (!finalText) {
    return NextResponse.json({ ok: false, error: "empty text" }, { status: 400 });
  }

  // Insert message in 'queued' state and clear unread count
  const now = new Date();
  const [inserted] = await db
    .insert(messages)
    .values({
      conversationId,
      direction: "out",
      sender: source === "suggestion" ? "claude" : source === "automation" ? "automation" : "setter",
      text: finalText,
      status: "queued",
      automationId: resolvedAutomationId,
      suggestionId: resolvedSuggestionId,
    })
    .returning({ id: messages.id });

  await db
    .update(conversations)
    .set({ lastMessageAt: now, unreadCount: 0 })
    .where(eq(conversations.id, conversationId));

  // Supersede any other still-ready suggestions for this conversation
  await db
    .update(suggestions)
    .set({ status: "superseded", updatedAt: new Date() })
    .where(
      and(
        eq(suggestions.conversationId, conversationId),
        eq(suggestions.status, "ready")
      )
    );

  await getOutboundQueue().add(
    "send",
    {
      messageId: inserted!.id,
      conversationId,
      pageId: conv.pageId,
      subscriberId: conv.subscriberId,
      text: finalText,
    },
    {
      // BullMQ Pro has groups; for OSS we use group key as job id prefix and rely on
      // the limiter for global per-key safety. Per-page rate is enforced upstream by
      // ManyChat anyway (10 req/s/key) and we keep limiter.max=8.
      jobId: `${outboundGroupKey(conv.pageId)}--${inserted!.id}`,
    }
  );

  await publish({ type: "message", conversationId, pageId: conv.pageId });

  return NextResponse.json({ ok: true, messageId: inserted!.id });
}
