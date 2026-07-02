import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Render nội dung markdown với style typography, bảng luôn vừa khung.
export default function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-zinc max-w-none break-words dark:prose-invert prose-pre:overflow-x-auto prose-table:w-full prose-table:table-fixed prose-th:break-words prose-td:break-words prose-td:align-top">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
