@echo off
chcp 65001 >nul
echo ╔══════════════════════════════════════════════════════════════╗
echo ║  NEXO WhatsApp Agent v8.0 — Relatório Inteligente            ║
echo ║  Clientes: Juan (Sorveteria) • Paulo (Santafe)               ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
cd /d "C:\Users\Administrator\Documents\NEXO DIGITAL\01_ATIVOS\NEXO_DASHBOARD_PRO"
node agents\nexo-whatsapp-agent-v8.mjs
echo.
echo ✅ Agente concluído.
pause
