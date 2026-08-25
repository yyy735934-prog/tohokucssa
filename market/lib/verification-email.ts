import { isValidLoginEmail } from "./email-auth";

export const VERIFICATION_CODE_LIFETIME_MS = 10 * 60 * 1000;
export const VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;
export const VERIFICATION_MAX_ATTEMPTS = 5;

type EmailBinding = {
  send(message: {
    to: string;
    from: { email: string; name: string };
    subject: string;
    text: string;
    html: string;
  }): Promise<{ messageId: string }>;
};

export async function verificationEmailRuntime() {
  const { env } = await import("cloudflare:workers");
  const runtime = env as unknown as {
    EMAIL?: EmailBinding;
    EMAIL_FROM?: string;
    SESSION_SECRET?: string;
  };
  const from = runtime.EMAIL_FROM?.trim().toLowerCase() ?? "";
  return {
    email: runtime.EMAIL,
    from: isValidLoginEmail(from) ? from : "",
    secret: runtime.SESSION_SECRET ?? "",
  };
}

export async function sendVerificationCode(
  binding: EmailBinding,
  from: string,
  to: string,
  code: string,
  purpose: "notification" | "academic",
) {
  const title = purpose === "academic" ? "学术邮箱认证" : "收件邮箱变更";
  await binding.send({
    to,
    from: { email: from, name: "东北集市" },
    subject: `${code}｜东北集市${title}验证码`,
    text: `你的东北集市${title}验证码是：${code}\n\n验证码 10 分钟内有效，仅可使用一次。如果不是你本人操作，请忽略本邮件。`,
    html: `<div style="font-family:system-ui,sans-serif;line-height:1.7;color:#18382e"><h2>东北集市${title}</h2><p>你的验证码是：</p><p style="font-size:30px;font-weight:800;letter-spacing:8px">${code}</p><p>验证码 10 分钟内有效，仅可使用一次。</p><p style="color:#718078">如果不是你本人操作，请忽略本邮件。</p></div>`,
  });
}

