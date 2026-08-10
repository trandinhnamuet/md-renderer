import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { Redis } from "@upstash/redis";

// Giới hạn số file md lưu đồng thời. Khi vượt, xoá file cũ nhất trước khi lưu
// mới. Giá trị mặc định, có thể đổi ở trang quản lý (lưu lại trong store).
export const DEFAULT_MAX_SHARES = 1000;
export const MAX_ALLOWED_SHARES = 10000;

export type Share = {
  id: string;
  name: string;
  content: string;
  createdAt: number;
};

/** Thông tin hiển thị trong danh sách quản lý (không kèm nội dung). */
export type ShareMeta = {
  id: string;
  name: string;
  createdAt: number;
  size: number; // số byte của nội dung
};

function newId() {
  return randomBytes(9).toString("base64url"); // ~12 ký tự an toàn cho URL
}

function metaOf(share: Share): ShareMeta {
  return {
    id: share.id,
    name: share.name,
    createdAt: share.createdAt,
    size: Buffer.byteLength(share.content, "utf8"),
  };
}

function clampLimit(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_MAX_SHARES;
  return Math.min(MAX_ALLOWED_SHARES, Math.max(1, Math.floor(value)));
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
const META_KEY = "shares:meta"; // hash id -> ShareMeta (để liệt kê nhanh)
const LIMIT_KEY = "shares:limit";
const shareKey = (id: string) => `share:${id}`;

let _redis: Redis | null = null;
function redis() {
  if (!_redis) _redis = new Redis({ url: redisUrl!, token: redisToken! });
  return _redis;
}

async function getLimitRedis(): Promise<number> {
  const raw = await redis().get<number | string>(LIMIT_KEY);
  return raw == null ? DEFAULT_MAX_SHARES : clampLimit(Number(raw));
}

async function setLimitRedis(limit: number): Promise<void> {
  await redis().set(LIMIT_KEY, limit);
}

async function saveRedis(share: Share): Promise<void> {
  const r = redis();
  await r.set(shareKey(share.id), share);
  await r.hset(META_KEY, { [share.id]: metaOf(share) });
  await r.rpush(INDEX_KEY, share.id);

  // Xoá (các) id cũ nhất nếu vượt giới hạn, kèm nội dung của chúng.
  const limit = await getLimitRedis();
  const len = await r.llen(INDEX_KEY);
  if (len > limit) {
    const evicted = (await r.lpop(INDEX_KEY, len - limit)) as string[] | null;
    if (evicted && evicted.length) {
      await r.del(...evicted.map(shareKey));
      await r.hdel(META_KEY, ...evicted);
    }
  }
}

async function getRedis(id: string): Promise<Share | null> {
  const share = await redis().get<Share>(shareKey(id));
  return share ?? null;
}

async function listRedis(): Promise<ShareMeta[]> {
  const r = redis();
  const ids = await r.lrange<string>(INDEX_KEY, 0, -1);
  if (!ids.length) return [];

  const metaMap = (await r.hgetall<Record<string, ShareMeta>>(META_KEY)) ?? {};
  const out: ShareMeta[] = [];
  for (const id of ids) {
    const meta = metaMap[id];
    if (meta) {
      out.push(meta);
      continue;
    }
    // Bản ghi cũ chưa có metadata: đọc từ share rồi ghi bù lại.
    const share = await getRedis(id);
    if (!share) continue;
    const built = metaOf(share);
    out.push(built);
    await r.hset(META_KEY, { [id]: built });
  }
  return out;
}

async function deleteRedis(id: string): Promise<boolean> {
  const r = redis();
  const removed = await r.del(shareKey(id));
  await r.lrem(INDEX_KEY, 0, id);
  await r.hdel(META_KEY, id);
  return removed > 0;
}

/** Xoá bớt file cũ nhất cho khớp giới hạn mới (khi giảm giới hạn). */
async function trimRedis(limit: number): Promise<number> {
  const r = redis();
  const len = await r.llen(INDEX_KEY);
  if (len <= limit) return 0;
  const evicted = (await r.lpop(INDEX_KEY, len - limit)) as string[] | null;
  if (!evicted || !evicted.length) return 0;
  await r.del(...evicted.map(shareKey));
  await r.hdel(META_KEY, ...evicted);
  return evicted.length;
}

// ---------------------------------------------------------------------------
// Backend: Filesystem (local dev)
// ---------------------------------------------------------------------------
const DIR = path.join(process.cwd(), ".data", "shares");
const INDEX_FILE = path.join(DIR, "index.json");
const LIMIT_FILE = path.join(DIR, "limit.json");
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

async function writeIndex(ids: string[]): Promise<void> {
  await fs.writeFile(INDEX_FILE, JSON.stringify(ids));
}

async function getLimitFs(): Promise<number> {
  try {
    const parsed = JSON.parse(await fs.readFile(LIMIT_FILE, "utf8"));
    return clampLimit(Number(parsed?.limit));
  } catch {
    return DEFAULT_MAX_SHARES;
  }
}

async function setLimitFs(limit: number): Promise<void> {
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(LIMIT_FILE, JSON.stringify({ limit }));
}

async function saveFs(share: Share): Promise<void> {
  await withLock(async () => {
    await fs.mkdir(DIR, { recursive: true });
    const limit = await getLimitFs();
    const ids = await readIndex();
    while (ids.length >= limit) {
      const oldest = ids.shift();
      if (oldest) await fs.rm(fileFor(oldest), { force: true });
    }
    await fs.writeFile(fileFor(share.id), JSON.stringify(share));
    ids.push(share.id);
    await writeIndex(ids);
  });
}

async function getFs(id: string): Promise<Share | null> {
  try {
    return JSON.parse(await fs.readFile(fileFor(id), "utf8")) as Share;
  } catch {
    return null;
  }
}

async function listFs(): Promise<ShareMeta[]> {
  const ids = await readIndex();
  const out: ShareMeta[] = [];
  for (const id of ids) {
    const share = await getFs(id);
    if (share) out.push(metaOf(share));
  }
  return out;
}

async function deleteFs(id: string): Promise<boolean> {
  return withLock(async () => {
    const ids = await readIndex();
    const next = ids.filter((x) => x !== id);
    let existed = false;
    try {
      await fs.rm(fileFor(id));
      existed = true;
    } catch {
      /* file không tồn tại */
    }
    if (next.length !== ids.length) await writeIndex(next);
    return existed;
  });
}

async function trimFs(limit: number): Promise<number> {
  return withLock(async () => {
    const ids = await readIndex();
    if (ids.length <= limit) return 0;
    const evicted = ids.splice(0, ids.length - limit);
    for (const id of evicted) await fs.rm(fileFor(id), { force: true });
    await writeIndex(ids);
    return evicted.length;
  });
}

// ---------------------------------------------------------------------------
// API công khai
// ---------------------------------------------------------------------------

/**
 * Lưu một file md và trả về id để tạo link. Chỉ gọi khi người dùng tạo link.
 * Nếu đã đạt giới hạn, xoá file cũ nhất trước khi lưu file mới.
 */
export async function saveShare(
  name: string,
  content: string,
): Promise<string> {
  const share: Share = { id: newId(), name, content, createdAt: Date.now() };
  if (useRedis) await saveRedis(share);
  else await saveFs(share);
  return share.id;
}

/** Đọc nội dung một file đã chia sẻ theo id. */
export async function getShare(id: string): Promise<Share | null> {
  if (!isValidId(id)) return null;
  return useRedis ? getRedis(id) : getFs(id);
}

/** Danh sách file đang lưu, cũ nhất trước. */
export async function listShares(): Promise<ShareMeta[]> {
  return useRedis ? listRedis() : listFs();
}

/** Xoá một file đang lưu. Trả về true nếu file tồn tại và đã xoá. */
export async function deleteShare(id: string): Promise<boolean> {
  if (!isValidId(id)) return false;
  return useRedis ? deleteRedis(id) : deleteFs(id);
}

/** Giới hạn số file lưu đồng thời hiện tại. */
export async function getLimit(): Promise<number> {
  return useRedis ? getLimitRedis() : getLimitFs();
}

/**
 * Đổi giới hạn. Nếu giới hạn mới nhỏ hơn số file đang lưu, xoá bớt file cũ nhất
 * cho khớp. Trả về giới hạn đã áp dụng và số file bị xoá.
 */
export async function setLimit(
  limit: number,
): Promise<{ limit: number; removed: number }> {
  const applied = clampLimit(limit);
  if (useRedis) await setLimitRedis(applied);
  else await setLimitFs(applied);
  const removed = useRedis ? await trimRedis(applied) : await trimFs(applied);
  return { limit: applied, removed };
}

// Chặn path traversal / key lạ: id chỉ gồm ký tự base64url.
function isValidId(id: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(id);
}
