"use client";

import { useCallback, useEffect, useState } from "react";

type ShareMeta = {
  id: string;
  name: string;
  createdAt: number;
  size: number;
};

const STORAGE_KEY = "admin-password";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(ms: number) {
  return new Date(ms).toLocaleString("vi-VN");
}

export default function AdminPanel() {
  const [password, setPassword] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [checking, setChecking] = useState(true);
  const [shares, setShares] = useState<ShareMeta[]>([]);
  const [limit, setLimitValue] = useState(0);
  const [maxAllowed, setMaxAllowed] = useState(10000);
  const [limitInput, setLimitInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (pw: string) => {
    const res = await fetch("/api/admin/shares", {
      headers: { "x-admin-password": pw },
      cache: "no-store",
    });
    if (!res.ok) throw new Error("unauthorized");
    const data = await res.json();
    setShares(data.shares);
    setLimitValue(data.limit);
    setLimitInput(String(data.limit));
    setMaxAllowed(data.maxAllowed);
  }, []);

  // Mật khẩu đã lưu trên thiết bị: tự đăng nhập, không cần nhập lại.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          await load(saved);
          if (!cancelled) setPassword(saved);
        } catch {
          localStorage.removeItem(STORAGE_KEY); // mật khẩu cũ không còn đúng
        }
      }
      if (!cancelled) setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await load(passwordInput);
      localStorage.setItem(STORAGE_KEY, passwordInput); // nhớ cho lần sau
      setPassword(passwordInput);
      setPasswordInput("");
    } catch {
      setError("Sai mật khẩu.");
    } finally {
      setBusy(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setPassword(null);
    setShares([]);
  };

  const remove = async (share: ShareMeta) => {
    if (!password) return;
    if (!confirm(`Xoá "${share.name}"? Link chia sẻ sẽ không còn truy cập được.`))
      return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/admin/shares?id=${encodeURIComponent(share.id)}`,
        { method: "DELETE", headers: { "x-admin-password": password } },
      );
      if (!res.ok) throw new Error();
      setShares((prev) => prev.filter((s) => s.id !== share.id));
      setNotice(`Đã xoá ${share.name}.`);
    } catch {
      setError("Không xoá được file.");
    } finally {
      setBusy(false);
    }
  };

  const saveLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/shares", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": password,
        },
        body: JSON.stringify({ limit: Number(limitInput) }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLimitValue(data.limit);
      setLimitInput(String(data.limit));
      setNotice(
        data.removed > 0
          ? `Đã đặt giới hạn ${data.limit} và xoá ${data.removed} file cũ nhất.`
          : `Đã đặt giới hạn ${data.limit} file.`,
      );
      if (data.removed > 0) await load(password);
    } catch {
      setError("Không lưu được giới hạn.");
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return <p className="text-sm text-zinc-500">Đang kiểm tra...</p>;
  }

  // Cổng mật khẩu
  if (!password) {
    return (
      <form
        onSubmit={submitPassword}
        className="mx-auto w-full max-w-sm rounded-2xl border border-black/10 bg-white p-8 dark:border-white/10 dark:bg-zinc-950"
      >
        <h1 className="mb-2 text-xl font-semibold">Trang quản lý</h1>
        <p className="mb-6 text-sm text-zinc-500">
          Nhập mật khẩu để xem danh sách file đã chia sẻ.
        </p>
        <input
          type="password"
          autoFocus
          value={passwordInput}
          onChange={(e) => setPasswordInput(e.target.value)}
          placeholder="Mật khẩu"
          className="w-full rounded-lg border border-black/10 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/15 dark:bg-zinc-900"
        />
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy || !passwordInput}
          className="mt-4 w-full rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
        >
          {busy ? "Đang kiểm tra..." : "Vào trang quản lý"}
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          Quản lý file đã chia sẻ
        </h1>
        <button
          onClick={logout}
          className="rounded-full border border-black/10 px-4 py-1.5 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06]"
        >
          Quên mật khẩu trên máy này
        </button>
      </div>

      {/* Giới hạn */}
      <form
        onSubmit={saveLimit}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-950"
      >
        <div>
          <label className="mb-1 block text-sm font-medium">
            Giới hạn số file lưu tối đa
          </label>
          <input
            type="number"
            min={1}
            max={maxAllowed}
            value={limitInput}
            onChange={(e) => setLimitInput(e.target.value)}
            className="w-40 rounded-lg border border-black/10 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/15 dark:bg-zinc-900"
          />
        </div>
        <button
          type="submit"
          disabled={busy || limitInput === String(limit)}
          className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
        >
          Lưu giới hạn
        </button>
        <p className="text-sm text-zinc-500">
          Đang lưu <strong>{shares.length}</strong>/{limit} file. Giảm giới hạn
          sẽ xoá bớt file cũ nhất.
        </p>
      </form>

      {error && (
        <p className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-lg bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          {notice}
        </p>
      )}

      {/* Danh sách */}
      <div className="overflow-hidden rounded-2xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950">
        {shares.length === 0 ? (
          <p className="p-8 text-center text-sm text-zinc-500">
            Chưa có file nào được chia sẻ.
          </p>
        ) : (
          <table className="w-full table-fixed text-sm">
            <thead className="border-b border-black/10 bg-zinc-50 text-left dark:border-white/10 dark:bg-zinc-900">
              <tr>
                <th className="w-[40%] px-4 py-3 font-medium">Tên file</th>
                <th className="w-[22%] px-4 py-3 font-medium">Ngày tạo</th>
                <th className="w-[12%] px-4 py-3 font-medium">Dung lượng</th>
                <th className="w-[26%] px-4 py-3 font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {shares.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-black/5 last:border-0 dark:border-white/5"
                >
                  <td className="truncate px-4 py-3 font-mono text-xs">
                    {s.name}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {formatDate(s.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {formatSize(s.size)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-3">
                      <a
                        href={`/s/${s.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Xem
                      </a>
                      <a
                        href={`/s/${s.id}/download`}
                        className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Tải
                      </a>
                      <button
                        onClick={() => remove(s)}
                        disabled={busy}
                        className="font-medium text-red-600 hover:underline disabled:opacity-60 dark:text-red-400"
                      >
                        Xoá
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
