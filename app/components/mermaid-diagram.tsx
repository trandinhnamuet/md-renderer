"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { getServerSnapshot, getSnapshot, subscribe } from "./theme-store";
import DiagramLightbox from "./diagram-lightbox";

type State =
  | { status: "loading" }
  | { status: "done"; svg: string }
  | { status: "error"; message: string };

/**
 * Vẽ một khối ```mermaid thành sơ đồ. Mermaid cần DOM nên chỉ chạy ở client và
 * được import động — thư viện chỉ tải về khi tài liệu thực sự có sơ đồ.
 */
export default function MermaidDiagram({ chart }: { chart: string }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [state, setState] = useState<State>({ status: "loading" });
  const [zoomed, setZoomed] = useState(false);

  // id phải hợp lệ cho phần tử SVG; useId() có ký tự ":" nên cần lọc bỏ.
  const domId = `mermaid-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  useEffect(() => {
    if (theme === null) return; // chưa hydrate xong, chưa biết theme

    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: theme === "dark" ? "dark" : "default",
          // Nội dung do người dùng tải lên: giữ mức lọc nghiêm ngặt để nhãn
          // trong sơ đồ không thể chèn HTML/script.
          securityLevel: "strict",
          suppressErrorRendering: true,
          // Không đặt fontFamily: "inherit" — mermaid đo bề rộng chữ bằng font
          // của chính nó, nếu vẽ bằng font khác thì nhãn bị cắt cụt.
        });
        const { svg } = await mermaid.render(domId, chart);
        if (!cancelled) setState({ status: "done", svg });
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Sơ đồ không hợp lệ",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chart, domId, theme]);

  // Cú pháp sai: hiện lỗi kèm mã gốc thay vì làm hỏng cả trang.
  if (state.status === "error") {
    return (
      <div className="not-prose my-6 overflow-hidden rounded-xl border border-red-500/30">
        <p className="bg-red-500/10 px-4 py-2 text-sm text-red-600 dark:text-red-400">
          Không vẽ được sơ đồ Mermaid: {state.message}
        </p>
        <pre className="overflow-x-auto bg-zinc-50 p-4 text-xs dark:bg-zinc-900">
          <code>{chart}</code>
        </pre>
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <div className="not-prose my-6 flex min-h-24 items-center justify-center rounded-xl border border-black/10 bg-zinc-50 text-sm text-zinc-500 dark:border-white/10 dark:bg-zinc-900">
        Đang vẽ sơ đồ...
      </div>
    );
  }

  return (
    <div className="not-prose my-6">
      <button
        type="button"
        onClick={() => setZoomed(true)}
        title="Nhấn để phóng to sơ đồ"
        className="group relative block w-full cursor-zoom-in overflow-x-auto rounded-xl border border-transparent p-2 transition-colors hover:border-black/10 hover:bg-black/[.02] dark:hover:border-white/15 dark:hover:bg-white/[.03]"
      >
        <div
          className="flex justify-center [&_svg]:h-auto [&_svg]:max-w-full"
          // SVG do mermaid sinh ra, đã lọc theo securityLevel "strict".
          dangerouslySetInnerHTML={{ __html: state.svg }}
        />
        <span className="pointer-events-none absolute right-3 top-3 flex items-center gap-1.5 rounded-lg bg-zinc-900/80 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-4.35-4.35M11 8v6m-3-3h6m4 0a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
            />
          </svg>
          Phóng to
        </span>
      </button>

      {zoomed && (
        <DiagramLightbox svg={state.svg} onClose={() => setZoomed(false)} />
      )}
    </div>
  );
}
