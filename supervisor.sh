#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# NEXO SUPERVISOR — Mantém backend, frontend e Luna sempre ligados
# ═══════════════════════════════════════════════════════════════════

ROOT="/home/jhin/NEXO_DASHBOARD_PRO"
export DISPLAY=:0
export XAUTHORITY=/home/jhin/.Xauthority
LOG="$ROOT/supervisor.log"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Supervisor iniciado" >> "$LOG"

start_backend() {
  setsid bash -c 'cd /home/jhin/NEXO_DASHBOARD_PRO/backend && exec node server.js > /home/jhin/NEXO_DASHBOARD_PRO/backend.log 2>&1' &
  echo $! > "$ROOT/backend.pid"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backend iniciado PID=$!" >> "$LOG"
}

start_frontend() {
  setsid bash -c 'cd /home/jhin/NEXO_DASHBOARD_PRO/frontend && exec npm run dev > /home/jhin/NEXO_DASHBOARD_PRO/frontend.log 2>&1' &
  echo $! > "$ROOT/frontend.pid"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Frontend iniciado PID=$!" >> "$LOG"
}

start_luna() {
  setsid bash -c 'cd /home/jhin/NEXO_DASHBOARD_PRO/agents && exec node luna-cto-agent.cjs > /home/jhin/NEXO_DASHBOARD_PRO/luna-run.log 2>&1' &
  echo $! > "$ROOT/luna.pid"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Luna iniciada PID=$!" >> "$LOG"
}

# Inicial
start_backend
sleep 3
start_frontend
sleep 3
start_luna

# Loop de supervisão
while true; do
  sleep 10

  if ! pgrep -f "node server.js" > /dev/null; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backend morto. Reiniciando..." >> "$LOG"
    start_backend
  fi

  if ! pgrep -f "vite.*3457" > /dev/null; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Frontend morto. Reiniciando..." >> "$LOG"
    start_frontend
  fi

  if ! pgrep -f "luna-cto-agent.cjs" > /dev/null; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Luna morta. Reiniciando..." >> "$LOG"
    start_luna
  fi
done
