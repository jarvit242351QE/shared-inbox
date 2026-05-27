"use client";

import { useState } from "react";
import { ChevronDown, Send, Wand2 } from "lucide-react";

type Automation = { id: string; name: string; content: string };

export function Composer({
  conversationId,
  automations,
  onSent,
}: {
  conversationId: string;
  automations: Automation[];
  onSent: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [showAutos, setShowAutos] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "send failed");
        return;
      }
      setText("");
      onSent();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      {error && <div className="text-xs text-[var(--color-danger)]">{error}</div>}
      <div className="flex items-end gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              if (text.trim()) void send({ source: "manual", text: text.trim() });
            }
          }}
          rows={2}
          placeholder="Type a reply… (⌘/Ctrl + Enter to send)"
          className="flex-1 resize-none bg-transparent outline-none text-sm py-1 px-1 min-h-[40px] max-h-40"
        />
        <div className="flex items-center gap-1">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAutos((v) => !v)}
              disabled={automations.length === 0 || busy}
              title={automations.length === 0 ? "No automations on this page" : "Insert automation"}
              className="size-9 grid place-items-center rounded-md hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
            >
              <Wand2 className="size-4" />
            </button>
            {showAutos && automations.length > 0 && (
              <div className="absolute bottom-11 right-0 z-10 w-72 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] shadow-xl overflow-hidden">
                <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] border-b border-[var(--color-border)] flex items-center justify-between">
                  <span>Automations</span>
                  <ChevronDown className="size-3" />
                </div>
                <ul className="max-h-72 overflow-y-auto scrollbar-thin">
                  {automations.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAutos(false);
                          void send({ source: "automation", automationId: a.id });
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-[var(--color-bg)]"
                      >
                        <div className="text-sm">{a.name}</div>
                        <div className="text-xs text-[var(--color-text-muted)] line-clamp-2">
                          {a.content}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <button
            type="button"
            disabled={!text.trim() || busy}
            onClick={() => void send({ source: "manual", text: text.trim() })}
            className="size-9 grid place-items-center rounded-md bg-[var(--color-accent)] text-white hover:opacity-90"
            title="Send (⌘/Ctrl + Enter)"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
