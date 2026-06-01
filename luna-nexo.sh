#!/bin/bash
# NEXO + LUNA — Unified Control Script
# Uso: ./luna-nexo.sh [start|stop|status|logs|restart]

set -e

NEXO_DIR="/home/jhin/NEXO_DASHBOARD_PRO"
LUNA_KERNEL="/home/jhin/.luna-kernel"
LUNA_WEB="$HOME/.luna-kernel/luna-web"
PID_DIR="/tmp/luna-nexo-pids"

mkdir -p "$PID_DIR"

NEXO_PID_FILE="$PID_DIR/nexo.pid"
LUNA_PID_FILE="$PID_DIR/luna.pid"
VITE_PID_FILE="$PID_DIR/vite.pid"
TELEGRAM_PID_FILE="$PID_DIR/telegram.pid"

colors() {
  CYAN='\033[0;36m'
  MAGENTA='\033[0;35m'
  YELLOW='\033[1;33m'
  GREEN='\033[0;32m'
  RED='\033[0;31m'
  DIM='\033[2m'
  BOLD='\033[1m'
  NC='\033[0m'
}

colorize_log() {
  while IFS= read -r line; do
    printf "${DIM}%s${NC} ${MAGENTA}[LUNA]${NC} %s\n" "$(date '+%H:%M:%S')" "$line"
  done
}

colorize_nexo() {
  while IFS= read -r line; do
    printf "${DIM}%s${NC} ${CYAN}[NEXO]${NC} %s\n" "$(date '+%H:%M:%S')" "$line"
  done
}

colorize_vite() {
  while IFS= read -r line; do
    printf "${DIM}%s${NC} ${YELLOW}[VITE]${NC} %s\n" "$(date '+%H:%M:%S')" "$line"
  done
}

kill_port() {
  local port=$1
  local pid=$(ss -tlnp 2>/dev/null | grep ":$port " | awk '{print $6}' | cut -d',' -f2 | cut -d'=' -f2 | head -1)
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    echo -e "${YELLOW}  → Matando processo na porta $port (PID: $pid)${NC}"
    kill -TERM "$pid" 2>/dev/null || true
    sleep 1
    kill -KILL "$pid" 2>/dev/null || true
  fi
}

start_services() {
  colors
  echo -e "${BOLD}${GREEN}"
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║     NEXO DIGITAL PRO + LUNA WEB — Unified Launcher         ║"
  echo "╠══════════════════════════════════════════════════════════════╣"
  echo "║  Dashboard:      http://localhost:3456                      ║"
  echo "║  Luna Web:       http://localhost:3458                      ║"
  echo "║  Luna Web Dev:   http://localhost:5173                      ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"

  # Use PM2 for robust process management (replaces nohup)
  echo -e "${BOLD}Verificando PM2...${NC}"
  
  # Ensure Caddy is running
  if ! ss -tlnp 2>/dev/null | grep -q ':5173 '; then
    echo -e "${YELLOW}▶ Caddy não está rodando — iniciando...${NC}"
    nohup /usr/bin/caddy run --config /home/jhin/.config/caddy/Caddyfile > /dev/null 2>&1 &
    sleep 2
  fi

  # 1. Nexo Backend (porta 3456)
  echo -e "${CYAN}▶ Iniciando NEXO Dashboard (porta 3456) via PM2...${NC}"
  cd "$NEXO_DIR/backend"
  pm2 start server.js --name nexo-dashboard --update-env --env PORT=3456 2>/dev/null || pm2 restart nexo-dashboard 2>/dev/null

  # 2. Luna Web Server (porta 3458)
  echo -e "${MAGENTA}▶ Iniciando Luna Web Server (porta 3458) via PM2...${NC}"
  cd "$NEXO_DIR/backend"
  pm2 start luna-server.js --name luna-server --update-env --env LUNA_PORT=3458 2>/dev/null || pm2 restart luna-server 2>/dev/null

  # 3. Luna Web Vite (dev mode only — optional)
  if [ -f "$LUNA_WEB/node_modules/.bin/vite" ]; then
    echo -e "${YELLOW}▶ Iniciando Luna Web Vite (porta 5173) via PM2...${NC}"
    cd "$LUNA_WEB"
    pm2 start "npx vite --host" --name luna-vite 2>/dev/null || pm2 restart luna-vite 2>/dev/null
  fi

  # 4. Telegram Bot (Luna Adapter v4.0)
  echo -e "${GREEN}▶ Iniciando Telegram Bot (@lunanexobot) via PM2...${NC}"
  cd "$NEXO_DIR/agents"
  pm2 start telegram-luna-adapter.cjs --name telegram-bot 2>/dev/null || pm2 restart telegram-bot 2>/dev/null

  # Save PM2 process list for auto-restart on boot
  pm2 save > /dev/null 2>&1

  sleep 2
  echo ""
  echo -e "${GREEN}${BOLD}✓ Todos os serviços iniciados via PM2!${NC}"
  echo -e "${DIM}  Use './luna-nexo.sh status' para verificar${NC}"
  echo -e "${DIM}  Use './luna-nexo.sh stop' para encerrar${NC}"
  echo -e "${DIM}  Use 'pm2 logs' para ver logs em tempo real${NC}"
  echo ""
}

stop_services() {
  colors
  echo -e "${BOLD}${RED}Encerrando todos os serviços via PM2...${NC}"
  
  pm2 stop luna-server nexo-dashboard luna-vite telegram-bot 2>/dev/null || true
  
  echo -e "${GREEN}✓ Todos os serviços parados (use 'pm2 delete all' para remover).${NC}"
}

status_services() {
  colors
  echo -e "${BOLD}Status dos Serviços (PM2):${NC}\n"
  pm2 status
  
  echo ""
  echo -e "${DIM}URLs:${NC}"
  echo -e "  ${CYAN}http://localhost:3456${NC} — Dashboard"
  echo -e "  ${MAGENTA}http://localhost:3458${NC} — Luna Web"
  echo -e "  ${YELLOW}http://localhost:5173${NC} — Luna Web Dev (Vite)"
}

show_logs() {
  colors
  echo -e "${BOLD}Logs em tempo real via PM2 (Ctrl+C para sair):${NC}\n"
  pm2 logs
}

case "${1:-start}" in
  start)
    start_services
    ;;
  stop)
    stop_services
    ;;
  restart)
    stop_services
    sleep 2
    start_services
    ;;
  status)
    status_services
    ;;
  logs)
    show_logs
    ;;
  *)
    echo "Uso: $0 [start|stop|restart|status|logs]"
    echo ""
    echo "  start   — Inicia todos os serviços em background"
    echo "  stop    — Encerra todos os serviços"
    echo "  restart — Reinicia todos os serviços"
    echo "  status  — Mostra status de cada serviço"
    echo "  logs    — Inicia em foreground com logs coloridos"
    exit 1
    ;;
esac
