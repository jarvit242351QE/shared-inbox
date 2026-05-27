"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "../../../../lib/cn";
import { MessageCircle, Calendar, CheckCircle2, Sparkles, Search } from "lucide-react";
import { useRealtime } from "./useRealtime";

type ConvRow = {
  id: string;
  pageId: string;
  pageName: string;
  subscriberId: string;
  igUsername: string | null;
  firstName: string | null;
  lastName: string | null;
  status: "open" | "snoozed" | "booked" | "closed";
  unreadCount: number;
  lastMessageAt: string | null;
  lastInboundAt: string | null;
  lastMessageText: string | null;
};

const STATUS_ICON: Record<ConvRow["status"], React.ComponentType<{ className?: string }>> = {
  open: MessageCircle,
  snoozed: Sparkles,
  booked: Calendar,
  closed: CheckCircle2,
};

function timeAgo(iso: string | null) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h`;
  return `${Math.floor(ms / 86_400_000)}d`;
}

export function ConversationList({ activeId }: { activeId?: string }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ConvRow[]>([]);
  const [query, setQuery] = useState("");

  async function load() {
    const res = await fetch("/api/conversations", { cache: "no-store" });
    const json = await res.json();
    if (json.ok) setRows(json.conversations as ConvRow[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  useRealtime((e) => {
    if (e.type === "message" || e.type === "message-status") void load();
  });

  const filtered = query
    ? rows.filter((r) => {
        const q = query.toLowerCase();
        return (
          r.pageName.toLowerCase().includes(q) ||
          (r.igUsername ?? "").toLowerCase().includes(q) ||
          (r.firstName ?? "").toLowerCase().includes(q) ||
          (r.lastName ?? "").toLowerCase().includes(q) ||
          (r.lastMessageText ?? "").toLowerCase().includes(q)
        );
      })
    : rows;

  return (
    <aside className="border-r border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col h-dvh">
      <div className="p-3 border-b border-[var(--color-border)] space-y-3">
        <h1 className="text-sm font-medium tracking-tight">Inbox</h1>
        <div className="relative">
          <Search className="size-4 absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="w-full pl-8 pr-2 py-1.5 text-sm rounded-md bg-[var(--color-bg)] border border-[var(--color-border)] outline-none focus:border-[var(--color-accent)]"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {loading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="boneyard h-16" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-[var(--color-text-muted)] text-center">
            No conversations yet. Configure a page in settings and trigger your ManyChat webhook.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {filtered.map((r) => {
              const Icon = STATUS_ICON[r.status];
              const isActive = activeId === r.id;
              const displayName =
                r.firstName || r.lastName
                  ? [r.firstName, r.lastName].filter(Boolean).join(" ")
                  : r.igUsername
                    ? `@${r.igUsername}`
                    : r.subscriberId;
              return (
                <li key={r.id}>
                  <Link
                    href={`/conversations/${r.id}`}
                    className={cn(
                      "block px-3 py-3 hover:bg-[var(--color-surface-2)] transition-colors",
                      isActive && "bg-[var(--color-surface-2)]"
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium text-sm truncate">{displayName}</span>
                      <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">
                        {timeAgo(r.lastMessageAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-[var(--color-text-muted)]">
                      <Icon className="size-3" />
                      <span className="truncate">{r.pageName}</span>
                    </div>
                    <div className="flex items-end justify-between gap-2 mt-1">
                      <p className="text-xs text-[var(--color-text-muted)] truncate flex-1">
                        {r.lastMessageText ?? ""}
                      </p>
                      {r.unreadCount > 0 && (
                        <span className="text-[10px] font-medium rounded-full bg-[var(--color-accent)] text-white px-1.5 py-0.5 shrink-0">
                          {r.unreadCount}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
