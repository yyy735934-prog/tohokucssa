import type { Metadata } from "next";
import PolicyShell from "../PolicyShell";

const CONTACT_EMAIL = "tohokuchinesegakuyukai@gmail.com";
export const metadata: Metadata = { title: "举报与建议｜东北集市", description: "向东北集市提交商品举报、安全问题或功能建议。" };

export default function ReportPage() {
  return (
    <PolicyShell eyebrow="REPORT & FEEDBACK" title="举报与建议" summary="发现风险内容或有改进建议时，请通过学友会官方邮箱联系我们。">
      <section><h2>可以报告什么</h2><p>如发现疑似违禁商品、虚假描述、诈骗、骚扰、隐私泄露或其他不当行为，请及时提交举报。一般功能建议也欢迎通过同一邮箱发送。</p></section>
      <section><h2>提交材料</h2><ul><li>相关商品链接或商品编号；</li><li>问题经过和希望平台处理的事项；</li><li>能够说明问题的必要截图；</li><li>便于平台回复的邮箱。</li></ul><p>请勿提交与事件无关的身份证件、家庭住址、密码或其他敏感信息。</p></section>
      <section className="policy-contact-box"><h2>受理方式</h2><p>邮箱：<a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("东北集市举报或建议")}`}>{CONTACT_EMAIL}</a></p><p>预计在 3 个工作日内首次响应。复杂事项可能需要更长时间，我们会在核实过程中保持必要沟通。</p></section>
      <section><h2>处理方式</h2><p>平台收到举报后，可以临时隐藏相关内容、向当事人核实并保留必要记录，再根据事实采取恢复、下架或限制账号等措施。涉及紧急人身安全或涉嫌违法犯罪时，请同时联系当地警察或其他主管机构。</p></section>
    </PolicyShell>
  );
}
