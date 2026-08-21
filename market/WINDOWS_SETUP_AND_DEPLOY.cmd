@echo off
setlocal
cd /d "%~dp0"

echo [1/3] Installing dependencies...
call npm.cmd ci
if errorlevel 1 goto failed

echo [2/3] Building the site...
call npx.cmd vinext build
if errorlevel 1 goto failed
if not exist "dist\server\index.js" (
  echo [ERROR] Build output dist\server\index.js was not created.
  goto failed
)

echo [3/3] Deploying to Cloudflare...
call npx.cmd wrangler deploy --config wrangler.jsonc --keep-vars
if errorlevel 1 goto failed

echo.
echo Deployment completed successfully.
pause
exit /b 0

:failed
echo.
echo [ERROR] The operation stopped because a command failed.
pause
exit /b 1
