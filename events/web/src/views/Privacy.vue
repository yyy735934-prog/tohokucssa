<template>
  <div class="page">
    <div class="card privacy-card">
      <h1>隐私政策</h1>
      <p class="updated">最后更新：2026年7月5日</p>

      <h2>一、我们是谁</h2>
      <p>本平台由東北地区中国学友会（以下简称「学友会」）运营，用于活动发布、报名与签到管理。</p>

      <h2>二、我们收集哪些信息</h2>
      <p>当你报名参加活动时，我们会收集以下信息：</p>
      <ul>
        <li><strong>必填信息：</strong>姓名、邮箱、性别、所属学校</li>
        <li><strong>选填信息：</strong>中国手机号、日本电话号、微信号、学号/工号、姓名假名</li>
        <li><strong>活动特定信息：</strong>活动主办方可能设置额外的报名字段（如身高、T恤尺码等）</li>
      </ul>
      <p>当你通过 Google 登录时，我们会获取你的 Google 账号邮箱和显示名称。</p>

      <h2>三、信息用途</h2>
      <p>你的个人信息仅用于以下目的：</p>
      <ul>
        <li>活动报名确认和签到管理</li>
        <li>向你发送活动相关的邮件通知（报名确认、签到码、活动提醒、主办方通知）</li>
        <li>活动主办方联络参与者</li>
      </ul>
      <p><strong>我们不会将你的信息出售或提供给任何第三方用于营销目的。</strong></p>

      <h2>四、谁能看到你的信息</h2>
      <ul>
        <li><strong>活动主办方：</strong>可以查看其活动的报名者信息</li>
        <li><strong>平台管理员：</strong>学友会管理团队可访问后台数据</li>
        <li><strong>其他用户：</strong>无法看到你的个人信息，活动页面仅显示报名人数</li>
      </ul>

      <h2>五、数据存储与安全</h2>
      <p>数据存储在 Cloudflare 的全球基础设施上（D1 数据库、KV 存储、R2 对象存储），受 Cloudflare 的安全保护。密码使用 PBKDF2 算法加盐哈希存储，不以明文保存。</p>

      <h2>六、数据保留与删除</h2>
      <p>你的报名数据在活动结束后仍会保留，以便你查看历史报名记录。如需删除你的个人数据，请联系学友会管理员，我们将在合理时间内处理你的请求。</p>

      <h2>七、你的权利</h2>
      <p>根据日本《個人情報保護法》，你享有以下权利：</p>
      <ul>
        <li>查询我们是否持有你的个人信息</li>
        <li>请求更正不准确的信息</li>
        <li>请求删除你的个人信息</li>
        <li>撤回对信息使用的同意</li>
      </ul>

      <h2>八、联系我们</h2>
      <p>如有任何隐私相关的问题或请求，请通过以下方式联系：</p>
      <p>邮箱：tohokucssa@gmail.com</p>

      <h2>九、政策更新</h2>
      <p>我们可能会不时更新本隐私政策。重大变更时会通过平台公告通知用户。</p>
    </div>
    <router-link to="/" class="back-link">← 返回首页</router-link>
  </div>
</template>

<style scoped>
.privacy-card { padding: 24px; line-height: 1.8; }
.privacy-card h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
.privacy-card h2 { font-size: 16px; font-weight: 600; margin-top: 24px; margin-bottom: 8px; }
.privacy-card p { font-size: 14px; color: var(--c-text); margin: 6px 0; }
.privacy-card ul { font-size: 14px; padding-left: 20px; margin: 6px 0; }
.privacy-card li { margin: 4px 0; }
.updated { font-size: 12px !important; color: var(--c-text-3) !important; }
.back-link { display: block; text-align: center; font-size: 13px; margin-top: 24px; color: var(--c-text-2); }
</style>
