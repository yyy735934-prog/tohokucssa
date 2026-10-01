<template>
  <section class="page bus-page">
    <header class="bus-hero">
      <span class="bus-kicker">CAMPUS BUS · 东北大学校车</span>
      <h2 class="bus-title">下一班，算一下就知道</h2>
      <p class="bus-lede">学生免费 · 已接入 {{ routeCount }} 条方向 / {{ stopCount }} 个站点</p>
      <div class="bus-hero-actions">
        <button type="button" class="btn btn-primary" :disabled="locating" @click="locateUser">
          {{ locating ? '定位中...' : '获取我的位置' }}
        </button>
      </div>
    </header>

    <div class="card bus-planner">
      <div class="planner-head">
        <h3>选起点和终点</h3>
        <p class="muted">系统会推荐最近乘车点和下一班。</p>
      </div>

      <div class="planner-grid">
        <label class="planner-field">
          <span>当前位置</span>
          <div class="quick-stop-grid">
            <button
              v-for="stop in quickOriginStops"
              :key="`origin-${stop.id}`"
              type="button"
              class="quick-stop-btn"
              :class="{ 'quick-stop-btn-active': selectedOriginId === stop.id }"
              @click="selectedOriginId = stop.id"
            >{{ formatQuickStopLabel(stop) }}</button>
          </div>
          <select v-model="selectedOriginId">
            <option value="">请选择当前位置</option>
            <option v-for="stop in stopOptions" :key="stop.id" :value="stop.id">{{ formatStopName(stop) }}</option>
          </select>
          <small class="muted">{{ locationLabel }}</small>
        </label>

        <label class="planner-field">
          <span>终点站</span>
          <div class="quick-stop-grid">
            <button
              v-for="stop in quickDestinationStops"
              :key="`destination-${stop.id}`"
              type="button"
              class="quick-stop-btn"
              :class="{ 'quick-stop-btn-active': selectedDestinationId === stop.id }"
              @click="selectedDestinationId = stop.id"
            >{{ formatQuickStopLabel(stop) }}</button>
          </div>
          <select v-model="selectedDestinationId">
            <option value="">请选择终点站</option>
            <option v-for="stop in destinationOptions" :key="stop.id" :value="stop.id">{{ formatStopName(stop) }}</option>
          </select>
        </label>
      </div>

      <div class="planner-actions">
        <button type="button" class="btn btn-primary" :disabled="!selectedOriginId || !selectedDestinationId" @click="refreshRecommendation">
          计算下一班
        </button>
      </div>

      <p v-if="plannerError" class="planner-error">{{ plannerError }}</p>

      <div v-if="plannerResult" class="trip-board">
        <div class="trip-head">
          <span class="trip-tag">{{ plannerResult.route.route }}</span>
          <span class="trip-tag trip-tag-mode">{{ plannerResult.isTransfer ? '换乘 1 次' : '直达' }}</span>
          <span class="trip-head-spacer"></span>
          <span v-if="!plannerResult.isNextServiceDay" class="trip-head-note">{{ plannerResult.route.direction }}</span>
        </div>

        <div class="trip-signal">
          <div class="trip-signal-main">
            <span class="trip-signal-label">下一班 · DEPARTURE</span>
            <strong class="trip-signal-time">{{ plannerResult.departureTime }}</strong>
            <span class="trip-signal-wait" :class="{ 'trip-signal-wait-nextday': plannerResult.isNextServiceDay }">
              <template v-if="plannerResult.isNextServiceDay">
                今天已无班次，下一次 {{ formatDateLabel(plannerResult.nextServiceDate) }}
              </template>
              <template v-else>还有 {{ plannerResult.waitMinutes }} 分钟</template>
            </span>
          </div>
          <div class="trip-signal-arrive">
            <span class="trip-signal-label">预计到达</span>
            <strong class="trip-signal-time trip-signal-time-secondary">{{ plannerResult.arrivalTime }}</strong>
            <span class="muted">{{ formatStopName(plannerResult.destinationStop) }}</span>
          </div>
        </div>

        <ol v-if="!plannerResult.isTransfer" class="trip-timeline">
          <li class="trip-stop trip-stop-start">
            <span class="trip-stop-time">{{ plannerResult.departureTime }}</span>
            <span class="trip-stop-dot"></span>
            <span class="trip-stop-name">{{ formatStopName(plannerResult.boardingStop) }}</span>
            <span class="trip-stop-role">起点</span>
          </li>
          <li class="trip-stop trip-stop-end">
            <span class="trip-stop-time">{{ plannerResult.arrivalTime }}</span>
            <span class="trip-stop-dot"></span>
            <span class="trip-stop-name">{{ formatStopName(plannerResult.destinationStop) }}</span>
            <span class="trip-stop-role">终点</span>
          </li>
        </ol>

        <ol v-else class="trip-timeline trip-timeline-transfer">
          <li class="trip-stop trip-stop-start">
            <span class="trip-stop-time">{{ plannerResult.firstLeg.departureTime }}</span>
            <span class="trip-stop-dot"></span>
            <span class="trip-stop-name">{{ formatStopName(plannerResult.firstLeg.boardingStop) }}</span>
            <span class="trip-stop-role">起点</span>
          </li>
          <li class="trip-stop trip-stop-transfer">
            <span class="trip-stop-time">{{ plannerResult.firstLeg.arrivalTime }} → {{ plannerResult.departureTime }}</span>
            <span class="trip-stop-dot"></span>
            <span class="trip-stop-name">{{ formatStopName(plannerResult.transferStop) }}</span>
            <span class="trip-stop-role">换乘</span>
          </li>
          <li class="trip-stop trip-stop-end">
            <span class="trip-stop-time">{{ plannerResult.arrivalTime }}</span>
            <span class="trip-stop-dot"></span>
            <span class="trip-stop-name">{{ formatStopName(plannerResult.destinationStop) }}</span>
            <span class="trip-stop-role">终点</span>
          </li>
        </ol>

        <div v-if="!plannerResult.isTransfer" class="trip-walk">
          <span class="trip-walk-icon">↱</span>
          <span>
            前往 <strong>{{ formatStopName(plannerResult.boardingStop) }}</strong>
            · 距离 {{ plannerResult.distanceText }}
            · 步行约 <strong>{{ plannerResult.walkMinutes }}</strong> 分钟
          </span>
          <a class="trip-walk-nav" :href="googleMapsLink(plannerResult.boardingStop)" target="_blank" rel="noreferrer">
            Google 地图导航 ↗
          </a>
        </div>
        <div v-else class="trip-walk">
          <span class="trip-walk-icon">↱</span>
          <span>先前往 <strong>{{ formatStopName(plannerResult.firstLeg.boardingStop) }}</strong> 乘第一段车</span>
          <a class="trip-walk-nav" :href="googleMapsLink(plannerResult.firstLeg.boardingStop)" target="_blank" rel="noreferrer">
            Google 地图导航 ↗
          </a>
        </div>

        <details v-if="plannerResult.alternativeDirectOptions?.length || plannerResult.schedulePreview" class="trip-more">
          <summary>
            <span>展开更多班次与时刻</span>
            <span class="trip-more-chevron">＋</span>
          </summary>

          <section v-if="plannerResult.alternativeDirectOptions?.length" class="trip-more-block">
            <h4 class="trip-more-title">其他可选班次</h4>
            <ul class="trip-alt-list">
              <li v-for="item in plannerResult.alternativeDirectOptions" :key="`${item.route.direction}-${item.departureTime}`" class="trip-alt-item">
                <span class="trip-alt-time">{{ item.departureTime }}</span>
                <span class="trip-alt-dir">{{ item.route.direction }}</span>
                <span class="trip-alt-path muted">{{ formatStopName(item.boardingStop) }} → {{ formatStopName(item.destinationStop) }}</span>
              </li>
            </ul>
          </section>

          <section v-if="plannerResult.schedulePreview" class="trip-more-block" :class="{ 'trip-more-block-warn': plannerResult.schedulePreview.mode === 'next_service_day' }">
            <header class="trip-more-head">
              <h4 class="trip-more-title">{{ plannerResult.schedulePreview.title }}</h4>
              <span class="muted">{{ plannerResult.schedulePreview.subtitle }}</span>
            </header>
            <div class="trip-time-grid">
              <span v-for="item in plannerResult.schedulePreview.nextTimes" :key="item" class="trip-time-chip">{{ item }}</span>
            </div>
            <p class="trip-last">当天最后一班 · <strong>{{ plannerResult.schedulePreview.lastTime }}</strong></p>
          </section>

          <section v-if="plannerResult.schedulePreview?.fallbackPreview" class="trip-more-block trip-more-block-warn">
            <header class="trip-more-head">
              <h4 class="trip-more-title">{{ plannerResult.schedulePreview.fallbackPreview.title }}</h4>
              <span class="muted">{{ plannerResult.schedulePreview.fallbackPreview.subtitle }}</span>
            </header>
            <div class="trip-time-grid">
              <span v-for="item in plannerResult.schedulePreview.fallbackPreview.nextTimes" :key="`fb-${item}`" class="trip-time-chip">{{ item }}</span>
            </div>
            <p class="trip-last">当天最后一班 · <strong>{{ plannerResult.schedulePreview.fallbackPreview.lastTime }}</strong></p>
          </section>
        </details>
      </div>
    </div>

    <footer class="bus-footer-links">
      <span class="muted">以学校当天官方信息为准</span>
      <a :href="officialEnglishBusUrl" target="_blank" rel="noreferrer">官方时刻表 ↗</a>
      <a :href="officialCampusGuideUrl" target="_blank" rel="noreferrer">校园导览 ↗</a>
    </footer>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import busData from '../data/tohokuBusData.json'

const officialEnglishBusUrl = 'https://sites.google.com/tohoku.ac.jp/asset-campusbus/english'
const officialCampusGuideUrl = 'https://campus.bureau.tohoku.ac.jp/'

const locating = ref(false)
const userCoords = ref(null)
const detectedNearestStopId = ref('')
const detectedNearestStopDistance = ref(0)
const selectedOriginId = ref('')
const selectedDestinationId = ref('')
const plannerError = ref('')
const plannerResult = ref(null)

const stops = busData.stops || []
const rawRoutes = busData.routes || []

function reverseDirection(directionText) {
  const [from, to] = String(directionText || '').split('→').map(s => s?.trim())
  if (!from || !to) return directionText
  return `${to}→${from}`
}

function buildExpandedRoutes(routeList) {
  const expanded = [...routeList]
  routeList.forEach(route => {
    const reversed = reverseDirection(route.direction)
    if (routeList.some(r => r.route === route.route && r.direction === reversed)) return
    expanded.push({
      ...route,
      direction: reversed,
      stops: [...route.stops].reverse(),
      timetable: route.timetable.map(row => Array.isArray(row) ? [...row].reverse() : row),
      synthetic: true,
    })
  })
  return expanded
}

const routes = buildExpandedRoutes(rawRoutes)
const stopCount = stops.length
const routeCount = routes.length
const stopOptions = computed(() => stops)
const destinationOptions = computed(() => stops)
const stopMapById = new Map(stops.map(s => [s.id, s]))
const stopMapByName = new Map(stops.map(s => [s.name_cn, s]))
const quickStopIds = ['aobayama_s1', 'uh', 'katahira', 'seiryo', 'admission']
const quickOriginStops = computed(() => quickStopIds.map(id => stopMapById.get(id)).filter(Boolean))
const quickDestinationStops = computed(() => quickStopIds.map(id => stopMapById.get(id)).filter(Boolean))

const locationLabel = computed(() => {
  if (plannerResult.value?.boardingStop) return '当前按你选的起点和终点计算路线，不会自动改写起点'
  if (userCoords.value && detectedNearestStopId.value) {
    const stop = stopMapById.get(detectedNearestStopId.value)
    if (stop) {
      return detectedNearestStopDistance.value > 180
        ? `定位可能有偏差，系统估算你在 ${stop.name_cn} 一带附近，请手动确认当前位置`
        : `系统估算你在 ${stop.name_cn} 附近，你也可以手动改当前位置`
    }
  }
  if (userCoords.value) return '已获取定位，你也可以手动改当前位置'
  return '可以直接手动选择当前位置，也可以点上方按钮获取定位'
})

function distanceInMeters(lat1, lon1, lat2, lon2) {
  const toRad = v => (v * Math.PI) / 180
  const R = 6371000
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function getMinutesOfDay(t) {
  const [h, m] = String(t || '').split(':').map(Number)
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null
}

function formatDistance(d) { return d < 1000 ? `${Math.round(d)} 米` : `${(d / 1000).toFixed(1)} 公里` }

function formatStopName(stop) {
  if (!stop) return ''
  if (stop.id === 'uh' || stop.name_cn === 'UH青叶山') return '青叶山宿舍'
  return stop.name_cn
}

function formatDateLabel(date) {
  const week = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()]
  return `${date.getMonth() + 1}/${date.getDate()}（周${week}）`
}

function isServiceDay(route, date) {
  if (String(route?.service_days?.type || '').toLowerCase() === 'weekday') {
    const d = date.getDay()
    return d >= 1 && d <= 5
  }
  return true
}

function findNextServiceDate(route, base) {
  for (let i = 1; i <= 14; i++) {
    const c = new Date(base)
    c.setDate(base.getDate() + i)
    if (isServiceDay(route, c)) return c
  }
  return null
}

function buildSchedulePreview(route, originIndex, now) {
  const timetable = route.timetable || []
  const currentMin = now.getHours() * 60 + now.getMinutes()
  const departures = timetable.map(row => row?.[originIndex]).filter(Boolean)
  const nextSD = findNextServiceDate(route, now)
  const future = departures.filter(t => { const v = getMinutesOfDay(t); return v != null && v >= currentMin })

  if (future.length) {
    const fallback = nextSD ? {
      title: future.length <= 1 ? '如果错过这班，下一次有班' : '如果今天后面的车都错过了',
      subtitle: `${formatDateLabel(nextSD)} 的前几班`,
      nextTimes: departures.slice(0, 3),
      lastTime: departures[departures.length - 1],
    } : null
    return { mode: 'today', title: '这一站后面还有这些车', subtitle: `今天 ${formatDateLabel(now)} 的后续班次`, nextTimes: future.slice(0, 3), lastTime: departures[departures.length - 1], fallbackPreview: fallback }
  }

  return { mode: 'next_service_day', title: '今天这条线已结束', subtitle: nextSD ? `下一次有班：${formatDateLabel(nextSD)}` : '下一次服务日请再核对官方信息', nextTimes: departures.slice(0, 3), lastTime: departures[departures.length - 1] }
}

function getNearestStop(coords) {
  let nearest = null, nearestDist = Infinity
  stops.forEach(s => { const d = distanceInMeters(coords.lat, coords.lon, s.lat, s.lon); if (d < nearestDist) { nearestDist = d; nearest = s } })
  return { stop: nearest, distance: nearestDist }
}

function buildTripCandidates(route, origin, dest, now) {
  const currentMin = now.getHours() * 60 + now.getMinutes()
  const names = route.stops || []
  const oi = names.indexOf(origin.name_cn), di = names.indexOf(dest.name_cn)
  if (oi < 0 || di < 0 || di <= oi) return []
  const candidates = []
  ;(route.timetable || []).forEach(row => {
    if (!Array.isArray(row) || row.length !== names.length) return
    const dep = getMinutesOfDay(row[oi]), arr = getMinutesOfDay(row[di])
    if (dep == null || arr == null) return
    if (dep >= currentMin) candidates.push({ route, departureTime: row[oi], arrivalTime: row[di], waitMinutes: dep - currentMin, boardingStop: origin, destinationStop: dest, departureMinutes: dep, direct: true })
  })
  if (candidates.length) return candidates
  const nextSD = findNextServiceDate(route, now)
  const first = (route.timetable || [])[0]
  if (nextSD && Array.isArray(first) && first.length === names.length) {
    const dep = getMinutesOfDay(first[oi])
    const nd = new Date(nextSD); nd.setHours(Math.floor((dep || 0) / 60), (dep || 0) % 60, 0, 0)
    candidates.push({ route, departureTime: first[oi], arrivalTime: first[di], waitMinutes: Math.max(0, Math.round((nd - now) / 60000)), boardingStop: origin, destinationStop: dest, departureMinutes: 100000 + Math.max(0, Math.round((nd - now) / 60000)), isNextServiceDay: true, nextServiceDate: nextSD, direct: true })
  }
  return candidates
}

function findBestRoute(originId, destId) {
  const now = new Date()
  const dest = stopMapById.get(destId), origin = stopMapById.get(originId)
  if (!dest || !origin) return null

  const direct = routes.flatMap(r => buildTripCandidates(r, origin, dest, now))
  if (direct.length) {
    direct.sort((a, b) => a.departureMinutes - b.departureMinutes)
    return { ...direct[0], alternativeDirectOptions: direct.slice(1, 5) }
  }

  const transfers = []
  const rss = routes.map(r => ({ route: r, stops: r.stops || [] }))
  rss.forEach(({ route: r1, stops: s1 }) => {
    const oi = s1.indexOf(origin.name_cn)
    if (oi < 0) return
    s1.forEach((tsn, ti) => {
      if (ti <= oi) return
      const ts = stopMapByName.get(tsn)
      if (!ts) return
      const leg1 = buildTripCandidates(r1, origin, ts, now).slice(0, 3)
      if (!leg1.length) return
      rss.forEach(({ route: r2 }) => {
        buildTripCandidates(r2, ts, dest, now).slice(0, 5).forEach(l2 => {
          leg1.forEach(l1 => {
            const a1 = getMinutesOfDay(l1.arrivalTime), d2 = getMinutesOfDay(l2.departureTime)
            if (l1.isNextServiceDay || l2.isNextServiceDay) return
            if (a1 == null || d2 == null || d2 < a1) return
            transfers.push({ ...l2, isTransfer: true, transferStop: ts, firstLeg: l1, journeyOriginStop: origin, departureMinutes: l1.departureMinutes })
          })
        })
      })
    })
  })
  if (!transfers.length) return null
  transfers.sort((a, b) => a.departureMinutes - b.departureMinutes)
  return transfers[0]
}

function buildPlannerResult(best) {
  const origin = best.isTransfer ? (best.journeyOriginStop || best.firstLeg?.boardingStop || best.boardingStop) : best.boardingStop
  const dist = userCoords.value ? distanceInMeters(userCoords.value.lat, userCoords.value.lon, origin.lat, origin.lon) : 0
  const walk = Math.max(1, Math.ceil(dist / 80))
  const preview = best.isTransfer ? best.firstLeg.route : best.route
  const previewOrigin = best.isTransfer ? best.firstLeg.boardingStop : origin
  const idx = preview.stops.findIndex(n => n === previewOrigin.name_cn)
  return { ...best, distanceText: formatDistance(dist), walkMinutes: walk, schedulePreview: idx >= 0 ? buildSchedulePreview(preview, idx, new Date()) : null, isNextServiceDay: !!best.isNextServiceDay, isTransfer: !!best.isTransfer, transferStop: best.transferStop || null, firstLeg: best.firstLeg || null, alternativeDirectOptions: best.alternativeDirectOptions || [] }
}

function refreshRecommendation() {
  plannerError.value = ''; plannerResult.value = null
  if (!selectedOriginId.value || !selectedDestinationId.value) { plannerError.value = '请先选当前位置和终点站。'; return }
  if (selectedOriginId.value === selectedDestinationId.value) { plannerError.value = '当前位置和终点站不能相同。'; return }
  const best = findBestRoute(selectedOriginId.value, selectedDestinationId.value)
  if (!best) { plannerError.value = '当前没有找到可用班次，请看官方时刻表确认。'; return }
  plannerResult.value = buildPlannerResult(best)
}

function locateUser() {
  if (!navigator.geolocation) { alert('当前设备不支持定位，请手动选择当前位置'); return }
  locating.value = true
  navigator.geolocation.getCurrentPosition(
    pos => {
      userCoords.value = { lat: pos.coords.latitude, lon: pos.coords.longitude }
      const { stop, distance } = getNearestStop(userCoords.value)
      detectedNearestStopDistance.value = distance || 0
      if (stop) { detectedNearestStopId.value = stop.id; selectedOriginId.value = stop.id }
      locating.value = false
      if (selectedOriginId.value && selectedDestinationId.value) refreshRecommendation()
    },
    () => { locating.value = false; alert('定位失败，请手动选择当前位置') },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
  )
}

function googleMapsLink(stop) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${stop.name_en || stop.name_cn}, Tohoku University, Sendai`)}`
}

function formatQuickStopLabel(stop) {
  if (!stop) return ''
  if (stop.id === 'uh') return '青叶山宿舍'
  if (stop.id === 'admission') return '川内 / 入学考试中心前'
  return formatStopName(stop)
}
</script>

<style scoped>
.bus-page { display: grid; gap: 14px; }
.bus-hero { padding: 4px 0 12px; display: flex; flex-direction: column; gap: 6px; border-bottom: 1px solid var(--c-border); }
.bus-kicker { font-size: 11.5px; letter-spacing: 0.24em; text-transform: uppercase; color: var(--c-primary); font-weight: 600; }
.bus-title { font-size: clamp(22px, 3.4vw, 28px); font-weight: 600; line-height: 1.25; }
.bus-lede { font-size: 13px; color: var(--c-text-2); }
.bus-hero-actions, .planner-actions { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 10px; }
.planner-head { display: flex; flex-direction: column; gap: 2px; margin-bottom: 4px; }
.planner-head h3 { font-size: 17px; font-weight: 600; }
.planner-head p { font-size: 12.5px; }
.muted { color: var(--c-text-3); }
.bus-footer-links { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; padding: 10px 2px 0; border-top: 1px solid var(--c-border); font-size: 12.5px; }
.bus-footer-links a { color: var(--c-primary); font-weight: 500; }
.bus-planner { display: grid; gap: 12px; }
.planner-grid { display: grid; gap: 10px; }
.planner-field { display: grid; gap: 8px; }
.planner-field span { font-size: 13px; font-weight: 800; }
.quick-stop-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.quick-stop-btn { min-height: 52px; padding: 10px 12px; border: 1px solid var(--c-border); border-radius: 14px; background: var(--c-surface); color: var(--c-text); font-size: 14px; font-weight: 800; line-height: 1.35; cursor: pointer; }
.quick-stop-btn-active { border-color: var(--c-primary); background: var(--c-primary-soft); color: var(--c-primary); box-shadow: 0 0 0 2px rgba(45,106,79,0.08); }
.planner-error { color: var(--c-danger); font-size: 14px; font-weight: 700; }

.trip-board { display: flex; flex-direction: column; border: 1px solid var(--c-text); border-radius: 16px; overflow: hidden; background: var(--c-surface); }
.trip-head { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: var(--c-text); color: var(--c-bg); font-size: 11.5px; letter-spacing: 0.18em; text-transform: uppercase; }
.trip-tag { display: inline-flex; padding: 3px 9px; border-radius: 999px; background: rgba(255,255,255,.14); font-size: 11px; font-weight: 600; letter-spacing: 0.14em; }
.trip-tag-mode { background: #fbbf24; color: #1a1511; }
.trip-head-spacer { flex: 1; }
.trip-head-note { font-size: 11px; letter-spacing: 0.1em; opacity: .85; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60%; }

.trip-signal { display: grid; grid-template-columns: 1.3fr 1fr; gap: 16px; padding: 20px 18px 18px; border-bottom: 1px dashed var(--c-border); }
.trip-signal-main, .trip-signal-arrive { display: flex; flex-direction: column; gap: 2px; }
.trip-signal-label { font-size: 10.5px; letter-spacing: 0.24em; text-transform: uppercase; color: var(--c-text-3); font-weight: 600; }
.trip-signal-time { font-variant-numeric: tabular-nums; font-weight: 700; font-size: clamp(48px, 11vw, 72px); line-height: 1; color: var(--c-warning); letter-spacing: -0.02em; }
.trip-signal-time-secondary { font-size: clamp(30px, 6vw, 42px); color: var(--c-text); }
.trip-signal-wait { margin-top: 4px; font-size: 13px; font-weight: 500; }
.trip-signal-wait-nextday { color: var(--c-warning); font-weight: 600; }

.trip-timeline { list-style: none; padding: 18px; display: grid; grid-template-columns: repeat(2, 1fr); position: relative; border-bottom: 1px dashed var(--c-border); }
.trip-timeline-transfer { grid-template-columns: repeat(3, 1fr); }
.trip-timeline::before { content: ''; position: absolute; top: 46px; left: 18px; right: 18px; height: 2px; background: var(--c-border); }
.trip-stop { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; z-index: 1; }
.trip-stop:last-child { align-items: flex-end; text-align: right; }
.trip-timeline-transfer .trip-stop:nth-child(2) { align-items: center; text-align: center; }
.trip-stop-time { font-variant-numeric: tabular-nums; font-size: 14px; font-weight: 600; letter-spacing: 0.02em; }
.trip-stop-dot { width: 12px; height: 12px; border-radius: 999px; background: var(--c-surface); border: 3px solid var(--c-primary); margin: 2px 0; }
.trip-stop-end .trip-stop-dot { background: var(--c-primary); }
.trip-stop-transfer .trip-stop-dot { border-color: var(--c-warning); background: var(--c-warning); }
.trip-stop-name { font-size: 14px; font-weight: 600; line-height: 1.3; }
.trip-stop-role { font-size: 10.5px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--c-text-3); font-weight: 600; }

.trip-walk { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 18px; background: var(--c-bg); border-bottom: 1px dashed var(--c-border); font-size: 13px; line-height: 1.5; }
.trip-walk strong { font-weight: 600; }
.trip-walk-icon { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 999px; background: var(--c-primary); color: #fff; font-size: 13px; font-weight: 700; flex-shrink: 0; }
.trip-walk-nav { margin-left: auto; padding: 6px 12px; border-radius: 999px; border: 1px solid var(--c-text); color: var(--c-text); font-size: 12.5px; font-weight: 600; white-space: nowrap; transition: all .2s; }
.trip-walk-nav:hover { background: var(--c-text); color: var(--c-bg); }

.trip-more { padding: 0 18px; }
.trip-more > summary { list-style: none; cursor: pointer; padding: 14px 0; display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 13px; font-weight: 600; color: var(--c-primary); }
.trip-more > summary::-webkit-details-marker { display: none; }
.trip-more-chevron { width: 22px; height: 22px; border-radius: 999px; background: var(--c-bg); color: var(--c-primary); display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; transition: transform .2s; }
.trip-more[open] .trip-more-chevron { transform: rotate(45deg); }
.trip-more-block { padding: 14px 0; border-top: 1px dashed var(--c-border); display: flex; flex-direction: column; gap: 10px; }
.trip-more-block:last-child { padding-bottom: 18px; }
.trip-more-block-warn { background: #fffbeb; margin: 0 -18px; padding-left: 18px; padding-right: 18px; }
.trip-more-block-warn .trip-more-title { color: #92400e; }
.trip-more-head { display: flex; flex-direction: column; gap: 2px; }
.trip-more-title { font-size: 14px; font-weight: 600; }
.trip-alt-list { list-style: none; display: flex; flex-direction: column; gap: 2px; }
.trip-alt-item { display: grid; grid-template-columns: 58px 1fr auto; gap: 10px; align-items: center; padding: 8px 10px; border-radius: 8px; background: var(--c-bg); font-size: 13px; }
.trip-alt-time { font-variant-numeric: tabular-nums; font-weight: 700; font-size: 16px; color: var(--c-primary); letter-spacing: 0.02em; }
.trip-alt-dir { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.trip-alt-path { font-size: 11.5px; white-space: nowrap; max-width: 160px; overflow: hidden; text-overflow: ellipsis; }
.trip-time-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.trip-time-chip { display: inline-flex; align-items: center; justify-content: center; min-width: 62px; min-height: 34px; padding: 0 10px; border-radius: 8px; background: var(--c-surface); border: 1px solid var(--c-border); font-variant-numeric: tabular-nums; font-size: 14px; font-weight: 600; }
.trip-more-block-warn .trip-time-chip { border-color: #fcd34d; color: #92400e; }
.trip-last { font-size: 12px; color: var(--c-text-3); }
.trip-last strong { font-variant-numeric: tabular-nums; font-weight: 600; margin-left: 4px; }

@media (min-width: 860px) { .planner-grid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 560px) {
  .quick-stop-grid { grid-template-columns: 1fr; }
  .trip-signal { grid-template-columns: 1fr; gap: 10px; }
  .trip-timeline::before { display: none; }
  .trip-timeline, .trip-timeline-transfer { grid-template-columns: 1fr; gap: 12px; }
  .trip-stop, .trip-timeline-transfer .trip-stop:nth-child(2), .trip-stop:last-child { align-items: flex-start; text-align: left; flex-direction: row; gap: 10px; padding: 6px 0; border-top: 1px dashed var(--c-border); }
  .trip-stop:first-child { border-top: 0; padding-top: 0; }
  .trip-stop-time { min-width: 64px; flex-shrink: 0; }
  .trip-stop-dot { margin-top: 4px; }
  .trip-stop-name { flex: 1; }
  .trip-walk-nav { margin-left: 0; }
}
</style>
