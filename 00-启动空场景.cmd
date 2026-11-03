@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Please run npm ci first.
  pause
  exit /b 1
)
call npm run dev
