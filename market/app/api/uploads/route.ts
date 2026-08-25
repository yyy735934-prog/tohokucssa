import { getMemberAccess } from "../../../lib/auth";
import { canUseMarketplace } from "../../../lib/member-status";
import { uploadOwnerHash } from "../../../lib/upload-ownership";

const allowedTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  const member = await getMemberAccess();
  if (!member) return Response.json({ error: "请先登录。" }, { status: 401 });
  const form = await request.formData();
  const rawPurpose = form.get("purpose");
  const purpose = rawPurpose === "profile" || rawPurpose === "verification" ? rawPurpose : "listing";
  if (purpose === "listing" && !canUseMarketplace(member.academicStatus, member.isAdmin)) {
    return Response.json({ error: "账号获得发布权限后才能上传商品照片。" }, { status: 403 });
  }

  const image = form.get("image");
  if (!(image instanceof File)) {
    return Response.json({ error: "请选择照片。" }, { status: 400 });
  }
  const extension = allowedTypes[image.type];
  if (!extension) {
    return Response.json({ error: "仅支持 JPG、PNG 或 WebP 图片。" }, { status: 400 });
  }
  const maxBytes = purpose === "verification" ? 4 * 1024 * 1024 : 2 * 1024 * 1024;
  if (image.size > maxBytes) {
    return Response.json({ error: `照片超过 ${purpose === "verification" ? 4 : 2} MB，请重新选择。` }, { status: 400 });
  }

  const ownerHash = await uploadOwnerHash(member.email);
  const folder = purpose === "profile" ? "profiles" : purpose === "verification" ? "verification" : "listings";
  const key = `${folder}/${ownerHash}/${crypto.randomUUID()}.${extension}`;
  const { env } = await import("cloudflare:workers");
  const runtimeEnv = env as unknown as { BUCKET: R2Bucket };
  await runtimeEnv.BUCKET.put(key, await image.arrayBuffer(), {
    httpMetadata: { contentType: image.type },
    customMetadata: { ownerHash },
  });

  return Response.json({ key }, { status: 201 });
}
