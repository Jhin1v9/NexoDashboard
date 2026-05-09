#!/bin/bash
ROOT="/home/jhin/NEXO_DASHBOARD_PRO"
echo "🩺 STATUS NEXO DASHBOARD"
echo "========================"

for svc in backend frontend luna; do
  PIDFILE="$ROOT/$svc.pid"
  if [ -f "$PIDFILE" ]; then
    PID=$(cat "$PIDFILE")
    if ps -p "$PID" > /dev/null 2>&1; then
      echo "  🟢 $svc  PID=$PID  (ativo)"
    else
      echo "  🔴 $svc  PID=$PID  (morto)"
    fi
  else
    echo "  ⚫ $svc  (nao iniciado)"
  fi
done

echo ""
echo "🌐 URLs:"
echo "  Dashboard: http://localhost:3457"
echo "  Backend:   http://localhost:3456"
echo "  Chrome:    http://localhost:9223"
