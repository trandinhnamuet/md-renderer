import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

// Lưu tối đa 1000 file md được chia sẻ. Khi vượt, xoá file cũ nhất trước khi lưu mới.
const MAX_SHARES = 1000;

const DIR = path.join(process.cwd(), ".data", "shares");
const INDEX_FILE = path.join(DIR, "index.json");

export type Share = {
  id: string;
  name: string;
  content: string;
  createdAt: number;
};

// Hàng đợi để tuần tự hoá các thao tác ghi (tránh đua trong cùng một tiến trình).
let queue: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

function fileFor(id: string) {
  return path.join(DIR, `${id}.json`);
}

async function readIndex(): Promise<string[]> {
  try {
    const raw = await fs.readFile(INDEX_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return []; // chưa có index
  }
}

async function writeIndex(ids: string[]) {
  await fs.writeFile(INDEX_FILE, JSON.stringify(ids));
}

/**
 * Lưu một file md và trả về id để tạo link. Chỉ gọi khi người dùng tạo link.
 * Nếu đã đủ MAX_SHARES, xoá (các) file cũ nhất trước khi lưu file mới.
 */
export async function saveShare(name: string, content: string): Promise<string> {
  return withLock(async () => {
    await fs.mkdir(DIR, { recursive: true });
    const ids = await readIndex();

    // Xoá cũ nhất (đầu mảng) cho tới khi còn chỗ cho file mới.
    while (ids.length >= MAX_SHARES) {
      const oldest = ids.shift();
      if (oldest) await fs.rm(fileFor(oldest), { force: true });
    }

    const id = randomBytes(9).toString("base64url"); // ~12 ký tự an toàn cho URL
    const share: Share = { id, name, content, createdAt: Date.now() };
    await fs.writeFile(fileFor(id), JSON.stringify(share));

    ids.push(id); // mới nhất ở cuối
    await writeIndex(ids);
    return id;
  });
}

/** Đọc nội dung một file đã chia sẻ theo id. */
export async function getShare(id: string): Promise<Share | null> {
  // Chặn path traversal: id chỉ gồm ký tự base64url.
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return null;
  try {
    const raw = await fs.readFile(fileFor(id), "utf8");
    return JSON.parse(raw) as Share;
  } catch {
    return null;
  }
}
