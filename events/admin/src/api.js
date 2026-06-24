import { auth } from './lib/auth.js'

async function request(method, path, body) {
  const headers = { 'content-type': 'application/json' }
  const token = auth.token
  if (token) headers['authorization'] = `Bearer ${token}`

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })

  if (res.headers.get('content-type')?.includes('text/csv')) return res

  const data = await res.json().catch(() => ({ ok: false, message: `HTTP ${res.status}` }))
  if (res.status === 401) {
    auth.clear()
    if (window.__vueRouter) window.__vueRouter.push('/admin/login')
    throw new Error('登录已过期')
  }
  if (!res.ok || data.ok === false) throw new Error(data.message || '请求失败')
  return data
}

export const api = {
  login: (email, password) => request('POST', '/auth/login', { email, password }),
  logout: () => request('POST', '/auth/logout'),
  me: () => request('GET', '/auth/me'),
  changePassword: (old_password, new_password) => request('POST', '/auth/change-password', { old_password, new_password }),
  resetPassword: (user_id, new_password) => request('POST', '/auth/reset-password', { user_id, new_password }),

  listEvents: () => request('GET', '/events'),
  getEvent: (id) => request('GET', `/events/${id}`),
  createEvent: (data) => request('POST', '/events', data),
  updateEvent: (id, data) => request('PATCH', `/events/${id}`, data),
  deleteEvent: (id) => request('DELETE', `/events/${id}`),
  submitEvent: (id) => request('POST', `/events/${id}/submit`),
  approveEvent: (id) => request('POST', `/events/${id}/approve`),
  rejectEvent: (id, reason) => request('POST', `/events/${id}/reject`, { reason }),
  withdrawEvent: (id) => request('POST', `/events/${id}/withdraw`),
  activateEvent: (id) => request('POST', `/events/${id}/activate`),
  deactivateEvent: (id) => request('POST', `/events/${id}/deactivate`),
  togglePin: (id) => request('POST', `/events/${id}/toggle-pin`),
  closeEvent: (id) => request('POST', `/events/${id}/close`),
  duplicateEvent: (id) => request('POST', `/events/${id}/duplicate`),

  listSignups: (event_id) => request('GET', `/signups?event_id=${event_id}`),
  exportSignups: (event_id, format = 'csv') => request('GET', `/signups/export?event_id=${event_id}&format=${format}`),
  exportAllEvents: (format = 'csv') => request('GET', `/signups/export-all?format=${format}`),
  checkinSignup: (id) => request('POST', `/signups/${id}/checkin`),
  batchCheckin: (event_id) => request('POST', '/signups/batch-checkin', { event_id }),
  deleteSignup: (id) => request('DELETE', `/signups/${id}`),

  checkinByToken: (token) => request('POST', '/signups/checkin-by-token', { token }),
  manualSignup: (data) => request('POST', '/signups/manual', data),
  dashboardStats: () => request('GET', '/events/dashboard-stats'),

  notifyParticipants: (id, message) => request('POST', `/events/${id}/notify`, { message }),
  remindParticipants: (id) => request('POST', `/events/${id}/remind`),

  getNotifications: () => request('GET', '/notifications'),
  getUnreadCount: () => request('GET', '/notifications/unread-count'),
  markAllRead: () => request('POST', '/notifications/read-all'),
  markRead: (id) => request('POST', `/notifications/${id}/read`),

  generatePlan: (id, userInput) => request('POST', `/events/${id}/ai-draft`, { userInput }),
  savePlan: (id, plan) => request('PATCH', `/events/${id}/plan`, { plan }),

  requestRole: (role) => request('POST', '/users/request-role', { role }),
  listUsers: () => request('GET', '/users'),
  createUser: (data) => request('POST', '/users', data),
  updateUser: (id, data) => request('PATCH', `/users/${id}`, data),
  deleteUser: (id) => request('DELETE', `/users/${id}`),

  listRoleRequests: () => request('GET', '/users/role-requests'),
  approveRole: (email, role) => request('POST', '/users/approve-role', { email, role }),
  rejectRole: (email, role) => request('POST', '/users/reject-role', { email, role }),
  listRoleHistory: () => request('GET', '/users/role-history'),
  revokeRole: (email, role) => request('POST', '/users/revoke-role', { email, role }),
  inviteUser: (email, name) => request('POST', '/users/invite', { email, name }),

  uploadEventImage: async (eventId, file) => {
    const form = new FormData()
    form.append('file', file)
    const headers = {}
    if (auth.token) headers['authorization'] = `Bearer ${auth.token}`
    const res = await fetch(`/api/images/upload/${eventId}`, { method: 'POST', headers, body: form })
    const data = await res.json().catch(() => ({ ok: false, message: `HTTP ${res.status}` }))
    if (!res.ok || data.ok === false) throw new Error(data.message || '上传失败')
    return data
  },
  deleteEventImage: (eventId) => request('DELETE', `/images/${eventId}`),
}
