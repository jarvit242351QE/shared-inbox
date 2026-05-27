import { NextResponse, type NextRequest } from "next/server";
import { createMagicLink } from "../../../../lib/auth";
import { sendMagicLinkEmail } from "../../../../lib/mailer";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "");
  const res = await createMagicLink(email);
  if (res.ok && res.url) {
    await sendMagicLinkEmail(email, res.url);
  }
  return NextResponse.redirect(new URL("/auth/signin?sent=1", req.url));
}
