import { isValidLoginEmail } from "./email-auth.ts";

export type EmailBinding = {
  send(message: OutboundEmailMessage): Promise<unknown>;
};

export type OutboundEmailMessage = {
  to: string;
  from: { email: string; name: string };
  subject: string;
  text: string;
  html: string;
  auditLabel?: string;
};

export type OutboundEmailRuntime = {
  binding?: EmailBinding;
  resendApiKey: string;
  from: string;
  enabled: boolean;
  db?: D1Database;
};

export function maskEmailForLog(email: string) {
  const [local = "", domain = ""] = email.trim().toLowerCase().split("@");
  if (!domain) return "[invalid-email]";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

export function emailAuditSubject(message: Pick<OutboundEmailMessage, "subject" | "auditLabel">) {
  return (message.auditLabel?.trim() || message.subject)
    .replace(/\b\d{6}\b/g, "[验证码]")
    .slice(0, 160);
}

function safeDeliveryError(error: unknown) {
  return (error instanceof Error ? error.message : "unknown")
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[REDACTED_EMAIL]")
    .replace(/\b\d{6}\b/g, "[REDACTED_CODE]")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .slice(0, 240);
}

async function createDeliveryLog(runtime: OutboundEmailRuntime, message: OutboundEmailMessage, provider: string) {
  if (!runtime.db) return null;
  const id = crypto.randomUUID();
  try {
    await runtime.db.prepare(`
      INSERT INTO email_delivery_logs
        (id, recipient_masked, subject, provider, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'sending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(id, maskEmailForLog(message.to), emailAuditSubject(message), provider).run();
    return id;
  } catch (error) {
    console.error(JSON.stringify({ event: "email_delivery_log_create_failed", error: safeDeliveryError(error) }));
    return null;
  }
}

async function finishDeliveryLog(runtime: OutboundEmailRuntime, id: string | null, status: "accepted" | "failed", providerMessageId?: string, error?: unknown) {
  if (!runtime.db || !id) return;
  try {
    await runtime.db.prepare(`
      UPDATE email_delivery_logs
      SET status = ?, provider_message_id = ?, error = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(status, providerMessageId || null, error ? safeDeliveryError(error) : null, id).run();
  } catch (logError) {
    console.error(JSON.stringify({ event: "email_delivery_log_update_failed", error: safeDeliveryError(logError) }));
  }
}

export async function outboundEmailRuntime(): Promise<OutboundEmailRuntime> {
  const { env } = await import("cloudflare:workers");
  const runtime = env as unknown as {
    EMAIL?: EmailBinding;
    EMAIL_FROM?: string;
    RESEND_API_KEY?: string;
    DB?: D1Database;
  };
  const from = runtime.EMAIL_FROM?.trim().toLowerCase() ?? "";
  const resendApiKey = runtime.RESEND_API_KEY?.trim() ?? "";
  return {
    binding: runtime.EMAIL,
    resendApiKey,
    from: isValidLoginEmail(from) ? from : "",
    enabled: Boolean((runtime.EMAIL || resendApiKey) && isValidLoginEmail(from)),
    db: runtime.DB,
  };
}

export async function sendOutboundEmail(
  runtime: OutboundEmailRuntime,
  message: OutboundEmailMessage,
) {
  if (!runtime.enabled) throw new Error("Outbound email is not configured");

  const provider = runtime.binding ? "cloudflare-email" : "resend";
  const logId = await createDeliveryLog(runtime, message, provider);

  try {
    if (runtime.binding) {
      const result = await runtime.binding.send(message);
      await finishDeliveryLog(runtime, logId, "accepted");
      return result;
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${runtime.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${message.from.name} <${message.from.email}>`,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });

    if (!response.ok) {
      throw new Error(`Resend API returned HTTP ${response.status}`);
    }

    const result = await response.json().catch(() => ({})) as { id?: string };
    await finishDeliveryLog(runtime, logId, "accepted", result.id);
    return result;
  } catch (error) {
    await finishDeliveryLog(runtime, logId, "failed", undefined, error);
    throw error;
  }
}
