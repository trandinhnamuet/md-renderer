import ThemeToggle from "./theme-toggle";

export default function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-black/10 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-black/70">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <svg
            className="h-6 w-6 text-blue-600 dark:text-blue-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 5h16v14H4z M7 15V9l2.5 3L12 9v6 M16 9v4m0 0-1.5-1.5M16 13l1.5-1.5"
            />
          </svg>
          <span className="text-lg font-semibold tracking-tight">
            Markdown Viewer
          </span>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
