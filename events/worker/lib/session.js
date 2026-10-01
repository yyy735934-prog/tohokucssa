const TTL = 7 * 24 * 3600
const RENEW_INTERVAL_MS = 24 * 3600 * 1000

export async function createSession(kv, user, loginMethod = 'password') {
  const token = crypto.randomUUID()
  await kv.put(`session:${token}`, JSON.stringify({
    id: user.id,
    email: user.email,
    role: user.role,
    display_name: user.display_name || '',
    is_super: !!user.is_super,
    login_method: loginMethod,
    renewed_at: Date.now(),
  }), { expirationTtl: TTL })
  return token
}

export async function getSession(kv, token, db) {
  if (!token) return null
  const raw = await kv.get(`session:${token}`)
  if (!raw) return null
  const session = JSON.parse(raw)
  // Sliding expiry: an active session keeps living; write at most once a day
  // so ordinary requests do not each cost a KV write.
  let dirty = false
  if (!session.renewed_at || Date.now() - session.renewed_at > RENEW_INTERVAL_MS) {
    session.renewed_at = Date.now()
    dirty = true
  }
  let user = null
  if (db) {
    user = await db.prepare('SELECT id, role, display_name, is_super, google_linked FROM admin_users WHERE id = ?').bind(session.id).first()
    if (!user) {
      await kv.delete(`session:${token}`)
      return null
    }
    if (user.role !== session.role || (user.display_name || '') !== (session.display_name || '') || !!user.is_super !== !!session.is_super) {
      session.role = user.role
      session.display_name = user.display_name || ''
      session.is_super = !!user.is_super
      dirty = true
    }
  }
  if (dirty) await kv.put(`session:${token}`, JSON.stringify(session), { expirationTtl: TTL })
  if (user) session.google_linked = !!user.google_linked
  return session
}

export async function deleteSession(kv, token) {
  if (token) await kv.delete(`session:${token}`)
}

export function extractToken(req) {
  const auth = req.header('authorization') || ''
  return auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''
}
