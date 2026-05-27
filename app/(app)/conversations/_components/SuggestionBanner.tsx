"use client";

import { useEffect, useState } from "react";
import { Check, Pencil, RefreshCw, Sparkles, X } from "lucide-react";

type Suggestion = {
  id: string;
  status: "pending" | "ready" | "accepted" | "rejected" | "superseded" | "error";
  text: string | null;
  error: string | null;
  triggeredByMessageId: string | null;
  updatedAt: string;
};

export function SuggestionBanner({
  conversationId,
  suggestion,
  onRefresh,
}: {
  conversationId: string;
  suggestion: Suggestion | null;
  onRefresh: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setEditing(false);
    setDraft(suggestion?.text ?? "");
  }, [suggestion?.id, suggestion?.text]);

  async function regenerate() {
    setBusy(true);
    try {
      await fetch(`/api/conversations/${conversationId}/suggest`, { method: "POST" });
      onRefresh();
    } finally {
      setBusy(false);
    }
  }

  async function send(text: string) {
    if (!suggestion) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "suggestion",
          suggestionId: suggestion.id,
          text: text !== suggestion.text ? text : undefined,
        }),
      });
      if (!res.ok) {
        // 409 — fetch fresh state
        onRefresh();
        return;
      }
      onRefresh();
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!suggestion) return;
    setBusy(true);
    try {
      await fetch(`/api/conversations/${conversationId}/suggest`, { method: "DELETE" }).catch(() => {});
      // mark in DB by hitting suggest again only after rejection? simplest: just refresh
      onRefresh();
    } finally {
      setBusy(false);
    }
  }

  if (!suggestion) return null;

  if (suggestion.status === "pending") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs">
        <Sparkles className="size-4 text-[var(--color-accent)] animate-pulse" />
        <span className="text-[var(--color-text-muted)]">Claude is drafting a reply…</span>
      </div>
    );
  }

  if (suggestion.status === "error") {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-danger)_10%,var(--color-surface-2))] px-3 py-2 text-xs">
        <span className="text-[var(--color-danger)]">
          Suggestion failed{suggestion.error ? `: ${suggestion.error}` : ""}
        </span>
        <button
          type="button"
          onClick={regenerate}
          disabled={busy}
          className="flex items-center gap-1 hover:underline"
        >
          <RefreshCw className="size-3" /> Retry
        </button>
      </div>
    );
  }

  if (suggestion.status !== "ready") return null;

  return (
    <div className="rounded-lg border border-[var(--color-accent-soft)] bg-[color-mix(in_oklab,var(--color-accent)_8%,var(--color-surface-2))] p-2.5 space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[var(--color-accent)]">
        <Sparkles className="size-3" />
        <span>Suggested reply</span>
      </div>
      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          className="w-full bg-[var(--color-bg)] rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
        />
      ) : (
        <p className="text-sm leading-snug whitespace-pre-wrap">{suggestion.text}</p>
      )}
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => send(editing ? draft : suggestion.text ?? "")}
          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-[var(--color-accent)] text-white hover:opacity-90"
        >
          <Check className="size-3.5" /> {editing ? "Send edited" : "Accept & send"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setEditing((v) => !v)}
          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md hover:bg-[var(--color-surface-2)]"
        >
          <Pencil className="size-3.5" /> {editing ? "Cancel" : "Edit"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={regenerate}
          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
        >
          <RefreshCw className="size-3.5" /> Regenerate
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={reject}
          className="ml-auto flex items-center gap-1 text-xs px-2.5 py-1 rounded-md hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
        >
          <X className="size-3.5" /> Dismiss
        </button>
      </div>
    </div>
  );
}
