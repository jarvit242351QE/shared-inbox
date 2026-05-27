"use client";

import { useEffect } from "react";

export type RealtimeEvent =
  | { type: "message"; conversationId: string; pageId: string }
  | { type: "suggestion"; conversationId: string; status: string }
  | { type: "message-status"; conversationId: string; messageId: string; status: string };

export function useRealtime(handler: (e: RealtimeEvent) => void) {
  useEffect(() => {
    const es = new EventSource("/api/sse");
    const onMessage = (e: MessageEvent) => {
      try {
        handler(JSON.parse(e.data) as RealtimeEvent);
      } catch {
        /* ignore */
      }
    };
    es.addEventListener("message", onMessage);
    es.addEventListener("suggestion", onMessage);
    es.addEventListener("message-status", onMessage);
    return () => {
      es.removeEventListener("message", onMessage);
      es.removeEventListener("suggestion", onMessage);
      es.removeEventListener("message-status", onMessage);
      es.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
