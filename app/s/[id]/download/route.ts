import { getShare } from "@/lib/share-store";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/s/[id]/download">,
) {
  const { id } = await ctx.params;
  const share = await getShare(id);
  if (!share) {
    return new Response("Không tìm thấy file", { status: 404 });
  }

  // Tên file có thể chứa tiếng Việt/ký tự đặc biệt: gửi kèm bản ASCII an toàn
  // và bản UTF-8 theo RFC 5987 để trình duyệt lấy đúng tên.
  const fallback = share.name.replace(/[^\w.\-]+/g, "_") || "shared.md";
  const encoded = encodeURIComponent(share.name);

  return new Response(share.content, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`,
      "Cache-Control": "no-store",
    },
  });
}
