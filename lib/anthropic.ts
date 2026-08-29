import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;
const defaultModel = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-7";
// Optional override so this app can point at an Anthropic-Messages-API-
// compatible gateway (e.g. OpenLux) instead of the official Anthropic API.
// Unset = official API, unchanged default behavior.
const baseURL = process.env.ANTHROPIC_BASE_URL?.trim() || undefined;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required");
  if (!client) client = new Anthropic({ apiKey, baseURL });
  return client;
}

export type ThreadTurn = { role: "user" | "assistant"; content: string };

export type SuggestionResult = {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
};

export async function generateSuggestion(args: {
  systemPrompt: string;
  thread: ThreadTurn[];
  model?: string;
}): Promise<SuggestionResult> {
  const c = getClient();
  const model = args.model ?? defaultModel;

  // Mark the system prompt cacheable so repeated suggestions for the same page reuse the prefix.
  const res = await c.messages.create({
    model,
    max_tokens: 400,
    temperature: 0.6,
    system: [
      {
        type: "text",
        text: args.systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: args.thread.map((t) => ({ role: t.role, content: t.content })),
  });

  const textBlock = res.content.find((b) => b.type === "text");
  const text = textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";

  return {
    text,
    model,
    inputTokens: res.usage?.input_tokens ?? 0,
    outputTokens: res.usage?.output_tokens ?? 0,
  };
}
