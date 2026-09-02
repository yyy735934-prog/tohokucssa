import { eq, or } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { academicEmailChallenges, users } from "../../../../../db/schema";
import { getMemberAccess, isAcademicEmail } from "../../../../../lib/auth";
import { createEmailLoginCode, hashEmailLoginCode, isSameOriginRequest, isValidLoginEmail, normalizeLoginEmail } from "../../../../../lib/email-auth";
import { sendVerificationCode, VERIFICATION_CODE_LIFETIME_MS, VERIFICATION_RESEND_COOLDOWN_MS, verificationEmailRuntime } from "../../../../../lib/verification-email";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "请求来源无效。" }, { status: 403 });
  const member = await getMemberAccess();
  if (!member) return Response.json({ error: "请先登录。" }, { status: 401 });
  if (member.academicStatus === "verified") return Response.json({ error: "你的学生身份已认证。" }, { status: 409 });
  const payload = await request.json().catch(() => null) as { email?: unknown } | null;
  const academicEmail = normalizeLoginEmail(payload?.email);
  if (!isValidLoginEmail(academicEmail) || !isAcademicEmail(academicEmail)) return Response.json({ error: "请输入有效的学校或学术机构邮箱。" }, { status: 400 });
  const db = await getDb();
  const [claimed] = await db.select({ email: users.email }).from(users).where(or(eq(users.email, academicEmail), eq(users.academicEmail, academicEmail))).limit(1);
  if (claimed && claimed.email !== member.email) return Response.json({ error: "该学术邮箱已被其他账号使用。" }, { status: 409 });
  const runtime = await verificationEmailRuntime();
  if (!runtime.enabled || !runtime.secret) return Response.json({ error: "邮件验证服务暂不可用。" }, { status: 503 });
  const now = Date.now();
  const [existing] = await db.select({ lastSentAt: academicEmailChallenges.lastSentAt }).from(academicEmailChallenges).where(eq(academicEmailChallenges.userEmail, member.email)).limit(1);
  if (existing && now - existing.lastSentAt < VERIFICATION_RESEND_COOLDOWN_MS) return Response.json({ ok: true, message: "验证码已发送，请检查学术邮箱。" });
  const code = createEmailLoginCode();
  const codeHash = await hashEmailLoginCode(runtime.secret, `academic:${member.email}:${academicEmail}`, code);
  await db.insert(academicEmailChallenges).values({ userEmail: member.email, academicEmail, codeHash, expiresAt: now + VERIFICATION_CODE_LIFETIME_MS, attempts: 0, lastSentAt: now }).onConflictDoUpdate({ target: academicEmailChallenges.userEmail, set: { academicEmail, codeHash, expiresAt: now + VERIFICATION_CODE_LIFETIME_MS, attempts: 0, lastSentAt: now } });
  try { await sendVerificationCode(runtime, academicEmail, code, "academic"); }
  catch { await db.delete(academicEmailChallenges).where(eq(academicEmailChallenges.userEmail, member.email)); return Response.json({ error: "验证码发送失败，请稍后重试。" }, { status: 502 }); }
  return Response.json({ ok: true, message: "验证码已发送，请检查学术邮箱。" });
}
