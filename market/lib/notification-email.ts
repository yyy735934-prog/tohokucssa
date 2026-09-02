import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { users } from "../db/schema";
import { isValidLoginEmail } from "./email-auth";

type EmailBinding = {
  send(message: {
    to: string;
    from: { email: string; name: string };
    subject: string;
    text: string;
    html: string;
  }): Promise<{ messageId: string }>;
};

export function escapeEmailHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export async function sendMemberNotification(userEmail: string, subject: string, text: string) {
  try {
    const db = await getDb();
    const [member] = await db.select({ email: users.email, notificationEmail: users.notificationEmail }).from(users).where(eq(users.email, userEmail)).limit(1);
    const to = member?.notificationEmail || member?.email;
    if (!to || !isValidLoginEmail(to)) return;
    const { env } = await import("cloudflare:workers");
    const runtime = env as unknown as { EMAIL?: EmailBinding; EMAIL_FROM?: string };
    const from = runtime.EMAIL_FROM?.trim().toLowerCase() ?? "";
    if (!runtime.EMAIL || !isValidLoginEmail(from)) return;
    await runtime.EMAIL.send({
      to,
      from: { email: from, name: "东北集市" },
      subject,
      text,
      html: `<div style="font-family:system-ui,sans-serif;line-height:1.7;color:#18382e"><h2>${escapeEmailHtml(subject)}</h2><p>${escapeEmailHtml(text).replaceAll("\n", "<br>")}</p><p><a href="https://market.tohokucssa.org/account">前往个人中心</a></p></div>`,
    });
  } catch (error) {
    console.error(JSON.stringify({ event: "member_notification_failed", error: error instanceof Error ? error.message.slice(0, 160) : "unknown" }));
  }
}
