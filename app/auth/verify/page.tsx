import { redirect } from "next/navigation";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  const token = sp.token;
  if (!token) redirect("/auth/signin?error=missing+token");
  redirect(`/api/auth/verify?token=${encodeURIComponent(token!)}`);
}
