import { isAuthorized } from "@/lib/admin-auth";
import {
  deleteShare,
  getLimit,
  listShares,
  MAX_ALLOWED_SHARES,
  setLimit,
} from "@/lib/share-store";

const unauthorized = () =>
  Response.json({ error: "Sai mật khẩu" }, { status: 401 });

/** Danh sách file đang lưu + giới hạn hiện tại. Cũng dùng để kiểm tra mật khẩu. */
export async function GET(request: Request) {
  if (!isAuthorized(request)) return unauthorized();
  const [shares, limit] = await Promise.all([listShares(), getLimit()]);
  return Response.json({
    shares: shares.slice().reverse(), // mới nhất lên đầu
    limit,
    maxAllowed: MAX_ALLOWED_SHARES,
  });
}

/** Xoá một file theo id: DELETE /api/admin/shares?id=... */
export async function DELETE(request: Request) {
  if (!isAuthorized(request)) return unauthorized();

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Thiếu id" }, { status: 400 });

  const deleted = await deleteShare(id);
  if (!deleted) {
    return Response.json({ error: "Không tìm thấy file" }, { status: 404 });
  }
  return Response.json({ ok: true });
}

/** Đổi giới hạn số file lưu tối đa: PATCH { limit: number } */
export async function PATCH(request: Request) {
  if (!isAuthorized(request)) return unauthorized();

  let body: { limit?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON không hợp lệ" }, { status: 400 });
  }

  const value = Number(body.limit);
  if (!Number.isFinite(value) || value < 1) {
    return Response.json({ error: "Giới hạn không hợp lệ" }, { status: 400 });
  }

  const result = await setLimit(value);
  return Response.json(result);
}
