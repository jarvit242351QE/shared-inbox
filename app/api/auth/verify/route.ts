import { NextResponse, type NextRequest } from "next/server";
import { consumeMagicLink, createSession } from "../../../../lib/auth";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/auth/signin?error=missing+token", req.url));
  }
  const email = await consumeMagicLink(token);
  if (!email) {
    return NextResponse.redirect(new URL("/auth/signin?error=invalid+or+expired+link", req.url));
  }
  await createSession(email);
  return NextResponse.redirect(new URL("/", req.url));
}
