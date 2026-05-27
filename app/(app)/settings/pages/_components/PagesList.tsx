"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Plus, ExternalLink } from "lucide-react";

type Page = {
  id: string;
  name: string;
  webhookToken: string;
  createdAt: string;
};

export function PagesList() {
  const [pages, setPages] = useState<Page[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [appUrl, setAppUrl] = useState("");

  async function load() {
    const res = await fetch("/api/pages", { cache: "no-store" });
    const json = await res.json();
    setPages(json.ok ? json.pages : []);
  }

  useEffect(() => {
    setAppUrl(window.location.origin);
    void load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, apiKey }),
    });
    const json = await res.json();
    if (!json.ok) {
      setError(json.error ?? "create failed");
      return;
    }
    setName("");
    setApiKey("");
    setAdding(false);
    await load();
  }

  function webhookUrl(p: Page) {
    return `${appUrl}/api/webhooks/manychat/${p.id}?token=${p.webhookToken}`;
  }

  return (
    <div className="space-y-4">
      {!adding ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 text-sm px-3 py-2 rounded-md bg-[var(--color-accent)] text-white hover:opacity-90"
        >
          <Plus className="size-4" /> Add page
        </button>
      ) : (
        <form
          onSubmit={create}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3"
        >
          <h2 className="font-medium">New page</h2>
          <label className="block text-sm space-y-1">
            <span className="text-[var(--color-text-muted)]">Page name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-md bg-[var(--color-bg)] border border-[var(--color-border)] px-2 py-1.5 outline-none focus:border-[var(--color-accent)]"
            />
          </label>
          <label className="block text-sm space-y-1">
            <span className="text-[var(--color-text-muted)]">ManyChat API key</span>
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              type="password"
              required
              className="w-full rounded-md bg-[var(--color-bg)] border border-[var(--color-border)] px-2 py-1.5 outline-none focus:border-[var(--color-accent)] font-mono"
            />
            <span className="text-xs text-[var(--color-text-muted)]">
              ManyChat → Settings → API → Generate. Encrypted at rest with AES-256-GCM.
            </span>
          </label>
          {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="text-sm px-3 py-1.5 rounded-md bg-[var(--color-accent)] text-white hover:opacity-90"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="text-sm px-3 py-1.5 rounded-md hover:bg-[var(--color-surface-2)]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {pages === null ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="boneyard h-20" />
          ))}
        </div>
      ) : pages.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] py-12 text-center">
          No pages yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {pages.map((p) => {
            const url = webhookUrl(p);
            return (
              <li
                key={p.id}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={`/settings/pages/${p.id}`}
                    className="font-medium hover:underline flex items-center gap-1"
                  >
                    {p.name}
                    <ExternalLink className="size-3.5 text-[var(--color-text-muted)]" />
                  </Link>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-md bg-[var(--color-bg)] border border-[var(--color-border)] px-2 py-1.5">
                  <code className="text-xs flex-1 overflow-x-auto scrollbar-thin whitespace-nowrap">
                    {url}
                  </code>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(url)}
                    className="size-7 grid place-items-center rounded hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
                    title="Copy"
                  >
                    <Copy className="size-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
