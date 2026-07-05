const FROM_DEFAULT = '活动平台 <onboarding@resend.dev>'

export async function sendEmail(env, { to, subject, html }) {
  const apiKey = env.RESEND_API_KEY
  if (!apiKey) { console.warn('[email] no RESEND_API_KEY, skipping'); return }
  const from = env.EMAIL_FROM || FROM_DEFAULT
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'authorization': `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html }),
    })
    if (!res.ok) {
      const body = await res.text()
      console.error(`[email] Resend error ${res.status}: ${body}`)
    }
  } catch (e) {
    console.error('[email] fetch error:', e.message)
  }
}

export async function sendEmailBatch(env, emails) {
  for (const e of emails) {
    await sendEmail(env, e)
  }
}

function baseHtml(title, body) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:0;background:#f5f5f7}
.wrap{max-width:560px;margin:0 auto;padding:24px}
.card{background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
h1{font-size:20px;margin:0 0 8px}
.sub{color:#8e8e93;font-size:14px;margin:0 0 24px}
.info{background:#f5f5f7;border-radius:8px;padding:16px;margin:16px 0}
.info dt{font-size:12px;color:#8e8e93;margin-bottom:2px}
.info dd{font-size:15px;font-weight:500;margin:0 0 12px}
.info dd:last-child{margin:0}
.btn{display:inline-block;background:#007aff;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px}
.footer{text-align:center;padding:16px;color:#aeaeb2;font-size:12px}
.danger{color:#ff3b30}
.success{color:#34c759}
</style></head>
<body><div class="wrap"><div class="card">${body}</div>
<div class="footer">学友会活动平台</div></div></body></html>`
}

// 报名确认（不含签到码，签到码活动前一天单独发）
export function signupConfirmEmail(event, signup) {
  return {
    subject: `报名成功 — ${event.title}`,
    html: baseHtml('报名成功', `
      <h1>报名成功!</h1>
      <p class="sub">${esc(signup.name)}，你已成功报名以下活动</p>
      <dl class="info">
        <dt>活动</dt><dd>${esc(event.title)}</dd>
        <dt>时间</dt><dd>${esc(event.event_date)}</dd>
        ${event.location ? `<dt>地点</dt><dd>${esc(event.location)}</dd>` : ''}
      </dl>
      <p style="margin:20px 0 8px;font-size:15px;font-weight:600">你的报名信息：</p>
      <dl class="info">${signupInfoBlock(signup)}</dl>
      <p style="margin-top:16px;font-size:14px;color:#8e8e93">签到码将在活动前一天通过邮件发送，届时请注意查收。</p>
      <p style="margin-top:8px;font-size:13px;color:#aeaeb2">如信息有误，可在「我的」页面修改报名信息</p>
    `),
  }
}

// 活动前一天提醒 + 签到码
export function eventReminderEmail(event, signup, origin) {
  const qrUrl = origin ? `${origin}/signup-ok/${event.id}?token=${signup.token}` : ''
  return {
    subject: `明日活动提醒 — ${event.title}`,
    html: baseHtml('活动提醒', `
      <h1>活动明天开始!</h1>
      <p class="sub">${esc(signup.name)}，你报名的活动将于明天举行，请做好准备</p>
      <dl class="info">
        <dt>活动</dt><dd>${esc(event.title)}</dd>
        <dt>时间</dt><dd>${esc(event.event_date)}</dd>
        ${event.location ? `<dt>地点</dt><dd>${esc(event.location)}</dd>` : ''}
      </dl>
      ${event.notes ? `<p style="font-size:14px;color:#8e8e93"><strong>注意事项：</strong>${esc(event.notes)}</p>` : ''}
      <p style="margin:20px 0 8px;font-size:15px;font-weight:600">你的报名信息：</p>
      <dl class="info">${signupInfoBlock(signup)}</dl>
      ${qrUrl ? `<p style="margin:24px 0 8px;font-size:15px;font-weight:600">你的签到码：</p>
      <p><a href="${qrUrl}" class="btn">查看签到码</a></p>
      <p style="margin-top:16px;font-size:13px;color:#aeaeb2">活动当天请出示签到码完成签到</p>` : ''}
    `),
  }
}

// 审核通过 → 通知主理人
export function eventApprovedEmail(event, host) {
  return {
    subject: `活动已通过审核 — ${event.title}`,
    html: baseHtml('审核通过', `
      <h1 class="success">活动已通过审核</h1>
      <p class="sub">${host.display_name || host.email}，你的活动已通过审核，现在开放报名</p>
      <dl class="info">
        <dt>活动</dt><dd>${esc(event.title)}</dd>
        <dt>时间</dt><dd>${esc(event.event_date)}</dd>
        ${event.location ? `<dt>地点</dt><dd>${esc(event.location)}</dd>` : ''}
        <dt>状态</dt><dd class="success">报名中</dd>
      </dl>
    `),
  }
}

// 审核驳回 → 通知主理人
export function eventRejectedEmail(event, host, reason) {
  return {
    subject: `活动未通过审核 — ${event.title}`,
    html: baseHtml('审核驳回', `
      <h1 class="danger">活动未通过审核</h1>
      <p class="sub">${host.display_name || host.email}，你的活动未通过审核，请修改后重新提交</p>
      <dl class="info">
        <dt>活动</dt><dd>${esc(event.title)}</dd>
        ${reason ? `<dt>驳回原因</dt><dd class="danger">${esc(reason)}</dd>` : ''}
      </dl>
      <p style="margin-top:16px;font-size:14px">请登录管理后台修改活动内容后重新提交审核</p>
    `),
  }
}

// 审核通过（公开申请者，带注册邀请）
export function eventApprovedInviteEmail(event, inviteToken, origin) {
  const registerUrl = `${origin}/register?token=${inviteToken}`
  return {
    subject: `活动已通过审核 — ${event.title}`,
    html: baseHtml('审核通过', `
      <h1 class="success">活动已通过审核!</h1>
      <p class="sub">${esc(event.submitter_name)}，你申请的活动已通过审核，现在开放报名</p>
      <dl class="info">
        <dt>活动</dt><dd>${esc(event.title)}</dd>
        <dt>时间</dt><dd>${esc(event.event_date)}</dd>
        ${event.location ? `<dt>地点</dt><dd>${esc(event.location)}</dd>` : ''}
        <dt>状态</dt><dd class="success">报名中</dd>
      </dl>
      <p style="margin:24px 0 8px;font-size:15px;font-weight:600">注册成为活动主理人</p>
      <p style="font-size:14px;color:#8e8e93;margin-bottom:16px">注册后你可以管理报名、签到、导出数据等</p>
      <p><a href="${registerUrl}" class="btn">注册并管理活动</a></p>
      <p style="margin-top:16px;font-size:12px;color:#aeaeb2">此链接7天内有效</p>
    `),
  }
}

// 签到确认
export function checkinConfirmEmail(event, signup) {
  return {
    subject: `签到成功 — ${event.title}`,
    html: baseHtml('签到成功', `
      <h1 class="success">签到成功!</h1>
      <p class="sub">${esc(signup.name)}，你已成功签到</p>
      <dl class="info">
        <dt>活动</dt><dd>${esc(event.title)}</dd>
        <dt>时间</dt><dd>${esc(event.event_date)}</dd>
        ${event.location ? `<dt>地点</dt><dd>${esc(event.location)}</dd>` : ''}
      </dl>
    `),
  }
}

// 活动信息变更 → 通知参与者
export function eventChangedEmail(event, signup, changes) {
  return {
    subject: `活动信息变更 — ${event.title}`,
    html: baseHtml('活动变更', `
      <h1>活动信息有变更</h1>
      <p class="sub">${esc(signup.name)}，你报名的活动信息已更新</p>
      <dl class="info">
        <dt>活动</dt><dd>${esc(event.title)}</dd>
        <dt>时间</dt><dd>${esc(event.event_date)}</dd>
        ${event.location ? `<dt>地点</dt><dd>${esc(event.location)}</dd>` : ''}
        ${changes ? `<dt>变更内容</dt><dd>${esc(changes)}</dd>` : ''}
      </dl>
      <p style="margin:20px 0 8px;font-size:15px;font-weight:600">你的报名信息：</p>
      <dl class="info">${signupInfoBlock(signup)}</dl>
      <p style="margin-top:16px;font-size:14px">如信息有误，可在「我的」页面修改。如有疑问请联系活动主理人</p>
    `),
  }
}

// 新活动提交审核 → 通知审核员
export function eventSubmittedEmail(event, submitterName) {
  return {
    subject: `新活动待审核 — ${event.title}`,
    html: baseHtml('待审核', `
      <h1>有新活动待审核</h1>
      <p class="sub">${esc(submitterName)} 提交了一个新活动，请登录后台审核</p>
      <dl class="info">
        <dt>活动</dt><dd>${esc(event.title)}</dd>
        <dt>时间</dt><dd>${esc(event.event_date)}</dd>
        ${event.location ? `<dt>地点</dt><dd>${esc(event.location)}</dd>` : ''}
      </dl>
      <p style="margin-top:16px"><a href="https://events.tohokucssa.org/admin/events" class="btn">去审核</a></p>
    `),
  }
}

// 角色升级申请 → 通知审核员
export function roleRequestEmail(user, roleName) {
  return {
    subject: `角色升级申请 — ${user.display_name || user.email}`,
    html: baseHtml('角色申请', `
      <h1>用户申请角色升级</h1>
      <p class="sub">${esc(user.display_name || user.email)} 申请成为${esc(roleName)}</p>
      <dl class="info">
        <dt>申请人</dt><dd>${esc(user.display_name || user.email)}</dd>
        <dt>邮箱</dt><dd>${esc(user.email)}</dd>
        <dt>申请角色</dt><dd>${esc(roleName)}</dd>
      </dl>
      <p style="margin-top:16px"><a href="https://events.tohokucssa.org/admin/users" class="btn">去审批</a></p>
    `),
  }
}

// 角色变更结果 → 通知用户
export function roleChangedEmail(user, newRole, slackInviteUrl) {
  const roleNames = { host: '活动主理人', reviewer: '审核管理员', user: '普通用户' }
  const roleName = roleNames[newRole] || newRole
  const isUpgrade = newRole === 'host' || newRole === 'reviewer'
  return {
    subject: `身份变更通知 — ${roleName}`,
    html: baseHtml('身份变更', `
      <h1${isUpgrade ? ' class="success"' : ''}>${isUpgrade ? '恭喜！身份已升级' : '身份已变更'}</h1>
      <p class="sub">${esc(user.display_name || user.email)}，你的平台身份已更新</p>
      <dl class="info">
        <dt>当前身份</dt><dd${isUpgrade ? ' class="success"' : ''}>${esc(roleName)}</dd>
      </dl>
      ${isUpgrade ? '<p style="margin-top:16px;font-size:14px">你现在可以登录管理后台使用对应功能了</p>' : ''}
      ${isUpgrade && slackInviteUrl ? `
      <p style="margin-top:20px"><a href="${esc(slackInviteUrl)}" class="btn">加入管理 Slack 群</a></p>
      <p style="margin-top:8px;font-size:13px;color:#8e8e93">管理团队在 Slack 上沟通协作，点击上方按钮加入（如已加入可忽略）</p>` : ''}
    `),
  }
}

export function roleRejectedEmail(user, roleName) {
  return {
    subject: `角色申请未通过 — ${roleName}`,
    html: baseHtml('申请结果', `
      <h1>角色申请未通过</h1>
      <p class="sub">${esc(user.display_name || user.email)}，你的${esc(roleName)}申请未被通过</p>
      <dl class="info">
        <dt>申请角色</dt><dd>${esc(roleName)}</dd>
      </dl>
      <p style="margin-top:16px;font-size:14px;color:#8e8e93">如有疑问，请联系管理员</p>
    `),
  }
}

// 邀请注册（管理员邀请新用户注册为主理人/管理员）
export function inviteRegisterEmail(invite, registerUrl) {
  const roleNames = { host: '活动主理人', reviewer: '审核管理员' }
  const roleName = roleNames[invite.role] || '活动主理人'
  return {
    subject: `邀请你加入学友会活动平台 — ${roleName}`,
    html: baseHtml('邀请注册', `
      <h1>你被邀请加入活动平台</h1>
      <p class="sub">${esc(invite.invited_by)} 邀请你注册为「${esc(roleName)}」</p>
      <dl class="info">
        <dt>注册角色</dt><dd>${esc(roleName)}</dd>
        <dt>邮箱</dt><dd>${esc(invite.email)}</dd>
      </dl>
      <p style="margin:24px 0 8px;font-size:14px">点击下方按钮完成注册，设置密码后即可使用管理后台</p>
      <p><a href="${registerUrl}" class="btn">注册账号</a></p>
      <p style="margin-top:16px;font-size:12px;color:#aeaeb2">此链接7天内有效</p>
    `),
  }
}

// 邀请报名活动
export function inviteSignupEmail(event, signupUrl) {
  return {
    subject: `邀请你参加 — ${event.title}`,
    html: baseHtml('活动邀请', `
      <h1>你被邀请参加活动</h1>
      <p class="sub">活动主理人邀请你参加以下活动</p>
      <dl class="info">
        <dt>活动</dt><dd>${esc(event.title)}</dd>
        <dt>时间</dt><dd>${esc(event.event_date)}</dd>
        ${event.location ? `<dt>地点</dt><dd>${esc(event.location)}</dd>` : ''}
        ${event.content ? `<dt>详情</dt><dd>${esc(event.content.slice(0, 200))}${event.content.length > 200 ? '…' : ''}</dd>` : ''}
      </dl>
      <p style="margin:24px 0 8px;font-size:14px">点击下方按钮填写报名信息</p>
      <p><a href="${signupUrl}" class="btn">立即报名</a></p>
    `),
  }
}

function signupInfoBlock(signup) {
  let html = `<dt>姓名</dt><dd>${esc(signup.name)}</dd>`
  html += `<dt>邮箱</dt><dd>${esc(signup.email)}</dd>`
  if (signup.phone) html += `<dt>手机号</dt><dd>${esc(signup.phone)}</dd>`
  let extra = {}
  try { extra = typeof signup.data === 'string' ? JSON.parse(signup.data || '{}') : (signup.data || {}) } catch {}
  for (const [k, v] of Object.entries(extra)) {
    if (v) html += `<dt>${esc(k)}</dt><dd>${esc(String(v))}</dd>`
  }
  return html
}

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// 普通通知（自定义标题+正文+可选附图，如微信群二维码）
export function eventAnnounceEmail(event, signup, subject, message, imageUrl) {
  return {
    subject: `${subject} — ${event.title}`,
    html: baseHtml('活动通知', `
      <h1>${esc(subject)}</h1>
      <p class="sub">${esc(signup.name || '')}，「${esc(event.title)}」主办方给你发来通知</p>
      <div style="font-size:15px;line-height:1.8;white-space:pre-wrap">${esc(message)}</div>
      ${imageUrl ? `<p style="margin-top:16px"><img src="${esc(imageUrl)}" style="max-width:100%;border-radius:8px" alt="附图" /></p>` : ''}
      <dl class="info" style="margin-top:20px">
        <dt>活动</dt><dd>${esc(event.title)}</dd>
        <dt>时间</dt><dd>${esc(event.event_date)}</dd>
      </dl>
    `),
  }
}
