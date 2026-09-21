<template>
  <div class="page event-signup-test">
    <header class="signup-hero">
      <router-link :to="detailUrl" class="signup-back">← 返回活动详情</router-link>
      <p>活动报名</p>
      <h1>{{ event?.title || '填写报名信息' }}</h1>
    </header>
    <div v-if="!event" class="card">{{ error || '加载中…' }}</div>
    <template v-else>
      <div v-if="chatToken && !done" class="card result-card">
        <div class="check-icon">✓</div>
        <p class="result-title">你已报名此活动</p>
        <router-link :to="detailUrl + '?tab=discussion'" class="btn btn-primary">进入活动讨论</router-link>
      </div>
      <template v-else>
      <!-- Signup Form -->
      <div v-if="done" class="card result-card">
        <div class="check-icon">✓</div>
        <p class="result-title">报名成功!</p>
        <p v-if="chatToken" class="result-sub">你已自动加入活动讨论</p>
        <button v-if="chatToken" type="button" class="btn btn-primary" style="margin-top:16px" @click="selectTab('discussion')">进入活动讨论</button>
        <p v-if="externalRedirect" class="result-sub">本站实名登记已完成。你仍需前往外部主办方完成正式报名。</p>
        <p v-if="showQrLink" class="result-sub">活动当天出示签到码即可签到</p>
        <p v-else class="result-sub">签到码将在活动前一天通过邮件发送，届时也可在「我的」页面查看</p>
        <a v-if="externalRedirect" :href="externalRedirect.target" class="btn btn-primary" style="margin-top:20px">继续完成外部报名</a>
        <router-link v-else-if="showQrLink" :to="`/signup-ok/${event.id}?token=${signupToken}`" class="btn btn-primary" style="margin-top:20px">
          查看签到码
        </router-link>
        <router-link v-else to="/my" class="btn btn-outline" style="margin-top:20px">
          前往「我的」页面
        </router-link>
      </div>

      <form v-else-if="event.status === 'open' && !isFull && !isLocked" class="card" @submit.prevent="doSignup">
        <h2 class="form-title">填写报名信息</h2>
        <div class="field">
          <label class="label">姓名 * <span class="label-hint">（中文优先，英文亦可）</span></label>
          <input v-model="form.name" required placeholder="请填写中文姓名" />
        </div>
        <div class="field">
          <label class="label">姓名假名 *</label>
          <input v-model="builtIn.name_kana" required placeholder="シメイ" />
        </div>
        <div class="field">
          <label class="label">性别 *</label>
          <select v-model="builtIn.gender" required>
            <option value="" disabled hidden>请选择</option>
            <option value="男">男</option>
            <option value="女">女</option>
          </select>
        </div>
        <div class="field">
          <label class="label">所属学校 *</label>
          <select v-model="builtIn.school" required>
            <option value="" disabled hidden>请选择</option>
            <option v-for="s in schools" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
        <div v-if="builtIn.school === '其他学校'" class="field">
          <label class="label">学校名称 *</label>
          <input v-model="builtIn.school_other" required placeholder="请输入学校名称" />
        </div>
        <div v-if="builtIn.school === '東北大学'" class="field">
          <label class="label">学号/工号 *</label>
          <input v-model="builtIn.student_id" required placeholder="東北大学学友填写" />
        </div>
        <div class="field">
          <label class="label">邮箱 *</label>
          <input v-model="form.email" type="email" required placeholder="用于接收活动通知和签到" />
        </div>
        <div class="field">
          <label class="label">中国手机号 (选填)</label>
          <input v-model="builtIn.phone_cn" type="tel" placeholder="选填" />
        </div>
        <div class="field">
          <label class="label">日本电话号 (选填)</label>
          <input v-model="builtIn.phone_jp" type="tel" placeholder="選択入力" />
        </div>
        <div class="field">
          <label class="label">微信号 (选填)</label>
          <input v-model="builtIn.wechat" placeholder="选填" />
        </div>

        <!-- Custom fields -->
        <div v-for="f in customFields" :key="f.key" class="field">
          <label class="label">{{ f.label }}{{ f.required ? ' *' : '' }}</label>
          <select v-if="f.type === 'select'" v-model="extra[f.key]" :required="f.required">
            <option value="" disabled hidden>请选择</option>
            <option v-for="opt in f.options" :key="opt" :value="opt">{{ opt }}</option>
          </select>
          <textarea v-else-if="f.type === 'textarea'" v-model="extra[f.key]" :required="f.required" rows="2" :placeholder="f.placeholder || ''" />
          <input v-else-if="f.type === 'number'" v-model.number="extra[f.key]" type="number" :required="f.required" :placeholder="f.placeholder || ''" />
          <input v-else v-model="extra[f.key]" :required="f.required" :placeholder="f.placeholder || ''" />
        </div>

        <label class="consent-row">
          <input type="checkbox" v-model="agreed" />
          <span>我已阅读并同意<router-link to="/privacy" target="_blank">《隐私政策》</router-link></span>
        </label>

        <p v-if="formError" class="error">{{ formError }}</p>
        <button type="submit" class="btn btn-primary" :disabled="submitting || !agreed">
          {{ submitting ? '提交中…' : '提交报名' }}
        </button>
      </form>

      <div v-else-if="isLocked" class="card result-card">
        <p class="result-title" style="color:var(--c-warning)">报名暂时锁定</p>
        <p class="result-sub">活动创建者已暂停接受新报名，现有报名不受影响。</p>
      </div>
      <div v-else-if="isFull" class="card result-card">
        <p class="result-title" style="color:var(--c-warning)">报名已满</p>
      </div>
      <div v-else class="card result-card">
        <p class="result-title" style="color:var(--c-text-2)">
          {{ event.status === 'active' ? '报名已截止,活动进行中' : event.status === 'closed' ? '活动已结束' : '暂未开放报名' }}
        </p>
        <router-link v-if="event.status === 'active'" :to="`/checkin/${event.id}`" class="btn btn-outline" style="margin-top:16px">
          前往签到 →
        </router-link>
      </div>


      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api.js'
import { auth } from '../auth.js'

const route = useRoute()
const router = useRouter()
const detailUrl = computed(() => '/e/' + route.params.id + '/test')
const event = ref(null)
const error = ref('')
const form = ref({
  name: localStorage.getItem('user_name') || '',
  email: localStorage.getItem('user_email') || '',
})
const builtIn = reactive({ student_id: '', name_kana: '', gender: '', wechat: '', school: '', school_other: '', phone_cn: '', phone_jp: '' })
const schools = ['東北大学', '山形大学', '福島大学', '会津大学', '宮城大学', '仙台大学', '東北医科薬科大学', '東北学院大学', '東北工業大学', '福島県立医科大学', '東北芸術工科大学', '其他学校']
const extra = reactive({})
const formError = ref('')
const submitting = ref(false)
const done = ref(false)
const signupToken = ref('')
const externalRedirect = ref(null)
const agreed = ref(false)
const chatToken = ref(localStorage.getItem(`event_chat_access_${route.params.id}`) || '')

const customFields = computed(() => {
  if (!event.value?.custom_fields) return []
  try {
    return JSON.parse(event.value.custom_fields).map((f, i) => ({
      ...f,
      key: f.key || f.label || `field_${i}`
    }))
  } catch { return [] }
})

const showQrLink = computed(() => {
  if (!event.value?.event_date) return false
  const now = new Date()
  const jstNow = new Date(now.getTime() + 9 * 3600000)
  const eventDay = new Date(event.value.event_date.replace(/\s/, 'T') + '+09:00')
  return (eventDay - jstNow) < 1 * 24 * 3600000
})
const effectiveCap = computed(() => event.value?.capacity || event.value?.lock_at || null)
const pct = computed(() => effectiveCap.value ? Math.min(100, event.value.signupCount / effectiveCap.value * 100) : 0)
const isFull = computed(() => effectiveCap.value && event.value.signupCount >= effectiveCap.value)
const isLocked = computed(() => event.value?.lock_at !== null && event.value?.lock_at !== undefined)


onMounted(async () => {
  if (route.query.token) {
    chatToken.value = String(route.query.token)
    localStorage.setItem(`event_chat_access_${route.params.id}`, chatToken.value)
    const { token, ...query } = route.query
    await router.replace({ path: route.path, query })
  }
  try {
    const data = await api.getEvent(route.params.id)
    event.value = data.event
  } catch (e) { error.value = e.message }


  if (auth.isLoggedIn) {
    if (!form.value.email) form.value.email = auth.email
    try {
      const data = await api.getProfile()
      const p = data.profile || {}
      if (p.name && !form.value.name) form.value.name = p.name
      if (p.name_kana && !builtIn.name_kana) builtIn.name_kana = p.name_kana
      if (p.gender && !builtIn.gender) builtIn.gender = p.gender
      if (p.phone_cn && !builtIn.phone_cn) builtIn.phone_cn = p.phone_cn
      if (p.phone_jp && !builtIn.phone_jp) builtIn.phone_jp = p.phone_jp
      if (p.wechat && !builtIn.wechat) builtIn.wechat = p.wechat
      if (p.student_id && !builtIn.student_id) builtIn.student_id = p.student_id
      if (p.school && !builtIn.school) {
        const isKnown = schools.includes(p.school)
        builtIn.school = isKnown ? p.school : '其他学校'
        if (!isKnown) builtIn.school_other = p.school
      }
    } catch {}
  }
})


async function doSignup() {
  formError.value = ''
  submitting.value = true
  try {
    const data = await api.signup({
      event_id: Number(route.params.id),
      name: form.value.name,
      email: form.value.email,
      phone: '',
      extra: {
        姓名假名: builtIn.name_kana,
        性别: builtIn.gender,
        所属学校: builtIn.school === '其他学校' ? builtIn.school_other : builtIn.school,
        ...(builtIn.student_id ? { '学号/工号': builtIn.student_id } : {}),
        ...(builtIn.phone_cn ? { 中国手机号: builtIn.phone_cn } : {}),
        ...(builtIn.phone_jp ? { 日本电话号: builtIn.phone_jp } : {}),
        ...(builtIn.wechat ? { 微信号: builtIn.wechat } : {}),
        ...extra
      }
    })
    signupToken.value = data.token
    chatToken.value = data.chat_access_token || ''
    if (chatToken.value) localStorage.setItem(`event_chat_access_${route.params.id}`, chatToken.value)
    externalRedirect.value = data.redirect || null
    done.value = true
    event.value.signupCount++
    localStorage.setItem('user_email', form.value.email)
    localStorage.setItem('user_name', form.value.name)
  } catch (e) { formError.value = e.message }
  submitting.value = false
}

</script>

<style scoped>
.event-signup-test { max-width:430px; min-height:100vh; background:#f5f6f8; padding-bottom:32px; }
.signup-hero { margin:-16px -16px 16px; padding:20px; color:#fff; background:linear-gradient(145deg,#1d8b76,#1f6f65); }
.signup-back { color:#fff; text-decoration:none; }
.signup-hero p { margin:24px 0 5px; color:#cff3eb; font-size:13px; }
.signup-hero h1 { margin:0; font-size:24px; line-height:1.3; }
.event-signup-test .card { border-radius:17px; }
.event-signup-test form.card { padding:20px; }
.event-test { --event-bg:#f5f6f8;--event-card:#fff;--event-text:#17202a;--event-muted:#6b7280;--event-line:#e8ebef;--event-brand:#16a085;--event-brand-dark:#0f766e;--event-soft:#e9f7f3;--event-warn:#fff7df; background:var(--event-bg); min-height:100vh; color:var(--event-text); }
.event-hero { margin:-24px -16px 0; padding:20px 20px 24px; color:white; background:linear-gradient(145deg,#1d8b76,#1f6f65); }
.hero-back { color:#fff; text-decoration:none; }.event-hero p { margin:28px 0 6px; color:#cff3eb; font-size:13px; }.event-hero h1 { margin:0 0 8px; font-size:clamp(22px,6vw,29px); line-height:1.25; overflow-wrap:anywhere; }.hero-bottom { display:flex; justify-content:space-between; gap:8px; margin-top:18px; font-size:13px; }.hero-bottom span:first-child { padding:5px 9px; background:#ffffff33; border-radius:999px; }
.event-tabs { position:sticky; top:0; z-index:20; display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); margin:0 -16px 16px; background:#fff; box-shadow:0 2px 10px #17202a12; }.event-tabs button { min-width:0; padding:15px 3px; border:0; border-bottom:3px solid transparent; background:none; white-space:nowrap; color:#6b7280; font-weight:700; }.event-tabs button.selected { color:#0f766e; border-color:#16a085; }.event-tabs button span { display:inline-block; min-width:18px; padding:1px 4px; border-radius:999px; background:#e9f7f3; font-size:11px; }
.event-test :deep(.card) { border-radius:16px; }.test-notice { white-space:pre-wrap; background:#e9f7f3; }.test-notice p { margin:8px 0 0; }.summary-card p { margin:8px 0; }.summary-heading { display:flex; justify-content:space-between; gap:8px; }.summary-heading span { color:#0f766e; font-size:13px; }.summary-item { border-top:1px solid var(--event-line); padding:12px 0; }.summary-item p { overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow-wrap:anywhere; }.summary-item small { display:block; color:#0f766e; line-height:1.5; }.tab-panel { min-width:0; }.locked-tab { text-align:center; padding:32px 20px; }.people-panel { padding:20px; }.people-panel h2 { font-size:17px; }.person { display:flex; justify-content:space-between; gap:10px; padding:12px 0; border-top:1px solid var(--event-line); }.person span { min-width:0; overflow-wrap:anywhere; }.person strong { flex:none; font-size:12px; color:#0f766e; }
@media(max-width:640px){.event-test {padding-bottom:max(20px,env(safe-area-inset-bottom))}.event-hero{margin-top:-16px}.event-tabs{top:0}}
.mb { margin-bottom: 16px; }
.title { font-size: 22px; font-weight: 700; flex: 1; min-width: 0; overflow-wrap: break-word; }
.meta { font-size: 14px; color: var(--c-text-2); margin-top: 6px; }
.content { white-space: pre-wrap; font-size: 15px; margin-top: 12px; line-height: 1.6; }
.notes {
  white-space: pre-wrap; font-size: 13px; color: var(--c-text-2); margin-top: 12px;
  padding: 12px; background: var(--c-bg); border-radius: var(--radius-sm);
}
.cap-row { display: flex; align-items: center; font-size: 13px; color: var(--c-text-2); margin-top: 16px; }
.progress { height: 4px; background: var(--c-border); border-radius: 2px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--c-primary); border-radius: 2px; }
.progress-fill.full { background: var(--c-danger); }
.form-title { font-size: 17px; font-weight: 600; margin-bottom: 16px; }
.consent-row {
  display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--c-text-2);
  margin-top: 16px; cursor: pointer; user-select: none;
}
.consent-row input[type="checkbox"] { width: 16px; height: 16px; margin: 0; flex-shrink: 0; cursor: pointer; }
.consent-row a { color: var(--c-primary); text-decoration: underline; }
.result-card { text-align: center; padding: 32px 20px; }
.check-icon {
  width: 56px; height: 56px; background: var(--c-success-bg); color: var(--c-success);
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 28px; font-weight: 700; margin: 0 auto 12px;
}
.result-title { font-size: 20px; font-weight: 700; }
.result-sub { font-size: 14px; color: var(--c-text-2); margin-top: 6px; }
.back-link { display: block; text-align: center; font-size: 13px; margin-top: 24px; color: var(--c-text-2); }

.event-image-card { padding: 0; overflow: hidden; }
.event-image { width: 100%; display: block; height: auto; }

.roster-card { padding: 20px; }
.roster-head { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 4px; }
.roster-head h3 { font-size: 15px; font-weight: 600; margin: 0; }
.roster-head strong { color: var(--c-primary); }
.roster-hint { font-size: 12px; color: var(--c-text-3); }
.roster-progress {
  height: 6px; background: var(--c-border); border-radius: 3px;
  overflow: hidden; margin-top: 10px;
}
.roster-progress-fill {
  height: 100%; background: var(--c-primary); border-radius: 3px;
  transition: width .3s;
}
.roster-progress-fill.full { background: var(--c-danger); }
.roster-empty { font-size: 13px; color: var(--c-text-3); margin-top: 12px; text-align: center; }
.roster-dots {
  display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; align-items: center;
}
.roster-dot {
  width: 10px; height: 10px; border-radius: 50%;
  background: var(--c-primary); opacity: .35;
}
.roster-more { font-size: 12px; color: var(--c-text-3); margin-left: 2px; }
.label-hint { font-weight: 400; font-size: 12px; color: var(--c-text-3); }
</style>

