<template>
  <div class="page">
    <div class="hero">
      <h1>活动广场</h1>
      <p>发现正在报名和进行中的活动</p>
    </div>

    <div v-if="loading" class="empty">加载中…</div>
    <div v-else-if="error" class="empty error">{{ error }}</div>
    <div v-else-if="!events.length" class="empty">
      <p style="font-size:40px;margin-bottom:12px">📭</p>
      <p>暂无活动</p>
    </div>

    <div v-else class="event-list">
      <router-link v-for="e in events" :key="e.id" :to="`/e/${e.id}`" class="event-item card">
        <img v-if="e.image_key" :src="`/api/images/serve/${e.id}`" alt="" class="event-cover" />
        <div class="event-body">
        <div class="event-head">
          <h3>{{ e.title }}</h3>
          <span v-if="e.pinned" class="pin-badge">置顶</span>
          <span class="badge" :class="e.status === 'open' ? 'badge-open' : 'badge-active'">
            {{ e.status === 'open' ? '报名中' : '进行中' }}
          </span>
        </div>
        <div class="event-info">
          <span>{{ e.event_date }}</span>
          <span v-if="e.location"> · {{ e.location }}</span>
        </div>
        <p v-if="e.content" class="event-desc">{{ e.content }}</p>
        <div class="event-foot">
          <span class="signup-count">{{ e.signupCount }}{{ e.capacity ? `/${e.capacity}` : '' }} 人报名</span>
          <span v-if="e.status === 'open'" class="action-hint">立即报名 →</span>
        </div>
        <div v-if="e.capacity" class="progress">
          <div class="progress-fill" :style="{ width: Math.min(100, e.signupCount/e.capacity*100)+'%' }"
               :class="{ full: e.signupCount >= e.capacity }"></div>
        </div>
        </div>
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api.js'

const events = ref([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    const data = await api.listEvents()
    events.value = data.events
  } catch (e) { error.value = e.message }
  loading.value = false
})
</script>

<style scoped>
.hero { margin-bottom: 24px; }
.hero h1 { font-size: 28px; font-weight: 700; }
.hero p { color: var(--c-text-2); font-size: 15px; margin-top: 4px; }
.event-list { display: flex; flex-direction: column; gap: 12px; }
.event-item { display: block; color: inherit; transition: transform .1s, box-shadow .15s; padding: 0; overflow: hidden; }
.event-item:active { transform: scale(.98); }
.event-cover { width: 100%; display: block; height: auto; }
.event-body { padding: 16px 20px; }
.event-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.event-head h3 { font-size: 17px; font-weight: 600; flex: 1; min-width: 0; overflow-wrap: break-word; }
.pin-badge {
  display: inline-block; padding: 2px 8px; border-radius: 4px;
  font-size: 11px; font-weight: 700; color: #b45309; background: #fef3c7;
  flex-shrink: 0;
}
.event-info { font-size: 13px; color: var(--c-text-2); margin-top: 6px; }
.event-desc {
  font-size: 14px; color: var(--c-text-2); margin-top: 8px;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.event-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; }
.signup-count { font-size: 13px; color: var(--c-text-3); }
.action-hint { font-size: 13px; font-weight: 600; color: var(--c-primary); }
.progress { height: 3px; background: var(--c-border); border-radius: 2px; margin-top: 12px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--c-primary); border-radius: 2px; transition: width .3s; }
.progress-fill.full { background: var(--c-danger); }
</style>
