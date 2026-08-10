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
            <div className="flex items-center gap-2">
              <a
                href={`/s/${share.id}/download`}
                download={share.name}
                className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                  />
                </svg>
                Tải file .md
              </a>
              <Link
                href="/"
                className="rounded-full border border-black/10 px-4 py-1.5 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06]"
              >
                Mở trình xem
              </Link>
            </div>
          </div>
          <MarkdownContent content={share.content} />
        </article>
      </div>
    </div>
  );
}
