#!/bin/bash
PID=$(cat /home/jhin/NEXO_DASHBOARD_PRO/backend.pid 2>/dev/null)
if [ -n "$PID" ] && ps -p "$PID" > /dev/null 2>&1; then
  kill "$PID" 2>/dev/null
  sleep 1
  kill -9 "$PID" 2>/dev/null
  echo "🔴 Backend (PID=$PID) desligado."
else
  echo "⚫ Backend ja estava morto."
fi
# Garante porta livre
fuser -k 3456/tcp 2>/dev/null || true
