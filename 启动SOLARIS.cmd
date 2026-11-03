@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "dist\index.html" (
 echo 请先运行 npm ci 和 npm run build。
 pause
 exit /b 1
)
echo SOLARIS 终审版（第 1–8 期）：总览含小行星带与矮行星；顶部「科普 · 5」「实验室 · 6」；行星可「进入卫星系统」。
py -3 scripts\serve-phase2.py
pause
