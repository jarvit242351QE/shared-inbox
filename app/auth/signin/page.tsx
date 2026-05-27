import { Mail } from "lucide-react";

export default function SignInPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  return <SignInForm searchParams={searchParams} />;
}

async function SignInForm({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="min-h-dvh grid place-items-center px-6">
      <form
        action="/api/auth/signin"
        method="post"
        className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 space-y-5"
      >
        <div className="flex items-center gap-3">
          <div className="size-10 grid place-items-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
            <Mail className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Shared Inbox</h1>
            <p className="text-sm text-[var(--color-text-muted)]">Sign in with a magic link</p>
          </div>
        </div>
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">Email</span>
          <input
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            className="mt-2 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 outline-none focus:border-[var(--color-accent)]"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-lg bg-[var(--color-accent)] py-2 font-medium text-white hover:opacity-90"
        >
          Send magic link
        </button>
        {sp.sent && (
          <p className="text-sm text-[var(--color-success)]">
            If that email is the owner, a sign-in link was sent.
          </p>
        )}
        {sp.error && <p className="text-sm text-[var(--color-danger)]">{sp.error}</p>}
      </form>
    </main>
  );
}
