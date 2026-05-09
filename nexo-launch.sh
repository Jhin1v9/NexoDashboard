#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# NEXO LAUNCH — Inicia Backend + Frontend + Luna visíveis
# Cada serviço tem seu PID salvo para desligamento individual
# ═══════════════════════════════════════════════════════════════════

ROOT="/home/jhin/NEXO_DASHBOARD_PRO"
export DISPLAY=:0

cd "$ROOT"

echo "🚀 Iniciando NEXO Dashboard..."

# Backend
setsid bash -c 'cd /home/jhin/NEXO_DASHBOARD_PRO/backend && node server.js > /home/jhin/NEXO_DASHBOARD_PRO/backend.log 2>&1' &
echo $! > "$ROOT/backend.pid"
echo "  🟢 Backend   PID=$!  (log: backend.log)"

sleep 2

# Frontend
setsid bash -c 'cd /home/jhin/NEXO_DASHBOARD_PRO/frontend && npm run dev > /home/jhin/NEXO_DASHBOARD_PRO/frontend.log 2>&1' &
echo $! > "$ROOT/frontend.pid"
echo "  🟢 Frontend  PID=$!  (log: frontend.log)"

sleep 2

# Luna Agent (Chrome visível)
setsid bash -c 'cd /home/jhin/NEXO_DASHBOARD_PRO/agents && node luna-cto-agent.cjs > /home/jhin/NEXO_DASHBOARD_PRO/luna-run.log 2>&1' &
echo $! > "$ROOT/luna.pid"
echo "  🟢 Luna      PID=$!  (log: luna-run.log)"

echo ""
echo "✅ Todos os serviços iniciados."
echo ""
echo "📋 Para ver status:    ./nexo-status.sh"
echo "📋 Para ver logs:      tail -f backend.log | tail -f frontend.log | tail -f luna-run.log"
echo "📋 Para matar individualmente:"
echo "     ./nexo-kill-backend.sh"
echo "     ./nexo-kill-frontend.sh"
echo "     ./nexo-kill-luna.sh"
echo "📋 Para matar TUDO:    ./nexo-kill-all.sh"
echo ""
