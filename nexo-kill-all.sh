#!/bin/bash
echo "💀 Desligando TUDO..."
/home/jhin/NEXO_DASHBOARD_PRO/nexo-kill-backend.sh
/home/jhin/NEXO_DASHBOARD_PRO/nexo-kill-frontend.sh
/home/jhin/NEXO_DASHBOARD_PRO/nexo-kill-luna.sh
sleep 1
killall -9 node chrome 2>/dev/null
echo "✅ Tudo desligado."
