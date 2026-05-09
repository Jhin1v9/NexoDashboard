#!/bin/bash
PID=$(cat /home/jhin/NEXO_DASHBOARD_PRO/frontend.pid 2>/dev/null)
if [ -n "$PID" ] && ps -p "$PID" > /dev/null 2>&1; then
  kill "$PID" 2>/dev/null
  echo "🔴 Frontend (PID=$PID) desligado."
else
  echo "⚫ Frontend ja estava morto."
fi
