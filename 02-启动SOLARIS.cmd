@echo off
cd /d "%~dp0"
if not exist dist\index.html (
  echo Please run npm ci and npm run build first.
  pause
  exit /b 1
)
echo SOLARIS Phase 1
echo Open http://127.0.0.1:4175 in Chrome or Edge.
py -3 -m http.server 4175 --bind 127.0.0.1 --directory dist
