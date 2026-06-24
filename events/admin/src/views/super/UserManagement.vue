<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">用户管理</h1>
        <p class="page-sub">管理后台用户和角色</p>
      </div>
      <button class="btn btn-primary" @click="showCreate = true">添加用户</button>
    </div>

    <!-- Pending role requests -->
    <div class="card mb-16">
      <h3 style="font-size:15px;font-weight:600;margin-bottom:12px">待审批的角色申请</h3>
      <div v-if="roleRequests.length" class="req-list">
        <div v-for="r in roleRequests" :key="r.key" class="req-item">
          <div class="req-info">
            <span style="font-weight:500">{{ r.display_name || r.email }}</span>
            <span v-if="r.display_name" style="color:var(--c-text-2);font-size:13px">{{ r.email }}</span>
            <span class="badge" :class="r.role === 'reviewer' ? 'badge-pending' : 'badge-open'">申请{{ r.roleName }}</span>
          </div>
          <div class="flex gap-8">
            <button class="btn btn-primary btn-sm" :disabled="busy" @click="approveRole(r)">批准</button>
            <button class="btn btn-outline btn-sm" :disabled="busy" @click="rejectRole(r)">拒绝</button>
          </div>
        </div>
      </div>
      <p v-else style="font-size:13px;color:var(--c-text-3)">暂无待审批的角色申请</p>

      <!-- History -->
      <div v-if="roleHistory.length" style="margin-top:16px;border-top:1px solid var(--c-border);padding-top:14px">
        <h4 style="font-size:13px;font-weight:600;color:var(--c-text-2);margin-bottom:10px">审批记录（近30天）</h4>
        <div class="req-list">
          <div v-for="h in roleHistory" :key="h.key" class="req-item history-item">
            <div class="req-info">
              <span style="font-weight:500">{{ h.display_name || h.email }}</span>
              <span v-if="h.display_name" style="color:var(--c-text-2);font-size:13px">{{ h.email }}</span>
              <span class="badge" :class="h.decision === 'approved' ? 'badge-open' : 'badge-draft'">
                {{ h.decision === 'approved' ? '已批准' : '已拒绝' }} · {{ h.roleName }}
              </span>
              <span style="font-size:12px;color:var(--c-text-3)">{{ formatDT(h.decided_at) }} · {{ h.decided_by }}</span>
            </div>
            <button v-if="h.decision === 'approved'" class="btn btn-outline btn-sm" style="color:var(--c-danger)"
              :disabled="busy" @click="revokeRole(h)">撤回</button>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div v-if="loading" class="empty"><p>加载中…</p></div>
      <div v-else-if="!users.length" class="empty"><p>暂无用户</p></div>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>邮箱</th>
              <th>显示名</th>
              <th>角色</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.id">
              <td>{{ u.id }}</td>
              <td style="font-weight:500">{{ u.email }}</td>
              <td>{{ u.display_name || '—' }}</td>
              <td>
                <span v-if="u.is_super" class="badge" style="background:#fef3c7;color:#92400e">超级管理员</span>
                <span v-else class="badge" :class="`badge-${u.role}`">{{ u.role === 'reviewer' ? '审核员' : u.role === 'host' ? '主理人' : '普通用户' }}</span>
              </td>
              <td>{{ formatDT(u.created_at) }}</td>
              <td>
                <div class="flex gap-8">
                  <button v-if="auth.isSuper && !u.is_super" class="btn btn-outline btn-sm" @click="startEdit(u)">编辑</button>
                  <button v-if="auth.isSuper && !u.is_super" class="btn btn-outline btn-sm" @click="startResetPw(u)">重置密码</button>
                  <button v-if="!u.is_super" class="btn btn-outline btn-sm" style="color:var(--c-danger)" @click="deleteUser(u)">删除</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create user modal -->
    <div v-if="showCreate" class="modal-overlay" @click.self="showCreate = false">
      <div class="modal">
        <h3 class="modal-title">添加用户</h3>
        <form @submit.prevent="createUser">
          <div class="field">
            <label class="label">邮箱 *</label>
            <input v-model="createForm.email" type="email" required />
          </div>
          <div class="field">
            <label class="label">显示名</label>
            <input v-model="createForm.display_name" />
          </div>
          <div class="field">
            <label class="label">密码 *</label>
            <input v-model="createForm.password" type="password" required minlength="6" />
          </div>
          <div class="field">
            <label class="label">角色</label>
            <select v-model="createForm.role">
              <option value="host">活动主理人</option>
              <option v-if="auth.isSuper" value="reviewer">审核员</option>
            </select>
          </div>
          <p v-if="createError" class="error">{{ createError }}</p>
          <div class="modal-actions">
            <button type="button" class="btn btn-outline" @click="showCreate = false">取消</button>
            <button type="submit" class="btn btn-primary" :disabled="busy">创建</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Edit user modal -->
    <div v-if="editTarget" class="modal-overlay" @click.self="editTarget = null">
      <div class="modal">
        <h3 class="modal-title">编辑用户</h3>
        <form @submit.prevent="updateUser">
          <div class="field">
            <label class="label">邮箱</label>
            <input :value="editTarget.email" disabled />
          </div>
          <div class="field">
            <label class="label">显示名</label>
            <input v-model="editForm.display_name" />
          </div>
          <div class="field">
            <label class="label">角色</label>
            <select v-model="editForm.role">
              <option value="user">普通用户</option>
              <option value="host">活动主理人</option>
              <option value="reviewer">审核员</option>
            </select>
          </div>
          <p v-if="editError" class="error">{{ editError }}</p>
          <div class="modal-actions">
            <button type="button" class="btn btn-outline" @click="editTarget = null">取消</button>
            <button type="submit" class="btn btn-primary" :disabled="busy">保存</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Reset password modal -->
    <div v-if="resetTarget" class="modal-overlay" @click.self="resetTarget = null">
      <div class="modal">
        <h3 class="modal-title">重置密码</h3>
        <p style="margin-bottom:12px">为 {{ resetTarget.email }} 设置新密码</p>
        <form @submit.prevent="doResetPw">
          <div class="field">
            <label class="label">新密码</label>
            <input v-model="resetPw" type="password" required minlength="6" />
          </div>
          <p v-if="resetError" class="error">{{ resetError }}</p>
          <div class="modal-actions">
            <button type="button" class="btn btn-outline" @click="resetTarget = null">取消</button>
            <button type="submit" class="btn btn-primary" :disabled="busy">确认</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { api } from '../../api.js'
import { auth } from '../../lib/auth.js'
import { showToast } from '../../lib/toast.js'
import { formatDateTime } from '../../lib/format.js'

const users = ref([])
const roleRequests = ref([])
const roleHistory = ref([])
const loading = ref(true)
const busy = ref(false)

const showCreate = ref(false)
const createForm = reactive({ email: '', display_name: '', password: '', role: 'host' })
const createError = ref('')

const editTarget = ref(null)
const editForm = reactive({ display_name: '', role: '' })
const editError = ref('')

const resetTarget = ref(null)
const resetPw = ref('')
const resetError = ref('')

function formatDT(ts) { return formatDateTime(ts) }

async function load() {
  try {
    const data = await api.listUsers()
    users.value = data.users
  } catch {}
  loading.value = false
}

async function loadRoleRequests() {
  try {
    const data = await api.listRoleRequests()
    roleRequests.value = data.requests || []
  } catch {}
}

async function loadRoleHistory() {
  try {
    const data = await api.listRoleHistory()
    roleHistory.value = data.history || []
  } catch {}
}

onMounted(() => { load(); loadRoleRequests(); loadRoleHistory() })

async function approveRole(r) {
  busy.value = true
  try {
    await api.approveRole(r.email, r.role)
    showToast(`已批准 ${r.display_name || r.email} 为${r.roleName}`)
    loadRoleRequests(); loadRoleHistory(); load()
  } catch (e) { showToast(e.message, 'error') }
  busy.value = false
}

async function rejectRole(r) {
  if (!confirm(`确定拒绝 ${r.display_name || r.email} 的${r.roleName}申请？`)) return
  busy.value = true
  try {
    await api.rejectRole(r.email, r.role)
    showToast('已拒绝')
    loadRoleRequests(); loadRoleHistory()
  } catch (e) { showToast(e.message, 'error') }
  busy.value = false
}

async function revokeRole(h) {
  if (!confirm(`确定撤回对 ${h.display_name || h.email} 的${h.roleName}批准？用户角色将被降级。`)) return
  busy.value = true
  try {
    await api.revokeRole(h.email, h.role)
    showToast(`已撤回 ${h.display_name || h.email} 的${h.roleName}权限`)
    loadRoleHistory(); load()
  } catch (e) { showToast(e.message, 'error') }
  busy.value = false
}

async function createUser() {
  createError.value = ''
  busy.value = true
  try {
    await api.createUser(createForm)
    showToast('用户已创建')
    showCreate.value = false
    createForm.email = ''; createForm.display_name = ''; createForm.password = ''; createForm.role = 'host'
    await load()
  } catch (e) { createError.value = e.message }
  busy.value = false
}

function startEdit(u) {
  editTarget.value = u
  editForm.display_name = u.display_name || ''
  editForm.role = u.role
  editError.value = ''
}

async function updateUser() {
  editError.value = ''
  busy.value = true
  try {
    await api.updateUser(editTarget.value.id, editForm)
    showToast('已更新')
    editTarget.value = null
    await load()
  } catch (e) { editError.value = e.message }
  busy.value = false
}

function startResetPw(u) {
  resetTarget.value = u
  resetPw.value = ''
  resetError.value = ''
}

async function doResetPw() {
  resetError.value = ''
  busy.value = true
  try {
    await api.resetPassword(resetTarget.value.id, resetPw.value)
    showToast('密码已重置')
    resetTarget.value = null
  } catch (e) { resetError.value = e.message }
  busy.value = false
}

async function deleteUser(u) {
  if (!confirm(`确定删除用户 ${u.email}？`)) return
  busy.value = true
  try { await api.deleteUser(u.id); showToast('已删除'); await load() }
  catch (e) { showToast(e.message, 'error') }
  busy.value = false
}
</script>

<style scoped>
.req-list { display: flex; flex-direction: column; gap: 10px; }
.req-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px; border: 1px solid var(--c-border); border-radius: 8px;
  flex-wrap: wrap; gap: 8px;
}
.req-info { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.history-item { background: var(--c-bg); border-color: var(--c-border); }
</style>
