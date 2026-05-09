#!/bin/bash
echo "💀 Desligando TUDO..."
/home/jhin/NEXO_DASHBOARD_PRO/nexo-kill-backend.sh
/home/jhin/NEXO_DASHBOARD_PRO/nexo-kill-frontend.sh
/home/jhin/NEXO_DASHBOARD_PRO/nexo-kill-luna.sh
sleep 1
killall -9 node chrome 2>/dev/null
# Garante que portas estejam livres
fuser -k 3456/tcp 2>/dev/null || true
fuser -k 3457/tcp 2>/dev/null || true
echo "✅ Tudo desligado."
