import { reactive } from 'vue'

const ADMIN_KEY = 'admin_auth'
const PUB_KEY = 'pub_auth'

function tryParse(key) {
  try { return JSON.parse(localStorage.getItem(key)) || null } catch { return null }
}

const stored = tryParse(ADMIN_KEY) || tryParse(PUB_KEY) || {}

export const auth = reactive({
  token: stored.token || '',
  email: stored.email || '',
  role: stored.role || '',
  is_super: !!stored.is_super,
  display_name: stored.display_name || '',

  save(data) {
    this.token = data.token
    this.email = data.email
    this.role = data.role
    this.is_super = !!data.is_super
    this.display_name = data.display_name || ''
    const payload = JSON.stringify({
      token: this.token, email: this.email, role: this.role,
      is_super: this.is_super, display_name: this.display_name
    })
    localStorage.setItem(ADMIN_KEY, payload)
    localStorage.setItem(PUB_KEY, payload)
  },

  clear() {
    this.token = ''
    this.email = ''
    this.role = ''
    this.is_super = false
    this.display_name = ''
    localStorage.removeItem(ADMIN_KEY)
    localStorage.removeItem(PUB_KEY)
  },

  _apply(data) {
    this.token = data.token || ''
    this.email = data.email || ''
    this.role = data.role || ''
    this.is_super = !!data.is_super
    this.display_name = data.display_name || ''
  },

  get isLoggedIn() { return !!this.token },
  get isReviewer() { return this.role === 'reviewer' },
  get isSuper() { return this.is_super },
})

let _lastReload = 0

window.addEventListener('storage', (e) => {
  if (e.key !== ADMIN_KEY && e.key !== PUB_KEY) return
  if (!e.newValue) {
    auth.clear()
    if (window.__vueRouter) window.__vueRouter.push('/admin/login')
    return
  }
  try {
    const data = JSON.parse(e.newValue)
    if (data.token && data.token !== auth.token) {
      if (Date.now() - _lastReload > 3000) {
        _lastReload = Date.now()
        window.location.reload()
      }
      return
    }
    auth._apply(data)
  } catch {}
})

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return
  const stored = tryParse(ADMIN_KEY) || tryParse(PUB_KEY)
  if (!stored?.token) {
    if (auth.isLoggedIn) {
      auth.clear()
      if (window.__vueRouter) window.__vueRouter.push('/admin/login')
    }
    return
  }
  if (stored.token !== auth.token) {
    if (Date.now() - _lastReload > 3000) {
      _lastReload = Date.now()
      window.location.reload()
    }
  }
})
