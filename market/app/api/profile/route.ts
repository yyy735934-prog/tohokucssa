import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { users } from "../../../db/schema";
import { getMemberAccess } from "../../../lib/auth";

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function GET() {
  const member = await getMemberAccess();
  if (!member) return Response.json({ error: "请先登录。" }, { status: 401 });
  const db = await getDb();
  const [profile] = await db.select({
    phone: users.phone, wechat: users.wechat, qq: users.qq,
    wechatQrKey: users.wechatQrKey, profileCompleted: users.profileCompleted,
  }).from(users).where(eq(users.email, member.email)).limit(1);
  return Response.json({
    profile: { ...profile, qrUrl: profile?.wechatQrKey ? `/api/profile/qr?email=${encodeURIComponent(member.email)}` : null },
  });
}

export async function PATCH(request: Request) {
  const member = await getMemberAccess();
  if (!member) return Response.json({ error: "请先登录。" }, { status: 401 });
  const payload = (await request.json()) as { phone?: string; wechat?: string; qq?: string; wechatQrKey?: string | null };
  const phone = clean(payload.phone, 40);
  const wechat = clean(payload.wechat, 60);
  const qq = clean(payload.qq, 30);
  const wechatQrKey = typeof payload.wechatQrKey === "string" && payload.wechatQrKey.startsWith("profiles/")
    ? payload.wechatQrKey.slice(0, 240) : null;
  if (!phone && !wechat && !qq && !wechatQrKey) {
    return Response.json({ error: "请至少填写一种联系方式。" }, { status: 400 });
  }
  const db = await getDb();
  const [updated] = await db.update(users).set({
    phone: phone || null,
    wechat: wechat || null,
    qq: qq || null,
    ...(wechatQrKey ? { wechatQrKey } : {}),
    profileCompleted: true,
    lastSeenAt: new Date().toISOString(),
  }).where(eq(users.email, member.email)).returning({
    phone: users.phone, wechat: users.wechat, qq: users.qq, profileCompleted: users.profileCompleted,
  });
  return Response.json({ profile: updated, message: "联系方式已保存。" });
}
