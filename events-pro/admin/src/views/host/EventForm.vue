<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">{{ isEdit ? '编辑活动' : '创建活动' }}</h1>
    </div>

    <!-- AI guidance banner -->
    <div class="ai-banner mb-16" style="max-width:680px">
      <div class="ai-banner-body">
        <div class="ai-banner-title">AI 辅助规划</div>
        <div class="ai-banner-text">
          填写基本信息并创建活动后，可在活动详情页使用「AI 智能起草」一键生成完整计划书草稿。AI 会根据你选择的活动类型自动匹配所需物料。
        </div>
      </div>
    </div>

    <div class="card" style="max-width:680px">
      <form @submit.prevent="submit">
        <div class="field">
          <label class="label">活动名称 *</label>
          <input v-model="form.title" required placeholder="输入活动名称" />
        </div>

        <!-- Activity type selector -->
        <div class="field">
          <label class="label">活动类型</label>
          <p class="field-hint">选择后 AI 会自动匹配对应物料清单</p>
          <div class="type-grid">
            <div v-for="t in activityTypes" :key="t.value" class="type-card"
              :class="{ selected: form.activity_type === t.value }"
              @click="selectType(t.value)">
              <div class="type-name">{{ t.label }}</div>
              <div class="type-materials">{{ t.materials }}</div>
            </div>
            <div class="type-card"
              :class="{ selected: isCustomType }"
              @click="selectType('__custom')">
              <div class="type-name">自定义</div>
              <div class="type-materials">其他类型活动</div>
            </div>
          </div>
          <input v-if="isCustomType" v-model="customTypeName" class="mt-8"
            placeholder="输入自定义活动类型，如：运动会、读书会"
            @input="form.activity_type = customTypeName" />
        </div>

        <div class="form-row">
          <div class="field" style="flex:1">
            <label class="label">活动日期 *</label>
            <input v-model="form.event_date" required placeholder="如: 2026-07-15 14:00" />
          </div>
          <div class="field" style="flex:1">
            <label class="label">活动地点</label>
            <input v-model="form.location" placeholder="地点" />
          </div>
        </div>
        <div class="field">
          <label class="label">活动详情</label>
          <textarea v-model="form.content" rows="4" placeholder="活动介绍"></textarea>
        </div>
        <div class="field">
          <label class="label">备注信息</label>
          <textarea v-model="form.notes" rows="2" placeholder="参与者须知"></textarea>
        </div>
        <div class="field" style="max-width:200px">
          <label class="label">报名上限</label>
          <input v-model.number="form.capacity" type="number" min="0" placeholder="不限" />
        </div>

        <!-- Divider -->
        <div class="section-divider">
          <span class="section-divider-text">报名表单字段</span>
        </div>

        <p class="field-hint" style="margin-bottom:14px">
          报名时默认收集姓名、邮箱、手机号。如需额外信息，可添加自定义字段。
        </p>

        <!-- Custom fields list -->
        <div v-if="customFields.length" class="cf-list">
          <div v-for="(cf, i) in customFields" :key="i" class="cf-row">
            <div class="cf-row-main">
              <input v-model="cf.label" placeholder="字段名称，如：学号、微信号" class="cf-input-name" />
              <select v-model="cf.type" class="cf-input-type">
                <option value="text">文本</option>
                <option value="select">下拉选择</option>
                <option value="textarea">多行文本</option>
              </select>
              <label class="cf-check"><input type="checkbox" v-model="cf.required" /> 必填</label>
              <button type="button" class="btn btn-outline btn-sm" style="color:var(--c-danger);flex-shrink:0" @click="customFields.splice(i, 1)">删除</button>
            </div>
            <div v-if="cf.type === 'select'" class="cf-select-row">
              <input v-model="cf.optionsStr" placeholder="下拉选项，逗号分隔：选项A, 选项B, 选项C" />
            </div>
          </div>
        </div>

        <button type="button" class="btn btn-outline btn-sm" @click="addField" style="margin-bottom:8px">+ 添加自定义字段</button>

        <p v-if="error" class="error" style="margin-top:16px">{{ error }}</p>
        <div class="flex gap-8 mt-24">
          <button type="submit" class="btn btn-primary" :disabled="busy">
            {{ busy ? '保存中…' : isEdit ? '保存修改' : '创建活动' }}
          </button>
          <router-link to="/admin/events" class="btn btn-outline">取消</router-link>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../../api.js'
import { auth } from '../../lib/auth.js'
import { showToast } from '../../lib/toast.js'

const route = useRoute()
const router = useRouter()
const isEdit = !!route.params.id
const error = ref('')
const busy = ref(false)

const activityTypes = [
  { value: 'indoor-general', label: '室内·通用', materials: '饮品、茶点茶歇' },
  { value: 'indoor-lecture', label: '室内·讲座/观影', materials: '饮品、茶点、投影仪、话筒' },
  { value: 'indoor-boardgame', label: '室内·桌游', materials: '饮品、茶点、桌游' },
  { value: 'outdoor-general', label: '户外·通用', materials: '饮品、应急医疗包' },
  { value: 'outdoor-bbq', label: '户外·烤肉', materials: '饮品、烤架、食材、木炭、应急医疗包' },
  { value: 'outdoor-camping', label: '户外·露营', materials: '饮品、帐篷、烤架、食材、木炭、应急医疗包' },
]

const form = reactive({
  title: '', event_date: '', location: '', content: '', notes: '', capacity: null, activity_type: ''
})
const customTypeName = ref('')
const customMode = ref(false)
const knownValues = activityTypes.map(t => t.value)
const isCustomType = computed(() => customMode.value || (form.activity_type && !knownValues.includes(form.activity_type)))

function selectType(val) {
  if (val === '__custom') {
    customMode.value = true
    form.activity_type = customTypeName.value || ''
  } else {
    customMode.value = false
    form.activity_type = form.activity_type === val ? '' : val
    customTypeName.value = ''
  }
}

const customFields = ref([])

function addField() {
  customFields.value.push({ label: '', type: 'text', required: false, optionsStr: '' })
}

onMounted(async () => {
  if (isEdit) {
    try {
      const data = await api.getEvent(route.params.id)
      const e = data.event
      form.title = e.title; form.event_date = e.event_date
      form.location = e.location || ''; form.content = e.content || ''
      form.notes = e.notes || ''; form.capacity = e.capacity || null
      form.activity_type = e.activity_type || ''
      if (form.activity_type && !knownValues.includes(form.activity_type)) {
        customTypeName.value = form.activity_type
      }
      const cf = typeof e.custom_fields === 'string' ? JSON.parse(e.custom_fields || '[]') : (e.custom_fields || [])
      customFields.value = cf.map(f => ({
        label: f.label, type: f.type || 'text', required: !!f.required,
        optionsStr: (f.options || []).join(', ')
      }))
    } catch (e) { error.value = e.message }
  }
})

async function submit() {
  error.value = ''
  busy.value = true
  try {
    const cfData = customFields.value.filter(f => f.label.trim()).map(f => ({
      key: f.label.trim(),
      label: f.label.trim(),
      type: f.type,
      required: f.required,
      ...(f.type === 'select' ? { options: f.optionsStr.split(',').map(o => o.trim()).filter(Boolean) } : {})
    }))
    const payload = { ...form, custom_fields: cfData }
    if (isEdit) {
      await api.updateEvent(route.params.id, payload)
      showToast('活动已更新')
    } else {
      const data = await api.createEvent(payload)
      if (data.role_upgraded) {
        auth.role = 'host'
        localStorage.setItem('admin_auth', JSON.stringify({ ...JSON.parse(localStorage.getItem('admin_auth') || '{}'), role: 'host' }))
      }
      showToast('活动已创建为草稿，编辑完成后请提交审核')
      router.push(`/admin/events/${data.id}`)
      return
    }
    router.push(`/admin/events/${route.params.id}`)
  } catch (e) { error.value = e.message }
  busy.value = false
}
</script>

<style scoped>
.ai-banner {
  padding: 14px 18px; border-radius: var(--radius);
  background: var(--c-bg); border: 1px solid var(--c-border);
}
.ai-banner-title { font-size: 13px; font-weight: 600; color: var(--c-text); }
.ai-banner-text { font-size: 13px; color: var(--c-text-2); margin-top: 4px; line-height: 1.5; }

.type-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 8px;
}
.type-card {
  border: 2px solid var(--c-border); border-radius: 10px; padding: 14px 12px;
  cursor: pointer; text-align: center; transition: all .15s;
}
.type-card:hover { border-color: var(--c-primary); background: rgba(79,70,229,.02); }
.type-card.selected {
  border-color: var(--c-primary); background: rgba(79,70,229,.06);
  box-shadow: 0 0 0 1px var(--c-primary);
}
.type-name { font-size: 13px; font-weight: 600; }
.type-materials { font-size: 11px; color: var(--c-text-3); margin-top: 4px; line-height: 1.4; }
.form-row { display: flex; gap: 12px; }

/* Section divider */
.section-divider {
  display: flex; align-items: center; gap: 12px;
  margin: 24px 0 12px; color: var(--c-text-2);
}
.section-divider::before, .section-divider::after {
  content: ''; flex: 1; height: 1px; background: var(--c-border);
}
.section-divider-text { font-size: 13px; font-weight: 600; white-space: nowrap; }

/* Custom fields */
.cf-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; }
.cf-row {
  padding: 12px; background: var(--c-bg); border-radius: 8px;
  border: 1px solid var(--c-border);
}
.cf-row-main { display: flex; gap: 8px; align-items: center; }
.cf-input-name { flex: 2; }
.cf-input-type { flex: 1; }
.cf-check {
  display: flex; align-items: center; gap: 4px;
  font-size: 13px; color: var(--c-text-2); white-space: nowrap;
}
.cf-check input { width: auto; }
.cf-select-row { margin-top: 8px; }

@media (max-width: 640px) {
  .form-row { flex-direction: column; gap: 0; }
  .type-grid { grid-template-columns: repeat(2, 1fr); }
  .type-card { padding: 10px 8px; }
  .type-icon { font-size: 20px; }
  .type-name { font-size: 12px; }
  .type-materials { font-size: 10px; }
  .cf-row-main { flex-wrap: wrap; }
}
</style>
