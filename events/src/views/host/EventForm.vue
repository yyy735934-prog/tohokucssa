<template>
  <div class="container">
    <h1 style="font-size:20px;margin-bottom:20px">{{ isEdit ? '编辑活动' : '创建活动' }}</h1>
    <form class="card" @submit.prevent="save">
      <div class="form-group">
        <label>活动标题 *</label>
        <input v-model="form.title" required placeholder="例如: 学友会7月烧烤活动" />
      </div>
      <div class="form-row">
        <div class="form-group" style="flex:1">
          <label>活动时间 *</label>
          <input v-model="form.event_date" required placeholder="例如: 7月12日(周六) 14:00" />
        </div>
        <div class="form-group" style="flex:1">
          <label>活动地点</label>
          <input v-model="form.location" placeholder="例如: 西公园 BBQ 区域" />
        </div>
      </div>
      <div class="form-group">
        <label>活动内容</label>
        <textarea v-model="form.content" rows="4" placeholder="活动详细说明,会展示在报名页"></textarea>
      </div>
      <div class="form-group">
        <label>注意事项</label>
        <textarea v-model="form.notes" rows="3" placeholder="参与者须知"></textarea>
      </div>
      <div class="form-group" style="max-width:200px">
        <label>人数上限 (留空 = 不限)</label>
        <input v-model.number="form.capacity" type="number" min="1" placeholder="例如: 30" />
      </div>
      <p v-if="error" style="color:var(--c-danger);font-size:13px;margin-bottom:12px">{{ error }}</p>
      <div class="flex gap-8">
        <button type="submit" class="btn-primary" :disabled="saving">{{ saving ? '保存中…' : '保存草稿' }}</button>
        <button type="button" class="btn-outline" @click="$router.back()">取消</button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../../services/api.js'
import { toast } from '../../lib/toast.js'

const route = useRoute()
const router = useRouter()
const isEdit = computed(() => !!route.params.id)
const form = ref({ title: '', event_date: '', location: '', content: '', notes: '', capacity: null })
const error = ref('')
const saving = ref(false)

onMounted(async () => {
  if (isEdit.value) {
    try {
      const data = await api.getEvent(route.params.id)
      if (data.event.status !== 'draft') {
        toast('只能编辑草稿状态的活动', 'error')
        router.replace(`/events/${route.params.id}`)
        return
      }
      Object.assign(form.value, data.event)
    } catch (e) { error.value = e.message }
  }
})

async function save() {
  error.value = ''
  saving.value = true
  try {
    if (isEdit.value) {
      await api.updateEvent(route.params.id, form.value)
      toast('已保存')
      router.push(`/events/${route.params.id}`)
    } else {
      const data = await api.createEvent(form.value)
      toast('活动已创建')
      router.push(`/events/${data.id}`)
    }
  } catch (e) { error.value = e.message }
  saving.value = false
}
</script>

<style scoped>
.form-row { display: flex; gap: 12px; }
@media (max-width: 600px) { .form-row { flex-direction: column; } }
</style>
