import { Worker } from "bullmq";
import { getBullConnection } from "../lib/redis";
import { QUEUES } from "../lib/queues";
import { processInbound } from "./processors/inbound";
import { processSuggestion } from "./processors/suggestion";
import { processOutbound } from "./processors/outbound";

const connection = getBullConnection();

const inbound = new Worker(QUEUES.inbound, processInbound, {
  connection,
  concurrency: 32,
});

const suggestion = new Worker(QUEUES.suggestion, processSuggestion, {
  connection,
  concurrency: 8,
});

const outbound = new Worker(QUEUES.outbound, processOutbound, {
  connection,
  concurrency: 16,
  // Per-page rate limit: keyed via job.opts.group.id; group concurrency is set per-job.
  // Global ManyChat per-key rate limit safety: 8 req/s overall when only one page is active.
  limiter: { max: 8, duration: 1000 },
});

for (const w of [inbound, suggestion, outbound]) {
  w.on("failed", (job, err) => {
    console.error(`[worker:${w.name}] job ${job?.id} failed:`, err.message);
  });
  w.on("error", (err) => {
    console.error(`[worker:${w.name}] runtime error:`, err);
  });
}

console.log("workers up:", { inbound: 32, suggestion: 8, outbound: 16 });

let closing = false;
async function shutdown(sig: string) {
  if (closing) return;
  closing = true;
  console.log(`[worker] ${sig} received, draining...`);
  await Promise.allSettled([inbound.close(), suggestion.close(), outbound.close()]);
  console.log("[worker] closed");
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
