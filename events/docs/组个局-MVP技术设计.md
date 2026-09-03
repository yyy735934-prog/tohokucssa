# “组个局”MVP 技术设计

更新日期：2026-09-03

## 1. 实施原则

- 保留现有正式活动的活动、报名、签到和审核流程。
- “组个局”继续复用现有活动页面、Google 账号、邮件、签到和图片能力。
- 公开首页在客户端合并正式活动与组局列表，使用统一双列卡片；详情路由仍分别保留，以承载不同报名流程。
- 组局图片直接复用 `events.image_key`、R2 `IMAGES` 绑定及现有 `/api/images/upload/:eventId` 接口，无需新增数据库字段。
- 新状态和自动化逻辑采用附加字段及独立接口，避免改变现有 `events.status` 的含义。
- 数据库迁移只做可回滚的新增表、字段和索引，不删除现有数据。
- 所有自动任务必须具备幂等性，同一模板、同一周只能生成一个活动实例。

## 2. 数据结构

### 2.1 每周活动模板 `gathering_templates`

保存管理员审核过的自动发布规则。

主要字段：

- `id`：模板编号。
- `name`：后台识别名称。
- `category`：`karaoke`、`sport`、`outdoor`、`salon`、`boardgame`、`movie` 或 `other`。
- `sport_name`：多人体育的具体项目，可为空。
- `title_template`、`description`、`notes`：每周活动默认内容。
- `region`、`default_location`：区域和可选默认地点。
- `event_weekday`、`event_time`：本周活动的目标时间。
- `publish_weekday`、`publish_time`：默认周一 08:00，可单独调整。
- `decision_weekday`、`decision_time`：默认周五 18:00，可单独调整。
- `min_participants`、`max_participants`：最低和最多人数。
- `requires_host`：是否必须有主理人接单；`host_user_id` 仅保留首位候选人以兼容旧数据。
- `gathering_template_hosts`：模板与候选主理人的多对多关系，可为同一模板配置多人。
- `gathering_host_offers`：每周实例的候选接单邀请、独立令牌及接单状态。首位接单者写入 `events.created_by`，其余邀请自动关闭。
- `carpool_enabled`：是否启用拼车。
- `approval_status`：`draft`、`approved` 或 `paused`。
- `approved_by`、`approved_at`、`created_by`、`created_at`、`updated_at`：管理和审计字段。

### 2.2 现有活动表 `events` 的附加字段

- `event_mode`：`standard` 或 `gathering`，默认 `standard`。
- `gathering_state`：`recruiting`、`arrangement_pending`、`confirmed`、`in_progress`、`completed` 或 `cancelled`。
- `gathering_category`：组局类别。
- `template_id`：来源模板，可为空。
- `week_key`：日本时间所属周，例如 `2026-W35`。
- `min_participants`：最低有效人数。
- `formation_deadline`：本周成局判定时间戳。
- `arrangement_due_at`：达标后 12 小时确认截止时间。
- `arrangement_confirmed_at`、`arrangement_confirmed_by`：最终安排确认记录。
- `requires_host`、`carpool_enabled`：本周实例规则。
- `cancel_reason`、`cancelled_at`：自动或人工取消记录。

约束与索引：

- `(template_id, week_key)` 建立唯一索引，阻止定时任务重复发布。
- 按 `(event_mode, gathering_state, formation_deadline)` 建立查询索引。
- 组局被取消时，现有 `events.status` 同步设为 `closed`；组局内部阶段以 `gathering_state` 为准。

### 2.3 现有报名表 `signups` 的附加字段

- `user_id`：绑定 Google 登录用户。
- `signup_status`：`joined`、`ride_pending`、`ride_assigned`、`general_waitlist` 或 `cancelled`。
- `transport_mode`：`self`、`driver`、`passenger` 或 `public_transport`。
- `vehicle_note`：车型或车辆说明。
- `seats_offered`：司机可搭载人数。
- `assigned_driver_signup_id`：乘客获分配的司机报名记录。
- `cancelled_at`、`cancel_type`、`cancel_reason`：保留取消历史。
- `attendance_status`：`pending`、`attended`、`excused` 或 `no_show`。

规则：

- 一个 Google 用户在同一活动只保留一条报名记录；取消后重新加入时恢复该记录。
- `joined`、`ride_assigned` 计入有效成局人数；`ride_pending`、`general_waitlist`、`cancelled` 不计入。
- 分配乘客时校验司机剩余座位，禁止超额分配。
- 现有正式活动继续按原有报名方式运行，新增字段使用默认值。

### 2.4 自动任务记录 `gathering_jobs`

保存每次自动发布、周五判定、12 小时超时处理和通知结果，便于管理员发现失败并人工重试。

主要字段：`job_type`、`template_id`、`event_id`、`week_key`、`status`、`detail`、`started_at`、`finished_at`。

## 3. 服务端模块

新增相对独立的路由，降低对现有接口的影响：

### 成员接口

- `GET /api/gatherings`：组局广场列表。
- `GET /api/gatherings/:id`：详情及本人参加状态。
- `POST /api/gatherings/:id/join`：登录后参加并提交交通信息。
- 候选主理人通过上述接口报名时自动接单；人数和主理人两个条件同时满足后才进入 `arrangement_pending`。
- `GET /api/gatherings/host-offers/:token` 与 `POST /api/gatherings/host-offers/:token/accept`：查看邮件邀请并明确接单。查看链接本身不改变状态。
- `POST /api/gatherings/:id/cancel`：保留历史地取消参加。
- `GET /api/gatherings/mine`：当前登录用户的组局记录。

### 主理人和管理员接口

- `POST /api/gatherings/:id/finalize`：确认最终时间、地点和说明。
- `POST /api/gatherings/:id/carpool/assign`：分配司机与乘客。
- `POST /api/gatherings/:id/carpool/unassign`：取消乘车分配。
- `POST /api/gatherings/:id/cancel-event`：人工取消组局。
- `POST /api/gatherings/:id/attendance`：主理人或管理员补录出席状态。
- `GET/POST/PATCH /api/gathering-templates`：模板管理。
- `GET /api/gathering-templates/jobs`：查看最近自动任务及失败原因。
- `POST /api/gathering-templates/:id/publish-now`：幂等地立即生成本周实例。
- `POST /api/events/:id/signup-lock`：创建者或管理员锁定/恢复新报名。
- `POST /api/gathering-templates/:id/approve`：管理员批准自动发布。
- `POST /api/gathering-templates/:id/pause`：暂停模板。

所有写接口在服务端检查当前 Google 会话、活动权限和状态，不信任页面提交的用户编号或邮箱。

## 4. 自动任务

现有定时任务扩展为按日本时间检查以下工作：

1. 到达模板发布时间：生成本周组局实例。
2. 每次有效人数变化：立即重新判断是否达到最低人数。
3. 到达周五判定时间：未达标实例自动取消。
4. 达标后超过 12 小时：
   - 必须有主理人的活动自动取消；
   - 唱歌和多人体育活动转交管理员，并发送待办通知。
5. 保留现有活动提醒和过期关闭任务。

模板允许按小时调整时间，因此定时触发器按固定频率运行，业务代码再以日本时间和模板配置判断是否到期。所有操作通过唯一索引和任务记录防止重复执行。

## 5. 页面改造

### 成员端

- 首页增加“正式活动 / 组个局”切换，不混淆两种报名逻辑。
- 新增组局详情页，突出“还差几人成局”和确认状态。
- 未登录时显示 Google 登录按钮；登录成功后才能参加。
- 拼车活动报名时展示交通选项；乘客获分配前持续显示“乘车候补中”。
- “我的”页面增加组局记录和私有出席记录。

### 管理端

- 增加“每周模板”页面：草稿、批准、暂停和时间调整。
- 活动详情增加有效人数、12 小时倒计时、最终安排确认和拼车分配面板。
- 管理总览增加“待管理员确认”“即将超时”“自动任务失败”提醒。

## 6. 通知节点

- 每周活动发布成功：通知默认主理人或管理员。
- 达到最低人数：通知主理人；无主理人的唱歌和体育活动通知管理员。
- 最终安排确认：通知所有有效参加成员。
- 获得乘车席位：通知乘客，并向司机发送必要联系信息。
- 周五未成局：通知所有已报名成员。
- 主理人确认超时：通知成员取消结果，或通知管理员接管。
- 活动前提醒：复用现有邮件提醒与签到码。

## 7. 安全与兼容性修正

- 组局报名必须从服务端会话取得用户身份，不能仅凭邮箱操作。
- “我的组局”只能返回当前登录用户的数据。
- 拼车联系方式仅向相关司机、主理人和管理员返回。
- Google 新建账号不再生成可预测的本地密码；Google 登录与密码登录能力明确区分。
- 现有正式活动的公开报名接口和历史数据保持兼容。

## 8. 实施顺序

1. 新增数据库迁移和服务端状态计算函数。
2. 完成 Google 登录约束、组局列表、详情、参加和取消。
3. 完成模板管理及每周自动发布。
4. 完成成局判定、12 小时确认和周五取消。
5. 完成拼车分配与邮件通知。
6. 完成管理端、签到衔接和出席记录。
7. 在本地数据库验证全流程后，执行线上迁移和部署。
