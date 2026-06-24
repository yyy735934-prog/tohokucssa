<template>
  <div class="container">
    <h1 class="square-title">活动广场</h1>
    <p class="square-subtitle">正在进行和报名中的活动</p>

    <div v-if="loading" class="empty-state">加载中…</div>
    <div v-else-if="error" class="empty-state" style="color:var(--c-danger)">{{ error }}</div>
    <div v-else-if="!events.length" class="empty-state">暂无活动</div>

    <div v-else class="event-grid">
      <router-link v-for="e in events" :key="e.id" :to="e.status==='open' ? `/signup/${e.id}` : `/checkin/${e.id}`" class="square-card card">
        <div class="flex-between">
          <h3>{{ e.title }}</h3>
          <span class="badge" :class="`badge-${e.status}`">{{ e.status==='open'?'报名中':'进行中' }}</span>
        </div>
        <div class="square-meta">
          <span>{{ e.event_date }}</span>
          <span v-if="e.location"> · {{ e.location }}</span>
        </div>
        <p v-if="e.content" class="square-content">{{ e.content }}</p>
        <div class="flex-between mt-16">
          <span class="square-count">{{ e.signupCount }}{{ e.capacity ? `/${e.capacity}` : '' }} 人已报名</span>
          <span v-if="e.status==='open'" class="card-action">立即报名 →</span>
          <span v-else class="badge badge-active" style="font-size:11px">进行中</span>
        </div>
        <div v-if="e.capacity" class="progress-bar mt-16">
          <div class="progress-fill" :style="{ width: Math.min(100, e.signupCount/e.capacity*100)+'%' }"
               :class="{ full: e.signupCount >= e.capacity }"></div>
        </div>
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../../services/api.js'

const events = ref([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    const data = await api.listEvents('public')
    events.value = data.events
  } catch (e) { error.value = e.message || '加载失败' }
  loading.value = false
})
</script>

<style scoped>
.square-title { font-size: 22px; margin-bottom: 4px; }
.square-subtitle { color: var(--c-text-secondary); font-size: 14px; margin-bottom: 24px; }
.event-grid { display: flex; flex-direction: column; gap: 16px; }
.square-card { display: block; color: inherit; transition: box-shadow .15s; }
.square-card:hover { box-shadow: var(--shadow-md); }
.square-card h3 { font-size: 18px; }
.square-meta { font-size: 13px; color: var(--c-text-secondary); margin-top: 6px; }
.square-content { font-size: 14px; margin-top: 10px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.square-count { font-size: 13px; color: var(--c-text-secondary); }
.card-action { font-size: 13px; font-weight: 500; color: var(--c-primary); }
.progress-bar { height: 4px; background: var(--c-border); border-radius: 2px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--c-primary); border-radius: 2px; transition: width .3s; }
.progress-fill.full { background: var(--c-danger); }
</style>
