import { triageRequest } from "./triage.js";
import { notifyStaff } from "./notify.js";

function buildConfig(env) {
  return {
    apiKey: env.DEEPSEEK_API_KEY,
    model: env.DEEPSEEK_MODEL,
    baseUrl: env.DEEPSEEK_BASE_URL,
    staffWebhookUrl: env.STAFF_WEBHOOK_URL,
  };
}

async function handleHelpRequest(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.slice(0, 2000) : "";
  if (!message.trim()) {
    return Response.json({ error: "求助内容不能为空" }, { status: 400 });
  }

  const config = buildConfig(env);
  const result = await triageRequest(config, message);

  if (result.action === "escalate") {
    try {
      await notifyStaff(config, result);
    } catch (err) {
      console.error("通知运营人员失败:", err);
    }
  }

  return Response.json(result);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/help" && request.method === "POST") {
      return handleHelpRequest(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
