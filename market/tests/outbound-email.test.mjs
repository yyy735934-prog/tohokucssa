import assert from "node:assert/strict";
import test from "node:test";
import { sendOutboundEmail } from "../lib/outbound-email.ts";

const message = {
  to: "member@example.com",
  from: { email: "noreply@tohokucssa.org", name: "东北集市" },
  subject: "测试邮件",
  text: "测试正文",
  html: "<p>测试正文</p>",
};

test("uses a configured Cloudflare Email binding when available", async () => {
  let sent;
  const result = await sendOutboundEmail(
    {
      binding: { send: async (value) => { sent = value; return { messageId: "test" }; } },
      resendApiKey: "",
      from: message.from.email,
      enabled: true,
    },
    message,
  );
  assert.deepEqual(sent, message);
  assert.deepEqual(result, { messageId: "test" });
});

test("sends through Resend when no Cloudflare Email binding is configured", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url, init };
    return new Response(JSON.stringify({ id: "email-id" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    const result = await sendOutboundEmail(
      {
        resendApiKey: "re_test_key",
        from: message.from.email,
        enabled: true,
      },
      message,
    );
    assert.equal(request.url, "https://api.resend.com/emails");
    assert.equal(request.init.headers.Authorization, "Bearer re_test_key");
    assert.deepEqual(JSON.parse(request.init.body), {
      from: "东北集市 <noreply@tohokucssa.org>",
      to: ["member@example.com"],
      subject: "测试邮件",
      text: "测试正文",
      html: "<p>测试正文</p>",
    });
    assert.deepEqual(result, { id: "email-id" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects sends when no outbound email provider is configured", async () => {
  await assert.rejects(
    sendOutboundEmail(
      { resendApiKey: "", from: message.from.email, enabled: false },
      message,
    ),
    /not configured/,
  );
});
