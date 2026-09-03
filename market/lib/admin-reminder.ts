import { isValidLoginEmail } from "./email-auth.ts";
import { sendOutboundEmail } from "./outbound-email.ts";

export type ReviewCounts = {
  listings: number;
  appeals: number;
};

export function buildAdminReviewReminder(counts: ReviewCounts) {
  if (counts.listings + counts.appeals === 0) return null;
  return {
    subject: `东北集市：今日有 ${counts.listings + counts.appeals} 项待审核`,
    text: [
      "管理员您好：",
      "",
      `当前待审核商品：${counts.listings} 件`,
      `当前学生身份申诉：${counts.appeals} 件`,
      "",
      "请进入管理后台及时处理：https://market.tohokucssa.org/admin",
    ].join("\n"),
  };
}

type ReminderEnv = {
  DB: D1Database;
  ADMIN_EMAILS?: string;
  EMAIL_FROM?: string;
  RESEND_API_KEY?: string;
};

function numericCount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

export async function sendDailyAdminReviewReminder(env: ReminderEnv) {
  const [listingRow, appealRow] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS count FROM listings WHERE status = 'pending'").first<{ count: number | string }>(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM verification_appeals WHERE status = 'pending'").first<{ count: number | string }>(),
  ]);
  const reminder = buildAdminReviewReminder({
    listings: numericCount(listingRow?.count),
    appeals: numericCount(appealRow?.count),
  });
  if (!reminder) return { sent: 0 };

  const from = env.EMAIL_FROM?.trim().toLowerCase() ?? "";
  const recipients = (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(isValidLoginEmail);
  if (!from || !env.RESEND_API_KEY || recipients.length === 0) {
    throw new Error("Admin reminder email is not configured");
  }
  const runtime = {
    resendApiKey: env.RESEND_API_KEY.trim(),
    from,
    enabled: true,
    db: env.DB,
  };
  const html = `<div style="font-family:system-ui,sans-serif;line-height:1.7;color:#18382e"><h2>${reminder.subject}</h2><p>${reminder.text.replaceAll("\n", "<br>")}</p><p><a href="https://market.tohokucssa.org/admin">进入管理后台</a></p><hr><small>你收到此邮件，是因为该邮箱被配置为东北集市管理员邮箱。</small></div>`;
  const results = await Promise.allSettled(recipients.map((to) => sendOutboundEmail(runtime, {
    to,
    from: { email: from, name: "东北集市" },
    subject: reminder.subject,
    text: reminder.text,
    html,
    auditLabel: "管理员待审核提醒",
  })));
  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length) throw new Error(`Failed to send ${failed.length} admin reminder email(s)`);
  return { sent: recipients.length };
}
