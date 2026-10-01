// 简单测试：验证 DeepSeek API Key 可用，并跑通匿名求助的 AI 分流逻辑。
// 用法：DEEPSEEK_API_KEY=sk-xxx node scripts/test-deepseek.mjs
//   可选：DEEPSEEK_MODEL=deepseek-chat DEEPSEEK_BASE_URL=https://api.deepseek.com

import { triageRequest } from "../worker/triage.js";

const config = {
  apiKey: process.env.DEEPSEEK_API_KEY,
  model: process.env.DEEPSEEK_MODEL,
  baseUrl: process.env.DEEPSEEK_BASE_URL,
};

if (!config.apiKey) {
  console.error(
    "请先设置环境变量 DEEPSEEK_API_KEY 再运行测试，例如：\n  DEEPSEEK_API_KEY=sk-xxx node scripts/test-deepseek.mjs"
  );
  process.exit(1);
}

const CASES = [
  { label: "简单问题（预期 AI 直接回答）", message: "请问义务翻译要怎么联系？是免费的吗？" },
  { label: "紧急情况（预期强制转人工，urgent）", message: "我现在情绪很崩溃，一直有想要自杀的念头。" },
  {
    label: "复杂/边界情况（预期 AI 判断转人工）",
    message: "我和房东因为押金退还产生纠纷，对方一直威胁不退钱还骂人，我不知道该怎么办。",
  },
  {
    label: "知识库未覆盖的具体问题（预期给出实质回答，而不是空泛套话）",
    message: "刚来日本想办银行卡，应该怎么办理？",
  },
];

for (const c of CASES) {
  console.log(`\n=== ${c.label} ===`);
  console.log("提问:", c.message);
  try {
    const result = await triageRequest(config, c.message);
    console.log("结果:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("调用失败:", err);
  }
}
