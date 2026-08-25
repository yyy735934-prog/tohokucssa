import { and, eq, gt, lt, or } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { academicEmailChallenges, users } from "../../../../../db/schema";
import { getMemberAccess } from "../../../../../lib/auth";
import { constantTimeTextEqual, hashEmailLoginCode, isSameOriginRequest } from "../../../../../lib/email-auth";
import { VERIFICATION_MAX_ATTEMPTS, verificationEmailRuntime } from "../../../../../lib/verification-email";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "请求来源无效。" }, { status: 403 });
  const member = await getMemberAccess();
  if (!member) return Response.json({ error: "请先登录。" }, { status: 401 });
  const payload = await request.json().catch(() => null) as { code?: unknown } | null;
  const code = typeof payload?.code === "string" ? payload.code.trim() : "";
  if (!/^\d{6}$/.test(code)) return invalid();
  const runtime = await verificationEmailRuntime();
  if (!runtime.secret) return Response.json({ error: "邮件验证服务暂不可用。" }, { status: 503 });
  const db = await getDb();
  const [row] = await db.select().from(academicEmailChallenges).where(eq(academicEmailChallenges.userEmail, member.email)).limit(1);
  const now = Date.now();
  if (!row || row.expiresAt <= now || row.attempts >= VERIFICATION_MAX_ATTEMPTS) return invalid();
  const submitted = await hashEmailLoginCode(runtime.secret, `academic:${member.email}:${row.academicEmail}`, code);
  if (!constantTimeTextEqual(submitted, row.codeHash)) {
    await db.update(academicEmailChallenges).set({ attempts: row.attempts + 1 }).where(and(eq(academicEmailChallenges.userEmail, member.email), eq(academicEmailChallenges.codeHash, row.codeHash)));
    return invalid();
  }
  const [claimed] = await db.select({ email: users.email }).from(users).where(or(eq(users.email, row.academicEmail), eq(users.academicEmail, row.academicEmail))).limit(1);
  if (claimed && claimed.email !== member.email) return Response.json({ error: "该学术邮箱已被其他账号使用。" }, { status: 409 });
  const consumed = await db.delete(academicEmailChallenges).where(and(eq(academicEmailChallenges.userEmail, member.email), eq(academicEmailChallenges.codeHash, row.codeHash), gt(academicEmailChallenges.expiresAt, now), lt(academicEmailChallenges.attempts, VERIFICATION_MAX_ATTEMPTS))).returning({ email: academicEmailChallenges.academicEmail });
  if (!consumed[0]) return invalid();
  await db.update(users).set({ academicEmail: consumed[0].email, academicStatus: "verified", lastSeenAt: new Date().toISOString() }).where(eq(users.email, member.email));
  return Response.json({ ok: true, email: consumed[0].email, message: "学生身份认证成功。" });
}

function invalid() { return Response.json({ error: "验证码错误或已过期，请重新获取。" }, { status: 400 }); }
