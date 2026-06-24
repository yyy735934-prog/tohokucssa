const TTL = 7 * 24 * 3600

export async function createSession(kv, user) {
  const token = crypto.randomUUID()
  await kv.put(`session:${token}`, JSON.stringify({ id: user.id, email: user.email, role: user.role, display_name: user.display_name || '', is_super: !!user.is_super }), { expirationTtl: TTL })
  return token
}

export async function getSession(kv, token, db) {
  if (!token) return null
  const raw = await kv.get(`session:${token}`)
  if (!raw) return null
  const session = JSON.parse(raw)
  if (db) {
    const user = await db.prepare('SELECT id FROM admin_users WHERE id = ?').bind(session.id).first()
    if (!user) {
      await kv.delete(`session:${token}`)
      return null
    }
  }
  return session
}

export async function deleteSession(kv, token) {
  if (token) await kv.delete(`session:${token}`)
}

export function extractToken(req) {
  const auth = req.header('authorization') || ''
  return auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''
}
