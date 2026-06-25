import { Hono } from 'hono'
import { hashPassword, verifyPassword } from '../lib/password.js'
import { createSession, deleteSession, getSession, extractToken } from '../lib/session.js'

const auth = new Hono()

// POST /api/auth/login  {email, password}
auth.post('/login', async (c) => {
  const { email, password } = await c.req.json()
  if (!email || !password) return c.json({ ok: false, message: '请输入邮箱和密码' }, 400)

  const user = await c.env.DB.prepare('SELECT * FROM admin_users WHERE email = ?').bind(email.trim().toLowerCase()).first()
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return c.json({ ok: false, message: '邮箱或密码错误' }, 401)
  }

  const token = await createSession(c.env.SESSIONS, user)
  return c.json({ ok: true, token, email: user.email, role: user.role, is_super: !!user.is_super })
})

// POST /api/auth/logout
auth.post('/logout', async (c) => {
  const token = extractToken(c.req)
  await deleteSession(c.env.SESSIONS, token)
  return c.json({ ok: true })
})

// GET /api/auth/me
auth.get('/me', async (c) => {
  const token = extractToken(c.req)
  const session = await getSession(c.env.SESSIONS, token, c.env.DB)
  if (!session) return c.json({ ok: false, message: '未登录' }, 401)
  return c.json({ ok: true, ...session })
})

// POST /api/auth/change-password  {old_password, new_password}
auth.post('/change-password', async (c) => {
  const token = extractToken(c.req)
  const session = await getSession(c.env.SESSIONS, token, c.env.DB)
  if (!session) return c.json({ ok: false, message: '未登录' }, 401)

  const { old_password, new_password } = await c.req.json()
  if (!new_password || new_password.length < 6) return c.json({ ok: false, message: '新密码至少6位' }, 400)

  const user = await c.env.DB.prepare('SELECT password_hash FROM admin_users WHERE id = ?').bind(session.id).first()
  if (user.password_hash && !(await verifyPassword(old_password || '', user.password_hash))) {
    return c.json({ ok: false, message: '原密码错误' }, 400)
  }

  const hash = await hashPassword(new_password)
  await c.env.DB.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').bind(hash, session.id).run()
  return c.json({ ok: true })
})

// Super admin: reset another user's password
auth.post('/reset-password', async (c) => {
  const token = extractToken(c.req)
  const session = await getSession(c.env.SESSIONS, token, c.env.DB)
  if (!session || !session.is_super) return c.json({ ok: false, message: '仅超级管理员可操作' }, 403)

  const { user_id, new_password } = await c.req.json()
  if (!user_id || !new_password || new_password.length < 6) return c.json({ ok: false, message: '参数错误' }, 400)

  const hash = await hashPassword(new_password)
  await c.env.DB.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').bind(hash, user_id).run()
  return c.json({ ok: true })
})

// POST /api/auth/register-invite  {token, password, display_name?}
auth.post('/register-invite', async (c) => {
  const { token, password, display_name } = await c.req.json()
  if (!token || !password || password.length < 6) {
    return c.json({ ok: false, message: '邀请码和密码（至少6位）必填' }, 400)
  }

  const raw = await c.env.SESSIONS.get(`invite:${token}`)
  if (!raw) return c.json({ ok: false, message: '邀请链接无效或已过期' }, 400)

  const invite = JSON.parse(raw)

  const hash = await hashPassword(password)
  const inviteRole = invite.role || 'host'
  const roleOrder = { user: 0, host: 1, reviewer: 2 }

  const existing = await c.env.DB.prepare('SELECT * FROM admin_users WHERE email = ?').bind(invite.email).first()
  if (existing) {
    const newRole = roleOrder[inviteRole] > roleOrder[existing.role] ? inviteRole : existing.role
    const newName = (display_name || existing.display_name || invite.name || '').trim()
    await c.env.DB.prepare('UPDATE admin_users SET password_hash = ?, role = ?, display_name = ? WHERE id = ?')
      .bind(hash, newRole, newName, existing.id).run()
    if (invite.event_id) {
      await c.env.DB.prepare('UPDATE events SET created_by = ? WHERE id = ? AND created_by IS NULL')
        .bind(existing.id, invite.event_id).run()
    }
    await c.env.SESSIONS.delete(`invite:${token}`)

    const user = { id: existing.id, email: invite.email, role: newRole, display_name: newName, is_super: !!existing.is_super }
    const sessionToken = await createSession(c.env.SESSIONS, user)
    return c.json({ ok: true, token: sessionToken, email: invite.email, role: newRole, is_super: !!existing.is_super, merged: true })
  }

  const name = (display_name || invite.name || '').trim()
  const result = await c.env.DB.prepare(
    'INSERT INTO admin_users (email, password_hash, role, display_name) VALUES (?, ?, ?, ?)'
  ).bind(invite.email, hash, inviteRole, name).run()

  const userId = result.meta.last_row_id
  if (invite.event_id) {
    await c.env.DB.prepare('UPDATE events SET created_by = ? WHERE id = ? AND created_by IS NULL')
      .bind(userId, invite.event_id).run()
  }

  await c.env.SESSIONS.delete(`invite:${token}`)

  const user = { id: userId, email: invite.email, role: inviteRole, display_name: name, is_super: false }
  const sessionToken = await createSession(c.env.SESSIONS, user)

  return c.json({ ok: true, token: sessionToken, email: invite.email, role: inviteRole, is_super: false })
})

// GET /api/auth/google — redirect to Google OAuth
auth.get('/google', async (c) => {
  const { GOOGLE_CLIENT_ID } = c.env
  if (!GOOGLE_CLIENT_ID) return c.json({ ok: false, message: 'Google OAuth 未配置' }, 500)

  const origin = new URL(c.req.url).origin
  const redirectUri = `${origin}/api/auth/google/callback`
  const from = c.req.query('from') || 'admin'
  const state = crypto.randomUUID()
  await c.env.SESSIONS.put(`oauth:${state}`, from, { expirationTtl: 600 })

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  })
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
})

// GET /api/auth/google/callback — handle Google OAuth callback
auth.get('/google/callback', async (c) => {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = c.env
  const { code, state, error } = c.req.query()

  if (error) return c.redirect('/admin/login?error=google_denied')

  const from = await c.env.SESSIONS.get(`oauth:${state}`)
  if (!from) return c.redirect('/admin/login?error=invalid_state')
  await c.env.SESSIONS.delete(`oauth:${state}`)

  const origin = new URL(c.req.url).origin
  const redirectUri = `${origin}/api/auth/google/callback`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri, grant_type: 'authorization_code',
    }),
  })
  const errorPage = from === 'admin' ? '/admin/login' : '/'
  if (!tokenRes.ok) return c.redirect(`${errorPage}?error=token_failed`)
  const tokens = await tokenRes.json()

  const infoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  })
  if (!infoRes.ok) return c.redirect(`${errorPage}?error=userinfo_failed`)
  const profile = await infoRes.json()

  const email = (profile.email || '').toLowerCase()
  let user = await c.env.DB.prepare('SELECT * FROM admin_users WHERE email = ?').bind(email).first()
  let isNew = false

  if (!user) {
    if (from === 'admin') {
      return c.redirect('/admin/login?error=no_account&email=' + encodeURIComponent(email))
    }
    const displayName = profile.name || email.split('@')[0]
    const initialPassword = email.split('@')[0]
    const hash = await hashPassword(initialPassword)
    const res = await c.env.DB.prepare(
      'INSERT INTO admin_users (email, password_hash, role, display_name) VALUES (?, ?, ?, ?)'
    ).bind(email, hash, 'user', displayName).run()
    user = { id: res.meta.last_row_id, email, role: 'user', display_name: displayName, is_super: 0 }
    isNew = true
  }

  const sessionToken = await createSession(c.env.SESSIONS, user)
  const params = `google_token=${sessionToken}&email=${encodeURIComponent(user.email)}&role=${user.role}&is_super=${user.is_super ? 1 : 0}&display_name=${encodeURIComponent(user.display_name || '')}`

  if (from === 'admin') {
    return c.redirect(`/admin/login?${params}`)
  }
  return c.redirect(`/my?${params}&new=${isNew ? 1 : 0}`)
})

// GET /api/auth/profile — get saved profile
auth.get('/profile', async (c) => {
  const token = extractToken(c.req)
  const session = await getSession(c.env.SESSIONS, token, c.env.DB)
  if (!session) return c.json({ ok: false, message: '未登录' }, 401)

  const user = await c.env.DB.prepare('SELECT profile FROM admin_users WHERE id = ?').bind(session.id).first()
  let profile = {}
  try { profile = JSON.parse(user?.profile || '{}') } catch {}
  return c.json({ ok: true, profile })
})

// POST /api/auth/profile — save profile
auth.post('/profile', async (c) => {
  const token = extractToken(c.req)
  const session = await getSession(c.env.SESSIONS, token, c.env.DB)
  if (!session) return c.json({ ok: false, message: '未登录' }, 401)

  const { profile } = await c.req.json()
  if (!profile || typeof profile !== 'object') return c.json({ ok: false, message: '无效数据' }, 400)

  const allowed = ['name', 'name_kana', 'school', 'school_other', 'student_id', 'phone', 'phone_cn', 'phone_jp', 'wechat']
  const clean = {}
  for (const k of allowed) {
    if (profile[k] !== undefined && profile[k] !== null) clean[k] = String(profile[k]).trim()
  }

  await c.env.DB.prepare('UPDATE admin_users SET profile = ? WHERE id = ?')
    .bind(JSON.stringify(clean), session.id).run()
  return c.json({ ok: true })
})

// GET /api/auth/invite-info?token=xxx — validate invite token
auth.get('/invite-info', async (c) => {
  const token = c.req.query('token')
  if (!token) return c.json({ ok: false, message: '缺少邀请码' }, 400)

  const raw = await c.env.SESSIONS.get(`invite:${token}`)
  if (!raw) return c.json({ ok: false, message: '邀请链接无效或已过期' }, 400)

  const invite = JSON.parse(raw)
  const existing = await c.env.DB.prepare('SELECT role FROM admin_users WHERE email = ?').bind(invite.email).first()
  return c.json({ ok: true, email: invite.email, name: invite.name, role: invite.role || 'host', hasAccount: !!existing, currentRole: existing?.role })
})

export { auth }
