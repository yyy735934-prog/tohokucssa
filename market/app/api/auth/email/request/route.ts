import { and, count, eq, gte, lt } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { emailLoginChallenges } from "../../../../../db/schema";
import {
  createEmailLoginCode,
  hashEmailLoginCode,
  hashEmailLoginRateLimitKey,
  isSameOriginRequest,
  isValidLoginEmail,
  normalizeLoginEmail,
} from "../../../../../lib/email-auth";
import {
  outboundEmailRuntime,
  sendOutboundEmail,
} from "../../../../../lib/outbound-email";

const CODE_LIFETIME_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const IP_WINDOW_MS = 10 * 60 * 1000;
const MAX_IP_REQUESTS = 8;

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "请求来源无效。" }, { status: 403 });
  }

  const payload = (await request.json().catch(() => null)) as {
    email?: unknown;
  } | null;
  const email = normalizeLoginEmail(payload?.email);
  if (!isValidLoginEmail(email)) {
    return Response.json({ error: "请输入有效的邮箱地址。" }, { status: 400 });
  }

  const { env } = await import("cloudflare:workers");
  const runtimeEnv = env as unknown as {
    SESSION_SECRET?: string;
  };
  const emailRuntime = await outboundEmailRuntime();
  if (!emailRuntime.enabled) {
    return Response.json(
      { error: "邮箱验证码登录正在配置中，请暂时使用 Google 登录。" },
      { status: 503 },
    );
  }
  if (!runtimeEnv.SESSION_SECRET) {
    return Response.json({ error: "登录服务暂不可用。" }, { status: 503 });
  }

  const now = Date.now();
  const db = await getDb();
  await db.delete(emailLoginChallenges).where(lt(emailLoginChallenges.expiresAt, now));

  const existing = await db
    .select({ lastSentAt: emailLoginChallenges.lastSentAt })
    .from(emailLoginChallenges)
    .where(eq(emailLoginChallenges.email, email))
    .limit(1);
  if (existing[0] && now - existing[0].lastSentAt < RESEND_COOLDOWN_MS) {
    return Response.json({ ok: true, message: "验证码已发送，请检查邮箱。" });
  }

  const requestIp =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const requestIpHash = await hashEmailLoginRateLimitKey(
    runtimeEnv.SESSION_SECRET,
    requestIp,
  );
  const recentRequests = await db
    .select({ value: count() })
    .from(emailLoginChallenges)
    .where(
      and(
        eq(emailLoginChallenges.requestIpHash, requestIpHash),
        gte(emailLoginChallenges.lastSentAt, now - IP_WINDOW_MS),
      ),
    );
  if (Number(recentRequests[0]?.value ?? 0) >= MAX_IP_REQUESTS) {
    return Response.json(
      { error: "验证码请求过于频繁，请稍后再试。" },
      { status: 429 },
    );
  }

  const code = createEmailLoginCode();
  const codeHash = await hashEmailLoginCode(
    runtimeEnv.SESSION_SECRET,
    email,
    code,
  );
  await db
    .insert(emailLoginChallenges)
    .values({
      email,
      codeHash,
      expiresAt: now + CODE_LIFETIME_MS,
      attempts: 0,
      requestIpHash,
      lastSentAt: now,
    })
    .onConflictDoUpdate({
      target: emailLoginChallenges.email,
      set: {
        codeHash,
        expiresAt: now + CODE_LIFETIME_MS,
        attempts: 0,
        requestIpHash,
        lastSentAt: now,
      },
    });

  try {
    await sendOutboundEmail(emailRuntime, {
      to: email,
      from: { email: emailRuntime.from, name: "东北集市" },
      subject: `${code}｜东北集市登录验证码`,
      text: `你的东北集市登录验证码是：${code}\n\n验证码 10 分钟内有效，仅可使用一次。如果不是你本人操作，请忽略本邮件。`,
      html: `<div style="font-family:system-ui,sans-serif;line-height:1.7;color:#18382e"><h2>东北集市登录验证码</h2><p>你的验证码是：</p><p style="font-size:30px;font-weight:800;letter-spacing:8px">${code}</p><p>验证码 10 分钟内有效，仅可使用一次。</p><p style="color:#718078">如果不是你本人操作，请忽略本邮件。</p></div>`,
    });
  } catch (error) {
    await db
      .delete(emailLoginChallenges)
      .where(
        and(
          eq(emailLoginChallenges.email, email),
          eq(emailLoginChallenges.codeHash, codeHash),
        ),
      );
    console.error(
      JSON.stringify({
        event: "email_login_send_failed",
        error: safeEmailSendError(error),
      }),
    );
    return Response.json(
      { error: "验证码发送失败，请稍后重试或使用 Google 登录。" },
      { status: 502 },
    );
  }

  return Response.json({ ok: true, message: "验证码已发送，请检查邮箱。" });
}

function safeEmailSendError(error: unknown) {
  return (error instanceof Error ? error.message : "unknown")
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[REDACTED_EMAIL]")
    .replace(/\b\d{6}\b/g, "[REDACTED_CODE]")
    .slice(0, 200);
}
