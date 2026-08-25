import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { users } from "../../../db/schema";
import { getMemberAccess } from "../../../lib/auth";
import {
  isValidPublicNickname,
  normalizePublicNameMode,
  normalizePublicNickname,
} from "../../../lib/public-identity";

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
    publicNameMode: users.publicNameMode, publicNickname: users.publicNickname,
  }).from(users).where(eq(users.email, member.email)).limit(1);
  return Response.json({
    profile: { ...profile, qrUrl: profile?.wechatQrKey ? "/api/profile/qr" : null },
  });
}

export async function PATCH(request: Request) {
  const member = await getMemberAccess();
  if (!member) return Response.json({ error: "请先登录。" }, { status: 401 });
  const payload = (await request.json()) as {
    phone?: string;
    wechat?: string;
    qq?: string;
    wechatQrKey?: string | null;
    publicNameMode?: string;
    publicNickname?: string;
  };
  const db = await getDb();
  const [existing] = await db.select({
    phone: users.phone,
    wechat: users.wechat,
    qq: users.qq,
    wechatQrKey: users.wechatQrKey,
    publicNameMode: users.publicNameMode,
    publicNickname: users.publicNickname,
  }).from(users).where(eq(users.email, member.email)).limit(1);
  const requestedMode = payload.publicNameMode === undefined
    ? null
    : normalizePublicNameMode(payload.publicNameMode);
  if (payload.publicNameMode !== undefined && !requestedMode) {
    return Response.json({ error: "无效的公开身份设置。" }, { status: 400 });
  }
  const publicNameMode = requestedMode
    ?? (existing?.publicNameMode === "nickname" ? "nickname" : "anonymous");
  const publicNickname = payload.publicNickname === undefined
    ? normalizePublicNickname(existing?.publicNickname)
    : normalizePublicNickname(payload.publicNickname);
  if (publicNameMode === "nickname" && !isValidPublicNickname(publicNickname)) {
    return Response.json(
      { error: "昵称须为 2–20 个中文、日文、英文、数字或常用连接符。" },
      { status: 400 },
    );
  }
  const phone = payload.phone === undefined ? existing?.phone ?? "" : clean(payload.phone, 40);
  const wechat = payload.wechat === undefined ? existing?.wechat ?? "" : clean(payload.wechat, 60);
  const qq = payload.qq === undefined ? existing?.qq ?? "" : clean(payload.qq, 30);
  const wechatQrKey = typeof payload.wechatQrKey === "string" && payload.wechatQrKey.startsWith("profiles/")
    ? payload.wechatQrKey.slice(0, 240)
    : existing?.wechatQrKey ?? null;
  if (!phone && !wechat && !qq && !wechatQrKey) {
    return Response.json({ error: "请至少填写一种联系方式。" }, { status: 400 });
  }
  const [updated] = await db.update(users).set({
    phone: phone || null,
    wechat: wechat || null,
    qq: qq || null,
    wechatQrKey,
    publicNameMode,
    publicNickname: publicNameMode === "nickname" ? publicNickname : null,
    profileCompleted: true,
    lastSeenAt: new Date().toISOString(),
  }).where(eq(users.email, member.email)).returning({
    phone: users.phone, wechat: users.wechat, qq: users.qq,
    profileCompleted: users.profileCompleted,
    publicNameMode: users.publicNameMode, publicNickname: users.publicNickname,
  });
  return Response.json({ profile: updated, message: "公开身份与联系方式已保存。" });
}
