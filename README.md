# Shared Inbox — Multi-Page ManyChat Setter Console

One inbox across many Instagram pages (added dynamically via ManyChat API keys), with per-page automations (text templates) and Claude-suggested replies the setter can accept, edit, or reject. Built on Next.js + Postgres + Redis + BullMQ workers, designed to handle ~1000 leads/hour sustained.

---

## Quick start (local dev)

Prereqs: Docker, Node 24, pnpm.

```bash
# 1. Postgres + Redis
docker compose up -d postgres redis

# 2. .env
cp .env.example .env
# Generate APP_ENCRYPTION_KEY:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# Paste into APP_ENCRYPTION_KEY=... in .env
# Set OWNER_EMAIL=you@example.com (only this address can sign in)
# Set ANTHROPIC_API_KEY=sk-ant-...
# (optional) RESEND_API_KEY=re_... — otherwise magic links print to the dev-server log

# 3. install + migrate
pnpm install
pnpm db:migrate

# 4. run the two processes (in separate terminals)
pnpm dev          # Next.js on http://localhost:3100
pnpm worker:dev   # BullMQ workers
```

Open `http://localhost:3100`, sign in with `OWNER_EMAIL`, follow the magic link, then go to **Settings → Pages**.

---

## Configuring a ManyChat page

1. In Shared Inbox: **Settings → Pages → Add page**. Paste your ManyChat page API key (Settings → API → Generate) and a friendly name. You'll get back a webhook URL.
2. In ManyChat, build an automation that runs on the events you care about (DM reply, comment-to-DM, etc.). At the end, add a **Dev Tools → External Request** action:
   - URL: the webhook URL from step 1.
   - Method: `POST`
   - Headers: `Content-Type: application/json`
   - Body:
     ```json
     {
       "subscriber_id": "{{contact.id}}",
       "first_name": "{{first_name}}",
       "last_name": "{{last_name}}",
       "ig_username": "{{ig_username}}",
       "text": "{{last_input_text}}",
       "external_message_id": "{{last_input_id}}"
     }
     ```
3. Trigger the automation once (DM yourself). The conversation appears in `/conversations` within ~200 ms via SSE.

The `token` query parameter is the per-page secret — keep the URL private. Posts with a wrong token are rejected 401 in constant time.

---

## Architecture

```
ManyChat → POST /api/webhooks/manychat/:pageId?token=…
            │
            ▼
   Next.js (web)  ── enqueue ──▶ Redis ── BullMQ
            ▲                       │
            │ SSE                   ▼
            │                Worker container
            │                ├─ inbound   (32 concurrent)  → write message, supersede stale suggestions
            │                ├─ suggestion (8 concurrent) → call Claude with page system prompt + thread
            │                └─ outbound  (16 concurrent, 8 req/s) → POST /fb/sending/sendContent
            │                       │
            └─── Redis pub/sub ◀────┘
```

- **Web** never blocks on ManyChat or Anthropic — it only writes to queues and reads from Postgres.
- **Workers** scale horizontally: `docker compose up --scale worker=4`.
- **Idempotency** is enforced twice: (a) BullMQ jobId set to `pageId--externalMessageId` for queue-level dedupe, (b) Postgres partial unique index on `(conversation_id, external_message_id)` for storage-level dedupe.
- **Per-page rate limit**: outbound worker is globally capped at 8 req/s — well under ManyChat's ~10 req/s/key — and BullMQ retries 5xx/429/network with exponential backoff (3 attempts).
- **24h window**: surfaced in the UI as a warning when `now - last_inbound_at > 23h`. ManyChat 4xx responses (window expired, bad tag) are non-retryable and marked `failed` on the message row so the setter sees the error.
- **Race conditions** (covered by unit tests in `tests/unit/race-conditions.test.ts`):
  - Inbound message supersedes any pending/ready suggestion before it can be sent.
  - Two tabs accepting the same suggestion: only one wins (`UPDATE ... WHERE status='ready'`).
  - Worker crash mid-Claude: re-runs with same `jobId`; old `suggestions` row is reused, not duplicated.

---

## Project structure

```
app/
  (app)/                    authenticated routes
    conversations/          inbox UI (list + thread + composer + suggestion banner)
    settings/pages/         pages CRUD + Claude system prompt + automations
  api/
    auth/{signin,verify,signout}/
    conversations/[id]/{send,suggest,route}
    pages/[id]/automations/[autoId]
    sse/                    realtime push (Redis pub/sub → text/event-stream)
    webhooks/manychat/[pageId]/
db/
  schema.ts                 Drizzle: pages, conversations, messages, automations, suggestions, sessions, magic_links, audit_log
  migrations/0000_init.sql
lib/
  crypto.ts                 AES-256-GCM + constantTimeEqual + randomToken
  manychat.ts               sendContent client with retryable-error classification
  anthropic.ts              Claude call with prompt-cached system prompt
  queues.ts                 BullMQ queue factories + InboundJob/SuggestionJob/OutboundJob types
  realtime.ts               Redis publish/subscribe helpers
  automation-template.ts    {{var}} substitution
  auth.ts                   single-owner magic-link sessions
worker/
  index.ts                  spawns inbound/suggestion/outbound workers with SIGTERM graceful shutdown
  processors/{inbound,suggestion,outbound}.ts
tests/unit/                 33 Vitest tests
scripts/loadtest.ts         synthetic webhook firehose
docker-compose.yml          postgres, redis, web, worker, bull-board
```

---

## Tests

```bash
pnpm test            # 33 unit tests covering crypto, template, ManyChat client, payload parser, auth, race conditions
pnpm typecheck
pnpm build
```

What the tests guard against:

| Test file                                    | Invariant                                                                                  |
|----------------------------------------------|---------------------------------------------------------------------------------------------|
| `crypto.test.ts`                             | Encrypt/decrypt round-trip; wrong-key decrypt fails cleanly; constant-time compare works  |
| `template.test.ts`                           | Missing vars → empty string (no throw); whitespace inside `{{ }}`; HTML escape is React's job |
| `manychat.test.ts`                           | 4xx non-retryable; 429/5xx/network retryable; correct request body shape                  |
| `webhook-payload.test.ts`                    | `subscriber_id` accepts string or number; `external_message_id` normalized; future fields pass through |
| `webhook-auth.test.ts`                       | Empty submitted token rejected; equal-length differing tokens rejected                    |
| `race-conditions.test.ts`                    | Supersede during generation; double-accept loses; idempotency at queue+DB; rate-limit math |

Load test:

```bash
export PAGE_HOOKS="<pageId>:<token>,<pageId>:<token>"
pnpm loadtest -- --leads 1000 --rate 17
# expect p50 < 100ms, p95 < 500ms; check `messages` table count matches leads exactly
```

---

## Production deployment

```bash
# All-in-one Docker stack on a single VPS (Hetzner CCX13 or DO Droplet is plenty for 1000 leads/hr)
docker compose up -d --build

# Scale workers as load grows
docker compose up -d --scale worker=4

# Bull Board ops UI at http://yourhost:3001  (HTTP basic auth: BULL_BOARD_USER/PASS)
```

Behind a reverse proxy (Caddy / Nginx), make sure to disable response buffering on `/api/sse` so SSE pushes flush immediately:

```caddy
@sse path /api/sse
reverse_proxy @sse web:3100 {
  flush_interval -1
}
```

---

## Env reference

| Var                  | Purpose                                                                       |
|----------------------|-------------------------------------------------------------------------------|
| `DATABASE_URL`       | Postgres connection string                                                    |
| `REDIS_URL`          | Redis connection string                                                       |
| `ANTHROPIC_API_KEY`  | Claude API key (sk-ant-…). Suggestions fail with status=error if missing.    |
| `ANTHROPIC_MODEL`    | Default model. Per-page override available in Settings → Pages → Claude model |
| `APP_ENCRYPTION_KEY` | 32-byte base64. AES-256-GCM key for encrypting ManyChat API keys at rest.    |
| `OWNER_EMAIL`        | The only email that can authenticate                                          |
| `RESEND_API_KEY`     | Optional. Without it, magic links print to the dev-server log                |
| `AUTH_SECRET`        | Cookie signing secret (reserved for future use)                              |
| `APP_URL`            | Public origin (used in magic-link emails)                                     |
