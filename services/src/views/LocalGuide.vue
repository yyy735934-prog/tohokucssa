<template>
  <div class="page">
    <div class="hero">
      <h1>在地生活指南</h1>
      <p>仙台及東北地区留学生活实用信息</p>
    </div>

    <section v-for="section in sections" :key="section.key" :id="section.key" class="guide-section">
      <div class="card">
        <div class="section-head">
          <span class="section-icon">{{ section.icon }}</span>
          <div>
            <h2>{{ section.title }}</h2>
            <p class="section-desc">{{ section.desc }}</p>
          </div>
        </div>
        <div class="section-body">
          <div v-for="item in section.items" :key="item.title" class="info-item">
            <h3>{{ item.title }}</h3>
            <p>{{ item.content }}</p>
            <a v-if="item.link" :href="item.link" target="_blank" rel="noreferrer">{{ item.linkText || '了解更多' }} ↗</a>
          </div>
          <p v-if="!section.items.length" class="placeholder">内容建设中，欢迎贡献信息</p>
        </div>
      </div>
    </section>

    <router-link to="/" class="back-link">← 返回服务大厅</router-link>
  </div>
</template>

<script setup>
const sections = [
  {
    key: 'medical',
    icon: '🏥',
    title: '医疗指南',
    desc: '就医流程、健康保险、常用医院信息',
    items: [
      { title: '国民健康保险', content: '留学生加入国保后，个人负担医疗费30%。入境后14天内到区役所办理。', link: 'https://www.city.sendai.jp/', linkText: '仙台市役所' },
      { title: '常用医院', content: '东北大学医院（星陵校区）、仙台市立病院均可就诊。建议提前预约，携带保险证和在留卡。' },
      { title: '急诊/夜间', content: '急救电话 119，夜间急诊可拨打 #7119 咨询。仙台市急患中心（若林区）提供夜间诊疗。' },
    ],
  },
  {
    key: 'housing',
    icon: '🏠',
    title: '租房与打工',
    desc: '租房流程、打工签证办理、注意事项',
    items: [
      { title: '租房流程', content: '通常需要：在留卡、银行账户、保证人（可用保证会社代替）。推荐通过学校国际交流课或 SUUMO/HOME\'S 等平台找房。' },
      { title: '打工许可', content: '留学签证需在入管局申请「资格外活动许可」，每周不超过28小时（假期可40小时）。入境时在机场可一并申请。' },
    ],
  },
  {
    key: 'license',
    icon: '🛵',
    title: '原付驾照',
    desc: '原付免许取得流程、考试要点',
    items: [
      { title: '报名流程', content: '携带在留卡、住民票（3个月内）、证件照到宫城县运転免許中心（泉区）申请。当天笔试+实技讲习即可取得。' },
      { title: '考试内容', content: '50道选择题（日语），30分钟内完成，45分以上合格。可提前在网上找模拟题练习。费用约7,800日元。' },
    ],
  },
  {
    key: 'vpn',
    icon: '🌐',
    title: 'VPN / 校园网络',
    desc: '东北大学VPN设置与校内网络',
    items: [
      { title: 'VPN 连接', content: '东北大学提供 SSL-VPN 服务，校外可访问校内资源（图书馆数据库、论文下载等）。需使用大学 Sub-ID 登录。' },
      { title: 'eduroam', content: '校内 Wi-Fi 使用 eduroam，用东北大学邮箱账号登录。其他 eduroam 成员校也可使用。' },
    ],
  },
  {
    key: 'food',
    icon: '🍜',
    title: '美食地图',
    desc: '仙台周边中华料理与推荐餐厅',
    items: [],
  },
]
</script>

<style scoped>
.hero { margin-bottom: 24px; }
.hero h1 { font-size: 26px; font-weight: 700; }
.hero p { color: var(--c-text-2); font-size: 14px; margin-top: 4px; }
.guide-section { margin-bottom: 16px; }
.section-head { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 16px; }
.section-icon { font-size: 28px; flex-shrink: 0; margin-top: 2px; }
.section-head h2 { font-size: 18px; font-weight: 700; }
.section-desc { font-size: 13px; color: var(--c-text-2); margin-top: 2px; }
.section-body { display: flex; flex-direction: column; gap: 14px; }
.info-item { padding: 12px 14px; background: var(--c-bg); border-radius: var(--radius-sm); }
.info-item h3 { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.info-item p { font-size: 13px; color: var(--c-text-2); line-height: 1.6; }
.info-item a { display: inline-block; margin-top: 6px; font-size: 13px; font-weight: 500; }
.placeholder { font-size: 13px; color: var(--c-text-3); text-align: center; padding: 20px; }
.back-link { display: block; text-align: center; font-size: 13px; margin-top: 24px; color: var(--c-text-3); }
</style>
