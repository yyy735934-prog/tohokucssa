import { and, eq, gt, lt } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { emailLoginChallenges } from "../../../../../db/schema";
import {
  constantTimeTextEqual,
  displayNameFromEmail,
  hashEmailLoginCode,
  isSameOriginRequest,
  isValidLoginEmail,
  normalizeLoginEmail,
} from "../../../../../lib/email-auth";
import {
  createSessionCookie,
  safeRelativeReturnPath,
} from "../../../../chatgpt-auth";

const MAX_ATTEMPTS = 5;

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "请求来源无效。" }, { status: 403 });
  }

  const payload = (await request.json().catch(() => null)) as {
    email?: unknown;
    code?: unknown;
    returnTo?: unknown;
  } | null;
  const email = normalizeLoginEmail(payload?.email);
  const code = typeof payload?.code === "string" ? payload.code.trim() : "";
  if (!isValidLoginEmail(email) || !/^\d{6}$/.test(code)) {
    return invalidCodeResponse();
  }

  const { env } = await import("cloudflare:workers");
  const runtimeEnv = env as unknown as { SESSION_SECRET?: string };
  if (!runtimeEnv.SESSION_SECRET) {
    return Response.json({ error: "登录服务暂不可用。" }, { status: 503 });
  }

  const now = Date.now();
  const db = await getDb();
  const challenge = await db
    .select()
    .from(emailLoginChallenges)
    .where(eq(emailLoginChallenges.email, email))
    .limit(1);
  const row = challenge[0];
  if (!row || row.expiresAt <= now || row.attempts >= MAX_ATTEMPTS) {
    if (row) {
      await db
        .delete(emailLoginChallenges)
        .where(eq(emailLoginChallenges.email, email));
    }
    return invalidCodeResponse();
  }

  const submittedHash = await hashEmailLoginCode(
    runtimeEnv.SESSION_SECRET,
    email,
    code,
  );
  if (!constantTimeTextEqual(submittedHash, row.codeHash)) {
    await db
      .update(emailLoginChallenges)
      .set({ attempts: row.attempts + 1 })
      .where(
        and(
          eq(emailLoginChallenges.email, email),
          eq(emailLoginChallenges.codeHash, row.codeHash),
        ),
      );
    return invalidCodeResponse();
  }

  const consumed = await db
    .delete(emailLoginChallenges)
    .where(
      and(
        eq(emailLoginChallenges.email, email),
        eq(emailLoginChallenges.codeHash, row.codeHash),
        gt(emailLoginChallenges.expiresAt, now),
        lt(emailLoginChallenges.attempts, MAX_ATTEMPTS),
      ),
    )
    .returning({ email: emailLoginChallenges.email });
  if (!consumed[0]) return invalidCodeResponse();

  const sessionCookie = await createSessionCookie(
    email,
    displayNameFromEmail(email),
  );
  const returnTo = safeRelativeReturnPath(
    typeof payload?.returnTo === "string" ? payload.returnTo : "/",
  );
  return Response.json(
    { ok: true, returnTo },
    { headers: { "set-cookie": sessionCookie, "cache-control": "no-store" } },
  );
}

function invalidCodeResponse() {
  return Response.json(
    { error: "验证码错误或已过期，请重新获取。" },
    { status: 400 },
  );
}
