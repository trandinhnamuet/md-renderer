"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

// Nguồn sự thật là class trên <html> (được script trong layout đặt trước khi
// hydrate). Đọc qua useSyncExternalStore để tránh lệch server/client.
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getServerSnapshot(): Theme | null {
  return null; // trên server chưa biết theme — chưa vẽ icon
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* localStorage không khả dụng — bỏ qua */
    }
    listeners.forEach((l) => l());
  };

  return (
    <button
      onClick={toggle}
      aria-label="Chuyển chế độ sáng/tối"
      title="Chuyển chế độ sáng/tối"
      className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-zinc-700 transition-colors hover:bg-black/[.05] dark:border-white/15 dark:text-zinc-200 dark:hover:bg-white/[.08]"
    >
      {theme === "dark" ? (
        // Mặt trời
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <circle cx="12" cy="12" r="4" />
          <path
            strokeLinecap="round"
            d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41"
          />
        </svg>
      ) : theme === "light" ? (
        // Mặt trăng
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"
          />
        </svg>
      ) : null}
    </button>
  );
}
