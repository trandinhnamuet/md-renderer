"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MIN_SCALE = 0.2;
const MAX_SCALE = 8;

const clamp = (v: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, v));

/**
 * Bản sao SVG trong lightbox trùng id với bản trong bài viết, khiến các tham
 * chiếu url(#...) (đầu mũi tên...) trỏ nhầm sang bản kia. Đổi id gốc ở *mọi*
 * nơi — kể cả trong <style> mà mermaid nhúng sẵn (selector "#mermaid-xxx ..."),
 * nếu không bản sao sẽ mất hết màu sắc. Các id con đều chứa id gốc nên cùng
 * được đổi theo.
 */
function isolateIds(svg: string, suffix: string) {
  const rootId = svg.match(/id="(mermaid-[^"]+)"/)?.[1];
  if (!rootId) return svg;
  return svg.split(rootId).join(`${rootId}${suffix}`);
}

export default function DiagramLightbox({
  svg,
  onClose,
}: {
  svg: string;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const surfaceRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  // Phóng to quanh vị trí con trỏ để chi tiết đang xem không bị trôi đi.
  const zoomAt = useCallback((factor: number, cx?: number, cy?: number) => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const rect = surface.getBoundingClientRect();
    const px = (cx ?? rect.left + rect.width / 2) - rect.left - rect.width / 2;
    const py = (cy ?? rect.top + rect.height / 2) - rect.top - rect.height / 2;

    setScale((prev) => {
      const next = clamp(prev * factor);
      const ratio = next / prev;
      setOffset((o) => ({
        x: px - (px - o.x) * ratio,
        y: py - (py - o.y) * ratio,
      }));
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  // Vừa khít khung khi mở: sơ đồ rộng thu lại cho thấy toàn cảnh, sơ đồ nhỏ
  // phóng lên để tận dụng màn hình.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const surface = surfaceRef.current;
      const content = contentRef.current?.firstElementChild;
      if (!surface || !content) return;
      const box = content.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const fit = Math.min(
        (surface.clientWidth * 0.95) / box.width,
        (surface.clientHeight * 0.95) / box.height,
      );
      setScale(clamp(Math.min(fit, 4)));
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  // Esc để đóng, khoá cuộn nền khi lightbox mở.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "+" || e.key === "=") zoomAt(1.25);
      else if (e.key === "-") zoomAt(0.8);
      else if (e.key === "0") reset();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, zoomAt, reset]);

  // Con lăn chuột để zoom — cần listener non-passive mới chặn được cuộn trang.
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY);
    };
    surface.addEventListener("wheel", onWheel, { passive: false });
    return () => surface.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setOffset({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y });
  };

  const endDrag = () => {
    drag.current = null;
  };

  const btn =
    "flex h-9 min-w-9 items-center justify-center rounded-lg bg-white/10 px-3 text-sm font-medium text-white backdrop-blur transition-colors hover:bg-white/25";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sơ đồ phóng to"
      className="fixed inset-0 z-50 flex flex-col bg-zinc-950/95"
    >
      {/* Thanh công cụ */}
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-3">
        <span className="text-sm text-white/70">
          Kéo để di chuyển · Lăn chuột để phóng to · Esc để đóng
        </span>
        <div className="flex items-center gap-2">
          <button className={btn} onClick={() => zoomAt(0.8)} aria-label="Thu nhỏ">
            −
          </button>
          <span className="min-w-14 text-center text-sm text-white/80">
            {Math.round(scale * 100)}%
          </span>
          <button className={btn} onClick={() => zoomAt(1.25)} aria-label="Phóng to">
            +
          </button>
          <button className={btn} onClick={reset}>
            Khôi phục
          </button>
          <button className={btn} onClick={onClose} aria-label="Đóng">
            ✕
          </button>
        </div>
      </div>

      {/* Vùng xem */}
      <div
        ref={surfaceRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="flex flex-1 touch-none cursor-grab items-center justify-center overflow-hidden active:cursor-grabbing"
      >
        <div
          ref={contentRef}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          }}
          // Nền sáng/tối theo theme để sơ đồ luôn tương phản với chữ.
          className="origin-center rounded-xl bg-white p-6 dark:bg-zinc-950 [&_svg]:h-auto [&_svg]:max-w-none"
          dangerouslySetInnerHTML={{ __html: isolateIds(svg, "-zoom") }}
        />
      </div>
    </div>,
    document.body,
  );
}
