<template>
  <div v-if="!event" class="empty"><p>{{ error || '加载中…' }}</p></div>
  <div v-else>
    <div class="page-header">
      <div>
        <h1 class="page-title">{{ event.title }}</h1>
        <p class="page-sub">
          {{ event.event_date }}<span v-if="event.location"> · {{ event.location }}</span>
        </p>
      </div>
      <div class="flex gap-8" style="flex-wrap:wrap">
        <router-link v-if="event.status === 'draft'" :to="`/admin/events/${event.id}/edit`" class="btn btn-outline btn-sm">编辑</router-link>
        <button v-if="event.status === 'draft'" class="btn btn-primary btn-sm" @click="submitEvent" :disabled="busy">提交审核</button>
        <button v-if="event.status === 'pending'" class="btn btn-outline btn-sm" @click="withdrawEvent" :disabled="busy">撤回</button>
        <button v-if="event.status === 'open' && !event.capacity && !isLocked" class="btn btn-outline btn-sm" style="color:var(--c-warning)" @click="lockSignups" :disabled="busy">锁定报名</button>
        <button v-if="event.status === 'open' && isLocked" class="btn btn-outline btn-sm" style="color:var(--c-success)" @click="unlockSignups" :disabled="busy">解锁报名</button>
        <button v-if="event.status === 'open'" class="btn btn-primary btn-sm" @click="activateEvent" :disabled="busy">开始活动</button>
        <button v-if="event.status === 'active'" class="btn btn-outline btn-sm" @click="deactivateEvent" :disabled="busy">撤回开始</button>
        <button v-if="event.status === 'active'" class="btn btn-danger btn-sm" @click="closeEvent" :disabled="busy">结束活动</button>
        <button v-if="auth.isReviewer" class="btn btn-outline btn-sm" @click="togglePin" :disabled="busy">
          {{ event.pinned ? '取消置顶' : '置顶' }}
        </button>
        <button class="btn btn-outline btn-sm" @click="duplicateEvent" :disabled="busy">复制</button>
        <button v-if="event.status === 'draft'" class="btn btn-danger btn-sm" @click="deleteEvent" :disabled="busy">删除</button>
      </div>
    </div>

    <!-- Workflow progress bar -->
    <div class="card mb-16 workflow-bar">
      <div class="wf-steps">
        <div class="wf-step" :class="{ active: stepIndex >= 0, current: event.status === 'draft' }">
          <div class="wf-dot"></div>
          <span>草稿</span>
        </div>
        <div class="wf-line" :class="{ done: stepIndex >= 1 }"></div>
        <div class="wf-step" :class="{ active: stepIndex >= 1, current: event.status === 'pending' }">
          <div class="wf-dot"></div>
          <span>审核中</span>
        </div>
        <div class="wf-line" :class="{ done: stepIndex >= 2 }"></div>
        <div class="wf-step" :class="{ active: stepIndex >= 2, current: event.status === 'open' }">
          <div class="wf-dot"></div>
          <span>报名中</span>
        </div>
        <div class="wf-line" :class="{ done: stepIndex >= 3 }"></div>
        <div class="wf-step" :class="{ active: stepIndex >= 3, current: event.status === 'active' }">
          <div class="wf-dot"></div>
          <span>进行中</span>
        </div>
        <div class="wf-line" :class="{ done: stepIndex >= 4 }"></div>
        <div class="wf-step" :class="{ active: stepIndex >= 4, current: event.status === 'closed' }">
          <div class="wf-dot"></div>
          <span>已结束</span>
        </div>
      </div>
      <p v-if="event.status === 'draft' && event.reject_reason" class="wf-hint" style="color:var(--c-danger)">
        审核被驳回，请修改后重新提交
      </p>
      <p v-else-if="event.status === 'draft'" class="wf-hint">
        活动为草稿状态，编辑完成后点击「提交审核」
      </p>
      <p v-else-if="event.status === 'pending'" class="wf-hint">
        已提交审核，等待审核员审批中…
      </p>
      <p v-else-if="event.status === 'open'" class="wf-hint">
        活动已开放报名，可以分享链接给参与者。活动当天点击「开始活动」进入签到模式
      </p>
      <p v-else-if="event.status === 'active'" class="wf-hint">
        活动进行中，可以扫码签到。结束后点击「结束活动」。无人签到时可点击「撤回开始」恢复报名
      </p>
    </div>

    <!-- Lock banner -->
    <div v-if="isLocked && event.status === 'open'" class="card mb-16 lock-banner">
      <span class="lock-banner-icon">🔒</span>
      <span>报名已锁定（当前 {{ signups.length }} 人），新报名将被拒绝</span>
    </div>

    <!-- Event Info Card (inline editable) -->
    <div class="card mb-16">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <h2 style="font-size:16px;font-weight:600">活动信息</h2>
        <div class="flex gap-8">
          <button v-if="!editingInfo" class="btn btn-outline btn-sm" @click="startEditInfo">编辑信息</button>
          <button v-if="editingInfo" class="btn btn-primary btn-sm" @click="saveInfo" :disabled="busy">保存</button>
          <button v-if="editingInfo" class="btn btn-outline btn-sm" @click="editingInfo = false">取消</button>
        </div>
      </div>

      <!-- View mode -->
      <div v-if="!editingInfo" class="info-grid">
        <div class="info-item">
          <div class="info-label">活动名称</div>
          <div class="info-value">{{ event.title }}</div>
        </div>
        <div class="info-item">
          <div class="info-label">活动日期</div>
          <div class="info-value">{{ event.event_date }}</div>
        </div>
        <div class="info-item">
          <div class="info-label">活动地点</div>
          <div class="info-value">{{ event.location || '—' }}</div>
        </div>
        <div class="info-item">
          <div class="info-label">报名上限</div>
          <div class="info-value">{{ event.capacity || '不限' }}</div>
        </div>
        <div class="info-item">
          <div class="info-label">活动类型</div>
          <div class="info-value">{{ activityTypeLabel || '未选择' }}</div>
        </div>
        <div v-if="event.content" class="info-item" style="grid-column:1/-1">
          <div class="info-label">活动详情</div>
          <div class="info-value" style="white-space:pre-wrap">{{ event.content }}</div>
        </div>
        <div v-if="event.notes" class="info-item" style="grid-column:1/-1">
          <div class="info-label">备注信息</div>
          <div class="info-value" style="white-space:pre-wrap">{{ event.notes }}</div>
        </div>
        <div v-if="parsedCustomFields.length" class="info-item" style="grid-column:1/-1">
          <div class="info-label">自定义报名字段</div>
          <div class="cf-preview">
            <span v-for="f in parsedCustomFields" :key="f.label" class="cf-tag">
              {{ f.label }}
              <span class="cf-tag-type">{{ f.type === 'select' ? '下拉' : f.type === 'textarea' ? '多行' : '文本' }}</span>
              <span v-if="f.required" class="cf-tag-req">必填</span>
            </span>
          </div>
        </div>
      </div>

      <!-- Edit mode -->
      <div v-else>
        <div class="edit-grid">
          <div class="field">
            <label class="label">活动名称 *</label>
            <input v-model="infoForm.title" required />
          </div>
          <div class="field">
            <label class="label">活动日期 *</label>
            <input v-model="infoForm.event_date" required placeholder="如: 2026-07-15 14:00" />
          </div>
          <div class="field">
            <label class="label">活动地点</label>
            <input v-model="infoForm.location" placeholder="地点" />
          </div>
          <div class="field">
            <label class="label">报名上限</label>
            <input v-model.number="infoForm.capacity" type="number" min="0" placeholder="不限" />
          </div>
        </div>
        <div class="field">
          <label class="label">活动类型</label>
          <div class="type-grid-sm">
            <div v-for="t in activityTypes" :key="t.value" class="type-chip"
              :class="{ selected: infoForm.activity_type === t.value }"
              @click="selectInfoType(t.value)">
              <span class="type-chip-icon">{{ t.icon }}</span>
              {{ t.label }}
            </div>
            <div class="type-chip"
              :class="{ selected: infoForm.activity_type && !knownTypeValues.includes(infoForm.activity_type) }"
              @click="selectInfoType('__custom')">
              <span class="type-chip-icon">+</span> 自定义
            </div>
          </div>
          <input v-if="infoForm.activity_type && !knownTypeValues.includes(infoForm.activity_type)"
            v-model="infoForm.activity_type" class="mt-8"
            placeholder="输入自定义活动类型，如：运动会、读书会" />
        </div>
        <div class="field">
          <label class="label">活动详情</label>
          <textarea v-model="infoForm.content" rows="3" placeholder="活动介绍"></textarea>
        </div>
        <div class="field">
          <label class="label">备注信息</label>
          <textarea v-model="infoForm.notes" rows="2" placeholder="参与者须知"></textarea>
        </div>
        <div class="field">
          <label class="label">自定义报名字段</label>
          <p class="field-hint">报名表已默认包含：姓名、姓名假名、性别、所属学校、学号（東北大学）、邮箱、中国手机号、日本电话号、微信号，请勿重复添加，只需补充活动特有的信息</p>
          <div v-for="(cf, i) in editCustomFields" :key="i" class="cf-row">
            <input v-model="cf.label" placeholder="字段名称，如：学号" style="flex:2" />
            <select v-model="cf.type" style="flex:1">
              <option value="text">文本</option>
              <option value="select">下拉选择</option>
              <option value="textarea">多行文本</option>
            </select>
            <label class="cf-required-label"><input type="checkbox" v-model="cf.required" /> 必填</label>
            <button type="button" class="btn btn-outline btn-sm" @click="editCustomFields.splice(i, 1)">删除</button>
          </div>
          <div v-for="(cf, i) in editCustomFields" :key="'opt-'+i">
            <div v-if="cf.type === 'select'" class="cf-options">
              <label class="label" style="font-size:12px">「{{ cf.label || '下拉' }}」选项（逗号分隔）</label>
              <input v-model="cf.optionsStr" placeholder="选项1, 选项2, 选项3" />
            </div>
          </div>
          <button type="button" class="btn btn-outline btn-sm mt-12" @click="editCustomFields.push({ label: '', type: 'text', required: false, optionsStr: '' })">+ 添加字段</button>
        </div>
      </div>
    </div>

    <!-- Event Image -->
    <div class="card mb-16">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <h2 style="font-size:16px;font-weight:600">活动图片</h2>
        <span style="font-size:12px;color:var(--c-text-3)">可选，上传后将在报名页展示</span>
      </div>
      <div v-if="event.image_key" class="img-preview">
        <img :src="`/api/images/serve/${event.id}`" alt="活动图片" />
        <button class="btn btn-outline btn-sm img-delete" @click="deleteImage" :disabled="busy">删除图片</button>
      </div>
      <div v-else class="img-upload-area" @click="$refs.imageInput.click()" @dragover.prevent @drop.prevent="handleDrop">
        <div class="img-upload-icon">+</div>
        <div class="img-upload-text">点击或拖拽上传图片</div>
        <div class="img-upload-hint">支持 JPG/PNG/WebP/GIF，最大 5MB</div>
      </div>
      <input ref="imageInput" type="file" accept="image/*" style="display:none" @change="handleImageSelect" />
      <div v-if="imageUploading" style="font-size:13px;color:var(--c-text-2);margin-top:8px">上传中…</div>
    </div>

    <!-- AI Plan Section (prominent) -->
    <div class="plan-card mb-16">
      <div class="plan-header">
        <div class="plan-title-row">
          <span class="plan-icon">&#9997;&#65039;</span>
          <span class="plan-title">活动计划书</span>
          <span v-if="event.plan" class="plan-badge">已生成</span>
          <span v-else class="plan-badge plan-badge-empty">未生成</span>
        </div>
        <div class="flex gap-8 flex-wrap">
          <button v-if="event.plan && !editingPlan" class="btn btn-outline btn-sm" @click="startEditPlan">编辑</button>
          <button v-if="editingPlan" class="btn btn-primary btn-sm" @click="savePlan" :disabled="busy">保存</button>
          <button v-if="editingPlan" class="btn btn-outline btn-sm" @click="cancelEditPlan">取消</button>
          <button class="btn btn-sm" :class="event.plan ? 'btn-outline' : 'btn-primary'" @click="showAiModal = true" :disabled="aiLoading">
            {{ aiLoading ? '生成中…' : event.plan ? '重新生成' : 'AI 智能起草' }}
          </button>
          <button v-if="event.plan" class="btn btn-outline btn-sm" @click="copyPlan">复制</button>
          <button v-if="event.plan" class="btn btn-outline btn-sm" @click="downloadPlan">下载 .md</button>
        </div>
      </div>
      <div v-if="!event.plan && !aiLoading" class="plan-empty">
        <div class="plan-empty-icon">&#128221;</div>
        <div class="plan-empty-text">暂无计划书</div>
        <div class="plan-empty-hint">点击「AI 智能起草」，根据活动信息自动生成九节结构的完整计划书草稿</div>
      </div>
      <div v-if="aiLoading" class="plan-loading">
        <div class="plan-spinner"></div>
        <div>AI 正在生成计划书，请稍候…</div>
      </div>
      <textarea v-if="editingPlan" v-model="planEditText" rows="20" class="plan-editor"></textarea>
      <div v-else-if="event.plan" class="ai-preview" v-html="renderedPlan"></div>
    </div>

    <div v-if="event.submitter_name && !event.created_by" class="card mb-16" style="border-left:3px solid var(--c-primary)">
      <div class="label" style="margin-bottom:8px">公开申请信息</div>
      <div style="font-size:14px;display:grid;grid-template-columns:auto 1fr;gap:4px 16px">
        <span style="color:var(--c-text-2)">申请人</span><span>{{ event.submitter_name }}</span>
        <span style="color:var(--c-text-2)">邮箱</span><span>{{ event.submitter_email }}</span>
        <span v-if="event.submitter_phone" style="color:var(--c-text-2)">手机号</span>
        <span v-if="event.submitter_phone">{{ event.submitter_phone }}</span>
        <span v-if="event.submitter_note" style="color:var(--c-text-2)">备注</span>
        <span v-if="event.submitter_note">{{ event.submitter_note }}</span>
      </div>
    </div>

    <div v-if="event.reject_reason" class="card mb-16" style="border-left:3px solid var(--c-danger)">
      <strong>驳回原因：</strong>{{ event.reject_reason }}
    </div>

    <div v-if="event.reviewed_by" class="card mb-16" style="font-size:13px;color:var(--c-text-2)">
      <strong>审核记录：</strong>
      {{ event.status === 'draft' && event.reject_reason ? '驳回' : '通过' }}
      · 审核人 ID {{ event.reviewed_by }}
      · {{ event.reviewed_at ? formatDT(event.reviewed_at) : '' }}
    </div>

    <div v-if="['open','active'].includes(event.status) && signups.length" class="card mb-16">
      <div style="font-size:14px;font-weight:600;margin-bottom:10px">通知参与者</div>
      <div class="flex gap-8 flex-wrap">
        <button class="btn btn-outline btn-sm" @click="sendReminder" :disabled="busy">发送活动提醒</button>
        <button class="btn btn-outline btn-sm" @click="showNotifyModal = true">发送变更通知</button>
      </div>
    </div>

    <div class="stats">
      <div class="card stat-card">
        <div class="stat-value">{{ signups.length }}</div>
        <div class="stat-label">总报名{{ event.capacity ? ` / ${event.capacity}` : (event.lock_at ? ` / ${event.lock_at} 🔒` : '') }}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-value">{{ signups.filter(s => s.checked_in).length }}</div>
        <div class="stat-label">已签到</div>
      </div>
      <div class="card stat-card">
        <div class="stat-value">{{ signups.length ? Math.round(signups.filter(s => s.checked_in).length / signups.length * 100) : 0 }}%</div>
        <div class="stat-label">签到率</div>
      </div>
    </div>

    <!-- Signup list -->
    <div class="card">
      <div class="flex items-center justify-between mb-16" style="flex-wrap:wrap;gap:8px">
        <h2 style="font-size:16px;font-weight:600">报名列表</h2>
        <div class="flex gap-8" style="flex-wrap:wrap">
          <button v-if="event.status === 'open'" class="btn btn-primary btn-sm" @click="showInviteSignup = true; inviteTab = 'email'">邀请报名</button>
          <button class="btn btn-outline btn-sm" @click="showAddSignup = true">手动添加</button>
          <button v-if="['open','active'].includes(event.status)" class="btn btn-success btn-sm" @click="batchCheckin" :disabled="busy">全部签到</button>
          <button class="btn btn-outline btn-sm" @click="doExport('csv')">导出 CSV</button>
          <button class="btn btn-outline btn-sm" @click="doExport('json')">导出 JSON</button>
        </div>
      </div>

      <div v-if="!signups.length" class="empty"><p>暂无报名</p></div>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>姓名</th>
              <th>邮箱</th>
              <th>手机号</th>
              <th>签到</th>
              <th>报名时间</th>
              <th v-if="hasExtra">附加信息</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(s, i) in signups" :key="s.id">
              <td>{{ i + 1 }}</td>
              <td style="font-weight:500">{{ s.name }}</td>
              <td>{{ s.email }}</td>
              <td>{{ phoneDisplay(s) }}</td>
              <td>
                <span v-if="s.checked_in" class="badge badge-open">已签到</span>
                <span v-else class="badge badge-draft">未签到</span>
              </td>
              <td>{{ formatDT(s.created_at) }}</td>
              <td v-if="hasExtra">{{ formatExtra(s.data) }}</td>
              <td>
                <div class="flex gap-8">
                  <button v-if="!s.checked_in && ['open','active'].includes(event.status)"
                    class="btn btn-outline btn-sm" @click="checkinOne(s)" :disabled="busy">签到</button>
                  <button class="btn btn-outline btn-sm" style="color:var(--c-danger)"
                    @click="deleteSignup(s)" :disabled="busy">删除</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card mt-16">
      <h2 style="font-size:16px;font-weight:600;margin-bottom:12px">链接与入口</h2>
      <div class="link-grid">
        <div class="link-row">
          <div>
            <div class="link-title">活动报名页</div>
            <div class="link-desc">参与者看到的报名页面</div>
          </div>
          <div class="flex gap-8" style="flex-wrap:wrap;min-width:0">
            <input :value="shareUrl" readonly @click="$event.target.select()" class="link-input" />
            <button class="btn btn-outline btn-sm" @click="copyLink">复制</button>
            <a :href="shareUrl" target="_blank" class="btn btn-outline btn-sm">打开 ↗</a>
          </div>
        </div>
        <div class="link-row">
          <div>
            <div class="link-title">现场签到页</div>
            <div class="link-desc">参与者输入邮箱签到（备用方式）</div>
          </div>
          <div class="flex gap-8" style="flex-wrap:wrap;min-width:0">
            <input :value="checkinUrl" readonly @click="$event.target.select()" class="link-input" />
            <button class="btn btn-outline btn-sm" @click="copyCheckinLink">复制</button>
            <a :href="checkinUrl" target="_blank" class="btn btn-outline btn-sm">打开 ↗</a>
          </div>
        </div>
        <div class="link-row">
          <div>
            <div class="link-title">管理员扫码签到</div>
            <div class="link-desc">用摄像头扫描参与者二维码</div>
          </div>
          <div class="flex gap-8">
            <router-link to="/admin/scan" class="btn btn-primary btn-sm">去扫码 →</router-link>
          </div>
        </div>
      </div>
    </div>

    <!-- Invite signup modal -->
    <div v-if="showInviteSignup" class="modal-overlay" @click.self="showInviteSignup = false">
      <div class="modal">
        <h3 class="modal-title">邀请报名</h3>
        <div class="invite-tabs">
          <button class="invite-tab" :class="{ active: inviteTab === 'email' }" @click="inviteTab = 'email'">邮件邀请</button>
          <button class="invite-tab" :class="{ active: inviteTab === 'link' }" @click="inviteTab = 'link'">分享链接</button>
          <button class="invite-tab" :class="{ active: inviteTab === 'direct' }" @click="inviteTab = 'direct'">直接报名</button>
        </div>

        <div v-if="inviteTab === 'email'">
          <p style="font-size:13px;color:var(--c-text-2);margin-bottom:12px">
            输入邮箱地址，系统将发送活动邀请邮件。支持批量粘贴，格式不限。
          </p>
          <div class="field">
            <textarea v-model="inviteEmails" rows="4" placeholder="粘贴邮箱地址，支持逗号、空格、换行分隔&#10;例如：a@example.com, b@example.com&#10;或直接粘贴通讯录文本"></textarea>
          </div>
          <div v-if="inviteSignupResult" class="invite-result-box">
            <p v-if="inviteSignupResult.sent.length" style="font-size:13px;margin-bottom:4px">
              <strong style="color:var(--c-success)">已发送 {{ inviteSignupResult.sent.length }} 封邀请邮件</strong>
            </p>
            <p v-if="inviteSignupResult.skipped.length" style="font-size:13px;color:var(--c-text-2)">
              已报名跳过：{{ inviteSignupResult.skipped.join('、') }}
            </p>
          </div>
          <p v-if="inviteSignupError" class="error">{{ inviteSignupError }}</p>
          <div class="modal-actions">
            <button class="btn btn-outline" @click="closeInviteSignup">关闭</button>
            <button v-if="!inviteSignupResult" class="btn btn-primary" @click="sendSignupInvites" :disabled="busy">
              {{ busy ? '发送中…' : '发送邀请' }}
            </button>
          </div>
        </div>

        <div v-if="inviteTab === 'link'" class="invite-tab-body">
          <p style="font-size:13px;color:var(--c-text-2);margin-bottom:12px">复制报名链接发送给想邀请的人</p>
          <div class="flex gap-8" style="flex-wrap:wrap">
            <input :value="shareUrl" readonly @click="$event.target.select()" class="link-input" style="flex:1" />
            <button class="btn btn-primary btn-sm" @click="copyLink">复制链接</button>
          </div>
          <div class="invite-msg-box">
            <div class="label" style="margin-bottom:4px">邀请文案（可复制发送）</div>
            <textarea :value="inviteText" readonly @click="$event.target.select()" rows="4" class="invite-textarea"></textarea>
            <button class="btn btn-outline btn-sm" style="margin-top:6px" @click="copyInviteText">复制文案</button>
          </div>
          <div class="modal-actions">
            <button class="btn btn-outline" @click="showInviteSignup = false">关闭</button>
          </div>
        </div>

        <div v-if="inviteTab === 'direct'">
          <p style="font-size:13px;color:var(--c-text-2);margin-bottom:12px">直接为对方填写报名信息</p>
          <form @submit.prevent="addManualSignup">
            <div class="field">
              <label class="label">姓名 *</label>
              <input v-model="addForm.name" required />
            </div>
            <div class="field">
              <label class="label">邮箱 *</label>
              <input v-model="addForm.email" type="email" required />
            </div>
            <div class="field">
              <label class="label">手机号</label>
              <input v-model="addForm.phone" />
            </div>
            <p v-if="addError" class="error">{{ addError }}</p>
            <div class="modal-actions">
              <button type="button" class="btn btn-outline" @click="showInviteSignup = false">取消</button>
              <button type="submit" class="btn btn-primary" :disabled="busy">添加报名</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- AI input modal -->
    <div v-if="showAiModal" class="modal-overlay" @click.self="showAiModal = false">
      <div class="modal">
        <h3 class="modal-title">{{ event.plan ? '重新生成计划书' : 'AI 起草计划书' }}</h3>
        <p v-if="event.plan" style="font-size:13px;color:var(--c-danger);margin-bottom:8px">
          重新生成将覆盖当前已保存的计划书
        </p>
        <p style="font-size:13px;color:var(--c-text-2);margin-bottom:12px">
          AI 会读取活动已有的标题、时间、地点、容量信息。<br>
          你可以补充活动想法，帮助 AI 生成更贴合的内容。
        </p>
        <div class="field">
          <label class="label">补充想法（可选）</label>
          <textarea v-model="aiUserInput" rows="4" placeholder="例如：想办个户外烤肉活动，大约30人参加，在广濑川河边"></textarea>
        </div>
        <p v-if="aiError" class="error">{{ aiError }}</p>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="showAiModal = false">取消</button>
          <button class="btn btn-primary" @click="generatePlan" :disabled="aiLoading">
            {{ aiLoading ? '正在生成…' : '开始生成' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Notify modal -->
    <div v-if="showNotifyModal" class="modal-overlay" @click.self="showNotifyModal = false">
      <div class="modal">
        <h3 class="modal-title">发送变更通知</h3>
        <p style="font-size:13px;color:var(--c-text-2);margin-bottom:12px">将向所有 {{ signups.length }} 位报名者发送邮件</p>
        <div class="field">
          <label class="label">变更内容</label>
          <textarea v-model="notifyMessage" rows="3" placeholder="告知参与者有什么变化"></textarea>
        </div>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="showNotifyModal = false">取消</button>
          <button class="btn btn-primary" @click="sendNotify" :disabled="busy">发送</button>
        </div>
      </div>
    </div>

    <!-- Manual signup modal -->
    <div v-if="showAddSignup" class="modal-overlay" @click.self="showAddSignup = false">
      <div class="modal">
        <h3 class="modal-title">手动添加报名</h3>
        <form @submit.prevent="addManualSignup">
          <div class="field">
            <label class="label">姓名 *</label>
            <input v-model="addForm.name" required />
          </div>
          <div class="field">
            <label class="label">邮箱 *</label>
            <input v-model="addForm.email" type="email" required />
          </div>
          <div class="field">
            <label class="label">手机号</label>
            <input v-model="addForm.phone" />
          </div>
          <p v-if="addError" class="error">{{ addError }}</p>
          <div class="modal-actions">
            <button type="button" class="btn btn-outline" @click="showAddSignup = false">取消</button>
            <button type="submit" class="btn btn-primary" :disabled="busy">添加</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../../api.js'
import { auth } from '../../lib/auth.js'
import { showToast } from '../../lib/toast.js'
import { STATUS_MAP, formatDateTime } from '../../lib/format.js'

const route = useRoute()
const router = useRouter()
const event = ref(null)
const signups = ref([])
const error = ref('')
const busy = ref(false)

const activityTypes = [
  { value: 'indoor-general', icon: '\u{1F3E0}', label: '室内·通用' },
  { value: 'indoor-lecture', icon: '\u{1F393}', label: '室内·讲座/观影' },
  { value: 'indoor-boardgame', icon: '\u{1F3B2}', label: '室内·桌游' },
  { value: 'outdoor-general', icon: '\u{1F333}', label: '户外·通用' },
  { value: 'outdoor-bbq', icon: '\u{1F356}', label: '户外·烤肉' },
  { value: 'outdoor-camping', icon: '\u{26FA}', label: '户外·露营' },
]
const knownTypeValues = activityTypes.map(t => t.value)
const activityTypeLabel = computed(() => {
  const val = event.value?.activity_type
  if (!val) return ''
  const t = activityTypes.find(t => t.value === val)
  return t ? `${t.icon} ${t.label}` : val
})

const editingInfo = ref(false)
const infoForm = ref({})
const editCustomFields = ref([])

const parsedCustomFields = computed(() => {
  const raw = event.value?.custom_fields
  if (!raw) return []
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
})

function selectInfoType(val) {
  if (val === '__custom') {
    infoForm.value.activity_type = infoForm.value.activity_type && !knownTypeValues.includes(infoForm.value.activity_type)
      ? infoForm.value.activity_type : ''
  } else {
    infoForm.value.activity_type = infoForm.value.activity_type === val ? '' : val
  }
}

function startEditInfo() {
  const e = event.value
  infoForm.value = {
    title: e.title, event_date: e.event_date, location: e.location || '',
    content: e.content || '', notes: e.notes || '', capacity: e.capacity || null,
    activity_type: e.activity_type || '',
  }
  editCustomFields.value = parsedCustomFields.value.map(f => ({
    label: f.label, type: f.type || 'text', required: !!f.required,
    optionsStr: (f.options || []).join(', ')
  }))
  editingInfo.value = true
}

async function saveInfo() {
  if (!infoForm.value.title || !infoForm.value.event_date) {
    showToast('活动名称和日期必填', 'error'); return
  }
  busy.value = true
  try {
    const cfData = editCustomFields.value.filter(f => f.label.trim()).map(f => ({
      label: f.label.trim(), type: f.type, required: f.required,
      ...(f.type === 'select' ? { options: f.optionsStr.split(/[,，、;；]/).map(o => o.trim()).filter(Boolean) } : {})
    }))
    const payload = { ...infoForm.value, custom_fields: cfData }
    await api.updateEvent(event.value.id, payload)
    Object.assign(event.value, infoForm.value)
    event.value.custom_fields = JSON.stringify(cfData)
    editingInfo.value = false
    showToast('活动信息已保存')
  } catch (e) { showToast(e.message, 'error') }
  busy.value = false
}

const imageUploading = ref(false)

async function uploadImage(file) {
  imageUploading.value = true
  try {
    await api.uploadEventImage(event.value.id, file)
    await load()
    showToast('图片已上传')
  } catch (e) { showToast(e.message, 'error') }
  imageUploading.value = false
}

function handleImageSelect(e) {
  const file = e.target.files[0]
  if (file) uploadImage(file)
  e.target.value = ''
}

function handleDrop(e) {
  const file = e.dataTransfer.files[0]
  if (file && file.type.startsWith('image/')) uploadImage(file)
}

async function deleteImage() {
  if (!confirm('确定删除活动图片？')) return
  busy.value = true
  try {
    await api.deleteEventImage(event.value.id)
    event.value.image_key = null
    showToast('图片已删除')
  } catch (e) { showToast(e.message, 'error') }
  busy.value = false
}

const showAddSignup = ref(false)
const addForm = ref({ name: '', email: '', phone: '' })
const addError = ref('')
const showNotifyModal = ref(false)
const notifyMessage = ref('')

const showInviteSignup = ref(false)
const inviteTab = ref('email')
const inviteEmails = ref('')
const inviteSignupResult = ref(null)
const inviteSignupError = ref('')

const inviteText = computed(() => {
  if (!event.value) return ''
  const e = event.value
  let text = `邀请你参加「${e.title}」`
  if (e.event_date) text += `\n时间：${e.event_date}`
  if (e.location) text += `\n地点：${e.location}`
  text += `\n\n报名链接：${shareUrl.value}`
  return text
})

function copyInviteText() {
  navigator.clipboard.writeText(inviteText.value)
  showToast('邀请文案已复制')
}

async function sendSignupInvites() {
  inviteSignupError.value = ''
  if (!inviteEmails.value.trim()) { inviteSignupError.value = '请输入邮箱'; return }
  busy.value = true
  try {
    const data = await api.inviteSignup(event.value.id, inviteEmails.value)
    inviteSignupResult.value = data
    if (data.sent.length) showToast(`已发送 ${data.sent.length} 封邀请邮件`)
    else showToast('没有新邮箱需要邀请', 'error')
  } catch (e) { inviteSignupError.value = e.message }
  busy.value = false
}

function closeInviteSignup() {
  showInviteSignup.value = false
  inviteEmails.value = ''
  inviteSignupResult.value = null
  inviteSignupError.value = ''
}

const showAiModal = ref(false)
const aiUserInput = ref('')
const aiLoading = ref(false)
const aiError = ref('')
const editingPlan = ref(false)
const planEditText = ref('')
const renderedPlan = computed(() => {
  const src = event.value?.plan || ''
  return src
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/【待补充】/g, '<mark style="background:#fef3c7;padding:1px 4px;border-radius:3px">【待补充】</mark>')
    .replace(/\n/g, '<br>')
})

const isLocked = computed(() => event.value?.lock_at && signups.value.length >= event.value.lock_at)

const stepIndex = computed(() => {
  const map = { draft: 0, pending: 1, open: 2, active: 3, closed: 4 }
  return map[event.value?.status] ?? 0
})
const shareUrl = computed(() => event.value ? `${location.origin}/e/${event.value.id}` : '')
const checkinUrl = computed(() => event.value ? `${location.origin}/checkin/${event.value.id}` : '')
const hasExtra = computed(() => signups.value.some(s => s.data && s.data !== '{}'))

function formatDT(ts) { return formatDateTime(ts) }
function formatExtra(data) {
  if (!data) return ''
  try {
    const obj = typeof data === 'string' ? JSON.parse(data) : data
    return Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join('; ')
  } catch { return String(data) }
}

function phoneDisplay(s) {
  if (s.phone) return s.phone
  try {
    const obj = typeof s.data === 'string' ? JSON.parse(s.data || '{}') : (s.data || {})
    const parts = [obj['中国手机号'], obj['日本电话号']].filter(Boolean)
    return parts.join(' / ') || '—'
  } catch { return '—' }
}

async function load() {
  const id = route.params.id
  try {
    const [eventData, signupData] = await Promise.all([
      api.getEvent(id),
      api.listSignups(id)
    ])
    event.value = eventData.event
    signups.value = signupData.signups
  } catch (e) { error.value = e.message }
}

onMounted(load)

async function lockSignups() {
  busy.value = true
  try {
    await api.updateEvent(event.value.id, { lock_at: signups.value.length })
    event.value.lock_at = signups.value.length
    showToast('报名已锁定')
  } catch (e) { showToast(e.message, 'error') }
  busy.value = false
}

async function unlockSignups() {
  busy.value = true
  try {
    await api.updateEvent(event.value.id, { lock_at: null })
    event.value.lock_at = null
    showToast('报名已解锁')
  } catch (e) { showToast(e.message, 'error') }
  busy.value = false
}

async function submitEvent() {
  busy.value = true
  try {
    const data = await api.submitEvent(event.value.id)
    showToast(data.autoApproved ? '已自动审核通过' : '已提交审核')
    await load()
  } catch (e) { showToast(e.message, 'error') }
  busy.value = false
}

async function withdrawEvent() {
  busy.value = true
  try { await api.withdrawEvent(event.value.id); showToast('已撤回'); await load() }
  catch (e) { showToast(e.message, 'error') }
  busy.value = false
}

async function activateEvent() {
  if (!confirm('确认开始活动？开始后报名通道将关闭。')) return
  busy.value = true
  try { await api.activateEvent(event.value.id); showToast('活动已开始'); await load() }
  catch (e) { showToast(e.message, 'error') }
  busy.value = false
}

async function deactivateEvent() {
  busy.value = true
  try { await api.deactivateEvent(event.value.id); showToast('已撤回，活动恢复为报名中'); await load() }
  catch (e) { showToast(e.message, 'error') }
  busy.value = false
}

async function closeEvent() {
  if (!confirm('确定结束活动？')) return
  busy.value = true
  try { await api.closeEvent(event.value.id); showToast('活动已结束'); await load() }
  catch (e) { showToast(e.message, 'error') }
  busy.value = false
}

async function togglePin() {
  busy.value = true
  try {
    const data = await api.togglePin(event.value.id)
    event.value.pinned = data.pinned
    showToast(data.pinned ? '已置顶' : '已取消置顶')
  } catch (e) { showToast(e.message, 'error') }
  busy.value = false
}

async function duplicateEvent() {
  busy.value = true
  try {
    const data = await api.duplicateEvent(event.value.id)
    showToast('已复制')
    router.push(`/admin/events/${data.id}`)
  } catch (e) { showToast(e.message, 'error') }
  busy.value = false
}

async function deleteEvent() {
  if (!confirm('确定删除此活动？')) return
  busy.value = true
  try { await api.deleteEvent(event.value.id); showToast('已删除'); router.push('/admin/events') }
  catch (e) { showToast(e.message, 'error') }
  busy.value = false
}

async function checkinOne(s) {
  busy.value = true
  try { await api.checkinSignup(s.id); showToast(`${s.name} 已签到`); await load() }
  catch (e) { showToast(e.message, 'error') }
  busy.value = false
}

async function batchCheckin() {
  if (!confirm('将所有未签到的参与者标记为已签到？')) return
  busy.value = true
  try {
    const data = await api.batchCheckin(event.value.id)
    showToast(`已签到 ${data.count} 人`)
    await load()
  } catch (e) { showToast(e.message, 'error') }
  busy.value = false
}

async function deleteSignup(s) {
  if (!confirm(`确定删除 ${s.name} 的报名？`)) return
  busy.value = true
  try { await api.deleteSignup(s.id); showToast('已删除'); await load() }
  catch (e) { showToast(e.message, 'error') }
  busy.value = false
}

async function doExport(format) {
  try {
    const res = await api.exportSignups(event.value.id, format)
    const blob = await res.blob()
    const ext = format === 'json' ? 'json' : 'csv'
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${event.value.title}-报名数据.${ext}`; a.click()
    URL.revokeObjectURL(url)
  } catch (e) { showToast(e.message, 'error') }
}

async function addManualSignup() {
  addError.value = ''
  busy.value = true
  try {
    await api.manualSignup({
      event_id: Number(event.value.id),
      name: addForm.value.name,
      email: addForm.value.email,
      phone: addForm.value.phone,
    })
    showToast('已添加')
    showAddSignup.value = false
    showInviteSignup.value = false
    addForm.value = { name: '', email: '', phone: '' }
    await load()
  } catch (e) { addError.value = e.message }
  busy.value = false
}

async function sendReminder() {
  if (!confirm(`向 ${signups.value.length} 位报名者发送活动提醒邮件？`)) return
  busy.value = true
  try {
    const data = await api.remindParticipants(event.value.id)
    showToast(`已发送 ${data.count} 封提醒邮件`)
  } catch (e) { showToast(e.message, 'error') }
  busy.value = false
}

async function sendNotify() {
  busy.value = true
  try {
    const data = await api.notifyParticipants(event.value.id, notifyMessage.value)
    showToast(`已发送 ${data.count} 封通知邮件`)
    showNotifyModal.value = false
    notifyMessage.value = ''
  } catch (e) { showToast(e.message, 'error') }
  busy.value = false
}

async function generatePlan() {
  aiError.value = ''
  aiLoading.value = true
  showAiModal.value = false
  editingPlan.value = false
  try {
    const data = await api.generatePlan(event.value.id, aiUserInput.value)
    event.value.plan = data.plan
    showToast('计划书已生成并保存')
  } catch (e) {
    showToast(e.message, 'error')
  }
  aiLoading.value = false
}

function startEditPlan() {
  planEditText.value = event.value.plan || ''
  editingPlan.value = true
}

async function savePlan() {
  busy.value = true
  try {
    await api.savePlan(event.value.id, planEditText.value)
    event.value.plan = planEditText.value
    editingPlan.value = false
    showToast('计划书已保存')
  } catch (e) { showToast(e.message, 'error') }
  busy.value = false
}

function cancelEditPlan() {
  editingPlan.value = false
}

function copyPlan() {
  navigator.clipboard.writeText(event.value.plan || '')
  showToast('计划书已复制到剪贴板')
}

function downloadPlan() {
  const blob = new Blob([event.value.plan || ''], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${event.value.title}-计划书.md`
  a.click()
  URL.revokeObjectURL(url)
}

function copyLink() {
  navigator.clipboard.writeText(shareUrl.value)
  showToast('链接已复制')
}

function copyCheckinLink() {
  navigator.clipboard.writeText(checkinUrl.value)
  showToast('签到链接已复制')
}
</script>

<style scoped>
.workflow-bar { padding: 20px 24px; overflow-x: auto; }
.wf-steps { display: flex; align-items: center; gap: 0; min-width: 0; }
.wf-step {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  font-size: 12px; color: var(--c-text-3); font-weight: 500; white-space: nowrap;
}
.wf-step.active { color: var(--c-primary); }
.wf-step.current { color: var(--c-primary); font-weight: 700; }
.wf-dot {
  width: 12px; height: 12px; border-radius: 50%;
  background: var(--c-border); transition: all .2s;
}
.wf-step.active .wf-dot { background: var(--c-primary); }
.wf-step.current .wf-dot {
  background: var(--c-primary); box-shadow: 0 0 0 4px rgba(79,70,229,.2);
  width: 14px; height: 14px;
}
.wf-line {
  flex: 1; height: 2px; background: var(--c-border);
  min-width: 20px; margin: 0 4px; margin-bottom: 22px;
}
.wf-line.done { background: var(--c-primary); }
.wf-hint { font-size: 13px; color: var(--c-text-2); margin-top: 14px; }

.lock-banner {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 18px; font-size: 14px; font-weight: 500;
  background: #fef3c7; border: 1px solid #f59e0b; color: #92400e;
}
.lock-banner-icon { font-size: 18px; }

.plan-card {
  background: var(--c-surface); border-radius: 12px; padding: 20px 24px;
  border: 2px solid var(--c-primary); box-shadow: 0 2px 12px rgba(79,70,229,.08);
}
.plan-header {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 10px; margin-bottom: 16px;
}
.plan-title-row { display: flex; align-items: center; gap: 8px; }
.plan-icon { font-size: 20px; }
.plan-title { font-size: 16px; font-weight: 700; }
.plan-badge {
  font-size: 11px; font-weight: 600; padding: 2px 10px; border-radius: 99px;
  background: rgba(79,70,229,.1); color: var(--c-primary);
}
.plan-badge-empty { background: rgba(0,0,0,.06); color: var(--c-text-3); }

.plan-empty {
  text-align: center; padding: 32px 16px;
}
.plan-empty-icon { font-size: 40px; margin-bottom: 8px; opacity: .7; }
.plan-empty-text { font-size: 15px; font-weight: 600; color: var(--c-text-2); }
.plan-empty-hint { font-size: 13px; color: var(--c-text-3); margin-top: 6px; max-width: 360px; margin-inline: auto; }

.plan-loading {
  display: flex; align-items: center; justify-content: center; gap: 12px;
  padding: 32px 16px; color: var(--c-text-2); font-size: 14px;
}
.plan-spinner {
  width: 20px; height: 20px; border: 2.5px solid var(--c-border);
  border-top-color: var(--c-primary); border-radius: 50%;
  animation: spin .7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.ai-preview {
  padding: 20px; background: var(--c-bg); border: 1px solid var(--c-border);
  border-radius: 8px; font-size: 14px; line-height: 1.8;
  max-height: 600px; overflow-y: auto;
}
.ai-preview h2 { font-size: 18px; font-weight: 700; margin: 16px 0 8px; }
.ai-preview h3 { font-size: 16px; font-weight: 600; margin: 14px 0 6px; }
.ai-preview h4 { font-size: 15px; font-weight: 600; margin: 12px 0 4px; }
.plan-editor {
  width: 100%; font-size: 13px; font-family: monospace; line-height: 1.6;
  padding: 12px; border: 1px solid var(--c-border); border-radius: 8px;
  background: var(--c-bg); resize: vertical;
}

.info-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 14px 24px;
}
@media (max-width: 600px) { .info-grid { grid-template-columns: 1fr; } }
.info-item {}
.info-label { font-size: 12px; color: var(--c-text-3); font-weight: 500; margin-bottom: 2px; }
.info-value { font-size: 14px; }

.edit-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px;
}
@media (max-width: 600px) { .edit-grid { grid-template-columns: 1fr; } }

.type-grid-sm {
  display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px;
}
.type-chip {
  display: flex; align-items: center; gap: 5px;
  font-size: 13px; padding: 6px 14px; border-radius: 99px;
  border: 1.5px solid var(--c-border); cursor: pointer;
  transition: all .15s; user-select: none;
}
.type-chip:hover { border-color: var(--c-primary); background: rgba(79,70,229,.03); }
.type-chip.selected {
  border-color: var(--c-primary); background: rgba(79,70,229,.08);
  font-weight: 600; color: var(--c-primary);
}
.type-chip-icon { font-size: 15px; }
.img-preview { position: relative; }
.img-preview img {
  width: 100%; max-height: 400px; object-fit: contain;
  border-radius: 8px; border: 1px solid var(--c-border);
}
.img-delete { margin-top: 8px; }
.img-upload-area {
  border: 2px dashed var(--c-border); border-radius: 10px;
  padding: 32px 20px; text-align: center; cursor: pointer;
  transition: border-color .15s, background .15s;
}
.img-upload-area:hover { border-color: var(--c-primary); background: rgba(79,70,229,.02); }
.img-upload-icon { font-size: 28px; color: var(--c-text-3); font-weight: 300; }
.img-upload-text { font-size: 14px; color: var(--c-text-2); margin-top: 4px; }
.img-upload-hint { font-size: 12px; color: var(--c-text-3); margin-top: 4px; }

.link-input { width: 220px; }
.flex-wrap { flex-wrap: wrap; }
.cf-preview { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.cf-tag {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 13px; padding: 4px 10px; border-radius: 6px;
  background: var(--c-bg); border: 1px solid var(--c-border);
}
.cf-tag-type { font-size: 11px; color: var(--c-text-3); }
.cf-tag-req { font-size: 10px; color: var(--c-danger); font-weight: 600; }
.cf-row {
  display: flex; gap: 8px; align-items: center; margin-top: 8px; flex-wrap: wrap;
}
.cf-required-label {
  display: flex; align-items: center; gap: 4px;
  font-size: 13px; color: var(--c-text-2); white-space: nowrap;
}
.cf-required-label input { width: auto; }
.cf-options { margin-top: 4px; margin-bottom: 8px; padding-left: 8px; border-left: 2px solid var(--c-border); }
.invite-tabs {
  display: flex; gap: 0; margin-bottom: 16px;
  border-bottom: 2px solid var(--c-border);
}
.invite-tab {
  padding: 8px 16px; font-size: 14px; font-weight: 500;
  background: none; border: none; cursor: pointer;
  color: var(--c-text-2); border-bottom: 2px solid transparent;
  margin-bottom: -2px; transition: all .15s;
}
.invite-tab.active { color: var(--c-primary); border-bottom-color: var(--c-primary); }
.invite-tab-body {}
.invite-msg-box {
  margin-top: 16px; padding: 12px; background: var(--c-bg);
  border-radius: 8px; border: 1px solid var(--c-border);
}
.invite-textarea {
  width: 100%; resize: none; font-size: 13px; line-height: 1.6;
  background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 6px;
  padding: 8px; cursor: text;
}
.invite-result-box {
  margin-top: 8px; padding: 12px; background: var(--c-bg);
  border: 1px solid var(--c-success); border-radius: 8px;
}

@media (max-width: 640px) {
  .workflow-bar { padding: 14px 12px; }
  .wf-step { font-size: 10px; }
  .wf-step span { display: none; }
  .wf-step.current span { display: block; }
  .wf-line { min-width: 12px; margin-bottom: 0; }
  .plan-card { padding: 14px; }
  .plan-header { flex-direction: column; align-items: flex-start; }
  .link-input { width: 100%; }
  .info-grid { grid-template-columns: 1fr; }
  .edit-grid { grid-template-columns: 1fr; }
}
</style>
