<template>
  <div class="page">
    <h1 class="page-title">我的</h1>

    <!-- Logged-in user header -->
    <div v-if="auth.isLoggedIn" class="user-card card">
      <div class="user-info">
        <div class="avatar">{{ (auth.display_name || auth.email)[0] }}</div>
        <div>
          <div class="user-name">{{ auth.display_name || auth.email.split('@')[0] }}</div>
          <div class="user-email">{{ auth.email }}</div>
          <div class="user-role">{{ roleLabel }}</div>
        </div>
      </div>
      <div class="user-actions">
        <a v-if="auth.role !== 'user'" href="/admin/events" class="btn btn-outline btn-sm">管理后台</a>
        <button class="btn btn-outline btn-sm" @click="logout">退出登录</button>
      </div>
    </div>

    <!-- Tip for first-time visitors -->
    <div v-if="!auth.isLoggedIn && !savedEmail" class="tip-card card">
      <p class="tip-title">无需注册，轻松参与</p>
      <p class="tip-desc">直接报名活动即可参与，报名后可在此页面查看活动记录。</p>
      <router-link to="/" class="btn btn-primary btn-sm" style="align-self:flex-start">浏览活动</router-link>
    </div>

    <!-- Profile section -->
    <div v-if="auth.isLoggedIn" class="section">
      <div class="section-head" style="display:flex;justify-content:space-between;align-items:center">
        <h2 class="section-title" style="margin-bottom:0">个人信息</h2>
        <button v-if="!editingProfile" class="btn btn-outline btn-sm" @click="startEditProfile">编辑</button>
      </div>
      <p class="section-desc">保存常用信息，报名活动时自动填充</p>

      <div v-if="!editingProfile" class="card profile-view">
        <div v-if="hasProfile">
          <div v-if="profile.name" class="profile-row"><span class="profile-label">姓名</span><span>{{ profile.name }}</span></div>
          <div v-if="profile.name_kana" class="profile-row"><span class="profile-label">姓名假名</span><span>{{ profile.name_kana }}</span></div>
          <div v-if="profile.gender" class="profile-row"><span class="profile-label">性别</span><span>{{ profile.gender }}</span></div>
          <div v-if="profile.school" class="profile-row"><span class="profile-label">所属学校</span><span>{{ profile.school }}</span></div>
          <div v-if="profile.student_id" class="profile-row"><span class="profile-label">学号/工号</span><span>{{ profile.student_id }}</span></div>
          <div v-if="profile.phone_cn" class="profile-row"><span class="profile-label">中国手机号</span><span>{{ profile.phone_cn }}</span></div>
          <div v-if="profile.phone_jp" class="profile-row"><span class="profile-label">日本电话号</span><span>{{ profile.phone_jp }}</span></div>
          <div v-if="profile.wechat" class="profile-row"><span class="profile-label">微信号</span><span>{{ profile.wechat }}</span></div>
        </div>
        <p v-else class="empty-profile">尚未填写，点击「编辑」保存常用信息</p>
      </div>

      <form v-else class="card" @submit.prevent="saveProfileData">
        <div class="field">
          <label class="label">姓名</label>
          <input v-model="profileForm.name" placeholder="你的姓名" />
        </div>
        <div class="field">
          <label class="label">姓名假名</label>
          <input v-model="profileForm.name_kana" placeholder="シメイ" />
        </div>
        <div class="field">
          <label class="label">性别</label>
          <select v-model="profileForm.gender">
            <option value="" disabled hidden>请选择</option>
            <option value="男">男</option>
            <option value="女">女</option>
          </select>
        </div>
        <div class="field">
          <label class="label">所属学校</label>
          <select v-model="profileForm.school">
            <option value="">请选择</option>
            <option v-for="s in schoolList" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
        <div v-if="profileForm.school === '其他学校'" class="field">
          <label class="label">学校名称</label>
          <input v-model="profileForm.school_other" placeholder="请输入学校名称" />
        </div>
        <div v-if="profileForm.school === '東北大学'" class="field">
          <label class="label">学号/工号</label>
          <input v-model="profileForm.student_id" placeholder="東北大学学友填写" />
        </div>
        <div class="field">
          <label class="label">中国手机号</label>
          <input v-model="profileForm.phone_cn" type="tel" placeholder="选填" />
        </div>
        <div class="field">
          <label class="label">日本电话号</label>
          <input v-model="profileForm.phone_jp" type="tel" placeholder="選択入力" />
        </div>
        <div class="field">
          <label class="label">微信号</label>
          <input v-model="profileForm.wechat" placeholder="选填" />
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" @click="editingProfile = false">取消</button>
          <button type="submit" class="btn btn-primary" :disabled="savingProfile">{{ savingProfile ? '保存中…' : '保存' }}</button>
        </div>
      </form>
    </div>

    <!-- Role upgrade section -->
    <div v-if="auth.isLoggedIn && (auth.role === 'user' || auth.role === 'host')" class="section">
      <h2 class="section-title">身份升级</h2>
      <div class="role-cards">
        <div v-if="auth.role === 'user'" class="card role-card">
          <div class="role-card-head">
            <span class="role-icon">&#127911;</span>
            <div>
              <div class="role-card-title">活动主理人</div>
              <div class="role-card-desc">创建和管理自己的活动，邀请参与者</div>
            </div>
          </div>
          <button v-if="requested.host" class="btn btn-outline btn-sm" disabled>已申请，等待审批</button>
          <button v-else class="btn btn-primary btn-sm" :disabled="requesting" @click="requestRole('host')">
            {{ requesting ? '提交中…' : '申请成为主理人' }}
          </button>
        </div>
        <div class="card role-card">
          <div class="role-card-head">
            <span class="role-icon">&#128736;</span>
            <div>
              <div class="role-card-title">审核管理员</div>
              <div class="role-card-desc">审核活动申请，管理平台用户</div>
            </div>
          </div>
          <button v-if="requested.reviewer" class="btn btn-outline btn-sm" disabled>已申请，等待审批</button>
          <button v-else class="btn btn-outline btn-sm" :disabled="requesting" @click="requestRole('reviewer')">
            {{ requesting ? '提交中…' : '申请成为管理员' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Created events section (logged-in only) -->
    <div v-if="auth.isLoggedIn && createdEvents.length" class="section">
      <h2 class="section-title">我创建的活动</h2>
      <div class="event-list">
        <div v-for="e in createdEvents" :key="'c-'+e.id" class="card event-item">
          <div class="head">
            <h3>{{ e.title }}</h3>
            <span class="badge" :class="`badge-${e.status}`">{{ statusLabel(e.status) }}</span>
          </div>
          <div class="info">{{ e.event_date }}<span v-if="e.location"> · {{ e.location }}</span></div>
          <div v-if="e.reject_reason" class="reject-reason">驳回原因：{{ e.reject_reason }}</div>
          <div class="meta-row">
            <span v-if="e.signupCount !== undefined" class="meta-item">{{ e.signupCount }} 人报名</span>
          </div>
          <div class="actions">
            <a :href="`/admin/events/${e.id}`" class="btn btn-outline btn-sm">管理详情</a>
            <router-link :to="`/e/${e.id}`" class="btn btn-outline btn-sm">公开页面</router-link>
          </div>
        </div>
      </div>
    </div>

    <!-- Signup history section -->
    <div class="section">
      <h2 class="section-title">参加的活动</h2>

      <!-- Search bar: only for anonymous users -->
      <form v-if="!auth.isLoggedIn" class="search-bar" @submit.prevent="searchSignups">
        <input v-model="email" type="email" required placeholder="输入报名邮箱查询" />
        <button type="submit" class="btn btn-primary btn-sm" :disabled="loading" style="flex-shrink:0">
          {{ loading ? '查询中…' : '查询' }}
        </button>
        <button v-if="savedEmail" type="button" class="btn btn-outline btn-sm" @click="clearSaved" style="flex-shrink:0">换人</button>
      </form>

      <div v-if="searched && !signups.length" class="empty">
        <p>暂无报名记录</p>
      </div>

      <div v-if="signups.length" class="event-list">
        <div v-for="e in signups" :key="e.signup_id" class="card event-item">
          <div class="head">
            <h3>{{ e.title }}</h3>
            <span class="badge" :class="`badge-${e.status}`">
              {{ { open:'报名中', active:'进行中', closed:'已结束' }[e.status] || e.status }}
            </span>
          </div>
          <div class="info">{{ e.event_date }}<span v-if="e.location"> · {{ e.location }}</span></div>
          <div class="status-row">
            <span v-if="e.checked_in" class="badge badge-open">已签到 ✓</span>
            <span v-else class="badge" style="background:var(--c-bg);color:var(--c-text-2)">未签到</span>
          </div>
          <div class="actions">
            <router-link v-if="e.token && isWithin(e.event_date, 1)" :to="`/signup-ok/${e.event_id}?token=${e.token}`" class="btn btn-outline btn-sm">
              签到码
            </router-link>
            <router-link :to="`/e/${e.event_id}`" class="btn btn-outline btn-sm">活动详情</router-link>
            <button v-if="canModify(e)"
              class="btn btn-outline btn-sm" @click="openEdit(e)">修改信息</button>
            <button v-if="canModify(e)"
              class="btn btn-outline btn-sm" style="color:var(--c-danger)"
              @click="cancelSignup(e)" :disabled="cancelling">取消报名</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit signup modal -->
    <div v-if="editTarget" class="modal-overlay" @click.self="editTarget = null">
      <div class="modal">
        <h3 class="modal-title">修改报名信息</h3>
        <p style="font-size:13px;color:var(--c-text-2);margin-bottom:12px">{{ editTarget.title }}</p>
        <form @submit.prevent="saveEdit">
          <div class="field">
            <label class="label">姓名 *</label>
            <input v-model="editForm.name" required />
          </div>
          <div class="field">
            <label class="label">手机号</label>
            <input v-model="editForm.phone" />
          </div>
          <div v-for="cf in editCustomFields" :key="cf.key" class="field">
            <label class="label">{{ cf.label }}{{ cf.required ? ' *' : '' }}</label>
            <select v-if="cf.type === 'select'" v-model="editForm.extra[cf.key]" :required="cf.required">
              <option value="">请选择</option>
              <option v-for="opt in cf.options" :key="opt" :value="opt">{{ opt }}</option>
            </select>
            <textarea v-else-if="cf.type === 'textarea'" v-model="editForm.extra[cf.key]" rows="2" :required="cf.required"></textarea>
            <input v-else v-model="editForm.extra[cf.key]" :type="cf.type === 'number' ? 'number' : 'text'" :required="cf.required" />
          </div>
          <p v-if="editError" class="error" style="font-size:13px;color:var(--c-danger)">{{ editError }}</p>
          <div class="modal-actions">
            <button type="button" class="btn btn-outline" @click="editTarget = null">取消</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Google login section (only for anonymous users) -->
    <div v-if="!auth.isLoggedIn" class="section login-section">
      <div class="card login-card">
        <p class="login-title">想举办活动或管理活动？</p>
        <p class="login-desc">用 Google 账号登录，即可创建和管理自己的活动</p>
        <a href="/api/auth/google?from=public" class="google-btn">
          <svg viewBox="0 0 24 24" width="18" height="18"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09a7.12 7.12 0 0 1 0-4.17V7.07H2.18a11.96 11.96 0 0 0 0 9.86l3.66-2.84z" fill="#FBBC05"/><path d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.09 14.97 0 12 0 7.7 0 3.99 2.47 2.18 6.07l3.66 2.85c.87-2.6 3.3-4.17 6.16-4.17z" fill="#EA4335"/></svg>
          Google 登录 / 注册
        </a>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { api } from '../api.js'
import { auth } from '../auth.js'
import { showToast } from '../lib/toast.js'

const email = ref('')
const savedEmail = ref('')
const signups = ref([])
const createdEvents = ref([])
const loading = ref(false)
const searched = ref(false)
const cancelling = ref(false)
const requesting = ref(false)
const editTarget = ref(null)
const editForm = ref({ name: '', phone: '', extra: {} })
const editCustomFields = ref([])
const editError = ref('')
const saving = ref(false)
const requested = ref(JSON.parse(localStorage.getItem('role_requested') || '{}'))

const profile = ref({})
const editingProfile = ref(false)
const savingProfile = ref(false)
const profileForm = ref({})
const schoolList = ['東北大学', '山形大学', '福島大学', '会津大学', '宮城大学', '仙台大学', '東北医科薬科大学', '東北学院大学', '東北工業大学', '福島県立医科大学', '東北芸術工科大学', '其他学校']

const hasProfile = computed(() => Object.values(profile.value).some(v => v))

function isWithin(eventDate, days) {
  if (!eventDate) return false
  const now = new Date()
  const jstNow = new Date(now.getTime() + 9 * 3600000)
  const eventDay = new Date(eventDate.replace(/\s/, 'T') + '+09:00')
  return (eventDay - jstNow) < days * 24 * 3600000
}

function canModify(e) {
  return !e.checked_in && e.status !== 'closed' && e.token && !isWithin(e.event_date, 3)
}

const roleLabel = computed(() => {
  if (auth.is_super) return '超级管理员'
  const map = { reviewer: '审核员', host: '活动主理人', user: '普通用户' }
  return map[auth.role] || ''
})

function statusLabel(s) {
  return { draft: '草稿', pending: '审核中', open: '报名中', active: '进行中', closed: '已结束' }[s] || s
}

function loadForCurrentUser() {
  signups.value = []
  createdEvents.value = []
  searched.value = false
  if (auth.isLoggedIn) {
    email.value = auth.email
    savedEmail.value = auth.email
    searchSignups()
    loadCreatedEvents()
    syncPendingRequests()
    loadProfile()
  } else {
    const stored = localStorage.getItem('user_email')
    if (stored) {
      email.value = stored
      savedEmail.value = stored
      searchSignups()
    }
  }
}

async function syncPendingRequests() {
  try {
    const data = await api.myPendingRequests()
    requested.value = data.pending || {}
    localStorage.setItem('role_requested', JSON.stringify(requested.value))
  } catch {}
}

async function loadProfile() {
  try {
    const data = await api.getProfile()
    profile.value = data.profile || {}
  } catch {}
}

function startEditProfile() {
  const p = { ...profile.value }
  if (p.school && !schoolList.includes(p.school)) {
    p.school_other = p.school
    p.school = '其他学校'
  }
  profileForm.value = p
  editingProfile.value = true
}

async function saveProfileData() {
  savingProfile.value = true
  try {
    const data = { ...profileForm.value }
    if (data.school === '其他学校') {
      data.school = data.school_other || ''
    }
    delete data.school_other
    await api.saveProfile(data)
    profile.value = { ...data }
    editingProfile.value = false
    showToast('个人信息已保存')
  } catch (err) { showToast(err.message, 'error') }
  savingProfile.value = false
}

onMounted(loadForCurrentUser)

watch(() => auth.email, (newEmail, oldEmail) => {
  if (newEmail !== oldEmail) loadForCurrentUser()
})

async function searchSignups() {
  loading.value = true
  searched.value = true
  try {
    const data = await api.myEvents(email.value)
    signups.value = data.events
    localStorage.setItem('user_email', email.value)
    savedEmail.value = email.value
  } catch { signups.value = [] }
  loading.value = false
}

async function loadCreatedEvents() {
  try {
    const data = await api.myCreatedEvents()
    createdEvents.value = data.events || []
  } catch { createdEvents.value = [] }
}

function clearSaved() {
  localStorage.removeItem('user_email')
  localStorage.removeItem('user_name')
  savedEmail.value = ''
  email.value = ''
  signups.value = []
  searched.value = false
}

function logout() {
  auth.clear()
  localStorage.removeItem('user_email')
  localStorage.removeItem('user_name')
  savedEmail.value = ''
  email.value = ''
  signups.value = []
  createdEvents.value = []
  searched.value = false
}

async function requestRole(role) {
  requesting.value = true
  try {
    const data = await api.requestRole(role)
    markRequested(role)
    showToast(data.message)
  } catch (err) {
    if (err.message && err.message.includes('已提交')) markRequested(role)
    showToast(err.message, 'error')
  }
  requesting.value = false
}

function markRequested(role) {
  requested.value = { ...requested.value, [role]: true }
  localStorage.setItem('role_requested', JSON.stringify(requested.value))
}

function openEdit(e) {
  editTarget.value = e
  editError.value = ''
  let extra = {}
  try { extra = typeof e.data === 'string' ? JSON.parse(e.data || '{}') : (e.data || {}) } catch {}
  editForm.value = { name: e.name, phone: e.phone || '', extra: { ...extra } }
  const builtInFields = [
    { key: '姓名假名', label: '姓名假名', type: 'text', required: true },
    { key: '所属学校', label: '所属学校', type: 'text', required: true },
    { key: '学号/工号', label: '学号/工号', type: 'text', required: false },
    { key: '微信号', label: '微信号', type: 'text', required: false },
  ].filter(f => f.key in extra)
  let cfs = []
  try { cfs = JSON.parse(e.custom_fields || '[]') } catch {}
  const customDefs = Array.isArray(cfs) ? cfs.map((f, i) => ({
    ...f, key: f.key || f.label || `field_${i}`, options: f.options || []
  })) : []
  editCustomFields.value = [...builtInFields, ...customDefs]
}

async function saveEdit() {
  editError.value = ''
  saving.value = true
  try {
    await api.updateSignup(editTarget.value.token, {
      name: editForm.value.name,
      phone: editForm.value.phone,
      extra: editForm.value.extra,
    })
    const t = editTarget.value
    t.name = editForm.value.name
    t.data = JSON.stringify(editForm.value.extra)
    editTarget.value = null
    showToast('报名信息已更新')
  } catch (err) { editError.value = err.message }
  saving.value = false
}

async function cancelSignup(e) {
  if (!confirm(`确定取消「${e.title}」的报名？`)) return
  cancelling.value = true
  try {
    await api.cancelSignup(e.token)
    signups.value = signups.value.filter(ev => ev.signup_id !== e.signup_id)
    showToast('已取消报名')
  } catch (err) { showToast(err.message, 'error') }
  cancelling.value = false
}
</script>

<style scoped>
.page-title { font-size: 22px; font-weight: 700; margin-bottom: 16px; }

.user-card { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
.user-info { display: flex; align-items: center; gap: 12px; }
.avatar {
  width: 40px; height: 40px; border-radius: 50%;
  background: var(--c-primary); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; font-weight: 700; text-transform: uppercase;
}
.user-name { font-size: 16px; font-weight: 600; }
.user-email { font-size: 13px; color: var(--c-text-2); }
.user-role { font-size: 12px; color: var(--c-primary); font-weight: 500; margin-top: 2px; }
.user-actions { display: flex; gap: 8px; }

.tip-card { display: flex; flex-direction: column; gap: 8px; }
.tip-title { font-size: 15px; font-weight: 600; }
.tip-desc { font-size: 13px; color: var(--c-text-2); line-height: 1.5; }

.section { margin-top: 24px; }
.section-title { font-size: 17px; font-weight: 600; margin-bottom: 12px; }

.search-bar { display: flex; gap: 8px; margin-bottom: 12px; }
.search-bar input { flex: 1; }

.event-list { display: flex; flex-direction: column; gap: 12px; }
.head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.head h3 { font-size: 16px; font-weight: 600; flex: 1; min-width: 0; overflow-wrap: break-word; }
.info { font-size: 13px; color: var(--c-text-2); margin-top: 4px; }
.status-row { margin-top: 10px; }
.actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.meta-row { margin-top: 8px; font-size: 13px; color: var(--c-text-2); display: flex; gap: 12px; }
.reject-reason {
  margin-top: 8px; font-size: 13px; color: var(--c-danger);
  padding: 6px 10px; background: rgba(239,68,68,.06); border-radius: 6px;
}

.role-cards { display: flex; gap: 12px; flex-wrap: wrap; }
.role-card { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 14px; }
@media (max-width: 480px) { .role-cards { flex-direction: column; } }
.role-card-head { display: flex; gap: 10px; align-items: flex-start; }
.role-icon { font-size: 24px; flex-shrink: 0; }
.role-card-title { font-size: 15px; font-weight: 600; }
.role-card-desc { font-size: 13px; color: var(--c-text-2); margin-top: 2px; }

.login-section { margin-top: 32px; }
.login-card { text-align: center; padding: 24px 20px; }
.login-title { font-size: 15px; font-weight: 600; }
.login-desc { font-size: 13px; color: var(--c-text-2); margin: 4px 0 16px; }
.google-btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 20px; border: 1px solid var(--c-border); border-radius: 8px;
  background: var(--c-card); font-size: 14px; font-weight: 600;
  color: var(--c-text); text-decoration: none;
}
.google-btn:hover { box-shadow: 0 1px 3px rgba(0,0,0,.08); }

.modal-overlay {
  position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,.4);
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.modal {
  background: var(--c-surface); border-radius: 12px; padding: 24px;
  width: 100%; max-width: 440px; max-height: 80vh; overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0,0,0,.12);
}
.modal-title { font-size: 17px; font-weight: 600; margin-bottom: 4px; }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }

.section-desc { font-size: 13px; color: var(--c-text-2); margin: 4px 0 12px; }
.profile-view { font-size: 14px; }
.profile-row { display: flex; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--c-border); }
.profile-row:last-child { border-bottom: none; }
.profile-label { color: var(--c-text-2); min-width: 72px; flex-shrink: 0; }
.empty-profile { font-size: 13px; color: var(--c-text-3); text-align: center; padding: 12px 0; }
</style>
