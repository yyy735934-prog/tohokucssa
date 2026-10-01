import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { users } from "../db/schema";
import { isValidLoginEmail } from "./email-auth";
import { outboundEmailRuntime, sendOutboundEmail } from "./outbound-email";
import { renderMarketEmail } from "./email-template";

export function escapeEmailHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export async function sendMemberNotification(userEmail: string, subject: string, text: string) {
  try {
    const db = await getDb();
    const [member] = await db.select({ email: users.email, notificationEmail: users.notificationEmail }).from(users).where(eq(users.email, userEmail)).limit(1);
    const to = member?.notificationEmail || member?.email;
    if (!to || !isValidLoginEmail(to)) return;
    const runtime = await outboundEmailRuntime();
    if (!runtime.enabled) return;
    await sendOutboundEmail(runtime, {
      to,
      from: { email: runtime.from, name: "东北集市" },
      subject,
      text,
      html: renderMarketEmail({
        title: subject,
        subtitle: "东北集市账号通知",
        contentHtml: `<div style="padding:16px;border-radius:12px;background:#f1f6ed">${escapeEmailHtml(text).replaceAll("\n", "<br>")}</div>`,
        action: { href: "https://market.tohokucssa.org/account", label: "前往个人中心" },
        footer: "你收到此邮件，是因为该邮箱用于东北集市账号通知。请勿向任何人提供验证码或密码。",
      }),
      auditLabel: subject,
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "member_notification_failed", error: error instanceof Error ? error.message.slice(0, 160) : "unknown" }));
  }
}
