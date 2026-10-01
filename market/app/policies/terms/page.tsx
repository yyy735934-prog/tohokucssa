import type { Metadata } from "next";
import PolicyShell from "../PolicyShell";

export const metadata: Metadata = { title: "使用规范｜东北集市", description: "东北集市的商品发布、交易安全与平台管理规范。" };

export default function TermsPage() {
  return (
    <PolicyShell eyebrow="COMMUNITY RULES" title="使用规范" summary="请如实发布、谨慎交易，共同维护学友之间安全友善的二手交流环境。">
      <section><h2>一、发布要求</h2><p>平台服务于仙台及周边学友之间的闲置物品信息交流。发布者应如实描述物品的名称、成色、功能、配件、价格及交接条件，并使用自己有权发布的图片。</p></section>
      <section><h2>二、禁止及限制商品</h2><p>禁止发布法律法规禁止交易的物品，以及药品、烟草、酒类、成人用品、武器或管制刀具、证件、金融账户、侵权仿品等高风险内容。车辆、摩托车、原付及其他需登记或转让手续的物品必须经人工审核，并由双方自行依法办理手续。</p></section>
      <section><h2>三、审核与管理</h2><p>平台可以使用自动化工具进行分类和初步风险分流，但自动结果不代表平台对商品真实性、安全性或合法性的保证。平台有权要求补充信息、暂停展示或下架内容。</p></section>
      <section><h2>四、交易安全</h2><p>买卖双方应尽量在公共场所当面验货，确认后再交易。请勿提前转账，不要向他人提供验证码、密码或与交易无关的身份证明材料，并保留商品描述、沟通和付款凭证。</p></section>
      <section><h2>五、平台角色与违规处理</h2><p>平台仅提供信息展示和联系渠道，不作为交易一方，不代收货款，也不对物品质量、履约或争议结果作保证。对虚假发布、骚扰、欺诈、规避审核或其他损害成员权益的行为，平台可限制账号、删除内容，并在必要时向有关机构报告。</p></section>
    </PolicyShell>
  );
}
