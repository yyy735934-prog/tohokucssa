// 硬性安全兜底：不依赖 AI 的判断，命中即强制转人工 + urgent。
// 这是对 AI 行为的"控制层" —— 生命安全相关的判断不能只交给模型。

const HARD_ESCALATION_PATTERNS = [
  { reason: "自杀/自残倾向", pattern: /(自杀|想死|自残|割腕|轻生|不想活)/ },
  { reason: "人身暴力/被侵害", pattern: /(被打|殴打|性侵|强奸|猥亵|跟踪骚扰|家暴)/ },
  { reason: "紧急医疗状况", pattern: /(晕倒|昏迷|大出血|心脏病发|呼吸困难|中毒)/ },
  { reason: "重大法律/在留风险", pattern: /(被拘留|被逮捕|遣返|签证被取消|涉嫌犯罪)/ },
];

export function checkHardEscalation(text) {
  for (const { reason, pattern } of HARD_ESCALATION_PATTERNS) {
    if (pattern.test(text)) return { hit: true, reason };
  }
  return { hit: false, reason: null };
}
