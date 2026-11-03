@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "dist\index.html" (
 echo 请先运行 npm ci 和 npm run build。
 pause
 exit /b 1
)
echo SOLARIS 第 3 期终验：选中有卫星的行星，点击「进入卫星系统」。
py -3 scripts\serve-phase2.py
pause
