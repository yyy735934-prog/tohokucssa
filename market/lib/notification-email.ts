import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { users } from "../db/schema";
import { isValidLoginEmail } from "./email-auth";
import { outboundEmailRuntime, sendOutboundEmail } from "./outbound-email";

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
      html: `<div style="font-family:system-ui,sans-serif;line-height:1.7;color:#18382e"><h2>${escapeEmailHtml(subject)}</h2><p>${escapeEmailHtml(text).replaceAll("\n", "<br>")}</p><p><a href="https://market.tohokucssa.org/account">前往个人中心</a></p><hr><small>你收到此邮件，是因为你的邮箱用于东北集市账号通知。请勿向任何人提供验证码或密码。</small></div>`,
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "member_notification_failed", error: error instanceof Error ? error.message.slice(0, 160) : "unknown" }));
  }
}
