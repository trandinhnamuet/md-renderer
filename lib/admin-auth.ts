// Mật khẩu trang quản lý (theo yêu cầu: set cứng). Chỉ so sánh phía server,
// không nhúng vào bundle client.
const ADMIN_PASSWORD = "meik9occod;";

export function isAuthorized(request: Request): boolean {
  return request.headers.get("x-admin-password") === ADMIN_PASSWORD;
}
