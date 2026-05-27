import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "../db/client";
import { magicLinks, sessions } from "../db/schema";
import { randomToken } from "./crypto";
import { env } from "./env";

const SESSION_COOKIE = "si_session";
const SESSION_TTL_DAYS = 30;
const LINK_TTL_MIN = 15;

export async function createMagicLink(rawEmail: string): Promise<{
  ok: true;
  url: string;
} | { ok: false; reason: string }> {
  const email = rawEmail.trim().toLowerCase();
  if (email !== env.ownerEmail()) {
    // Don't disclose which emails are allowed — always pretend we sent it.
    return { ok: true, url: "" };
  }
  const token = randomToken(32);
  const expires = new Date(Date.now() + LINK_TTL_MIN * 60_000);
  await db.insert(magicLinks).values({ token, email, expiresAt: expires });
  return { ok: true, url: `${env.appUrl()}/auth/verify?token=${token}` };
}

export async function consumeMagicLink(token: string): Promise<string | null> {
  const now = new Date();
  const rows = await db
    .update(magicLinks)
    .set({ usedAt: now })
    .where(
      and(
        eq(magicLinks.token, token),
        isNull(magicLinks.usedAt),
        gt(magicLinks.expiresAt, now)
      )
    )
    .returning({ email: magicLinks.email });
  return rows[0]?.email ?? null;
}

export async function createSession(email: string): Promise<void> {
  const id = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
  await db.insert(sessions).values({ id, email, expiresAt });
  const c = await cookies();
  c.set(SESSION_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function getSession(): Promise<{ email: string } | null> {
  const c = await cookies();
  const id = c.get(SESSION_COOKIE)?.value;
  if (!id) return null;
  const rows = await db
    .select({ email: sessions.email, expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(eq(sessions.id, id))
    .limit(1);
  const s = rows[0];
  if (!s) return null;
  if (s.expiresAt.getTime() < Date.now()) return null;
  return { email: s.email };
}

export async function destroySession(): Promise<void> {
  const c = await cookies();
  const id = c.get(SESSION_COOKIE)?.value;
  if (id) await db.delete(sessions).where(eq(sessions.id, id));
  c.delete(SESSION_COOKIE);
}

export async function requireOwner(): Promise<{ email: string }> {
  const s = await getSession();
  if (!s || s.email !== env.ownerEmail()) {
    throw new Error("UNAUTHORIZED");
  }
  return s;
}
