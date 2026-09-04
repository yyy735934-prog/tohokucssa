# CometChat 配置

聊天代码和 D1 结构已在本站实现，但启用前必须在 CometChat 控制台创建或选择一个 App。

1. 记录 App 的 `App ID` 与 `Region`。
2. 在 API Keys 中创建仅由 Cloudflare Worker 使用的 REST API Key；不要把它放进网页代码或 GitHub。
3. 将下列四项写入 Cloudflare Worker `tohoku-market` 的 Secrets：
   - `COMETCHAT_APP_ID`
   - `COMETCHAT_REGION`
   - `COMETCHAT_REST_API_KEY`
   - `COMETCHAT_WEBHOOK_PASSWORD`（使用随机长密码）
4. 在 CometChat Webhooks 新建 `message_sent` Webhook：
   - URL：`https://market.tohokucssa.org/api/chat/webhook`
   - Basic Auth 用户名：`tohoku_market`
   - Basic Auth 密码：与 `COMETCHAT_WEBHOOK_PASSWORD` 完全一致
5. 重新部署 Worker。首页会在检测到三项 CometChat 服务凭据后自动切换到匿名聊天；缺少配置时继续使用原有联系申请。

实现使用两人私密 Group 隔离不同商品的会话。CometChat 用户名只保存随机匿名编号，不上传本站邮箱、真实姓名、OAuth 名称、手机号或微信号。
