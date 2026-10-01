<template>
  <div class="page">
    <div class="hero">
      <h1>生活指南服务中心</h1>
      <p>東北地区中国学友会 · 公益服务</p>
    </div>

    <section v-for="group in groups" :key="group.key" class="service-group">
      <h2 class="group-title">{{ group.label }}</h2>
      <div class="service-grid">
        <router-link
          v-for="item in itemsByGroup(group.key)"
          :key="item.key"
          :to="item.path + (item.hash || '')"
          class="service-card card"
        >
          <span class="service-icon">{{ item.icon }}</span>
          <div class="service-body">
            <h3>{{ item.label }}</h3>
            <p>{{ item.desc }}</p>
          </div>
          <span v-if="item.status === 'todo'" class="service-tag tag-todo">待开发</span>
          <span v-else-if="item.status === 'skeleton'" class="service-tag tag-wip">框架</span>
          <span class="service-arrow">→</span>
        </router-link>
      </div>
    </section>

    <footer class="hub-footer">
      <p>東北地区中国学友会 · <a :href="eventsUrl">活动平台</a></p>
    </footer>
  </div>
</template>

<script setup>
import { SERVICE_GROUPS, SERVICE_ITEMS } from '../data/serviceCategories.js'

const groups = SERVICE_GROUPS
const eventsUrl = 'https://events.tohokucssa.org'

function itemsByGroup(groupKey) {
  return SERVICE_ITEMS.filter(item => item.group === groupKey)
}
</script>

<style scoped>
.hero { margin-bottom: 28px; }
.hero h1 { font-size: 26px; font-weight: 700; }
.hero p { color: var(--c-text-2); font-size: 14px; margin-top: 4px; }

.service-group { margin-bottom: 28px; }
.group-title {
  font-size: 14px; font-weight: 700; color: var(--c-text-3);
  text-transform: uppercase; letter-spacing: 0.04em;
  margin-bottom: 10px; padding-left: 2px;
  display: flex; align-items: center; gap: 8px;
}
.group-title::before {
  content: ''; width: 3px; height: 14px;
  background: var(--c-primary); border-radius: 2px;
}

.service-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
@media (max-width: 520px) { .service-grid { grid-template-columns: 1fr; } }

.service-card {
  display: flex; align-items: center; gap: 12px;
  color: inherit; transition: transform .1s, box-shadow .15s;
  padding: 14px 16px;
}
.service-card:active { transform: scale(.98); }
.service-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,.06); }

.service-icon { font-size: 28px; flex-shrink: 0; }
.service-body { flex: 1; min-width: 0; }
.service-body h3 { font-size: 15px; font-weight: 600; }
.service-body p { font-size: 12px; color: var(--c-text-2); margin-top: 2px; line-height: 1.4; }

.service-arrow { color: var(--c-text-3); font-size: 16px; flex-shrink: 0; }

.service-tag {
  font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px;
  flex-shrink: 0; white-space: nowrap;
}
.tag-todo { background: #fef3c7; color: #92400e; }
.tag-wip { background: var(--c-primary-soft); color: var(--c-primary); }

.hub-footer {
  margin-top: 40px; padding-top: 16px; border-top: 1px solid var(--c-border);
  font-size: 13px; color: var(--c-text-3); text-align: center;
}
</style>
