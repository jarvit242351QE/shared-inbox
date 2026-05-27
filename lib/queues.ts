import { Queue, type JobsOptions } from "bullmq";
import { getBullConnection } from "./redis";

export const QUEUES = {
  inbound: "inbound",
  suggestion: "suggestion",
  outbound: "outbound",
} as const;

export type InboundJob = {
  pageId: string;
  payload: {
    subscriber_id: string;
    first_name?: string | null;
    last_name?: string | null;
    ig_username?: string | null;
    text: string;
    ts?: string;
    external_message_id?: string;
  };
};

export type SuggestionJob = {
  conversationId: string;
  triggeredByMessageId: string;
};

export type OutboundJob = {
  messageId: string;
  conversationId: string;
  pageId: string;
  subscriberId: string;
  text: string;
};

const sharedDefaults: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 1500 },
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 86_400, count: 1000 },
};

let inboundQueue: Queue<InboundJob> | null = null;
let suggestionQueue: Queue<SuggestionJob> | null = null;
let outboundQueue: Queue<OutboundJob> | null = null;

export function getInboundQueue(): Queue<InboundJob> {
  if (!inboundQueue)
    inboundQueue = new Queue(QUEUES.inbound, {
      connection: getBullConnection(),
      defaultJobOptions: sharedDefaults,
    });
  return inboundQueue;
}

export function getSuggestionQueue(): Queue<SuggestionJob> {
  if (!suggestionQueue)
    suggestionQueue = new Queue(QUEUES.suggestion, {
      connection: getBullConnection(),
      defaultJobOptions: {
        ...sharedDefaults,
        attempts: 4,
        backoff: { type: "exponential", delay: 2000 },
      },
    });
  return suggestionQueue;
}

export function getOutboundQueue(): Queue<OutboundJob> {
  if (!outboundQueue)
    outboundQueue = new Queue(QUEUES.outbound, {
      connection: getBullConnection(),
      defaultJobOptions: sharedDefaults,
    });
  return outboundQueue;
}

// Group key for per-page outbound batching. Kept colon-free for BullMQ jobId compatibility.
export function outboundGroupKey(pageId: string) {
  return `page-${pageId}`;
}
