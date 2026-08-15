"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { getServerSnapshot, getSnapshot, subscribe } from "./theme-store";

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
    <div
      className="not-prose my-6 flex justify-center overflow-x-auto [&_svg]:h-auto [&_svg]:max-w-full"
      // SVG do mermaid sinh ra, đã lọc theo securityLevel "strict".
      dangerouslySetInnerHTML={{ __html: state.svg }}
    />
  );
}
