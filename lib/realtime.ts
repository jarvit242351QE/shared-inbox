import { createSubscriber, getPublisher } from "./redis";

export type RealtimeEvent =
  | { type: "message"; conversationId: string; pageId: string }
  | { type: "suggestion"; conversationId: string; status: string }
  | { type: "message-status"; conversationId: string; messageId: string; status: string };

const CHANNEL = "inbox:events";

export async function publish(event: RealtimeEvent): Promise<void> {
  await getPublisher().publish(CHANNEL, JSON.stringify(event));
}

export function subscribe(handler: (e: RealtimeEvent) => void): () => Promise<void> {
  const sub = createSubscriber();
  void sub.subscribe(CHANNEL);
  sub.on("message", (_ch, msg) => {
    try {
      handler(JSON.parse(msg) as RealtimeEvent);
    } catch {
      /* ignore malformed */
    }
  });
  return async () => {
    await sub.unsubscribe(CHANNEL).catch(() => undefined);
    await sub.quit().catch(() => undefined);
  };
}
