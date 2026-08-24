<template>
  <div>
    <div class="page-header">
      <div><h1 class="page-title">每周组局模板</h1><p class="page-sub">管理员批准后，系统按模板自动发布本周活动</p></div>
      <button class="btn btn-primary btn-sm" @click="startNew">新建模板</button>
    </div>

    <div v-if="editing" class="card editor mb-16">
      <div class="editor-head"><h2>{{ form.id ? '编辑模板' : '新建模板' }}</h2><button class="btn btn-outline btn-sm" @click="editing = false">关闭</button></div>
      <form @submit.prevent="save">
        <div class="form-grid">
          <div class="field"><label class="label">模板名称 *</label><input v-model="form.name" required placeholder="如：每周唱歌局" /></div>
          <div class="field"><label class="label">活动类别 *</label><select v-model="form.category" @change="applyCategoryDefaults"><option v-for="c in categories" :key="c.value" :value="c.value">{{ c.label }}</option></select></div>
          <div v-if="form.category === 'sport'" class="field"><label class="label">体育项目</label><input v-model="form.sport_name" placeholder="羽毛球、保龄球等" /></div>
          <div class="field"><label class="label">活动标题 *</label><input v-model="form.title_template" required placeholder="可使用 {date}、{sport}" /></div>
          <div class="field full"><label class="label">活动介绍</label><textarea v-model="form.description" rows="3"></textarea></div>
          <div class="field full"><label class="label">参加须知</label><textarea v-model="form.notes" rows="2"></textarea></div>
          <div class="field"><label class="label">区域</label><input v-model="form.region" placeholder="仙台市内" /></div>
          <div class="field"><label class="label">默认地点</label><input v-model="form.default_location" placeholder="可留空，成局后确认" /></div>
        </div>

        <div class="section-title">每周时间</div>
        <div class="schedule-grid">
          <div class="field"><label class="label">自动发布</label><div class="inline"><select v-model.number="form.publish_weekday"><option v-for="d in weekdays" :key="d.value" :value="d.value">{{ d.label }}</option></select><input v-model="form.publish_time" type="time" required /></div></div>
          <div class="field"><label class="label">成局判定</label><div class="inline"><select v-model.number="form.decision_weekday"><option v-for="d in weekdays" :key="d.value" :value="d.value">{{ d.label }}</option></select><input v-model="form.decision_time" type="time" required /></div></div>
          <div class="field"><label class="label">活动时间</label><div class="inline"><select v-model.number="form.event_weekday"><option v-for="d in weekdays" :key="d.value" :value="d.value">{{ d.label }}</option></select><input v-model="form.event_time" type="time" required /></div></div>
        </div>

        <div class="form-grid">
          <div class="field"><label class="label">最低成局人数 *</label><input v-model.number="form.min_participants" type="number" min="1" required /></div>
          <div class="field"><label class="label">最多人数</label><input v-model.number="form.max_participants" type="number" :min="form.min_participants" placeholder="不限" /></div>
          <div class="field"><label class="label">主理人</label><select v-model.number="form.host_user_id"><option :value="null">暂不指定</option><option v-for="u in hosts" :key="u.id" :value="u.id">{{ u.display_name || u.email }}</option></select><p v-if="hostRequired" class="hint">此类别必须指定主理人</p></div>
          <div class="field option-field"><label><input v-model="form.requires_host" type="checkbox" :disabled="hostRequired" /> 必须由主理人确认</label><label><input v-model="form.carpool_enabled" type="checkbox" /> 启用拼车收集</label></div>
        </div>

        <p v-if="error" class="error">{{ error }}</p>
        <div class="flex gap-8"><button class="btn btn-primary" :disabled="busy">{{ busy ? '保存中…' : '保存为草稿' }}</button><button type="button" class="btn btn-outline" @click="editing = false">取消</button></div>
      </form>
    </div>

    <div v-if="loading" class="empty">加载中…</div>
    <div v-else-if="!templates.length" class="card empty">还没有组局模板</div>
    <div v-else class="template-list">
      <div v-for="t in templates" :key="t.id" class="card template-card">
        <div class="template-head">
          <div><span class="category">{{ categoryLabel(t.category) }}</span><h3>{{ t.name }}</h3></div>
          <span class="approval" :class="`approval-${t.approval_status}`">{{ approvalLabel(t.approval_status) }}</span>
        </div>
        <div class="template-title">{{ t.title_template }}</div>
        <div class="facts">
          <span>周{{ weekdayLabel(t.publish_weekday) }} {{ t.publish_time }} 发布</span>
          <span>周{{ weekdayLabel(t.decision_weekday) }} {{ t.decision_time }} 判定</span>
          <span>{{ t.min_participants }} 人成局{{ t.max_participants ? `，最多 ${t.max_participants} 人` : '' }}</span>
          <span>{{ t.host_name ? `主理人：${t.host_name}` : '管理员确认' }}</span>
          <span v-if="t.carpool_enabled">启用拼车</span>
        </div>
        <div class="actions">
          <button class="btn btn-outline btn-sm" @click="editTemplate(t)">编辑</button>
          <button v-if="t.approval_status !== 'approved'" class="btn btn-primary btn-sm" @click="approve(t)">批准自动发布</button>
          <button v-else class="btn btn-outline btn-sm" style="color:var(--c-warning)" @click="pause(t)">暂停</button>
        </div>
      </div>
    </div>

    <div class="card jobs-card">
      <div class="jobs-head"><div><h2>最近自动任务</h2><p>自动发布、成局判定和确认超时的执行记录</p></div><button class="btn btn-outline btn-sm" @click="load">刷新</button></div>
      <div v-if="!jobs.length" class="empty compact">还没有自动任务记录</div>
      <div v-else class="job-list">
        <div v-for="job in jobs" :key="job.id" class="job-row">
          <span class="job-status" :class="`job-${job.status}`">{{ job.status === 'failed' ? '失败' : '成功' }}</span>
          <div class="job-main"><strong>{{ jobTypeLabel(job.job_type) }}</strong><span>{{ job.event_title || job.template_name || job.week_key || '系统任务' }}</span><small v-if="job.detail">{{ job.detail }}</small></div>
          <time>{{ formatTime(job.started_at) }}</time>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { api } from '../../api.js'
import { showToast } from '../../lib/toast.js'

const templates = ref([])
const jobs = ref([])
const users = ref([])
const loading = ref(true)
const editing = ref(false)
const busy = ref(false)
const error = ref('')
const categories = [
  { value: 'karaoke', label: '唱歌' }, { value: 'sport', label: '多人体育' },
  { value: 'outdoor', label: '徒步·户外' }, { value: 'salon', label: '沙龙' },
  { value: 'boardgame', label: '桌游' }, { value: 'movie', label: '观影' }, { value: 'other', label: '其他' },
]
const weekdays = [1,2,3,4,5,6,7].map((value, i) => ({ value, label: ['一','二','三','四','五','六','日'][i] }))

const defaults = () => ({ id: null, name: '', category: 'karaoke', sport_name: '', title_template: '本周唱歌局 · {date}', description: '', notes: '', region: '仙台市内', default_location: '', event_weekday: 6, event_time: '14:00', publish_weekday: 1, publish_time: '08:00', decision_weekday: 5, decision_time: '18:00', min_participants: 4, max_participants: null, requires_host: false, host_user_id: null, carpool_enabled: false })
const form = reactive(defaults())
const hosts = computed(() => users.value.filter((u) => ['host', 'reviewer'].includes(u.role)))
const hostRequired = computed(() => !['karaoke', 'sport'].includes(form.category))

onMounted(load)

async function load() {
  loading.value = true
  try {
    const [templateData, userData, jobData] = await Promise.all([api.listGatheringTemplates(), api.listUsers(), api.listGatheringJobs()])
    templates.value = templateData.templates
    users.value = userData.users
    jobs.value = jobData.jobs
  } catch (e) { showToast(e.message, 'error') }
  loading.value = false
}

function startNew() { Object.assign(form, defaults()); editing.value = true; error.value = '' }
function editTemplate(t) { Object.assign(form, defaults(), t, { requires_host: !!t.requires_host, carpool_enabled: !!t.carpool_enabled }); editing.value = true; error.value = ''; window.scrollTo({ top: 0, behavior: 'smooth' }) }
function applyCategoryDefaults() {
  if (hostRequired.value) form.requires_host = true
  if (form.category === 'karaoke' || form.category === 'sport') form.min_participants = 4
  if (['salon', 'boardgame', 'movie'].includes(form.category)) form.min_participants = 5
}

async function save() {
  error.value = ''; busy.value = true
  try {
    const payload = { ...form, max_participants: form.max_participants || null, host_user_id: form.host_user_id || null }
    if (form.id) await api.updateGatheringTemplate(form.id, payload)
    else await api.createGatheringTemplate(payload)
    showToast('模板已保存为草稿')
    editing.value = false
    await load()
  } catch (e) { error.value = e.message }
  busy.value = false
}

async function approve(t) { try { await api.approveGatheringTemplate(t.id); showToast('模板已批准，将按设置自动发布'); await load() } catch (e) { showToast(e.message, 'error') } }
async function pause(t) { try { await api.pauseGatheringTemplate(t.id); showToast('模板已暂停'); await load() } catch (e) { showToast(e.message, 'error') } }
const categoryLabel = (value) => categories.find((c) => c.value === value)?.label || value
const weekdayLabel = (value) => weekdays.find((d) => d.value === Number(value))?.label || value
const approvalLabel = (value) => ({ draft: '草稿', approved: '自动发布中', paused: '已暂停' }[value] || value)
const jobTypeLabel = (value) => ({ weekly_publish: '每周自动发布', formation_deadline: '成局判定', arrangement_timeout: '主理人确认超时', admin_takeover: '转交管理员' }[value] || value)
const formatTime = (value) => value ? new Date(Number(value)).toLocaleString('zh-CN', { timeZone: 'Asia/Tokyo', hour12: false }) : '—'
</script>

<style scoped>
.mb-16 { margin-bottom: 16px; }
.editor { max-width: 860px; }
.editor-head, .template-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.editor-head h2 { font-size: 18px; }
.form-grid, .schedule-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 14px; }
.schedule-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.full { grid-column: 1 / -1; }
.inline { display: flex; gap: 8px; }
.inline select, .inline input { min-width: 0; }
.section-title { font-size: 14px; font-weight: 700; border-top: 1px solid var(--c-border); padding-top: 18px; margin: 8px 0 4px; }
.option-field { display: flex; flex-direction: column; gap: 10px; justify-content: center; }
.option-field label { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.option-field input { width: auto; }
.hint { font-size: 12px; color: var(--c-warning); margin-top: 4px; }
.template-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.template-head h3 { font-size: 17px; }
.category { font-size: 12px; font-weight: 700; color: var(--c-primary); }
.approval { font-size: 12px; border-radius: 99px; padding: 5px 9px; background: var(--c-bg); white-space: nowrap; }
.approval-approved { color: var(--c-success); background: var(--c-success-bg); }
.approval-paused { color: var(--c-warning); }
.template-title { font-size: 14px; font-weight: 600; }
.facts { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 12px; }
.facts span { font-size: 12px; color: var(--c-text-2); background: var(--c-bg); padding: 4px 8px; border-radius: 99px; }
.actions { display: flex; gap: 8px; margin-top: 16px; }
.jobs-card { margin-top: 16px; }
.jobs-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.jobs-head h2 { font-size: 17px; }
.jobs-head p { color: var(--c-text-2); font-size: 12px; margin-top: 3px; }
.compact { padding: 16px; }
.job-list { display: flex; flex-direction: column; }
.job-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: start; gap: 10px; padding: 12px 0; border-top: 1px solid var(--c-border); }
.job-status { font-size: 11px; padding: 3px 7px; border-radius: 99px; color: var(--c-success); background: var(--c-success-bg); }
.job-failed { color: var(--c-danger); background: #fff0f0; }
.job-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.job-main strong { font-size: 13px; }
.job-main span, .job-main small, .job-row time { color: var(--c-text-2); font-size: 12px; overflow-wrap: anywhere; }
.job-row time { white-space: nowrap; }
@media (max-width: 720px) { .form-grid, .schedule-grid, .template-list { grid-template-columns: 1fr; } .full { grid-column: auto; } }
</style>
