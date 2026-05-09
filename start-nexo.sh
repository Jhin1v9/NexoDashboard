#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# START NEXO — Inicializador robusto do ecossistema NEXO Dashboard
# ═══════════════════════════════════════════════════════════════════

ROOT="/home/jhin/NEXO_DASHBOARD_PRO"
export DISPLAY=:0
export XAUTHORITY=/home/jhin/.Xauthority

cd "$ROOT"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Iniciando NEXO Dashboard..."

# Backend
setsid bash -c 'cd /home/jhin/NEXO_DASHBOARD_PRO/backend && node server.js > /home/jhin/NEXO_DASHBOARD_PRO/backend.log 2>&1' &
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backend PID=$!"
sleep 3

# Frontend
setsid bash -c 'cd /home/jhin/NEXO_DASHBOARD_PRO/frontend && npm run dev > /home/jhin/NEXO_DASHBOARD_PRO/frontend.log 2>&1' &
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Frontend PID=$!"
sleep 3

# Luna Agent (Chrome visível, headless: false)
setsid bash -c 'cd /home/jhin/NEXO_DASHBOARD_PRO/agents && node luna-cto-agent.cjs > /home/jhin/NEXO_DASHBOARD_PRO/luna-run.log 2>&1' &
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Luna PID=$!"
sleep 5

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Todos os servicos iniciados."
echo "  Backend:   http://localhost:3456"
echo "  Frontend:  http://localhost:3457"
echo "  Chrome CDP: http://localhost:9223"
echo "  Logs:      $ROOT/*.log"
