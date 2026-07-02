import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { Redis } from "@upstash/redis";

// Lưu tối đa 1000 file md được chia sẻ. Khi vượt, xoá file cũ nhất trước khi lưu mới.
const MAX_SHARES = 1000;

export type Share = {
  id: string;
  name: string;
  content: string;
  createdAt: number;
};

function newId() {
  return randomBytes(9).toString("base64url"); // ~12 ký tự an toàn cho URL
}

// Dùng Upstash Redis khi có biến môi trường (production/Vercel); nếu không thì
// fallback sang filesystem cho môi trường local dev.
// Tích hợp Upstash trên Vercel đặt tên biến là KV_REST_API_*; SDK mặc định lại
// tìm UPSTASH_REDIS_REST_* — nên hỗ trợ cả hai.
const redisUrl =
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const useRedis = Boolean(redisUrl && redisToken);

// ---------------------------------------------------------------------------
// Backend: Upstash Redis
// ---------------------------------------------------------------------------
const INDEX_KEY = "shares:index"; // list các id, cũ nhất ở đầu, mới nhất ở cuối
const shareKey = (id: string) => `share:${id}`;

let _redis: Redis | null = null;
function redis() {
  if (!_redis) _redis = new Redis({ url: redisUrl!, token: redisToken! });
  return _redis;
}

async function saveRedis(share: Share): Promise<void> {
  const r = redis();
  await r.set(shareKey(share.id), share);
  await r.rpush(INDEX_KEY, share.id);

  // Xoá (các) id cũ nhất nếu vượt giới hạn, kèm nội dung của chúng.
  const len = await r.llen(INDEX_KEY);
  if (len > MAX_SHARES) {
    const evicted = (await r.lpop(INDEX_KEY, len - MAX_SHARES)) as
      | string[]
      | null;
    if (evicted && evicted.length) {
      await r.del(...evicted.map(shareKey));
    }
  }
}

async function getRedis(id: string): Promise<Share | null> {
  const share = await redis().get<Share>(shareKey(id));
  return share ?? null;
}

// ---------------------------------------------------------------------------
// Backend: Filesystem (local dev)
// ---------------------------------------------------------------------------
const DIR = path.join(process.cwd(), ".data", "shares");
const INDEX_FILE = path.join(DIR, "index.json");
const fileFor = (id: string) => path.join(DIR, `${id}.json`);

// Hàng đợi để tuần tự hoá các thao tác ghi (tránh đua trong cùng một tiến trình).
let queue: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

async function readIndex(): Promise<string[]> {
  try {
    const parsed = JSON.parse(await fs.readFile(INDEX_FILE, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveFs(share: Share): Promise<void> {
  await withLock(async () => {
    await fs.mkdir(DIR, { recursive: true });
    const ids = await readIndex();
    while (ids.length >= MAX_SHARES) {
      const oldest = ids.shift();
      if (oldest) await fs.rm(fileFor(oldest), { force: true });
    }
    await fs.writeFile(fileFor(share.id), JSON.stringify(share));
    ids.push(share.id);
    await fs.writeFile(INDEX_FILE, JSON.stringify(ids));
  });
}

async function getFs(id: string): Promise<Share | null> {
  try {
    return JSON.parse(await fs.readFile(fileFor(id), "utf8")) as Share;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// API công khai
// ---------------------------------------------------------------------------

/**
 * Lưu một file md và trả về id để tạo link. Chỉ gọi khi người dùng tạo link.
 * Nếu đã đủ MAX_SHARES, xoá file cũ nhất trước khi lưu file mới.
 */
export async function saveShare(name: string, content: string): Promise<string> {
  const share: Share = { id: newId(), name, content, createdAt: Date.now() };
  if (useRedis) await saveRedis(share);
  else await saveFs(share);
  return share.id;
}

/** Đọc nội dung một file đã chia sẻ theo id. */
export async function getShare(id: string): Promise<Share | null> {
  // Chặn path traversal / key lạ: id chỉ gồm ký tự base64url.
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return null;
  return useRedis ? getRedis(id) : getFs(id);
}
