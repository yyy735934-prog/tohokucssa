<template>
  <nav class="top-nav">
    <strong class="nav-brand">物资租赁</strong>
    <div class="nav-links">
      <router-link to="/">首页</router-link>
      <router-link to="/my">我的借用</router-link>
      <a href="https://services.tohokucssa.org" target="_blank" rel="noreferrer">服务大厅</a>
    </div>
  </nav>
  <main class="container">
    <router-view />
  </main>
</template>

<style scoped>
.top-nav { display: flex; align-items: center; gap: 20px; padding: 14px var(--space-page); border-bottom: 2px solid var(--c-primary); }
.nav-brand { font-size: 17px; }
.nav-links { display: flex; gap: 18px; font-size: 14px; font-weight: 500; }
.nav-links a { color: var(--c-text-2); }
.nav-links a.router-link-active { color: var(--c-text); text-decoration: underline; text-underline-offset: 4px; }
</style>
