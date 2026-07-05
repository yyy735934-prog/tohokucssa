import { callDeepSeek } from "./deepseek.js";
import { retrieveContext } from "./kb.js";
import { checkHardEscalation } from "./safety.js";

const SYSTEM_PROMPT = `你是「東北地区中国学友会」网站"匿名求助"版块的AI助理，服务对象是在日中国留学生。
你的任务是阅读用户匿名提交的求助内容，结合下面提供的资料库摘录，判断如何处理，只能输出一个JSON对象，不要输出任何其他文字或解释。

处理规则：
1. 如果问题简单、常见，资料库或常识能直接给出准确回答（如日常生活咨询、办事流程、翻译/租车/搬家等服务的使用方式），action填"answer"，并在answer字段给出简洁、可执行、友善的中文回答。
2. 如果问题涉及以下任一情形，必须action填"escalate"，不要尝试自己回答：
   - 人身安全、自杀/自残念头、暴力、性侵、被骚扰跟踪
   - 紧急医疗、突发疾病、灾害逃生
   - 法律纠纷、签证/在留资格重大问题、金钱诈骗
   - 你不确定、资料库没有覆盖、或问题描述模糊需要人工判断
3. urgency字段：不需要转人工时填"low"；需要人工但不紧急填"normal"；需要立即联系工作人员填"urgent"。
4. category字段：从资料库主题中选择贴切的中文短标签，无法归类则填"其他"。
5. escalate时，summary_for_staff字段：给运营人员的20-60字中文摘要，说明求助人的核心诉求和判断需要人工的原因，不得编造求助人身份信息。
6. 不要编造资料库中没有的具体规则、电话号码、金额等事实性信息；不确定就escalate，而不是猜测作答。
7. answer字段必须是针对用户具体问题的实质性内容（例如具体流程、所需材料、建议步骤、可靠的一般性常识等）。禁止用"建议查看XX入口/资料库""可参考FAQ/地图"之类的空泛套话来代替真正的回答——如果给不出实质内容，应改为action="escalate"，而不是输出空泛答案。
8. 只输出如下结构的JSON：
{"action":"answer"|"escalate","urgency":"low"|"normal"|"urgent","category":"...","answer":"...(仅action=answer时填)","summary_for_staff":"...(仅action=escalate时填)"}`;

function buildContextText(entries) {
  if (!entries.length) return "（资料库未匹配到相关内容）";
  return entries.map((e) => `[${e.category}] ${e.content}`).join("\n");
}

export async function triageRequest(config, question) {
  const trimmed = (question || "").trim();

  if (!trimmed) {
    return {
      action: "escalate",
      urgency: "low",
      category: "其他",
      summary_for_staff: "收到空白求助内容，请人工确认。",
      matchedKb: [],
      hardEscalation: false,
    };
  }

  const hardHit = checkHardEscalation(trimmed);
  const contextEntries = retrieveContext(trimmed);

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `资料库摘录：\n${buildContextText(contextEntries)}\n\n用户求助内容：\n${trimmed}`,
    },
  ];

  let parsed;
  try {
    const raw = await callDeepSeek(config, messages, { jsonMode: true });
    parsed = JSON.parse(raw);
  } catch (err) {
    // AI调用/解析失败时，走保守路径：转人工而不是假装能处理
    parsed = {
      action: "escalate",
      urgency: "normal",
      category: "其他",
      summary_for_staff: `AI处理失败（${err.message}），请人工处理。`,
    };
  }

  const action = parsed.action === "answer" ? "answer" : "escalate";
  const urgency = ["low", "normal", "urgent"].includes(parsed.urgency) ? parsed.urgency : "normal";

  const result = {
    action,
    urgency,
    category: parsed.category || "其他",
    answer: action === "answer" ? parsed.answer || "" : undefined,
    summary_for_staff: action === "escalate" ? parsed.summary_for_staff || "AI建议转人工，无更多摘要。" : undefined,
    matchedKb: contextEntries.map((e) => e.id),
    hardEscalation: hardHit.hit,
  };

  // 安全关键词命中时强制覆盖AI的判断，不允许模型把高风险问题判成"answer"
  if (hardHit.hit) {
    result.action = "escalate";
    result.urgency = "urgent";
    result.answer = undefined;
    result.summary_for_staff = `[安全关键词触发：${hardHit.reason}] ${result.summary_for_staff || ""}`.trim();
  }

  return result;
}
