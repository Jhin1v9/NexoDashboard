@echo off
chcp 65001 >nul
echo ╔══════════════════════════════════════════════════════════════╗
echo ║  NEXO DASHBOARD PRO v2.0 — Servidor Central                  ║
echo ║  Porta: 3456 • Acesso: VPN Only                              ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

cd /d "C:\Users\Administrator\Documents\NEXO DIGITAL\01_ATIVOS\NEXO_DASHBOARD_PRO\backend"

set PORT=3457
set BIND_IP=127.0.0.1
set NEXO_BASE_PATH=C:\Users\Administrator\Documents\NEXO DIGITAL

echo [1/2] Iniciando backend...
start "NEXO Backend" cmd /k "node server.js"

echo [2/2] Backend iniciado em http://127.0.0.1:3456
echo.
echo 📊 Dashboard: http://127.0.0.1:3456
echo 📱 WhatsApp Agent: node agents\nexo-whatsapp-agent-v8.mjs
echo 📋 Relatorios: /relatorios
echo.
pause
