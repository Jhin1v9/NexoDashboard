#!/bin/bash
PID=$(cat /home/jhin/NEXO_DASHBOARD_PRO/backend.pid 2>/dev/null)
if [ -n "$PID" ] && ps -p "$PID" > /dev/null 2>&1; then
  kill "$PID" 2>/dev/null
  echo "🔴 Backend (PID=$PID) desligado."
else
  echo "⚫ Backend ja estava morto."
fi
