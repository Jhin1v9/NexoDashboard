#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# LUNA WATCHDOG — Serviço de Keep-Alive para o Agente Luna
# Roda no display do usuário, reinicia automaticamente se morrer
# ═══════════════════════════════════════════════════════════════════

ROOT="/home/jhin/NEXO_DASHBOARD_PRO"
AGENT_DIR="$ROOT/agents"
LOG_FILE="$ROOT/luna-watchdog.log"
PID_FILE="$ROOT/luna-agent.pid"
export DISPLAY=:0

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Luna Watchdog iniciado" >> "$LOG_FILE"

while true; do
  if ! pgrep -f "luna-cto-agent.cjs" > /dev/null 2>&1; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Luna morta detectada. Reiniciando..." >> "$LOG_FILE"
    cd "$AGENT_DIR"
    nohup node luna-cto-agent.cjs >> "$ROOT/luna-run.log" 2>&1 &
    echo $! > "$PID_FILE"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Luna reiniciada PID=$!" >> "$LOG_FILE"
  fi
  sleep 10
done
