"use client";

import { useEffect, useState } from "react";
import { Save, Trash2, Plus, GripVertical } from "lucide-react";

type Page = {
  id: string;
  name: string;
  webhookToken: string;
  claudeSystemPrompt: string;
  claudeModel: string;
};

type Automation = { id: string; name: string; content: string; sortOrder: number };

export function PageEditor({ pageId }: { pageId: string }) {
  const [page, setPage] = useState<Page | null>(null);
  const [autos, setAutos] = useState<Automation[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function load() {
    const [p, a] = await Promise.all([
      fetch(`/api/pages/${pageId}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/pages/${pageId}/automations`, { cache: "no-store" }).then((r) => r.json()),
    ]);
    if (p.ok) setPage(p.page);
    if (a.ok) setAutos(a.automations);
  }

  useEffect(() => {
    void load();
  }, [pageId]);

  async function savePage() {
    if (!page) return;
    setSaving(true);
    await fetch(`/api/pages/${pageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: page.name,
        claudeSystemPrompt: page.claudeSystemPrompt,
        claudeModel: page.claudeModel,
      }),
    });
    setSaving(false);
    setSavedAt(Date.now());
  }

  async function deletePage() {
    if (!confirm("Delete this page and all its conversations? This cannot be undone.")) return;
    await fetch(`/api/pages/${pageId}`, { method: "DELETE" });
    location.href = "/settings/pages";
  }

  async function addAuto() {
    const name = prompt("Automation name?");
    if (!name) return;
    const content = prompt("Message content? Variables: {{first_name}}, {{ig_username}}");
    if (!content) return;
    await fetch(`/api/pages/${pageId}/automations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, content }),
    });
    await load();
  }

  async function updateAuto(a: Automation) {
    await fetch(`/api/pages/${pageId}/automations/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: a.name, content: a.content }),
    });
  }

  async function deleteAuto(id: string) {
    if (!confirm("Delete this automation?")) return;
    await fetch(`/api/pages/${pageId}/automations/${id}`, { method: "DELETE" });
    await load();
  }

  async function reorder(idx: number, dir: -1 | 1) {
    if (!autos) return;
    const j = idx + dir;
    if (j < 0 || j >= autos.length) return;
    const next = [...autos];
    [next[idx], next[j]] = [next[j]!, next[idx]!];
    setAutos(next);
    await Promise.all(
      next.map((a, i) =>
        fetch(`/api/pages/${pageId}/automations/${a.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sortOrder: i }),
        })
      )
    );
  }

  if (!page) {
    return (
      <div className="space-y-3">
        <div className="boneyard h-8 w-48" />
        <div className="boneyard h-40" />
        <div className="boneyard h-40" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
        <h2 className="font-medium">Page</h2>
        <label className="block text-sm space-y-1">
          <span className="text-[var(--color-text-muted)]">Name</span>
          <input
            value={page.name}
            onChange={(e) => setPage({ ...page, name: e.target.value })}
            className="w-full rounded-md bg-[var(--color-bg)] border border-[var(--color-border)] px-2 py-1.5"
          />
        </label>
        <label className="block text-sm space-y-1">
          <span className="text-[var(--color-text-muted)]">Claude model</span>
          <input
            value={page.claudeModel}
            onChange={(e) => setPage({ ...page, claudeModel: e.target.value })}
            className="w-full rounded-md bg-[var(--color-bg)] border border-[var(--color-border)] px-2 py-1.5 font-mono text-xs"
          />
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={savePage}
            disabled={saving}
            className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-md bg-[var(--color-accent)] text-white hover:opacity-90"
          >
            <Save className="size-3.5" /> Save
          </button>
          {savedAt && (
            <span className="text-xs text-[var(--color-text-muted)]">
              Saved {new Date(savedAt).toLocaleTimeString()}
            </span>
          )}
          <button
            type="button"
            onClick={deletePage}
            className="ml-auto flex items-center gap-1 text-sm px-3 py-1.5 rounded-md text-[var(--color-danger)] hover:bg-[color-mix(in_oklab,var(--color-danger)_15%,transparent)]"
          >
            <Trash2 className="size-3.5" /> Delete page
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
        <h2 className="font-medium">Claude suggestion instructions</h2>
        <p className="text-xs text-[var(--color-text-muted)]">
          This system prompt is sent with every suggestion request for this page. Write it as if
          briefing a junior setter — tone, target action (book a call?), format constraints.
        </p>
        <textarea
          value={page.claudeSystemPrompt}
          onChange={(e) => setPage({ ...page, claudeSystemPrompt: e.target.value })}
          rows={10}
          className="w-full rounded-md bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-2 text-sm font-mono leading-relaxed"
        />
        <button
          type="button"
          onClick={savePage}
          disabled={saving}
          className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-md bg-[var(--color-accent)] text-white hover:opacity-90"
        >
          <Save className="size-3.5" /> Save prompt
        </button>
      </section>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-medium">Automations</h2>
            <p className="text-xs text-[var(--color-text-muted)]">
              Pre-written reply templates the setter can send with one click. Supports{" "}
              <code>{"{{first_name}}"}</code> and <code>{"{{ig_username}}"}</code>.
            </p>
          </div>
          <button
            type="button"
            onClick={addAuto}
            className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-md bg-[var(--color-accent)] text-white hover:opacity-90"
          >
            <Plus className="size-3.5" /> New
          </button>
        </div>
        {autos === null ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="boneyard h-16" />
            ))}
          </div>
        ) : autos.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] py-6 text-center">
            No automations yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {autos.map((a, i) => (
              <li key={a.id} className="rounded-lg border border-[var(--color-border)] p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col text-[var(--color-text-muted)]">
                    <button
                      type="button"
                      onClick={() => void reorder(i, -1)}
                      className="text-[10px]"
                    >
                      ▲
                    </button>
                    <GripVertical className="size-3" />
                    <button
                      type="button"
                      onClick={() => void reorder(i, 1)}
                      className="text-[10px]"
                    >
                      ▼
                    </button>
                  </div>
                  <input
                    value={a.name}
                    onChange={(e) => {
                      const next = [...autos];
                      next[i] = { ...a, name: e.target.value };
                      setAutos(next);
                    }}
                    onBlur={() => void updateAuto(autos[i]!)}
                    className="flex-1 rounded-md bg-[var(--color-bg)] border border-[var(--color-border)] px-2 py-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void deleteAuto(a.id)}
                    className="size-8 grid place-items-center rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[color-mix(in_oklab,var(--color-danger)_15%,transparent)]"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <textarea
                  value={a.content}
                  onChange={(e) => {
                    const next = [...autos];
                    next[i] = { ...a, content: e.target.value };
                    setAutos(next);
                  }}
                  onBlur={() => void updateAuto(autos[i]!)}
                  rows={3}
                  className="w-full rounded-md bg-[var(--color-bg)] border border-[var(--color-border)] px-2 py-1.5 text-sm"
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
