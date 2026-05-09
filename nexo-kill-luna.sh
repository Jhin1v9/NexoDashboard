#!/bin/bash
PID=$(cat /home/jhin/NEXO_DASHBOARD_PRO/luna.pid 2>/dev/null)
if [ -n "$PID" ] && ps -p "$PID" > /dev/null 2>&1; then
  kill "$PID" 2>/dev/null
  sleep 1
  kill -9 "$PID" 2>/dev/null
  echo "🔴 Luna (PID=$PID) desligada."
else
  echo "⚫ Luna ja estava morta."
fi
# Mata processos orfaos da Luna
pkill -f "luna-cto-agent.cjs" 2>/dev/null || true
pkill -f "luna-scheduler.mjs" 2>/dev/null || true
pkill -f "luna-daemon.mjs" 2>/dev/null || true
