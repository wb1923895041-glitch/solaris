@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "dist\index.html" (
 echo 请先运行 npm ci 和 npm run build。
 pause
 exit /b 1
)
echo SOLARIS 3B 卫星独立资产：打开后点击顶部“卫星资产 · 3B”。
py -3 scripts\serve-phase2.py
pause
