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
