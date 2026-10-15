import { isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import MermaidDiagram from "./mermaid-diagram";

/**
 * Nhận diện khối ```mermaid: react-markdown render nó thành
 * <pre><code class="language-mermaid">…</code></pre>. Trả về mã sơ đồ, hoặc
 * null nếu đây là khối code thường.
 */
function mermaidChart(children: ReactNode): string | null {
  const child = Array.isArray(children) ? children[0] : children;
  if (!isValidElement<{ className?: string; children?: ReactNode }>(child)) {
    return null;
  }
  const className = child.props.className ?? "";
  if (!/(?:^|\s)language-mermaid(?:\s|$)/.test(className)) return null;
  return String(child.props.children ?? "").replace(/\n$/, "");
}

// Render nội dung markdown với style typography.
// Bảng dùng table-layout auto để độ rộng cột theo lượng chữ; bọc trong khung
// overflow-x-auto để bảng quá rộng (vd. URL dài không ngắt được) cuộn ngang
// thay vì tràn ra ngoài.
// rehype-slug gắn id kiểu GitHub cho heading để link mục lục (#...) hoạt động;
// scroll-mt chừa chỗ cho header sticky khi nhảy tới heading.
export default function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-zinc max-w-none break-words dark:prose-invert prose-pre:overflow-x-auto prose-table:my-0 prose-table:w-full prose-th:break-words prose-td:break-words prose-td:align-top prose-headings:scroll-mt-20">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug]}
        components={{
          pre({ children, ...props }) {
            const chart = mermaidChart(children);
            if (chart) return <MermaidDiagram chart={chart} />;
            return <pre {...props}>{children}</pre>;
          },
          table({ children, ...props }) {
            return (
              <div className="my-8 overflow-x-auto">
                <table {...props}>{children}</table>
              </div>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
