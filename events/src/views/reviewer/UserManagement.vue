<template>
  <div class="container">
    <div class="flex-between mb-16">
      <h1 style="font-size:20px">用户管理</h1>
      <button class="btn-primary" @click="showAdd = !showAdd">+ 添加用户</button>
    </div>

    <div v-if="showAdd" class="card mb-16">
      <h3 style="font-size:15px;margin-bottom:12px">添加管理员</h3>
      <form @submit.prevent="addUser">
        <div class="form-row">
          <div class="form-group" style="flex:2">
            <label>邮箱 *</label>
            <input v-model="form.email" type="email" required placeholder="user@example.com" />
          </div>
          <div class="form-group" style="flex:1">
            <label>显示名</label>
            <input v-model="form.display_name" placeholder="选填" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group" style="flex:1">
            <label>角色 *</label>
            <select v-model="form.role">
              <option value="host">主理人</option>
              <option value="reviewer">审核负责人</option>
            </select>
          </div>
          <div class="form-group" style="flex:1">
            <label>初始密码 *</label>
            <input v-model="form.password" required placeholder="不少于6位" minlength="6" />
          </div>
        </div>
        <p v-if="addError" style="color:var(--c-danger);font-size:13px;margin-bottom:8px">{{ addError }}</p>
        <p v-if="addOk" style="color:var(--c-success);font-size:13px;margin-bottom:8px">{{ addOk }}</p>
        <div class="flex gap-8">
          <button type="submit" class="btn-primary" :disabled="adding">{{ adding ? '添加中…' : '添加' }}</button>
          <button type="button" class="btn-outline" @click="showAdd = false">取消</button>
        </div>
      </form>
    </div>

    <div v-if="loading" class="empty-state">加载中…</div>
    <div v-else-if="!users.length" class="empty-state">暂无用户</div>

    <div v-else class="card">
      <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr><th>邮箱</th><th>显示名</th><th>角色</th><th>创建时间</th><th>操作</th></tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td>{{ u.email }}</td>
            <td>{{ u.display_name || '-' }}</td>
            <td><span class="badge" :class="u.role==='reviewer'?'badge-open':'badge-active'">{{ u.role==='reviewer'?'负责人':'主理人' }}</span></td>
            <td>{{ formatTime(u.created_at) }}</td>
            <td>
              <button class="btn-sm" style="color:var(--c-danger);background:none" @click="removeUser(u)" :disabled="deleting">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../../services/api.js'
import { toast } from '../../lib/toast.js'
import { formatTime } from '../../lib/format.js'

const users = ref([])
const loading = ref(true)
const showAdd = ref(false)
const adding = ref(false)
const deleting = ref(false)
const addError = ref('')
const addOk = ref('')
const form = ref({ email: '', display_name: '', role: 'host', password: '' })

async function loadUsers() {
  try {
    const data = await api.listUsers()
    users.value = data.users
  } catch { /* */ }
  loading.value = false
}

onMounted(loadUsers)

async function addUser() {
  addError.value = ''
  addOk.value = ''
  adding.value = true
  try {
    await api.addUser(form.value)
    toast(`已添加 ${form.value.email}`)
    form.value = { email: '', display_name: '', role: 'host', password: '' }
    showAdd.value = false
    await loadUsers()
  } catch (e) { addError.value = e.message }
  adding.value = false
}

async function removeUser(u) {
  if (!confirm(`确定删除用户 ${u.email}?`)) return
  deleting.value = true
  try {
    await api.deleteUser(u.id)
    toast('已删除')
    await loadUsers()
  } catch (e) { toast(e.message, 'error') }
  deleting.value = false
}
</script>

<style scoped>
.form-row { display: flex; gap: 12px; }
@media (max-width: 600px) { .form-row { flex-direction: column; } }
.table-wrap { overflow-x: auto; margin: 0 -16px; padding: 0 16px; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 500px; }
.data-table th, .data-table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--c-border); }
.data-table th { font-weight: 600; color: var(--c-text-secondary); font-size: 12px; }
</style>
