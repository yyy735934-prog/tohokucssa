// Slack 集成：角色审批通过后自动拉群
// 需要配置的环境变量（wrangler secret put）：
//   SLACK_BOT_TOKEN   — Slack App 的 Bot Token（xoxb- 开头）
//   SLACK_CHANNEL_ID  — 要拉入的频道 ID（C 开头，频道详情最底部可见）
//   SLACK_INVITE_URL  — 工作区邀请链接（用户还没加入 Slack 时随邮件发送）
// 不配置则此功能完全关闭，平台其余功能不受影响

async function slackApi(token, method, params) {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(params),
  })
  return res.json()
}

// 审批通过后调用：已在工作区 → 直接拉进频道；不在 → 频道内发提示（邀请链接走邮件）
export async function slackOnRoleGranted(env, { email, displayName, roleName }) {
  const token = env.SLACK_BOT_TOKEN
  const channel = env.SLACK_CHANNEL_ID
  if (!token || !channel) return
  const name = displayName || email
  try {
    const lookupRes = await fetch(`https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`, {
      headers: { authorization: `Bearer ${token}` },
    })
    const lookup = await lookupRes.json()
    if (lookup.ok) {
      const inv = await slackApi(token, 'conversations.invite', { channel, users: lookup.user.id })
      if (inv.ok || inv.error === 'already_in_channel') {
        await slackApi(token, 'chat.postMessage', {
          channel,
          text: `🎉 ${name}（${email}）已成为${roleName}，已自动拉入本频道，欢迎！`,
        })
        return
      }
      console.warn('[slack] conversations.invite failed:', inv.error)
    }
    await slackApi(token, 'chat.postMessage', {
      channel,
      text: `📩 ${name}（${email}）已批准为${roleName}，尚未加入 Slack 工作区。邀请链接已随审批邮件发送，加入后请将其拉入本频道。`,
    })
  } catch (e) {
    console.error('[slack] error:', e.message)
  }
}
