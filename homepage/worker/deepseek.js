// DeepSeek API 客户端（OpenAI 兼容的 chat completions 接口）。
// 纯 fetch 实现，不依赖 Workers 专属 API，因此在 Node 测试脚本里也能直接复用。

const DEFAULT_BASE_URL = "https://api.deepseek.com";
// TODO: 确认 DeepSeek 控制台里 V4 模型的准确 model id 后按需覆盖
// （可通过 config.model 或环境变量 DEEPSEEK_MODEL 覆盖，无需改代码）。
const DEFAULT_MODEL = "deepseek-chat";

export async function callDeepSeek(config, messages, { jsonMode = false, temperature = 0.3 } = {}) {
  const { apiKey, model, baseUrl } = config;
  if (!apiKey) {
    throw new Error("缺少 DeepSeek API Key（config.apiKey / env.DEEPSEEK_API_KEY）");
  }

  const res = await fetch(`${baseUrl || DEFAULT_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || DEFAULT_MODEL,
      messages,
      temperature,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`DeepSeek API 请求失败 ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}
