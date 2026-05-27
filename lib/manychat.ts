const BASE = "https://api.manychat.com";

export type SendContentResult =
  | { ok: true; status: "success" }
  | { ok: false; code: number; status: string; message: string; retryable: boolean };

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export async function sendText(
  apiKey: string,
  subscriberId: string,
  text: string,
  opts: { messageTag?: string; timeoutMs?: number } = {}
): Promise<SendContentResult> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15_000);
  try {
    const res = await fetch(`${BASE}/fb/sending/sendContent`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        subscriber_id: subscriberId,
        data: {
          version: "v2",
          content: {
            messages: [{ type: "text", text }],
          },
        },
        ...(opts.messageTag ? { message_tag: opts.messageTag } : {}),
      }),
      signal: controller.signal,
    });

    const body = (await res.json().catch(() => ({}))) as {
      status?: string;
      message?: string;
      details?: unknown;
    };

    if (!res.ok || body.status !== "success") {
      return {
        ok: false,
        code: res.status,
        status: body.status ?? "error",
        message: body.message ?? `manychat sendContent failed (${res.status})`,
        retryable: RETRYABLE_STATUS.has(res.status),
      };
    }
    return { ok: true, status: "success" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      code: 0,
      status: "network_error",
      message: msg,
      retryable: true,
    };
  } finally {
    clearTimeout(t);
  }
}
