import { type NextRequest } from "next/server";
import { requireOwner } from "../../../lib/auth";
import { subscribe } from "../../../lib/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  await requireOwner();

  const encoder = new TextEncoder();
  let unsubscribe: (() => Promise<void>) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => controller.enqueue(encoder.encode(data));

      // Initial comment to flush headers
      send(": connected\n\n");

      // Heartbeat
      const ping = setInterval(() => {
        try {
          send(`: ping ${Date.now()}\n\n`);
        } catch {
          /* closed */
        }
      }, 15_000);

      unsubscribe = subscribe((event) => {
        try {
          send(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
        } catch {
          /* closed */
        }
      });

      // Detach on stream cancel
      return () => {
        clearInterval(ping);
        void unsubscribe?.();
      };
    },
    async cancel() {
      await unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
