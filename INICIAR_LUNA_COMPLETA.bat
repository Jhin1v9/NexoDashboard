@echo off
chcp 65001 >nul
cd /d "C:\Users\Administrator\Documents\NEXO DIGITAL\01_ATIVOS\NEXO_DASHBOARD_PRO"
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\start-luna-stack.ps1"
pause
