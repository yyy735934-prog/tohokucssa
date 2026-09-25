import { auth } from './auth.js'
import { showToast } from './lib/toast.js'

let expiryNotified = false
function handleExpiredLogin(tokenUsed) {
  // Another login may have replaced the token while this request was in flight
  if (auth.token !== tokenUsed) return
  auth.clear()
  if (!expiryNotified) {
    expiryNotified = true
    showToast('登录已过期，请重新登录', 'error')
    setTimeout(() => { expiryNotified = false }, 3000)
  }
}

async function request(method, path, body, extraHeaders = {}) {
  const headers = { 'content-type': 'application/json', ...extraHeaders }
  const tokenUsed = auth.token
  if (tokenUsed) headers['authorization'] = `Bearer ${tokenUsed}`

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })
  const data = await res.json().catch(() => ({ ok: false, message: `HTTP ${res.status}` }))
  // A stored login the server no longer recognises: drop it so the page
  // stops pretending the user is signed in.
  if (res.status === 401 && tokenUsed && !path.startsWith('/auth/login')) {
    handleExpiredLogin(tokenUsed)
    const err = new Error('登录已过期，请重新登录')
    err.status = 401
    throw err
  }
  if (!res.ok || data.ok === false) throw new Error(data.message || '请求失败')
  return data
}

export const api = {
  me: () => request('GET', '/auth/me'),
  getEvent: (id) => request('GET', `/events/${id}`),
  listEvents: () => request('GET', '/events?scope=public'),
  signup: (data) => request('POST', '/signups', data),
  getSignupByToken: (token) => request('GET', `/signups/by-token/${token}`),
  checkinByToken: (token) => request('POST', '/signups/checkin-by-token', { token }),
  checkinByEmail: (eventId, email) => request('POST', '/signups/checkin', { event_id: eventId, email }),
  myEvents: (lookupToken) => request('GET', '/participant/my-events', undefined, lookupToken ? { 'x-lookup-token': lookupToken } : {}),
  sendLookupCode: (email) => request('POST', '/participant/lookup-code', { email }),
  verifyLookupCode: (email, code) => request('POST', '/participant/lookup-verify', { email, code }),
  lookupLogout: (lookupToken) => request('POST', '/participant/lookup-logout', undefined, { 'x-lookup-token': lookupToken }),
  myCreatedEvents: () => request('GET', '/events'),
  cancelSignup: (token) => request('POST', '/participant/cancel', { token }),
  updateSignup: (token, data) => request('POST', '/participant/update', { token, ...data }),
  requestRole: (role) => request('POST', '/users/request-role', { role }),
  applyEvent: (data) => request('POST', '/events/propose', data),
  myPendingRequests: () => request('GET', '/users/my-requests'),
  getProfile: () => request('GET', '/auth/profile'),
  saveProfile: (profile) => request('POST', '/auth/profile', { profile }),
  listGatherings: () => request('GET', '/gatherings'),
  getGathering: (id) => request('GET', `/gatherings/${id}`),
  getGatheringHostOffer: (token) => request('GET', `/gatherings/host-offers/${encodeURIComponent(token || '')}`),
  acceptGatheringHostOffer: (token) => request('POST', `/gatherings/host-offers/${encodeURIComponent(token || '')}/accept`),
  joinGathering: (id, data) => request('POST', `/gatherings/${id}/join`, data),
  cancelGatheringSignup: (id, reason = '') => request('POST', `/gatherings/${id}/cancel`, { reason }),
  myGatherings: () => request('GET', '/gatherings/mine'),
  getOccurrences: (id) => request('GET', `/gatherings/${id}/occurrences`),
  selectOccurrence: (id, occurrenceId) => request('POST', `/gatherings/${id}/occurrences/${occurrenceId}/select`),
  cancelOccurrence: (id, occurrenceId) => request('DELETE', `/gatherings/${id}/occurrences/${occurrenceId}/select`),
  getReconfirm: (token) => request('GET', `/gatherings/reconfirm/${encodeURIComponent(token || '')}`),
  submitReconfirm: (token, action) => request('POST', `/gatherings/reconfirm/${encodeURIComponent(token || '')}`, { action }),
  getEventHostInvite: (token) => request('GET', `/events/host-invites/${encodeURIComponent(token || '')}`),
  respondEventHostInvite: (token, action) => request('POST', `/events/host-invites/${encodeURIComponent(token || '')}/${action}`),
  chatSession: (data) => request('POST', '/chat/session', data),
}
