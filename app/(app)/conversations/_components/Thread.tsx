"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, AtSign, Sparkles } from "lucide-react";
import { cn } from "../../../../lib/cn";
import { Composer } from "./Composer";
import { SuggestionBanner } from "./SuggestionBanner";
import { useRealtime } from "./useRealtime";

type Conv = {
  id: string;
  pageId: string;
  pageName: string;
  igUsername: string | null;
  firstName: string | null;
  lastName: string | null;
  status: string;
  lastInboundAt: string | null;
};

type Msg = {
  id: string;
  direction: "in" | "out";
  sender: "lead" | "setter" | "automation" | "claude" | "system";
  text: string;
  status: "queued" | "sent" | "failed";
  error: string | null;
  createdAt: string;
  suggestionId: string | null;
  automationId: string | null;
};

type Automation = { id: string; name: string; content: string };
type Suggestion = {
  id: string;
  status: "pending" | "ready" | "accepted" | "rejected" | "superseded" | "error";
  text: string | null;
  error: string | null;
  triggeredByMessageId: string | null;
  updatedAt: string;
};

export function Thread({ conversationId }: { conversationId: string }) {
  const [conv, setConv] = useState<Conv | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function load(opts: { triggerSuggest?: boolean } = {}) {
    const res = await fetch(`/api/conversations/${conversationId}`, { cache: "no-store" });
    const json = await res.json();
    if (!json.ok) return;
    setConv(json.conversation);
    setMessages(json.messages);
    setAutomations(json.automations);
    setSuggestion(json.suggestion);
    setLoading(false);

    if (opts.triggerSuggest) {
      const last = (json.messages as Msg[]).filter((m) => m.direction === "in").pop();
      const existing = json.suggestion as Suggestion | null;
      if (
        last &&
        (!existing ||
          existing.triggeredByMessageId !== last.id ||
          (existing.status !== "pending" && existing.status !== "ready" && existing.status !== "accepted"))
      ) {
        await fetch(`/api/conversations/${conversationId}/suggest`, { method: "POST" });
        // load again shortly to pull pending state
      }
    }
  }

  useEffect(() => {
    setLoading(true);
    void load({ triggerSuggest: true });
  }, [conversationId]);

  useRealtime((e) => {
    if ("conversationId" in e && e.conversationId === conversationId) {
      void load();
    }
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  if (loading) {
    return (
      <section className="grid grid-rows-[auto_1fr_auto] h-dvh">
        <div className="h-14 border-b border-[var(--color-border)] p-3">
          <div className="boneyard h-6 w-40" />
        </div>
        <div className="p-4 space-y-3 overflow-hidden">
          <div className="boneyard h-12 w-1/2" />
          <div className="boneyard h-12 w-2/3 ml-auto" />
          <div className="boneyard h-12 w-2/5" />
        </div>
        <div className="border-t border-[var(--color-border)] p-3">
          <div className="boneyard h-20" />
        </div>
      </section>
    );
  }

  if (!conv) return <section className="grid place-items-center">Conversation not found.</section>;

  const displayName =
    [conv.firstName, conv.lastName].filter(Boolean).join(" ") ||
    (conv.igUsername ? `@${conv.igUsername}` : "Unknown");
  const hoursSinceInbound = conv.lastInboundAt
    ? (Date.now() - new Date(conv.lastInboundAt).getTime()) / 3_600_000
    : null;
  const windowWarning = hoursSinceInbound !== null && hoursSinceInbound > 23;

  return (
    <section className="grid grid-rows-[auto_1fr_auto] h-dvh">
      <header className="border-b border-[var(--color-border)] px-4 py-3 flex items-center gap-3">
        <div className="size-9 rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)] grid place-items-center">
          <AtSign className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{displayName}</div>
          <div className="text-xs text-[var(--color-text-muted)] truncate">
            {conv.pageName}
            {conv.igUsername ? ` · @${conv.igUsername}` : ""}
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="overflow-y-auto scrollbar-thin px-4 py-4 space-y-3">
        {windowWarning && (
          <div className="mb-2 flex items-center gap-2 text-xs rounded-md bg-[color-mix(in_oklab,var(--color-warn)_15%,transparent)] text-[var(--color-warn)] px-3 py-2 border border-[color-mix(in_oklab,var(--color-warn)_30%,transparent)]">
            <AlertTriangle className="size-4 shrink-0" />
            <span>Past 24 h since the lead's last message — replies may bounce.</span>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex flex-col gap-1 max-w-[80%]",
              m.direction === "out" ? "ml-auto items-end" : "items-start"
            )}
          >
            <div
              className={cn(
                "rounded-2xl px-3.5 py-2 text-sm leading-snug whitespace-pre-wrap break-words",
                m.direction === "out"
                  ? m.status === "failed"
                    ? "bg-[color-mix(in_oklab,var(--color-danger)_25%,var(--color-surface))]"
                    : "bg-[var(--color-accent)] text-white"
                  : "bg-[var(--color-surface-2)]"
              )}
            >
              {m.text}
            </div>
            <div className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1">
              {m.sender === "claude" && <Sparkles className="size-3 text-[var(--color-accent)]" />}
              <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              {m.direction === "out" && m.status === "queued" && <span>· sending…</span>}
              {m.direction === "out" && m.status === "failed" && (
                <span className="text-[var(--color-danger)]">· failed{m.error ? ": " + m.error : ""}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-[var(--color-border)] p-3 space-y-2 bg-[var(--color-surface)]">
        <SuggestionBanner
          conversationId={conversationId}
          suggestion={suggestion}
          onRefresh={() => load()}
        />
        <Composer
          conversationId={conversationId}
          automations={automations}
          onSent={() => load()}
        />
      </div>
    </section>
  );
}
