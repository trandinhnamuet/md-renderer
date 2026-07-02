import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getShare } from "@/lib/share-store";
import MarkdownContent from "@/app/components/markdown-content";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const share = await getShare(id);
  return { title: share ? share.name : "Không tìm thấy file" };
}

export default async function SharedPage({ params }: Props) {
  const { id } = await params;
  const share = await getShare(id);
  if (!share) notFound();

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-6 py-16 font-sans dark:bg-black">
      <div className="w-full max-w-5xl">
        <article className="rounded-2xl border border-black/10 bg-white p-8 dark:border-white/10 dark:bg-zinc-950">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-black/5 pb-4 dark:border-white/10">
            <span className="font-mono text-sm text-zinc-500">
              {share.name}
            </span>
            <Link
              href="/"
              className="rounded-full border border-black/10 px-4 py-1.5 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06]"
            >
              Mở trình xem
            </Link>
          </div>
          <MarkdownContent content={share.content} />
        </article>
      </div>
    </div>
  );
}
