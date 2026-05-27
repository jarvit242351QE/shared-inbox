import { env } from "./env";

export async function sendMagicLinkEmail(email: string, url: string): Promise<void> {
  const key = env.resendKey();
  if (!key) {
    console.log(`[mailer] (no RESEND_API_KEY) magic link for ${email}: ${url}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Shared Inbox <noreply@resend.dev>",
      to: [email],
      subject: "Your sign-in link",
      html: `<p>Click to sign in:</p><p><a href="${url}">${url}</a></p><p>This link expires in 15 minutes.</p>`,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[mailer] resend error", res.status, body);
  }
}
