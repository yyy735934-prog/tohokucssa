<template>
  <div class="page">
    <div class="hero">
      <h1>{{ tab === 'gatherings' ? '组个局' : '活动广场' }}</h1>
      <p>{{ tab === 'gatherings' ? '先看看谁有兴趣，人够了我们就出发' : '发现正在报名和进行中的活动' }}</p>
    </div>

    <div class="tabs" role="tablist" aria-label="活动类型">
      <button :class="{ active: tab === 'events' }" role="tab" @click="tab = 'events'">正式活动</button>
      <button :class="{ active: tab === 'gatherings' }" role="tab" @click="tab = 'gatherings'">组个局</button>
    </div>

    <div v-if="loading" class="empty">加载中…</div>
    <div v-else-if="error" class="empty error">{{ error }}</div>

    <template v-else-if="tab === 'events'">
      <div v-if="!events.length" class="empty"><p>暂无活动</p></div>
      <div v-else class="event-list">
        <router-link v-for="e in events" :key="e.id" :to="`/e/${e.id}`" class="event-item card">
          <img v-if="e.image_key" :src="`/api/images/serve/${e.id}`" alt="" class="event-cover" />
          <div class="event-body">
            <div class="event-head">
              <h3>{{ e.title }}</h3>
              <span v-if="e.pinned" class="pin-badge">置顶</span>
              <span class="badge" :class="e.status === 'open' ? 'badge-open' : 'badge-active'">{{ e.status === 'open' ? '报名中' : '进行中' }}</span>
            </div>
            <div class="event-info">{{ e.event_date }}<span v-if="e.location"> · {{ e.location }}</span></div>
            <p v-if="e.content" class="event-desc">{{ e.content }}</p>
            <div class="event-foot">
              <span class="signup-count">{{ e.signupCount }}{{ e.capacity ? `/${e.capacity}` : '' }} 人报名</span>
              <span v-if="e.status === 'open'" class="action-hint">立即报名 →</span>
            </div>
            <div v-if="e.capacity" class="progress"><div class="progress-fill" :style="{ width: Math.min(100, e.signupCount/e.capacity*100)+'%' }" :class="{ full: e.signupCount >= e.capacity }"></div></div>
          </div>
        </router-link>
      </div>
    </template>

    <template v-else>
      <div v-if="!gatherings.length" class="empty"><p>本周还没有组局</p></div>
      <div v-else class="event-list">
        <router-link v-for="g in gatherings" :key="g.id" :to="`/g/${g.id}`" class="event-item card gathering-card">
          <div class="event-body">
            <div class="event-head">
              <div><span class="category">{{ categoryLabel(g.gathering_category) }}</span><h3>{{ g.title }}</h3></div>
              <span class="state-pill" :class="`state-${g.gathering_state}`">{{ stateLabel(g.gathering_state) }}</span>
            </div>
            <div class="event-info">{{ g.event_date }}<span v-if="g.location"> · {{ g.location }}</span></div>
            <p v-if="g.content" class="event-desc">{{ g.content }}</p>
            <div class="formation-row">
              <div><strong>{{ g.effective_count }}</strong> / {{ g.min_participants }} 人<span v-if="g.gathering_state === 'recruiting' && g.effective_count < g.min_participants">，还差 {{ g.min_participants - g.effective_count }} 人</span></div>
              <span>{{ g.interest_count }} 人感兴趣</span>
            </div>
            <div class="progress gathering-progress"><div class="progress-fill" :style="{ width: Math.min(100, g.effective_count/g.min_participants*100)+'%' }"></div></div>
            <div class="gathering-flags">
              <span v-if="g.carpool_enabled">可拼车</span>
              <span v-if="g.host_name">主理人：{{ g.host_name }}</span>
              <span v-else>管理员协助安排</span>
            </div>
          </div>
        </router-link>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api.js'

const tab = ref('events')
const events = ref([])
const gatherings = ref([])
const loading = ref(true)
const error = ref('')
const categoryLabels = { karaoke: '唱歌', sport: '多人体育', outdoor: '徒步·户外', salon: '沙龙', boardgame: '桌游', movie: '观影', other: '其他' }
const stateLabels = { recruiting: '组局中', arrangement_pending: '待确认安排', confirmed: '已成局', in_progress: '进行中', completed: '已结束', cancelled: '已取消' }
const categoryLabel = (value) => categoryLabels[value] || '组局'
const stateLabel = (value) => stateLabels[value] || value

onMounted(async () => {
  try {
    const [eventData, gatheringData] = await Promise.all([api.listEvents(), api.listGatherings()])
    events.value = eventData.events
    gatherings.value = gatheringData.gatherings
  } catch (e) { error.value = e.message }
  loading.value = false
})
</script>

<style scoped>
.hero { margin-bottom: 18px; }
.hero h1 { font-size: 28px; font-weight: 700; }
.hero p { color: var(--c-text-2); font-size: 15px; margin-top: 4px; }
.tabs { display: flex; gap: 6px; padding: 4px; background: var(--c-bg); border-radius: 10px; margin-bottom: 20px; }
.tabs button { flex: 1; border: 0; background: transparent; padding: 10px 16px; border-radius: 7px; color: var(--c-text-2); font-weight: 600; cursor: pointer; }
.tabs button.active { background: var(--c-surface); color: var(--c-primary); box-shadow: 0 1px 4px rgba(0,0,0,.08); }
.event-list { display: flex; flex-direction: column; gap: 12px; }
.event-item { display: block; color: inherit; transition: transform .1s, box-shadow .15s; padding: 0; overflow: hidden; }
.event-item:active { transform: scale(.98); }
.event-cover { width: 100%; display: block; height: auto; }
.event-body { padding: 16px 20px; }
.event-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.event-head h3 { font-size: 17px; font-weight: 600; flex: 1; min-width: 0; overflow-wrap: break-word; }
.pin-badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; color: #b45309; background: #fef3c7; flex-shrink: 0; }
.event-info { font-size: 13px; color: var(--c-text-2); margin-top: 6px; }
.event-desc { font-size: 14px; color: var(--c-text-2); margin-top: 8px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.event-foot, .formation-row { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; gap: 12px; font-size: 13px; color: var(--c-text-3); }
.formation-row strong { font-size: 18px; color: var(--c-primary); }
.signup-count { font-size: 13px; color: var(--c-text-3); }
.action-hint { font-size: 13px; font-weight: 600; color: var(--c-primary); }
.progress { height: 3px; background: var(--c-border); border-radius: 2px; margin-top: 12px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--c-primary); border-radius: 2px; transition: width .3s; }
.progress-fill.full { background: var(--c-danger); }
.category { display: block; color: var(--c-primary); font-size: 12px; font-weight: 700; margin-bottom: 4px; }
.state-pill { font-size: 12px; font-weight: 700; padding: 5px 10px; border-radius: 99px; background: var(--c-bg); white-space: nowrap; }
.state-confirmed { color: var(--c-success); background: var(--c-success-bg); }
.state-arrangement_pending { color: #b45309; background: #fef3c7; }
.gathering-progress { height: 6px; }
.gathering-flags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.gathering-flags span { font-size: 12px; color: var(--c-text-2); background: var(--c-bg); padding: 3px 8px; border-radius: 99px; }
</style>
