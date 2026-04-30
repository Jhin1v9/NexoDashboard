@echo off
chcp 65001 >nul
echo 🔥 NEXO DASHBOARD PRO
echo.
cd /d "%~dp0\backend"
set BIND_IP=127.0.0.1
set PORT=3456
set NEXO_BASE_PATH=C:\Users\Administrator\Documents\NEXO DIGITAL
node server.js
pause
