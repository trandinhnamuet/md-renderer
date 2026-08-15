"use client";

// Nguồn sự thật của theme là class "dark" trên <html> (được script trong layout
// đặt trước khi hydrate). Store này cho các component đọc/đổi theme và cùng
// nhận thông báo khi theme thay đổi — kể cả khi bị đổi từ nơi khác.
export type Theme = "light" | "dark";

const listeners = new Set<() => void>();
let observer: MutationObserver | null = null;

export function subscribe(onChange: () => void) {
  listeners.add(onChange);

  // Theo dõi thay đổi class trên <html> để mọi subscriber cùng cập nhật.
  if (!observer && typeof MutationObserver !== "undefined") {
    observer = new MutationObserver(() => {
      for (const listener of listeners) listener();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && observer) {
      observer.disconnect();
      observer = null;
    }
  };
}

export function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** Trên server chưa biết theme — component tự xử lý giá trị null. */
export function getServerSnapshot(): Theme | null {
  return null;
}

export function setTheme(next: Theme) {
  document.documentElement.classList.toggle("dark", next === "dark");
  try {
    localStorage.setItem("theme", next);
  } catch {
    /* localStorage không khả dụng — bỏ qua */
  }
  // MutationObserver sẽ thông báo cho các subscriber.
}
