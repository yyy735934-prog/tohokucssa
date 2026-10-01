const TOKEN_KEY = 'event_platform_token'
const ROLE_KEY = 'event_platform_role'

export function getToken() { return localStorage.getItem(TOKEN_KEY) }
export function setToken(t) { localStorage.setItem(TOKEN_KEY, t) }
export function clearToken() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(ROLE_KEY) }
export function getRole() { return localStorage.getItem(ROLE_KEY) }
export function setRole(r) { localStorage.setItem(ROLE_KEY, r) }

async function request(method, path, body) {
  const headers = { 'content-type': 'application/json' }
  const token = getToken()
  if (token) headers.authorization = `Bearer ${token}`
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })
  if (res.headers.get('content-type')?.includes('text/csv')) return res
  const data = await res.json().catch(() => ({ ok: false, message: `HTTP ${res.status}` }))
  if (!res.ok || data.ok === false) throw new Error(data.message || `请求失败 (${res.status})`)
  return data
}

export const api = {
  login: (email, password) => request('POST', '/auth/login', { email, password }),
  logout: () => request('POST', '/auth/logout'),
  me: () => request('GET', '/auth/me'),
  changePassword: (old_password, new_password) => request('POST', '/auth/change-password', { old_password, new_password }),

  listEvents: (scope) => request('GET', scope ? `/events?scope=${scope}` : '/events'),
  getEvent: (id) => request('GET', `/events/${id}`),
  createEvent: (data) => request('POST', '/events', data),
  updateEvent: (id, data) => request('PATCH', `/events/${id}`, data),
  deleteEvent: (id) => request('DELETE', `/events/${id}`),
  submitEvent: (id) => request('POST', `/events/${id}/submit`),
  withdrawEvent: (id) => request('POST', `/events/${id}/withdraw`),
  approveEvent: (id) => request('POST', `/events/${id}/approve`),
  rejectEvent: (id, reason) => request('POST', `/events/${id}/reject`, { reason }),
  activateEvent: (id) => request('POST', `/events/${id}/activate`),
  closeEvent: (id) => request('POST', `/events/${id}/close`),
  duplicateEvent: (id) => request('POST', `/events/${id}/duplicate`),

  listSignups: (eventId) => request('GET', `/signups?event_id=${eventId}`),
  signup: (data) => request('POST', '/signups', data),
  checkin: (id) => request('POST', `/signups/${id}/checkin`),
  publicCheckin: (eventId, email) => request('POST', '/signups/checkin', { event_id: eventId, email }),
  batchCheckin: (eventId) => request('POST', '/signups/batch-checkin', { event_id: eventId }),
  deleteSignup: (id) => request('DELETE', `/signups/${id}`),
  exportSignups: (eventId) => request('GET', `/signups/export?event_id=${eventId}`),

  listUsers: () => request('GET', '/users'),
  addUser: (data) => request('POST', '/users', data),
  deleteUser: (id) => request('DELETE', `/users/${id}`),
}
