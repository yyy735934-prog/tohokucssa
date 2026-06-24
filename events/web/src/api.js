import { auth } from './auth.js'

async function request(method, path, body) {
  const headers = { 'content-type': 'application/json' }
  if (auth.token) headers['authorization'] = `Bearer ${auth.token}`

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })
  const data = await res.json().catch(() => ({ ok: false, message: `HTTP ${res.status}` }))
  if (!res.ok || data.ok === false) throw new Error(data.message || '请求失败')
  return data
}

export const api = {
  getEvent: (id) => request('GET', `/events/${id}`),
  listEvents: () => request('GET', '/events?scope=public'),
  signup: (data) => request('POST', '/signups', data),
  getSignupByToken: (token) => request('GET', `/signups/by-token/${token}`),
  checkinByToken: (token) => request('POST', '/signups/checkin-by-token', { token }),
  checkinByEmail: (eventId, email) => request('POST', '/signups/checkin', { event_id: eventId, email }),
  myEvents: (email) => request('GET', `/participant/my-events?email=${encodeURIComponent(email)}`),
  myCreatedEvents: () => request('GET', '/events'),
  cancelSignup: (token) => request('POST', '/participant/cancel', { token }),
  updateSignup: (token, data) => request('POST', '/participant/update', { token, ...data }),
  requestRole: (role) => request('POST', '/users/request-role', { role }),
  applyEvent: (data) => request('POST', '/events/propose', data),
  myPendingRequests: () => request('GET', '/users/my-requests'),
}
