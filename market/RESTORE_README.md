# 东北学友会二手平台：恢复与部署

本压缩包是完整项目源码，包含最新的 Gemini 图片识别修复。

## Windows 使用方法

1. 将压缩包解压到永久目录，例如：
   `C:\Users\Administrator\Documents\tohoku-market`
2. 不要在 `AppData\Local\Temp` 或 `codex-file-preview-*` 目录中继续开发。
3. 双击 `WINDOWS_SETUP_AND_DEPLOY.cmd`。它会安装依赖、构建并部署到 Cloudflare。

脚本使用 `--keep-vars`，会保留 Cloudflare 中已有的 `GOOGLE_CLIENT_ID` 等远程环境变量。已经通过 `wrangler secret put` 上传的 `GEMINI_API_KEY`、`SESSION_SECRET` 和 `GOOGLE_CLIENT_SECRET` 也不会写入源码包。

如需只在本地构建，可在 PowerShell 中进入项目目录后运行：

```powershell
npm.cmd ci
npx.cmd vinext build
```

请勿将 API Key 或 OAuth Client Secret 写入源码或提交到 Git。
