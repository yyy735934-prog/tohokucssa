// 自动联系运营人员：通过 webhook 推送（Slack/飞书/企业微信机器人等都兼容这个简单文本格式）。
// 未配置 webhook 时先降级为日志输出，方便本地开发时不报错。

export async function notifyStaff(config, ticket) {
  if (!config.staffWebhookUrl) {
    console.log("[notifyStaff] STAFF_WEBHOOK_URL 未配置，仅记录日志：", ticket);
    return { delivered: false, reason: "no_webhook_configured" };
  }

  const res = await fetch(config.staffWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `【匿名求助-需人工介入】\n紧急度：${ticket.urgency}\n分类：${ticket.category}\n摘要：${ticket.summary_for_staff}\n时间：${new Date().toISOString()}`,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`通知运营人员失败 ${res.status}: ${errText}`);
  }

  return { delivered: true };
}
