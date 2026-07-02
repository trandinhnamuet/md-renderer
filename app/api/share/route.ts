import { saveShare } from "@/lib/share-store";

const MAX_CONTENT = 2_000_000; // ~2MB mỗi file

export async function POST(request: Request) {
  let body: { name?: unknown; content?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON không hợp lệ" }, { status: 400 });
  }

  const content = typeof body.content === "string" ? body.content : null;
  if (content === null) {
    return Response.json({ error: "Thiếu nội dung" }, { status: 400 });
  }
  if (content.length > MAX_CONTENT) {
    return Response.json({ error: "File quá lớn" }, { status: 413 });
  }

  const name =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim()
      : "untitled.md";

  const id = await saveShare(name, content);
  return Response.json({ id });
}
