#!/bin/bash
PID=$(cat /home/jhin/NEXO_DASHBOARD_PRO/frontend.pid 2>/dev/null)
if [ -n "$PID" ] && ps -p "$PID" > /dev/null 2>&1; then
  kill "$PID" 2>/dev/null
  sleep 1
  kill -9 "$PID" 2>/dev/null
  echo "🔴 Frontend (PID=$PID) desligado."
else
  echo "⚫ Frontend ja estava morto."
fi
# Garante porta livre
fuser -k 3457/tcp 2>/dev/null || true
