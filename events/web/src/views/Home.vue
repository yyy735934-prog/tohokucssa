<template>
  <div class="page feed-page">
    <div class="hero">
      <h1>活动广场</h1>
      <p>发现近期活动，找到想一起出发的人</p>
    </div>

    <div v-if="loading" class="empty">加载中…</div>
    <div v-else-if="error" class="empty error">{{ error }}</div>
    <div v-else-if="!feed.length" class="empty"><p>暂时还没有活动</p></div>

    <div v-else class="activity-feed">
      <router-link
        v-for="item in feed"
        :key="`${item.kind}-${item.id}`"
        :to="item.kind === 'gathering' ? `/g/${item.id}` : `/e/${item.id}`"
        class="activity-card card"
      >
        <img v-if="item.image_key" :src="`/api/images/serve/${item.id}`" :alt="`${item.title}活动图片`" class="activity-cover" />
        <div class="activity-body">
          <h2><span class="type-label" :class="`type-${item.kind}`">{{ item.kind === 'gathering' ? '组个局' : '正式活动' }}</span>{{ item.title }}</h2>
          <div class="activity-meta">{{ item.event_date }}<span v-if="item.location"> · {{ item.location }}</span></div>
          <p v-if="item.content" class="activity-desc">{{ item.content }}</p>

          <template v-if="item.kind === 'gathering'">
            <div class="formation"><strong>{{ item.effective_count }}</strong> / {{ item.min_participants }} 人</div>
            <div class="progress"><div class="progress-fill" :style="{ width: gatheringProgress(item) }"></div></div>
            <div class="card-foot"><span>{{ categoryLabel(item.gathering_category) }}</span><span>{{ stateLabel(item.gathering_state) }}</span></div>
          </template>
          <template v-else>
            <div class="card-foot"><span>{{ item.signupCount }}{{ item.capacity ? `/${item.capacity}` : '' }} 人报名</span><span>{{ item.status === 'open' ? '报名中' : '进行中' }}</span></div>
          </template>
        </div>
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { api } from '../api.js'

const events = ref([])
const gatherings = ref([])
const loading = ref(true)
const error = ref('')
const categoryLabels = { karaoke: '唱歌', sport: '多人体育', outdoor: '徒步·户外', salon: '沙龙', boardgame: '桌游', movie: '观影', other: '其他' }
const stateLabels = { recruiting: '组局中', arrangement_pending: '待确认', confirmed: '已成局', in_progress: '进行中', completed: '已结束', cancelled: '已取消' }

const feed = computed(() => [
  ...events.value.map((item) => ({ ...item, kind: 'standard' })),
  ...gatherings.value.map((item) => ({ ...item, kind: 'gathering' })),
].sort((a, b) => Number(b.pinned || 0) - Number(a.pinned || 0) || Number(b.created_at || 0) - Number(a.created_at || 0)))

const categoryLabel = (value) => categoryLabels[value] || '其他'
const stateLabel = (value) => stateLabels[value] || value
const gatheringProgress = (item) => `${Math.min(100, Number(item.effective_count || 0) / Number(item.min_participants || 1) * 100)}%`

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
.feed-page { max-width: 920px; }
.hero { margin: 8px 0 22px; }
.hero h1 { font-size: 28px; font-weight: 750; letter-spacing: -.02em; }
.hero p { color: var(--c-text-2); font-size: 14px; margin-top: 4px; }
.activity-feed { columns: 2; column-gap: 12px; }
.activity-card { display: inline-block; width: 100%; padding: 0; margin: 0 0 12px; overflow: hidden; break-inside: avoid; color: inherit; vertical-align: top; transition: transform .15s, box-shadow .15s; }
.activity-card:active { transform: scale(.985); }
.activity-cover { display: block; width: 100%; height: auto; max-height: 360px; object-fit: cover; background: var(--c-bg); }
.activity-body { padding: 13px 14px 14px; }
.activity-body h2 { font-size: 15px; line-height: 1.45; font-weight: 700; overflow-wrap: anywhere; }
.type-label { display: inline-block; margin-right: 6px; padding: 2px 6px; border-radius: 4px; font-size: 10px; line-height: 1.4; font-weight: 750; vertical-align: 2px; white-space: nowrap; color: #fff; background: var(--c-primary); }
.type-gathering { color: #9a3412; background: #ffedd5; }
.activity-meta { margin-top: 7px; color: var(--c-text-2); font-size: 11px; line-height: 1.5; }
.activity-desc { margin-top: 7px; color: var(--c-text-2); font-size: 12px; line-height: 1.55; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.formation { margin-top: 11px; color: var(--c-text-2); font-size: 11px; }
.formation strong { color: var(--c-primary); font-size: 17px; }
.progress { height: 4px; margin-top: 6px; overflow: hidden; border-radius: 99px; background: var(--c-border); }
.progress-fill { height: 100%; border-radius: inherit; background: var(--c-primary); }
.card-foot { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-top: 11px; color: var(--c-text-3); font-size: 10px; }
@media (min-width: 700px) { .activity-feed { column-gap: 16px; }.activity-card { margin-bottom: 16px; }.activity-body { padding: 16px 17px; }.activity-body h2 { font-size: 17px; }.activity-meta, .formation { font-size: 12px; }.activity-desc { font-size: 13px; }.card-foot { font-size: 11px; } }
@media (max-width: 380px) { .feed-page { padding-inline: 10px; }.activity-feed { column-gap: 8px; }.activity-card { margin-bottom: 8px; }.activity-body { padding: 10px; }.activity-body h2 { font-size: 14px; }.activity-desc { -webkit-line-clamp: 2; } }
</style>
