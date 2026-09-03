import type { Metadata } from "next";
import PolicyShell from "../PolicyShell";

const CONTACT_EMAIL = "tohokuchinesegakuyukai@gmail.com";

export const metadata: Metadata = {
  title: "隐私说明｜东北集市",
  description: "东北集市收集、使用、保存和删除个人信息的简明说明。",
};

export default function PrivacyPage() {
  return (
    <PolicyShell eyebrow="PRIVACY NOTICE" title="隐私说明" summary="我们只为登录、身份确认、商品展示、交易联系和平台安全处理必要信息。">
      <section>
        <h2>一、我们处理的信息</h2>
        <p>运营方为東北地区中国留学生学友会。平台可能处理登录邮箱、昵称、学术身份状态、可选的交易联系方式、商品文字和图片、交接地点、收藏、联系申请、举报申诉以及必要的安全和邮件投递记录。</p>
        <p>邮箱不会显示在公开商品页面。卖家的电话、微信、QQ 或微信二维码，仅在卖家接受联系申请后向该买家提供。公开地图只显示发布者选择的交接点位，请勿填写家庭住址等精确私人地址。</p>
      </section>
      <section>
        <h2>二、保存期限</h2>
        <p>我们按实现服务、处理纠纷和保障安全所需的最短期限保存信息，并按以下上限定期清理；法律要求或正在处理的争议除外。</p>
        <div className="policy-table-wrap"><table><thead><tr><th>信息类别</th><th>一般保存期限</th></tr></thead><tbody>
          <tr><td>账号、个人资料、学术身份状态及联系方式</td><td>账号存续期间；注销申请核验后原则上 30 日内删除或匿名化。</td></tr>
          <tr><td>邮箱验证码及验证请求</td><td>验证码 10 分钟后失效；验证成功后立即删除，失效记录随后清理。</td></tr>
          <tr><td>学生证等申诉证明图片</td><td>审核作出决定后立即删除；最迟不超过上传后 90 日。</td></tr>
          <tr><td>商品资料、商品图片及交接点位</td><td>展示期间保存；售出、撤回、驳回或下架后最长 180 日。</td></tr>
          <tr><td>收藏记录</td><td>用户取消收藏或账号注销时删除。</td></tr>
          <tr><td>联系申请及处理状态</td><td>申请处理完成或相关商品关闭后最长 180 日。</td></tr>
          <tr><td>举报、申诉、审核与管理记录</td><td>事项结束后最长 1 年。</td></tr>
          <tr><td>平台邮件投递日志</td><td>最长 90 日；仅保留脱敏收件地址、邮件用途和投递结果，不保存验证码正文。</td></tr>
          <tr><td>Cloudflare Worker 安全及运行日志</td><td>按当前服务方案通常保存 3 至 7 日。</td></tr>
        </tbody></table></div>
        <p>删除商品图片后，网络缓存中的副本可能继续存在最多约 24 小时；灾难恢复备份中的副本可能在服务商的常规轮换周期内暂时保留，但不会用于日常业务。</p>
      </section>
      <section>
        <h2>三、访问、更正、删除与注销</h2>
        <p>昵称、通知邮箱和交易联系方式可在个人中心自行更正。申请访问、导出、更正或删除个人信息，或申请注销账号，请使用注册邮箱或已验证的通知邮箱发送邮件：</p>
        <ol>
          <li>收件地址：<a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("东北集市个人信息申请")}`}>{CONTACT_EMAIL}</a>，主题请写“东北集市个人信息申请”；</li>
          <li>说明账号邮箱、申请事项及需要处理的信息范围；请勿主动附上身份证件；</li>
          <li>我们将在 3 个工作日内首次响应，并通过账号信息或一次性验证码核验身份；</li>
          <li>核验完成后原则上在 30 日内处理并告知结果。</li>
        </ol>
        <p>注销后，公开商品会停止展示。为履行法律义务、保护他人权益或处理未结纠纷，我们可能在必要期限内保留最少量记录，并说明不能立即删除的原因。</p>
      </section>
      <section>
        <h2>四、Cookie、会话与安全日志</h2>
        <ul>
          <li><b>登录会话：</b>平台设置名为 <code>tohoku_session</code> 的必要 Cookie，有效期 7 天，并使用 HttpOnly、Secure 和 SameSite=Lax 等安全属性。</li>
          <li><b>登录校验：</b>Google 登录过程中会使用约 10 分钟有效的一次性状态 Cookie，用于防止伪造登录请求。</li>
          <li><b>安全服务：</b>Cloudflare 可能设置防滥用、流量管理或机器人识别所需的 Cookie，并记录 IP 地址、设备与请求信息。</li>
          <li><b>非广告用途：</b>平台目前不使用广告 Cookie，也不使用浏览器本地存储进行跨站跟踪。禁用必要 Cookie 会导致登录功能无法正常使用。</li>
        </ul>
      </section>
      <section>
        <h2>五、第三方服务与跨境处理</h2>
        <p>为运行平台，我们仅在必要范围内向以下服务传输数据。相关数据可能在日本境外（包括美国）处理，具体地点和期限由服务商基础设施及其政策决定。</p>
        <ul>
          <li><b>Cloudflare：</b>提供网站运行、数据库、图片存储、安全防护与运行日志。<a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noreferrer">查看隐私政策</a>。</li>
          <li><b>Resend：</b>接收邮件地址、主题和必要邮件内容，用于发送验证码及交易、审核通知。平台自己的投递日志只保存脱敏地址和投递结果。<a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noreferrer">查看隐私政策</a>。</li>
          <li><b>Google：</b>Google 登录向平台提供基础账号资料和邮箱；Gemini 仅用于识别用户主动上传的商品图片并生成商品信息。请勿把学生证、联系方式或其他敏感信息作为商品图片上传。<a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">查看隐私政策</a>。</li>
          <li><b>OpenStreetMap：</b>地图瓦片服务可能接收 IP 地址、浏览器信息及所请求的地图区域。<a href="https://osmfoundation.org/wiki/Privacy_Policy" target="_blank" rel="noreferrer">查看隐私政策</a>。</li>
        </ul>
        <p>从 Google 账号中撤销授权只会停止后续 Google 登录授权；如需删除东北集市内的账号和数据，仍请按上一节提交申请。</p>
      </section>
      <section>
        <h2>六、未成年人</h2>
        <p>未满 18 周岁的使用者应在监护人知情同意和指导下使用平台，并由监护人同意或陪同完成线下交易。请勿公开家庭住址、学校日程等信息。对无法独立理解本说明的未成年人，隐私申请应由监护人协助提出。发现存在人身或财产风险时，平台可暂停相关账号或内容。</p>
      </section>
      <section>
        <h2>七、适用法律与争议处理</h2>
        <p>本说明及平台对个人信息的处理适用日本法律，包括《个人信息保护法》。发生疑问或争议时，请先通过下方邮箱联系我们协商处理；协商不成的，可依日本民事诉讼法向有管辖权的法院寻求解决。本条不限制消费者依法享有的强制性权利。</p>
      </section>
      <section className="policy-contact-box">
        <h2>八、联系与更新</h2>
        <p>隐私联系人：東北地区中国留学生学友会<br />邮箱：<a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
        <p>我们可能因功能、服务商或法律要求变化而更新本说明，并在本页面标注新的版本日期；对使用者有重大影响的变更，将通过站内显著位置或邮件另行提示。</p>
      </section>
    </PolicyShell>
  );
}
