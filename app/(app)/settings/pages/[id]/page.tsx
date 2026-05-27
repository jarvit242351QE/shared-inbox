import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageEditor } from "../_components/PageEditor";

export default async function PageEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6">
      <Link
        href="/settings/pages"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
      >
        <ArrowLeft className="size-4" /> Back to pages
      </Link>
      <PageEditor pageId={id} />
    </div>
  );
}
