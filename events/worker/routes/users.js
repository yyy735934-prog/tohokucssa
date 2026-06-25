import { Hono } from 'hono'
import { hashPassword } from '../lib/password.js'
import { getSession, extractToken } from '../lib/session.js'
import { sendEmail, roleRequestEmail, roleChangedEmail, inviteRegisterEmail } from '../lib/email.js'
import { audit } from '../lib/audit.js'

const users = new Hono()

async function requireReviewer(c) {
  const session = await getSession(c.env.SESSIONS, extractToken(c.req), c.env.DB)
  if (!session) throw new Error('未登录')
  if (session.role !== 'reviewer') throw new Error('仅负责人可操作')
  return session
}

function parseEmails(raw) {
  if (!raw) return []
  return [...new Set(
    raw.replace(/[,;，；\n\r\t]+/g, ' ')
      .split(/\s+/)
      .map(s => s.replace(/^[<(【「"']+|[>)】」"']+$/g, '').trim().toLowerCase())
      .filter(s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
  )]
}

// POST /api/users/invite — batch invite registration with email
users.post('/invite', async (c) => {
  const session = await requireReviewer(c)
  const { emails: rawEmails, role } = await c.req.json()
  if (!rawEmails || !rawEmails.trim()) return c.json({ ok: false, message: '请输入邮箱' }, 400)

  const inviteRole = role || 'host'
  if (!['host', 'reviewer'].includes(inviteRole)) return c.json({ ok: false, message: '无效角色' }, 400)
  if (inviteRole === 'reviewer' && !session.is_super) {
    return c.json({ ok: false, message: '仅超级管理员可邀请审核员' }, 403)
  }

  const emailList = parseEmails(rawEmails)
  if (!emailList.length) return c.json({ ok: false, message: '未识别到有效邮箱' }, 400)

  const origin = new URL(c.req.url).origin
  const sent = [], skipped = []
  for (const email of emailList) {
    const existing = await c.env.DB.prepare('SELECT id FROM admin_users WHERE email = ?').bind(email).first()
    if (existing) { skipped.push(email); continue }

    const token = crypto.randomUUID()
    const invite = { email, name: '', role: inviteRole, invited_by: session.email }
    await c.env.SESSIONS.put(`invite:${token}`, JSON.stringify(invite), { expirationTtl: 7 * 24 * 3600 })

    const url = `${origin}/register?token=${token}`
    const content = inviteRegisterEmail(invite, url)
    c.executionCtx.waitUntil(sendEmail(c.env, { to: email, ...content }))
    sent.push(email)
  }

  return c.json({ ok: true, sent, skipped })
})

users.get('/', async (c) => {
  await requireReviewer(c)
  const rows = await c.env.DB.prepare('SELECT id, email, role, display_name, is_super, created_at FROM admin_users ORDER BY created_at').all()
  return c.json({ ok: true, users: rows.results })
})

users.post('/', async (c) => {
  const session = await requireReviewer(c)
  const body = await c.req.json()
  const { email, role, password } = body
  const displayName = body.display_name || body.displayName || ''
  if (!email) return c.json({ ok: false, message: '邮箱必填' }, 400)
  if (!password || password.length < 6) return c.json({ ok: false, message: '密码至少6位' }, 400)

  // Only super admin can create reviewers
  if (role === 'reviewer' && !session.is_super) {
    return c.json({ ok: false, message: '仅超级管理员可创建审核负责人' }, 403)
  }

  const r = ['user', 'host', 'reviewer'].includes(role) ? role : 'host'
  const hash = await hashPassword(password)

  try {
    await c.env.DB.prepare('INSERT INTO admin_users (email, password_hash, role, display_name) VALUES (?, ?, ?, ?)')
      .bind(email.trim().toLowerCase(), hash, r, (displayName || '').trim()).run()
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return c.json({ ok: false, message: '该邮箱已存在' }, 400)
    throw e
  }
  return c.json({ ok: true })
})

// PATCH /api/users/:id — update role (super admin only)
users.patch('/:id', async (c) => {
  const session = await requireReviewer(c)
  if (!session.is_super) return c.json({ ok: false, message: '仅超级管理员可修改角色' }, 403)

  const id = Number(c.req.param('id'))
  const target = await c.env.DB.prepare('SELECT is_super FROM admin_users WHERE id = ?').bind(id).first()
  if (!target) return c.json({ ok: false, message: '用户不存在' }, 404)
  if (target.is_super) return c.json({ ok: false, message: '不能修改超级管理员' }, 400)

  const { role, display_name } = await c.req.json()
  const sets = []
  const vals = []
  if (role && ['user', 'host', 'reviewer'].includes(role)) { sets.push('role = ?'); vals.push(role) }
  if (display_name !== undefined) { sets.push('display_name = ?'); vals.push(display_name.trim()) }
  if (!sets.length) return c.json({ ok: false, message: '无修改' }, 400)

  vals.push(id)
  await c.env.DB.prepare(`UPDATE admin_users SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run()

  if (role) {
    const user = await c.env.DB.prepare('SELECT email, display_name FROM admin_users WHERE id = ?').bind(id).first()
    if (user) {
      const content = roleChangedEmail(user, role)
      c.executionCtx.waitUntil(sendEmail(c.env, { to: user.email, ...content }))
      // Clean up any pending role requests at or below the new role
      const roleOrder = { user: 0, host: 1, reviewer: 2 }
      for (const r of ['host', 'reviewer']) {
        if (roleOrder[r] <= roleOrder[role]) {
          await c.env.SESSIONS.delete(`role_req:${user.email}:${r}`)
        }
      }
    }
  }

  return c.json({ ok: true })
})

users.delete('/:id', async (c) => {
  const session = await requireReviewer(c)
  const id = Number(c.req.param('id'))
  if (id === session.id) return c.json({ ok: false, message: '不能删除自己' }, 400)

  const target = await c.env.DB.prepare('SELECT is_super FROM admin_users WHERE id = ?').bind(id).first()
  if (target?.is_super) return c.json({ ok: false, message: '不能删除超级管理员' }, 400)

  await c.env.DB.prepare('DELETE FROM notifications WHERE user_id = ?').bind(id).run()
  await c.env.DB.prepare('UPDATE events SET created_by = NULL WHERE created_by = ?').bind(id).run()
  await c.env.DB.prepare('UPDATE events SET reviewed_by = NULL WHERE reviewed_by = ?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM admin_users WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

// GET /api/users/my-requests — check own pending role requests
users.get('/my-requests', async (c) => {
  const session = await getSession(c.env.SESSIONS, extractToken(c.req), c.env.DB)
  if (!session) throw new Error('未登录')

  const pending = {}
  for (const role of ['host', 'reviewer']) {
    const val = await c.env.SESSIONS.get(`role_req:${session.email}:${role}`)
    if (val) pending[role] = true
  }
  return c.json({ ok: true, pending })
})

// POST /api/users/request-role  { role: 'host' | 'reviewer' }
users.post('/request-role', async (c) => {
  const session = await getSession(c.env.SESSIONS, extractToken(c.req), c.env.DB)
  if (!session) throw new Error('未登录')

  const { role } = await c.req.json()
  if (!['host', 'reviewer'].includes(role)) return c.json({ ok: false, message: '无效角色' }, 400)

  const roleOrder = { user: 0, host: 1, reviewer: 2 }
  if (roleOrder[session.role] >= roleOrder[role]) {
    return c.json({ ok: false, message: '你已经拥有该权限' }, 400)
  }

  const roleName = role === 'host' ? '活动主理人' : '审核管理员'

  const dedupKey = `role_req:${session.email}:${role}`
  const existing = await c.env.SESSIONS.get(dedupKey)
  if (existing) {
    return c.json({ ok: false, message: '你已提交过申请，请耐心等待管理员审批' }, 400)
  }

  await c.env.SESSIONS.put(dedupKey, JSON.stringify({
    email: session.email, display_name: session.display_name || '',
    role, roleName, requested_at: Date.now(),
  }), { expirationTtl: 7 * 24 * 3600 })

  const reviewers = await c.env.DB.prepare("SELECT id, email FROM admin_users WHERE role = 'reviewer'").all()
  for (const r of reviewers.results) {
    await c.env.DB.prepare(
      'INSERT INTO notifications (user_id, type, title, body) VALUES (?, ?, ?, ?)'
    ).bind(r.id, 'role_request', '角色升级申请',
      `${session.display_name || session.email} 申请成为${roleName}`
    ).run()

    const content = roleRequestEmail({ email: session.email, display_name: session.display_name }, roleName)
    c.executionCtx.waitUntil(sendEmail(c.env, { to: r.email, ...content }))
  }

  return c.json({ ok: true, message: `已提交${roleName}申请，等待管理员审批` })
})

// GET /api/users/role-requests — list pending role requests (reviewer)
users.get('/role-requests', async (c) => {
  await requireReviewer(c)
  const list = await c.env.SESSIONS.list({ prefix: 'role_req:' })
  const requests = []
  for (const key of list.keys) {
    const val = await c.env.SESSIONS.get(key.name)
    if (!val) continue
    try {
      const data = JSON.parse(val)
      if (data.email) requests.push({ key: key.name, ...data })
    } catch {}
  }
  requests.sort((a, b) => (b.requested_at || 0) - (a.requested_at || 0))
  return c.json({ ok: true, requests })
})

// POST /api/users/approve-role — approve a role request (reviewer)
users.post('/approve-role', async (c) => {
  const session = await requireReviewer(c)
  const { email, role } = await c.req.json()
  if (!email || !role) return c.json({ ok: false, message: '参数缺失' }, 400)

  const user = await c.env.DB.prepare('SELECT id, email, display_name, role FROM admin_users WHERE email = ?')
    .bind(email.trim().toLowerCase()).first()
  if (!user) return c.json({ ok: false, message: '用户不存在' }, 404)

  if (role === 'reviewer' && !session.is_super) {
    return c.json({ ok: false, message: '仅超级管理员可授予审核员权限' }, 403)
  }

  const prevRole = user.role
  await c.env.DB.prepare('UPDATE admin_users SET role = ? WHERE id = ?').bind(role, user.id).run()

  const emailContent = roleChangedEmail({ email: user.email, display_name: user.display_name }, role)
  c.executionCtx.waitUntil(sendEmail(c.env, { to: user.email, ...emailContent }))

  await c.env.SESSIONS.delete(`role_req:${email}:${role}`)

  const roleName = role === 'host' ? '活动主理人' : '审核管理员'
  await c.env.SESSIONS.put(`role_done:${email}:${role}`, JSON.stringify({
    email, display_name: user.display_name || '', role, roleName, prevRole,
    decision: 'approved', decided_by: session.email, decided_at: Date.now(),
  }), { expirationTtl: 30 * 24 * 3600 })

  await audit(c.env.DB, 'approve_role', 'user', user.id, `批准 ${email} 为${roleName}`, session.email)
  return c.json({ ok: true })
})

// POST /api/users/reject-role — reject a role request (reviewer)
users.post('/reject-role', async (c) => {
  const session = await requireReviewer(c)
  const { email, role } = await c.req.json()
  if (!email || !role) return c.json({ ok: false, message: '参数缺失' }, 400)

  const pendingVal = await c.env.SESSIONS.get(`role_req:${email}:${role}`)
  const pending = pendingVal ? JSON.parse(pendingVal) : {}

  await c.env.SESSIONS.delete(`role_req:${email}:${role}`)

  const roleName = role === 'host' ? '活动主理人' : '审核管理员'
  await c.env.SESSIONS.put(`role_done:${email}:${role}`, JSON.stringify({
    email, display_name: pending.display_name || '', role, roleName,
    decision: 'rejected', decided_by: session.email, decided_at: Date.now(),
  }), { expirationTtl: 30 * 24 * 3600 })

  await audit(c.env.DB, 'reject_role', 'user', null, `拒绝 ${email} 的${roleName}申请`, session.email)
  return c.json({ ok: true })
})

// GET /api/users/role-history — list decided role requests (reviewer)
users.get('/role-history', async (c) => {
  await requireReviewer(c)
  const list = await c.env.SESSIONS.list({ prefix: 'role_done:' })
  const history = []
  for (const key of list.keys) {
    const val = await c.env.SESSIONS.get(key.name)
    if (!val) continue
    try {
      const data = JSON.parse(val)
      if (data.email) history.push({ key: key.name, ...data })
    } catch {}
  }
  history.sort((a, b) => (b.decided_at || 0) - (a.decided_at || 0))
  return c.json({ ok: true, history })
})

// POST /api/users/revoke-role — undo an approval (reviewer)
users.post('/revoke-role', async (c) => {
  const session = await requireReviewer(c)
  const { email, role } = await c.req.json()
  if (!email || !role) return c.json({ ok: false, message: '参数缺失' }, 400)

  const doneKey = `role_done:${email}:${role}`
  const doneVal = await c.env.SESSIONS.get(doneKey)
  if (!doneVal) return c.json({ ok: false, message: '未找到该审批记录' }, 404)
  const done = JSON.parse(doneVal)
  if (done.decision !== 'approved') return c.json({ ok: false, message: '只能撤回已批准的申请' }, 400)

  const user = await c.env.DB.prepare('SELECT id, email, display_name, role FROM admin_users WHERE email = ?')
    .bind(email.trim().toLowerCase()).first()
  if (!user) return c.json({ ok: false, message: '用户不存在' }, 404)

  if (role === 'reviewer' && !session.is_super) {
    return c.json({ ok: false, message: '仅超级管理员可撤回审核员权限' }, 403)
  }

  const demoteTo = done.prevRole || (role === 'reviewer' ? 'host' : 'user')
  await c.env.DB.prepare('UPDATE admin_users SET role = ? WHERE id = ?').bind(demoteTo, user.id).run()

  const emailContent = roleChangedEmail({ email: user.email, display_name: user.display_name }, demoteTo)
  c.executionCtx.waitUntil(sendEmail(c.env, { to: user.email, ...emailContent }))

  await c.env.SESSIONS.delete(doneKey)

  return c.json({ ok: true })
})

export { users }
