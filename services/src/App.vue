<template>
  <nav class="nav">
    <div class="nav-inner">
      <router-link to="/" class="nav-brand">公益服务</router-link>
      <div class="nav-links">
        <router-link to="/">服务大厅</router-link>
        <router-link to="/bus">校车查询</router-link>
        <a :href="eventsUrl">活动平台</a>
      </div>
    </div>
  </nav>
  <main>
    <router-view />
  </main>
</template>

<script setup>
const eventsUrl = 'https://events.tohokucssa.org'
</script>
