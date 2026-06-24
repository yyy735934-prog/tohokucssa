<template>
  <div class="page">
    <div v-if="done" class="card center-card">
      <div class="icon-circle icon-success">✓</div>
      <h1 class="title">注册成功</h1>
      <p class="sub">你的主理人账号已创建，活动已绑定到你的名下</p>
      <a :href="adminUrl" class="btn btn-primary" style="margin-top:20px;display:inline-block">进入管理后台</a>
    </div>

    <div v-else-if="invalid" class="card center-card">
      <div class="icon-circle" style="background:#fff3f3;color:#ff3b30">✕</div>
      <h1 class="title">链接无效</h1>
      <p class="sub">{{ invalidMsg }}</p>
      <router-link to="/" class="btn btn-outline" style="margin-top:20px;display:inline-block">返回首页</router-link>
    </div>

    <template v-else-if="invite">
      <h1 class="page-title">注册活动主理人</h1>
      <p class="page-sub">注册后你可以管理活动、查看报名、签到等</p>

      <form class="card" @submit.prevent="submit" style="margin-top:16px">
        <div class="field">
          <label class="label">邮箱</label>
          <input :value="invite.email" disabled />
        </div>
        <div class="field">
          <label class="label">你的姓名</label>
          <input v-model="form.display_name" :placeholder="invite.name" />
        </div>
        <div class="field">
          <label class="label">设置密码 *</label>
          <input v-model="form.password" type="password" required minlength="6" placeholder="至少6位" />
        </div>
        <div class="field">
          <label class="label">确认密码 *</label>
          <input v-model="form.confirm" type="password" required minlength="6" placeholder="再输入一次" />
        </div>
        <p v-if="error" class="error">{{ error }}</p>
        <button type="submit" class="btn btn-primary" :disabled="busy" style="margin-top:8px">
          {{ busy ? '注册中…' : '注册' }}
        </button>
      </form>
    </template>

    <div v-else class="empty"><p>加载中…</p></div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const token = route.query.token
const invite = ref(null)
const invalid = ref(false)
const invalidMsg = ref('')
const done = ref(false)
const error = ref('')
const busy = ref(false)
const form = reactive({ display_name: '', password: '', confirm: '' })

const adminUrl = computed(() => `${location.origin}/admin/`)

onMounted(async () => {
  if (!token) { invalid.value = true; invalidMsg.value = '缺少邀请码'; return }
  try {
    const res = await fetch(`/api/auth/invite-info?token=${encodeURIComponent(token)}`)
    const data = await res.json()
    if (!data.ok) { invalid.value = true; invalidMsg.value = data.message; return }
    invite.value = data
    form.display_name = data.name || ''
  } catch { invalid.value = true; invalidMsg.value = '网络错误' }
})

async function submit() {
  error.value = ''
  if (form.password !== form.confirm) { error.value = '两次密码不一致'; return }
  busy.value = true
  try {
    const res = await fetch('/api/auth/register-invite', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, password: form.password, display_name: form.display_name })
    })
    const data = await res.json()
    if (!data.ok) { error.value = data.message; busy.value = false; return }
    localStorage.setItem('auth', JSON.stringify({
      token: data.token, email: data.email, role: data.role, is_super: data.is_super
    }))
    done.value = true
  } catch (e) { error.value = e.message }
  busy.value = false
}
</script>

<style scoped>
.page-title { font-size: 22px; font-weight: 700; }
.page-sub { font-size: 14px; color: var(--c-text-2); margin-top: 4px; }
.center-card { text-align: center; padding: 40px 20px; margin-top: 20px; }
.title { font-size: 22px; font-weight: 700; }
.sub { font-size: 14px; color: var(--c-text-2); margin-top: 8px; }
.icon-circle {
  width: 56px; height: 56px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 28px; font-weight: 700; margin: 0 auto 16px;
}
.icon-success { background: var(--c-success-bg); color: var(--c-success); }
</style>
