import { reactive } from 'vue'

const PUB_KEY = 'pub_auth'
const ADMIN_KEY = 'admin_auth'

function tryParse(key) {
  try { return JSON.parse(localStorage.getItem(key)) || null } catch { return null }
}

function loadStored() {
  return tryParse(PUB_KEY) || tryParse(ADMIN_KEY) || {}
}

const stored = loadStored()

export const auth = reactive({
  token: stored.token || '',
  email: stored.email || '',
  role: stored.role || '',
  is_super: !!stored.is_super,
  display_name: stored.display_name || '',

  get isLoggedIn() { return !!this.token },

  save(data) {
    this.token = data.token || ''
    this.email = data.email || ''
    this.role = data.role || ''
    this.is_super = !!data.is_super
    this.display_name = data.display_name || ''
    const payload = JSON.stringify({
      token: this.token, email: this.email, role: this.role,
      is_super: this.is_super, display_name: this.display_name,
    })
    localStorage.setItem(PUB_KEY, payload)
    localStorage.setItem(ADMIN_KEY, payload)
  },

  clear() {
    this.token = ''; this.email = ''; this.role = ''; this.is_super = false; this.display_name = ''
    localStorage.removeItem(PUB_KEY)
    localStorage.removeItem(ADMIN_KEY)
  },

  _apply(data) {
    this.token = data.token || ''
    this.email = data.email || ''
    this.role = data.role || ''
    this.is_super = !!data.is_super
    this.display_name = data.display_name || ''
  },
})

window.addEventListener('storage', (e) => {
  if (e.key !== PUB_KEY && e.key !== ADMIN_KEY) return
  if (!e.newValue) { auth.clear(); return }
  try { auth._apply(JSON.parse(e.newValue)) } catch {}
})
