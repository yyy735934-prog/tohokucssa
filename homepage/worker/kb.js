// 匿名求助 - 简易信息库（占位数据）
// 后续可替换为 Cloudflare D1 / KV / Vectorize 做真正的向量检索，
// 目前用关键词打分做最简单的检索，方便先跑通 AI 分流链路。

export const KNOWLEDGE_BASE = [
  {
    id: "emergency-phone",
    category: "应急",
    keywords: ["报警", "110", "火灾", "119", "救护车", "急救"],
    content:
      "日本紧急电话：警察110（报警），火灾/救护车119。听不懂日语时可先说“中国語”或“English”尝试转接，或直接说明所在位置等待对方引导。",
  },
  {
    id: "embassy",
    category: "应急",
    keywords: ["大使馆", "领事", "护照", "证件丢失", "领事保护"],
    content:
      "中国驻日本大使馆领事保护与协助电话：+81-3-3403-3065（工作时间）。遇护照/证件丢失、重大人身安全事件可联系。",
  },
  {
    id: "mental-health",
    category: "心理",
    keywords: ["心理", "压力", "抑郁", "焦虑", "咨询", "情绪", "孤独"],
    content:
      "留学生心理援助热线提供匿名免费心理咨询。遇持续情绪低落、强烈孤独感或有自伤念头，建议尽快联系热线或学友会工作人员，不要独自承受。",
  },
  {
    id: "translate",
    category: "翻译",
    keywords: ["翻译", "在留卡", "住民票", "市役所", "银行", "医院"],
    content:
      "学友会提供义务翻译（中日互译，完全免费，志愿者提供），可协助证件翻译及市役所/银行/医院等场景陪同翻译。",
  },
  {
    id: "car",
    category: "租车",
    keywords: ["租车", "用车", "借车", "驾照"],
    content:
      "学友会用车面向活动免费借用，需提前预约，使用需符合驾照与保险要求，具体流程见“租车”板块。",
  },
  {
    id: "moving",
    category: "搬家",
    keywords: ["搬家", "退房", "粗大垃圾"],
    content:
      "学友会提供搬家互助志愿者服务（免费），另有退房流程与粗大垃圾处理等经验分享。",
  },
  {
    id: "market",
    category: "二手",
    keywords: ["二手", "转让", "赠送", "求购"],
    content:
      "二手板块支持闲置转让、免费赠送与求购信息发布，毕业季/搬家季常有免费赠送。",
  },
];

function tokenize(text) {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
}

export function retrieveContext(query, topN = 3) {
  const tokens = tokenize(query);
  const scored = KNOWLEDGE_BASE.map((entry) => {
    let score = 0;
    for (const kw of entry.keywords) {
      if (query.includes(kw)) score += 2;
    }
    for (const t of tokens) {
      if (entry.content.includes(t)) score += 1;
    }
    return { entry, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map((s) => s.entry);
}
