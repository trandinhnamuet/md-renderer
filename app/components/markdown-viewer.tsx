"use client";

import { useCallback, useRef, useState } from "react";
import MarkdownContent from "./markdown-content";

type LoadedFile = {
  name: string;
  content: string;
};

const ACCEPTED = [".md", ".markdown", ".mdown", ".mkd"];

function isMarkdownFile(name: string) {
  const lower = name.toLowerCase();
  return ACCEPTED.some((ext) => lower.endsWith(ext));
}

// Phát hiện bảng GFM qua dòng phân cách kiểu "| --- | --- |"
function hasTable(md: string) {
  return md.split("\n").some((line) => {
    const t = line.trim();
    return t.includes("|") && t.includes("-") && /^[\s|:-]+$/.test(t);
  });
}

function readAsText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export default function MarkdownViewer() {
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [activeName, setActiveName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [shareLinks, setShareLinks] = useState<Record<string, string>>({});
  const [sharing, setSharing] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async (list: FileList | File[]) => {
    const all = Array.from(list);
    const mdFiles = all.filter((f) => isMarkdownFile(f.name));

    if (mdFiles.length === 0) {
      setError("Vui lòng chọn file Markdown (.md).");
      return;
    }
    setError(
      mdFiles.length !== all.length
        ? "Đã bỏ qua các file không phải Markdown."
        : null,
    );

    const loaded = await Promise.all(
      mdFiles.map(async (f) => ({ name: f.name, content: await readAsText(f) })),
    );

    // Gộp vào danh sách hiện có; trùng tên thì cập nhật nội dung, giữ nguyên vị trí.
    setFiles((prev) => {
      const map = new Map(prev.map((p) => [p.name, p]));
      for (const item of loaded) map.set(item.name, item);
      return Array.from(map.values());
    });
    setActiveName(loaded[loaded.length - 1].name);
  }, []);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) loadFiles(e.target.files);
    e.target.value = ""; // cho phép chọn lại cùng file
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) loadFiles(e.dataTransfer.files);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const closeFile = (name: string) => {
    const idx = files.findIndex((f) => f.name === name);
    const next = files.filter((f) => f.name !== name);
    setFiles(next);
    if (activeName === name) {
      setActiveName(
        next.length ? next[Math.min(idx, next.length - 1)].name : null,
      );
    }
  };

  const active = files.find((f) => f.name === activeName) ?? null;
  // Mở rộng khung khi file đang xem có bảng để bảng có thêm chỗ hiển thị
  const wide = !!active && hasTable(active.content);
  const shareUrl = active ? shareLinks[active.name] : undefined;

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
    } catch {
      /* clipboard không khả dụng — người dùng có thể tự copy từ ô input */
    }
  };

  // Tạo link chia sẻ: chỉ khi bấm mới lưu file lên server.
  const createLink = async () => {
    if (!active || sharing) return;
    setSharing(true);
    setError(null);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: active.name, content: active.content }),
      });
      if (!res.ok) throw new Error();
      const { id } = await res.json();
      const url = `${window.location.origin}/s/${id}`;
      setShareLinks((prev) => ({ ...prev, [active.name]: url }));
      copyLink(url);
    } catch {
      setError("Không tạo được link chia sẻ. Vui lòng thử lại.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      className={`w-full flex flex-col gap-4 transition-[max-width] duration-200 ${
        wide ? "max-w-5xl" : "max-w-3xl"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".md,.markdown,.mdown,.mkd,text/markdown"
        onChange={onInputChange}
        className="hidden"
      />

      {error && (
        <p className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {files.length === 0 ? (
        <div
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${
            isDragging
              ? "border-blue-500 bg-blue-500/5"
              : "border-black/15 hover:border-black/30 dark:border-white/20 dark:hover:border-white/40"
          }`}
        >
          <svg
            className="h-10 w-10 text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
            />
          </svg>
          <p className="text-base font-medium">
            Kéo thả các file <span className="font-mono">.md</span> vào đây
          </p>
          <p className="text-sm text-zinc-500">
            hoặc nhấn để chọn (có thể chọn nhiều file)
          </p>
        </div>
      ) : (
        <>
          {/* Thanh tab kiểu VS Code */}
          <div className="flex items-stretch gap-1 overflow-x-auto rounded-t-xl border-b border-black/10 bg-zinc-100/70 px-1 pt-1 dark:border-white/10 dark:bg-zinc-900/70">
            {files.map((f) => {
              const isActive = f.name === activeName;
              return (
                <div
                  key={f.name}
                  onClick={() => setActiveName(f.name)}
                  title={f.name}
                  className={`group flex max-w-[200px] cursor-pointer items-center gap-2 rounded-t-lg border border-b-0 px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? "border-black/10 bg-white text-black dark:border-white/10 dark:bg-zinc-950 dark:text-white"
                      : "border-transparent text-zinc-500 hover:bg-black/[.04] dark:hover:bg-white/[.05]"
                  }`}
                >
                  <span className="truncate font-mono text-xs">{f.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeFile(f.name);
                    }}
                    aria-label={`Đóng ${f.name}`}
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-zinc-400 hover:bg-black/10 hover:text-black dark:hover:bg-white/20 dark:hover:text-white"
                  >
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        d="M6 6l12 12M18 6L6 18"
                      />
                    </svg>
                  </button>
                </div>
              );
            })}
            <button
              onClick={() => inputRef.current?.click()}
              aria-label="Thêm file"
              title="Thêm file"
              className="flex shrink-0 items-center justify-center rounded px-2 text-zinc-500 hover:bg-black/[.06] hover:text-black dark:hover:bg-white/10 dark:hover:text-white"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>

          {/* Nội dung file đang chọn */}
          {active && (
            <article className="rounded-b-xl border border-t-0 border-black/10 bg-white p-8 dark:border-white/10 dark:bg-zinc-950">
              {/* Thanh công cụ chia sẻ */}
              <div className="mb-6 flex flex-wrap items-center justify-end gap-2 border-b border-black/5 pb-4 dark:border-white/10">
                {shareUrl ? (
                  <>
                    <input
                      readOnly
                      value={shareUrl}
                      onFocus={(e) => e.currentTarget.select()}
                      className="min-w-0 flex-1 rounded-lg border border-black/10 bg-zinc-50 px-3 py-1.5 font-mono text-xs text-zinc-600 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-300"
                    />
                    <button
                      onClick={() => copyLink(shareUrl)}
                      className="shrink-0 rounded-full bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                    >
                      {copiedUrl === shareUrl ? "Đã sao chép ✓" : "Sao chép"}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={createLink}
                    disabled={sharing}
                    className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
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
                        d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                      />
                    </svg>
                    {sharing ? "Đang tạo..." : "Tạo link chia sẻ"}
                  </button>
                )}
              </div>
              <MarkdownContent content={active.content} />
            </article>
          )}
        </>
      )}
    </div>
  );
}
