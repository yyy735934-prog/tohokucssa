import {
  outboundEmailRuntime,
  sendOutboundEmail,
  type OutboundEmailRuntime,
} from "./outbound-email";
import { renderMarketEmail } from "./email-template";

export const VERIFICATION_CODE_LIFETIME_MS = 10 * 60 * 1000;
export const VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;
export const VERIFICATION_MAX_ATTEMPTS = 5;

export async function verificationEmailRuntime() {
  const { env } = await import("cloudflare:workers");
  const runtime = env as unknown as { SESSION_SECRET?: string };
  return {
    ...(await outboundEmailRuntime()),
    secret: runtime.SESSION_SECRET ?? "",
  };
}

export async function sendVerificationCode(
  runtime: OutboundEmailRuntime,
  to: string,
  code: string,
  purpose: "notification" | "academic",
) {
  const title = purpose === "academic" ? "学术邮箱认证" : "收件邮箱变更";
  await sendOutboundEmail(runtime, {
    to,
    from: { email: runtime.from, name: "东北集市" },
    subject: `${code}｜东北集市${title}验证码`,
    text: `你的东北集市${title}验证码是：${code}\n\n验证码 10 分钟内有效，仅可使用一次。如果不是你本人操作，请忽略本邮件。`,
    html: renderMarketEmail({
      title: `东北集市${title}`,
      subtitle: "请使用下方验证码完成本次验证",
      contentHtml: `<div style="padding:18px;border-radius:12px;background:#f1f6ed;text-align:center"><span style="display:block;color:#718078;font-size:12px">你的验证码</span><b style="display:block;margin-top:7px;color:#17352d;font-size:30px;letter-spacing:8px">${code}</b></div><p style="margin:16px 0 0">验证码 10 分钟内有效，仅可使用一次。</p>`,
      footer: "如果不是你本人操作，请忽略本邮件。",
    }),
    auditLabel: `东北集市${title}验证码`,
  });
}
