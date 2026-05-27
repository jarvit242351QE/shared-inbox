#!/usr/bin/env tsx
/**
 * Synthetic load test. Pumps webhook payloads to the local app.
 * Usage:
 *   pnpm tsx scripts/loadtest.ts --pages 3 --leads 1000 --rate 17
 *
 * Requires the app to be running on APP_URL (default http://localhost:3000)
 * and at least one page configured. Reads pages from /api/pages but that
 * needs a session cookie — instead, expects pageId+token pairs in PAGE_HOOKS env:
 *   PAGE_HOOKS="<pageId>:<token>,<pageId>:<token>"
 */

const args = process.argv.slice(2);
function arg(name: string, def: string) {
  const i = args.indexOf("--" + name);
  return i >= 0 ? (args[i + 1] ?? def) : def;
}

const appUrl = process.env.APP_URL ?? "http://localhost:3000";
const leads = parseInt(arg("leads", "1000"), 10);
const rate = parseInt(arg("rate", "17"), 10); // per second

const hooks = (process.env.PAGE_HOOKS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map((p) => {
    const [id, token] = p.split(":");
    return { id: id!, token: token! };
  });

if (hooks.length === 0) {
  console.error(
    "Set PAGE_HOOKS env to a comma-separated list of <pageId>:<token> pairs (from the settings page)."
  );
  process.exit(1);
}

console.log(`load test: ${leads} leads @ ${rate}/s across ${hooks.length} pages`);

let sent = 0;
let failed = 0;
let p50: number[] = [];
const start = Date.now();

async function once(i: number) {
  const hook = hooks[i % hooks.length]!;
  const url = `${appUrl}/api/webhooks/manychat/${hook.id}?token=${hook.token}`;
  const payload = {
    subscriber_id: `loadtest-${1000 + (i % 200)}`,
    first_name: `Load${i}`,
    ig_username: `lt_${i}`,
    text: `Synthetic lead message #${i} — ${Math.random().toString(36).slice(2)}`,
    external_message_id: `lt-${i}-${Date.now()}`,
  };
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) failed++;
    else sent++;
    p50.push(Date.now() - t0);
  } catch {
    failed++;
  }
}

const interval = 1000 / rate;
let i = 0;
const timer = setInterval(() => {
  if (i >= leads) {
    clearInterval(timer);
    setTimeout(() => {
      const dur = (Date.now() - start) / 1000;
      p50.sort((a, b) => a - b);
      const median = p50[Math.floor(p50.length / 2)] ?? 0;
      const p95 = p50[Math.floor(p50.length * 0.95)] ?? 0;
      console.log(
        `done in ${dur.toFixed(1)}s — sent=${sent} failed=${failed} p50=${median}ms p95=${p95}ms`
      );
    }, 500);
    return;
  }
  void once(i++);
}, interval);
