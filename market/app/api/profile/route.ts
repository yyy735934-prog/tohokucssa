import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { users } from "../../../db/schema";
import { getMemberAccess } from "../../../lib/auth";
import {
  isValidPublicNickname,
  normalizePublicNameMode,
  normalizePublicNickname,
} from "../../../lib/public-identity";

export async function GET() {
  const member = await getMemberAccess();
  if (!member) return Response.json({ error: "请先登录。" }, { status: 401 });
  const db = await getDb();
  const [profile] = await db.select({
    publicNameMode: users.publicNameMode,
    publicNickname: users.publicNickname,
  }).from(users).where(eq(users.email, member.email)).limit(1);
  return Response.json({ profile });
}

export async function PATCH(request: Request) {
  const member = await getMemberAccess();
  if (!member) return Response.json({ error: "请先登录。" }, { status: 401 });
  const payload = (await request.json()) as {
    publicNameMode?: string;
    publicNickname?: string;
  };
  const db = await getDb();
  const [existing] = await db.select({
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
  const [updated] = await db.update(users).set({
    publicNameMode,
    publicNickname: publicNameMode === "nickname" ? publicNickname : null,
    profileCompleted: true,
    lastSeenAt: new Date().toISOString(),
  }).where(eq(users.email, member.email)).returning({
    publicNameMode: users.publicNameMode,
    publicNickname: users.publicNickname,
  });
  return Response.json({ profile: updated, message: "公开身份设置已保存。" });
}
