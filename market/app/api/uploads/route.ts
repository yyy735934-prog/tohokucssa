import { getMemberAccess } from "../../../lib/auth";

const allowedTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  const member = await getMemberAccess();
  if (!member) return Response.json({ error: "请先登录。" }, { status: 401 });
  const form = await request.formData();
  const purpose = form.get("purpose") === "profile" ? "profile" : "listing";
  if (purpose === "listing" && member.academicStatus !== "verified" && !member.isAdmin) {
    return Response.json({ error: "完成学友身份认证后才能上传商品照片。" }, { status: 403 });
  }

  const image = form.get("image");
  if (!(image instanceof File)) {
    return Response.json({ error: "请选择照片。" }, { status: 400 });
  }
  const extension = allowedTypes[image.type];
  if (!extension) {
    return Response.json({ error: "仅支持 JPG、PNG 或 WebP 图片。" }, { status: 400 });
  }
  if (image.size > 2 * 1024 * 1024) {
    return Response.json({ error: "照片优化后仍超过 2 MB，请重新选择。" }, { status: 400 });
  }

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(member.email.toLowerCase()),
  );
  const ownerHash = Array.from(new Uint8Array(digest))
    .slice(0, 10)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  const folder = purpose === "profile" ? "profiles" : "listings";
  const key = `${folder}/${ownerHash}/${crypto.randomUUID()}.${extension}`;
  const { env } = await import("cloudflare:workers");
  const runtimeEnv = env as unknown as { BUCKET: R2Bucket };
  await runtimeEnv.BUCKET.put(key, await image.arrayBuffer(), {
    httpMetadata: { contentType: image.type },
    customMetadata: { ownerHash },
  });

  return Response.json({ key }, { status: 201 });
}
