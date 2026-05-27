import { NextResponse, type NextRequest } from "next/server";
import { asc } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../../db/client";
import { pages } from "../../../db/schema";
import { requireOwner } from "../../../lib/auth";
import { encrypt, randomToken } from "../../../lib/crypto";

const Body = z.object({
  name: z.string().min(1).max(120),
  apiKey: z.string().min(10),
  claudeSystemPrompt: z.string().optional(),
});

export async function GET() {
  try {
    await requireOwner();
  } catch {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const rows = await db
    .select({
      id: pages.id,
      name: pages.name,
      webhookToken: pages.webhookToken,
      createdAt: pages.createdAt,
    })
    .from(pages)
    .orderBy(asc(pages.createdAt));
  return NextResponse.json({ ok: true, pages: rows });
}

export async function POST(req: NextRequest) {
  try {
    await requireOwner();
  } catch {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }
  const { name, apiKey, claudeSystemPrompt } = parsed.data;
  const [row] = await db
    .insert(pages)
    .values({
      name,
      manychatApiKeyEncrypted: encrypt(apiKey),
      webhookToken: randomToken(32),
      ...(claudeSystemPrompt ? { claudeSystemPrompt } : {}),
    })
    .returning({ id: pages.id, webhookToken: pages.webhookToken });
  return NextResponse.json({ ok: true, page: row });
}
