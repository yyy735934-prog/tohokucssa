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
};

export type OutboundEmailRuntime = {
  binding?: EmailBinding;
  resendApiKey: string;
  from: string;
  enabled: boolean;
};

export async function outboundEmailRuntime(): Promise<OutboundEmailRuntime> {
  const { env } = await import("cloudflare:workers");
  const runtime = env as unknown as {
    EMAIL?: EmailBinding;
    EMAIL_FROM?: string;
    RESEND_API_KEY?: string;
  };
  const from = runtime.EMAIL_FROM?.trim().toLowerCase() ?? "";
  const resendApiKey = runtime.RESEND_API_KEY?.trim() ?? "";
  return {
    binding: runtime.EMAIL,
    resendApiKey,
    from: isValidLoginEmail(from) ? from : "",
    enabled: Boolean((runtime.EMAIL || resendApiKey) && isValidLoginEmail(from)),
  };
}

export async function sendOutboundEmail(
  runtime: OutboundEmailRuntime,
  message: OutboundEmailMessage,
) {
  if (!runtime.enabled) throw new Error("Outbound email is not configured");

  if (runtime.binding) {
    return runtime.binding.send(message);
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

  return response.json().catch(() => ({}));
}
