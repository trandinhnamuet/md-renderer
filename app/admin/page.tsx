import type { Metadata } from "next";
import AdminPanel from "./admin-panel";

export const metadata: Metadata = {
  title: "Quản lý file đã chia sẻ",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-6 py-16 font-sans dark:bg-black">
      <div className="w-full max-w-4xl">
        <AdminPanel />
      </div>
    </div>
  );
}
