import Link from "next/link";
import { Inbox, Settings, LogOut } from "lucide-react";
import { getSession } from "../../lib/auth";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s) redirect("/auth/signin");

  return (
    <div className="grid grid-cols-[64px_1fr] min-h-dvh">
      <aside className="border-r border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col items-center py-4 gap-2">
        <Link
          href="/conversations"
          className="size-10 grid place-items-center rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
          title="Inbox"
        >
          <Inbox className="size-5" />
        </Link>
        <Link
          href="/settings/pages"
          className="size-10 grid place-items-center rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
          title="Settings"
        >
          <Settings className="size-5" />
        </Link>
        <div className="flex-1" />
        <form action="/api/auth/signout" method="post">
          <button
            type="submit"
            className="size-10 grid place-items-center rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
            title="Sign out"
          >
            <LogOut className="size-5" />
          </button>
        </form>
      </aside>
      <main className="min-h-dvh">{children}</main>
    </div>
  );
}
