import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { emailChangeChallenges, users } from "../../../../../db/schema";
import { getMemberAccess } from "../../../../../lib/auth";
import {
  createEmailLoginCode,
  hashEmailLoginCode,
  isSameOriginRequest,
  isValidLoginEmail,
  normalizeLoginEmail,
} from "../../../../../lib/email-auth";
import {
  sendVerificationCode,
  VERIFICATION_CODE_LIFETIME_MS,
  VERIFICATION_RESEND_COOLDOWN_MS,
  verificationEmailRuntime,
} from "../../../../../lib/verification-email";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "请求来源无效。" }, { status: 403 });
  const member = await getMemberAccess();
  if (!member) return Response.json({ error: "请先登录。" }, { status: 401 });
  if (member.academicStatus !== "verified" && !member.isAdmin) {
    return Response.json({ error: "学生身份认证通过后才能更换收件邮箱。" }, { status: 403 });
  }
  const payload = await request.json().catch(() => null) as { email?: unknown } | null;
  const newEmail = normalizeLoginEmail(payload?.email);
  if (!isValidLoginEmail(newEmail)) return Response.json({ error: "请输入有效的邮箱地址。" }, { status: 400 });

  const db = await getDb();
  const [profile] = await db.select({ notificationEmail: users.notificationEmail }).from(users).where(eq(users.email, member.email)).limit(1);
  if (newEmail === member.email || newEmail === profile?.notificationEmail) {
    return Response.json({ error: "请输入不同于当前收件邮箱的新地址。" }, { status: 400 });
  }
  const runtime = await verificationEmailRuntime();
  if (!runtime.email || !runtime.from || !runtime.secret) return Response.json({ error: "邮件验证服务暂不可用。" }, { status: 503 });
  const now = Date.now();
  const [existing] = await db.select({ lastSentAt: emailChangeChallenges.lastSentAt }).from(emailChangeChallenges).where(eq(emailChangeChallenges.userEmail, member.email)).limit(1);
  if (existing && now - existing.lastSentAt < VERIFICATION_RESEND_COOLDOWN_MS) {
    return Response.json({ ok: true, message: "验证码已发送，请检查新邮箱。" });
  }
  const code = createEmailLoginCode();
  const codeHash = await hashEmailLoginCode(runtime.secret, `notification:${member.email}:${newEmail}`, code);
  await db.insert(emailChangeChallenges).values({ userEmail: member.email, newEmail, codeHash, expiresAt: now + VERIFICATION_CODE_LIFETIME_MS, attempts: 0, lastSentAt: now }).onConflictDoUpdate({ target: emailChangeChallenges.userEmail, set: { newEmail, codeHash, expiresAt: now + VERIFICATION_CODE_LIFETIME_MS, attempts: 0, lastSentAt: now } });
  try {
    await sendVerificationCode(runtime.email, runtime.from, newEmail, code, "notification");
  } catch {
    await db.delete(emailChangeChallenges).where(eq(emailChangeChallenges.userEmail, member.email));
    return Response.json({ error: "验证码发送失败，请稍后重试。" }, { status: 502 });
  }
  return Response.json({ ok: true, message: "验证码已发送，请检查新邮箱。" });
}

