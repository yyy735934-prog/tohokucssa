# 东北学友会二手平台：Cloudflare 部署

本部署包使用 Cloudflare Workers、D1 与 R2，并支持 Google OAuth 登录和
Gemini 2.5 Flash-Lite 图片识别。不要把任何 API Key、OAuth Secret 或会话
密钥写进源码、`.env`、`wrangler.jsonc` 或聊天消息。

## 1. 准备本机环境

安装 Node.js 22 或更新版本，在项目目录执行：

```bash
npm ci
npx wrangler login
npx wrangler whoami
```

登录会在浏览器中完成。确认 `whoami` 显示的是你自己的 Cloudflare 账户。

## 2. 写入最初的加密 Secret

交互式写入 Gemini Key：

```bash
npx wrangler secret put GEMINI_API_KEY
```

生成随机会话密钥并直接写入 Cloudflare，不保存到文件：

```bash
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))" | npx wrangler secret put SESSION_SECRET
```

## 3. 首次部署并初始化数据

```bash
npm run cloudflare:deploy
npm run cloudflare:migrate
```

记录 Wrangler 输出的 `https://tohoku-market.<你的子域>.workers.dev` 地址。

## 4. 配置 Google 登录

在 Google Cloud Console 的同一个项目中创建“Web application”类型的 OAuth
客户端，将下面的地址加入 Authorized redirect URIs：

```text
https://tohoku-market.<你的子域>.workers.dev/callback
```

然后交互式写入两个值：

```bash
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
```

每次命令都会提示粘贴值；输入不会进入源码。完成后重新部署：

```bash
npm run cloudflare:deploy
```

## 5. 验证

1. 打开 Workers 地址，点击“登录 / 注册”。
2. 用 Google 账号登录；学术邮箱将自动通过身份验证，其他邮箱进入待审核状态。
3. 首次登录后补充联系方式。
4. 上传一张不含人脸、地址或联系方式的商品照片，确认 Gemini 自动生成标题、描述与分类。
5. 发布测试商品，确认 D1 中出现记录，R2 中出现图片。

以后绑定正式域名时，还需把正式域名的 `/callback` 地址加入 Google OAuth 的
Authorized redirect URIs，然后重新测试登录。
