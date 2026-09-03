import { isValidLoginEmail } from "./email-auth.ts";
import { acceptedContactEmailText } from "./contact-notification.ts";
import { sendOutboundEmail, type EmailBinding } from "./outbound-email.ts";

export type ContactEmailEnv = {
  DB: D1Database;
  EMAIL?: EmailBinding;
  EMAIL_FROM?: string;
  RESEND_API_KEY?: string;
};

type PendingContactEmail = {
  id: string;
  title: string;
  recipient: string;
  phone: string | null;
  wechat: string | null;
  qq: string | null;
  wechatQrKey: string | null;
  attempts: number;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export function canRetryContactEmail(attempts: number) {
  return Number.isFinite(attempts) && attempts < 5;
}

export async function deliverAcceptedContactEmail(env: ContactEmailEnv, requestId: string) {
  const contact = await env.DB.prepare(`
    SELECT c.id, l.title,
      COALESCE(NULLIF(TRIM(b.notification_email), ''), b.email) AS recipient,
      s.phone, s.wechat, s.qq, s.wechat_qr_key AS wechatQrKey,
      c.buyer_notification_attempts AS attempts
    FROM contact_requests c
    JOIN listings l ON l.id = c.listing_id
    JOIN users b ON b.email = c.buyer_email
    JOIN users s ON s.email = c.seller_email
    WHERE c.id = ? AND c.status = 'accepted' AND c.buyer_notified_at IS NULL
    LIMIT 1
  `).bind(requestId).first<PendingContactEmail>();

  if (!contact) return { delivered: true, reason: "already-delivered-or-not-found" } as const;
  if (!canRetryContactEmail(Number(contact.attempts))) {
    return { delivered: false, reason: "retry-limit" } as const;
  }

  const recipient = contact.recipient?.trim().toLowerCase() ?? "";
  const from = env.EMAIL_FROM?.trim().toLowerCase() ?? "";
  if (!isValidLoginEmail(recipient) || !isValidLoginEmail(from) || (!env.EMAIL && !env.RESEND_API_KEY?.trim())) {
    await env.DB.prepare(`
      UPDATE contact_requests
      SET buyer_notification_attempts = buyer_notification_attempts + 1,
          buyer_notification_error = 'email-runtime-not-configured'
      WHERE id = ?
    `).bind(requestId).run();
    return { delivered: false, reason: "not-configured" } as const;
  }

  const text = acceptedContactEmailText(contact.title, {
    phone: contact.phone,
    wechat: contact.wechat,
    qq: contact.qq,
    hasWechatQr: Boolean(contact.wechatQrKey),
  });
  try {
    await sendOutboundEmail({
      binding: env.EMAIL,
      resendApiKey: env.RESEND_API_KEY?.trim() ?? "",
      from,
      enabled: true,
    }, {
      to: recipient,
      from: { email: from, name: "东北集市" },
      subject: "卖家已接受你的联系申请",
      text,
      html: `<div style="font-family:system-ui,sans-serif;line-height:1.7;color:#18382e"><h2>卖家已接受你的联系申请</h2><p>${escapeHtml(text).replaceAll("\n", "<br>")}</p><p><a href="https://market.tohokucssa.org/account#contacts">查看交易联系</a></p><hr><small>你收到此邮件，是因为你曾在东北集市申请联系该商品卖家。</small></div>`,
    });
    await env.DB.prepare(`
      UPDATE contact_requests
      SET buyer_notified_at = CURRENT_TIMESTAMP,
          buyer_notification_attempts = buyer_notification_attempts + 1,
          buyer_notification_error = NULL
      WHERE id = ?
    `).bind(requestId).run();
    return { delivered: true, reason: "sent" } as const;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 160) : "unknown";
    await env.DB.prepare(`
      UPDATE contact_requests
      SET buyer_notification_attempts = buyer_notification_attempts + 1,
          buyer_notification_error = ?
      WHERE id = ?
    `).bind(message, requestId).run();
    console.error(JSON.stringify({ event: "accepted_contact_email_failed", requestId, error: message }));
    return { delivered: false, reason: "provider-error" } as const;
  }
}

export async function retryAcceptedContactEmails(env: ContactEmailEnv) {
  const rows = await env.DB.prepare(`
    SELECT id FROM contact_requests
    WHERE status = 'accepted'
      AND buyer_notified_at IS NULL
      AND buyer_notification_attempts < 5
    ORDER BY updated_at ASC
    LIMIT 20
  `).all<{ id: string }>();
  const results = [];
  for (const row of rows.results ?? []) {
    results.push(await deliverAcceptedContactEmail(env, row.id));
  }
  return results;
}
