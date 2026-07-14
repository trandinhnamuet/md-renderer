import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";

// Render nội dung markdown với style typography, bảng luôn vừa khung.
// rehype-slug gắn id kiểu GitHub cho heading để link mục lục (#...) hoạt động;
// scroll-mt chừa chỗ cho header sticky khi nhảy tới heading.
export default function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-zinc max-w-none break-words dark:prose-invert prose-pre:overflow-x-auto prose-table:w-full prose-table:table-fixed prose-th:break-words prose-td:break-words prose-td:align-top prose-headings:scroll-mt-20">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
