import { isValidLoginEmail } from "./email-auth.ts";
import { renderMarketEmail } from "./email-template.ts";
import { sendOutboundEmail } from "./outbound-email.ts";

type ReminderEnv = {
  DB: D1Database;
  EMAIL_FROM?: string;
  RESEND_API_KEY?: string;
  EMAIL?: import("./outbound-email.ts").EmailBinding;
};

type UnreadRow = {
  userEmail: string;
  deliveryEmail: string;
  messageCount: number | string;
};

export function unreadReminderWindow(scheduledTime: number) {
  const scheduled = new Date(scheduledTime);
  const windowEnd = Math.floor(Date.UTC(
    scheduled.getUTCFullYear(),
    scheduled.getUTCMonth(),
    scheduled.getUTCDate(),
    23,
  ) / 1000);
  return { windowStart: windowEnd - 24 * 60 * 60, windowEnd };
}

export function buildUnreadReminder(messageCount: number) {
  const count = Math.max(1, Math.trunc(messageCount));
  return {
    subject: `东北集市：你有 ${count} 条未读交易消息`,
    text: `你在过去一天收到 ${count} 条尚未浏览的交易消息。请登录东北集市，及时查看并回复。\n\nhttps://market.tohokucssa.org/messages`,
  };
}

function safeError(error: unknown) {
  return (error instanceof Error ? error.message : "unknown").slice(0, 180);
}

export async function sendDailyUnreadChatReminders(env: ReminderEnv, scheduledTime: number) {
  const { windowStart, windowEnd } = unreadReminderWindow(scheduledTime);
  const result = await env.DB.prepare(`
    SELECT
      events.recipient_email AS userEmail,
      COALESCE(NULLIF(users.notification_email, ''), users.email) AS deliveryEmail,
      COUNT(*) AS messageCount
    FROM chat_message_events AS events
    INNER JOIN users ON users.email = events.recipient_email
    LEFT JOIN chat_conversation_reads AS reads
      ON reads.conversation_id = events.conversation_id
      AND reads.user_email = events.recipient_email
    WHERE events.sent_at >= ?
      AND events.sent_at < ?
      AND events.sent_at > COALESCE(reads.last_read_at, 0)
    GROUP BY events.recipient_email, deliveryEmail
  `).bind(windowStart, windowEnd).all<UnreadRow>();

  const from = env.EMAIL_FROM?.trim().toLowerCase() ?? "";
  const resendApiKey = env.RESEND_API_KEY?.trim() ?? "";
  if (!from || !isValidLoginEmail(from) || (!env.EMAIL && !resendApiKey)) {
    throw new Error("Unread chat reminder email is not configured");
  }
  const runtime = { binding: env.EMAIL, resendApiKey, from, enabled: true, db: env.DB };
  let sent = 0;

  for (const row of result.results ?? []) {
    const deliveryEmail = String(row.deliveryEmail ?? "").trim().toLowerCase();
    const userEmail = String(row.userEmail ?? "").trim().toLowerCase();
    const messageCount = Math.max(0, Math.trunc(Number(row.messageCount) || 0));
    if (!isValidLoginEmail(deliveryEmail) || !isValidLoginEmail(userEmail) || !messageCount) continue;

    const runId = `${windowEnd}:${userEmail}`;
    const reserved = await env.DB.prepare(`
      INSERT INTO chat_unread_reminder_runs
        (id, user_email, window_start, window_end, message_count, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'sending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        message_count = excluded.message_count,
        status = 'sending',
        error = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE chat_unread_reminder_runs.status = 'failed'
    `).bind(runId, userEmail, windowStart, windowEnd, messageCount).run();
    if (!reserved.meta.changes) continue;

    const reminder = buildUnreadReminder(messageCount);
    try {
      await sendOutboundEmail(runtime, {
        to: deliveryEmail,
        from: { email: from, name: "东北集市" },
        subject: reminder.subject,
        text: reminder.text,
        html: renderMarketEmail({
          title: reminder.subject,
          subtitle: "每日 08:00 未读消息提醒",
          contentHtml: `<div style="padding:16px;border-radius:12px;background:#f1f6ed"><b style="font-size:17px">过去一天有 ${messageCount} 条消息等待查看</b><p style="margin:8px 0 0;color:#718078">为保护交易隐私，邮件不会显示聊天正文。请登录东北集市查看。</p></div>`,
          action: { href: "https://market.tohokucssa.org/messages", label: "查看交易消息" },
          footer: "你收到此邮件，是因为该邮箱用于东北集市账号通知。",
        }),
        auditLabel: "未读交易消息提醒",
      });
      await env.DB.prepare("UPDATE chat_unread_reminder_runs SET status = 'sent', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(runId).run();
      sent += 1;
    } catch (error) {
      await env.DB.prepare("UPDATE chat_unread_reminder_runs SET status = 'failed', error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(safeError(error), runId).run();
      console.error(JSON.stringify({ event: "chat_unread_reminder_failed", error: safeError(error) }));
    }
  }
  return { sent, candidates: result.results?.length ?? 0, windowStart, windowEnd };
}
