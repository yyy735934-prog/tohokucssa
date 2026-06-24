<template>
  <div class="page">
    <div v-if="!event" class="empty">{{ error || '加载中…' }}</div>
    <template v-else>
      <!-- Event Info -->
      <div class="card mb">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <h1 class="title">{{ event.title }}</h1>
          <span class="badge" :class="`badge-${event.status}`">
            {{ { open:'报名中', active:'进行中', closed:'已结束' }[event.status] || event.status }}
          </span>
        </div>
        <div class="meta">{{ event.event_date }}<span v-if="event.location"> · {{ event.location }}</span></div>
        <div v-if="event.content" class="content">{{ event.content }}</div>
        <div v-if="event.notes" class="notes">{{ event.notes }}</div>
      </div>

      <!-- Event Image -->
      <div v-if="event.image_key" class="card mb event-image-card">
        <img :src="`/api/images/serve/${event.id}`" alt="活动图片" class="event-image" />
      </div>

      <!-- Signup count roster -->
      <div class="card mb roster-card">
        <div class="roster-head">
          <h3>已确认参加 <strong>{{ event.signupCount }}</strong> {{ event.capacity ? `/ ${event.capacity}` : '' }} 位</h3>
          <span class="roster-hint">为保护隐私，不显示姓名</span>
        </div>
        <div v-if="event.capacity" class="roster-progress">
          <div class="roster-progress-fill" :style="{ width: pct+'%' }" :class="{ full: isFull }"></div>
        </div>
        <p v-if="!event.signupCount" class="roster-empty">还没有人报名，快来成为第一个吧。</p>
        <div v-else class="roster-dots">
          <span v-for="i in Math.min(event.signupCount, 50)" :key="i" class="roster-dot"></span>
          <span v-if="event.signupCount > 50" class="roster-more">+{{ event.signupCount - 50 }}</span>
        </div>
      </div>

      <!-- Signup Form -->
      <div v-if="done" class="card result-card">
        <div class="check-icon">✓</div>
        <p class="result-title">报名成功!</p>
        <p v-if="showQrLink" class="result-sub">活动当天出示签到码即可签到</p>
        <p v-else class="result-sub">签到码将在活动前一天通过邮件发送，届时也可在「我的」页面查看</p>
        <router-link v-if="showQrLink" :to="`/signup-ok/${event.id}?token=${signupToken}`" class="btn btn-primary" style="margin-top:20px">
          查看签到码
        </router-link>
        <router-link v-else to="/my" class="btn btn-outline" style="margin-top:20px">
          前往「我的」页面
        </router-link>
      </div>

      <form v-else-if="event.status === 'open' && !isFull" class="card" @submit.prevent="doSignup">
        <h2 class="form-title">填写报名信息</h2>
        <div class="field">
          <label class="label">姓名 *</label>
          <input v-model="form.name" required placeholder="你的姓名" />
        </div>
        <div class="field">
          <label class="label">姓名假名 *</label>
          <input v-model="builtIn.name_kana" required placeholder="シメイ" />
        </div>
        <div class="field">
          <label class="label">所属学校 *</label>
          <select v-model="builtIn.school" required>
            <option value="">请选择</option>
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
          <label class="label">手机号 (选填)</label>
          <input v-model="form.phone" type="tel" placeholder="选填" />
        </div>
        <div class="field">
          <label class="label">微信号 (选填)</label>
          <input v-model="builtIn.wechat" placeholder="选填" />
        </div>

        <!-- Custom fields -->
        <div v-for="f in customFields" :key="f.key" class="field">
          <label class="label">{{ f.label }}{{ f.required ? ' *' : '' }}</label>
          <select v-if="f.type === 'select'" v-model="extra[f.key]" :required="f.required">
            <option value="">请选择</option>
            <option v-for="opt in f.options" :key="opt" :value="opt">{{ opt }}</option>
          </select>
          <textarea v-else-if="f.type === 'textarea'" v-model="extra[f.key]" :required="f.required" rows="2" :placeholder="f.placeholder || ''" />
          <input v-else-if="f.type === 'number'" v-model.number="extra[f.key]" type="number" :required="f.required" :placeholder="f.placeholder || ''" />
          <input v-else v-model="extra[f.key]" :required="f.required" :placeholder="f.placeholder || ''" />
        </div>

        <p v-if="formError" class="error">{{ formError }}</p>
        <button type="submit" class="btn btn-primary" :disabled="submitting">
          {{ submitting ? '提交中…' : '提交报名' }}
        </button>
        <p class="privacy">你的信息仅供活动主办方联系使用</p>
      </form>

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

      <router-link to="/" class="back-link">← 返回活动列表</router-link>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../api.js'

const route = useRoute()
const event = ref(null)
const error = ref('')
const form = ref({
  name: localStorage.getItem('user_name') || '',
  email: localStorage.getItem('user_email') || '',
  phone: ''
})
const builtIn = reactive({ student_id: '', name_kana: '', wechat: '', school: '', school_other: '' })
const schools = ['東北大学', '山形大学', '福島大学', '会津大学', '宮城大学', '仙台大学', '東北医科薬科大学', '東北学院大学', '東北工業大学', '福島県立医科大学', '東北芸術工科大学', '其他学校']
const extra = reactive({})
const formError = ref('')
const submitting = ref(false)
const done = ref(false)
const signupToken = ref('')

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
const pct = computed(() => event.value?.capacity ? Math.min(100, event.value.signupCount / event.value.capacity * 100) : 0)
const isFull = computed(() => event.value?.capacity && event.value.signupCount >= event.value.capacity)

onMounted(async () => {
  try {
    const data = await api.getEvent(route.params.id)
    event.value = data.event
  } catch (e) { error.value = e.message }
})

async function doSignup() {
  formError.value = ''
  submitting.value = true
  try {
    const data = await api.signup({
      event_id: Number(route.params.id),
      name: form.value.name,
      email: form.value.email,
      phone: form.value.phone,
      extra: {
        姓名假名: builtIn.name_kana,
        所属学校: builtIn.school === '其他学校' ? builtIn.school_other : builtIn.school,
        ...(builtIn.student_id ? { '学号/工号': builtIn.student_id } : {}),
        ...(builtIn.wechat ? { 微信号: builtIn.wechat } : {}),
        ...extra
      }
    })
    signupToken.value = data.token
    done.value = true
    event.value.signupCount++
    localStorage.setItem('user_email', form.value.email)
    localStorage.setItem('user_name', form.value.name)
  } catch (e) { formError.value = e.message }
  submitting.value = false
}
</script>

<style scoped>
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
.privacy { font-size: 11px; color: var(--c-text-3); margin-top: 12px; text-align: center; }
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
</style>
