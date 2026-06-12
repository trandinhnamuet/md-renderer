import MarkdownViewer from "./components/markdown-viewer";

export default function Home() {
  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-6 py-16 font-sans dark:bg-black">
      <MarkdownViewer />
    </div>
  );
}
