<template>
  <div class="page">
    <div class="hero">
      <h1>🆘 灾害应对指南</h1>
      <p>地震、台风等自然灾害的应急信息与紧急联络</p>
    </div>

    <div class="card emergency-card">
      <h2>紧急联络电话</h2>
      <div class="contact-grid">
        <div class="contact-item contact-critical">
          <span class="contact-label">警察</span>
          <a href="tel:110" class="contact-number">110</a>
        </div>
        <div class="contact-item contact-critical">
          <span class="contact-label">消防 / 急救</span>
          <a href="tel:119" class="contact-number">119</a>
        </div>
        <div class="contact-item">
          <span class="contact-label">急病咨询</span>
          <a href="tel:#7119" class="contact-number">#7119</a>
        </div>
        <div class="contact-item">
          <span class="contact-label">中国驻仙台总领馆</span>
          <a href="tel:022-261-6255" class="contact-number">022-261-6255</a>
        </div>
        <div class="contact-item">
          <span class="contact-label">仙台国际交流中心</span>
          <a href="tel:022-224-1919" class="contact-number">022-224-1919</a>
        </div>
        <div class="contact-item">
          <span class="contact-label">NTT灾害留言</span>
          <a href="tel:171" class="contact-number">171</a>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>地震应对</h2>
      <div class="steps">
        <div class="step"><span class="step-num">1</span><div><strong>摇晃时</strong><p>蹲下、护住头部、抓紧桌腿。远离窗户和书架。不要慌张跑出建筑。</p></div></div>
        <div class="step"><span class="step-num">2</span><div><strong>摇晃停止后</strong><p>关闭煤气和电源。打开门确保逃生通道。穿鞋防止碎玻璃。</p></div></div>
        <div class="step"><span class="step-num">3</span><div><strong>确认安全后</strong><p>到最近的避难所集合。用 NTT 171 留言或 LINE 向亲友报平安。确认学校紧急通知。</p></div></div>
      </div>
    </div>

    <div class="card">
      <h2>有用链接</h2>
      <ul class="link-list">
        <li><a href="https://www.city.sendai.jp/kikikanri/" target="_blank" rel="noreferrer">仙台市危机管理 ↗</a></li>
        <li><a href="https://www.jma.go.jp/jma/en/Activities/earthquake.html" target="_blank" rel="noreferrer">日本气象厅（英文） ↗</a></li>
        <li><a href="https://www.nhk.or.jp/kishou-saigai/" target="_blank" rel="noreferrer">NHK 防灾情报 ↗</a></li>
      </ul>
    </div>

    <router-link to="/" class="back-link">← 返回服务大厅</router-link>
  </div>
</template>

<style scoped>
.hero { margin-bottom: 24px; }
.hero h1 { font-size: 26px; font-weight: 700; }
.hero p { color: var(--c-text-2); font-size: 14px; margin-top: 4px; }
.emergency-card h2, .card h2 { font-size: 17px; font-weight: 700; margin-bottom: 14px; }
.card + .card { margin-top: 14px; }

.contact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
@media (max-width: 480px) { .contact-grid { grid-template-columns: 1fr; } }
.contact-item { padding: 12px 14px; background: var(--c-bg); border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center; }
.contact-critical { background: #fef2f2; }
.contact-label { font-size: 13px; font-weight: 500; color: var(--c-text-2); }
.contact-number { font-size: 20px; font-weight: 700; color: var(--c-text); font-variant-numeric: tabular-nums; }
.contact-critical .contact-number { color: var(--c-danger); }

.steps { display: flex; flex-direction: column; gap: 12px; }
.step { display: flex; gap: 12px; align-items: flex-start; }
.step-num { width: 28px; height: 28px; border-radius: 50%; background: var(--c-primary); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; flex-shrink: 0; }
.step strong { font-size: 14px; display: block; }
.step p { font-size: 13px; color: var(--c-text-2); margin-top: 2px; line-height: 1.5; }

.link-list { list-style: none; display: flex; flex-direction: column; gap: 8px; }
.link-list li a { font-size: 14px; font-weight: 500; }

.back-link { display: block; text-align: center; font-size: 13px; margin-top: 24px; color: var(--c-text-3); }
</style>
