"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(
      document.documentElement.classList.contains("dark") ? "dark" : "light",
    );
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* localStorage không khả dụng — bỏ qua */
    }
    setTheme(next);
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
