import { PagesList } from "./_components/PagesList";

export default function PagesIndex() {
  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Pages</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Each page corresponds to one ManyChat account / Instagram page. Add a page, copy its
          webhook URL, and configure ManyChat's External Request to POST to it.
        </p>
      </header>
      <PagesList />
    </div>
  );
}
