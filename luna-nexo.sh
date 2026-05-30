#!/bin/bash
# NEXO + LUNA — Unified Control Script
# Uso: ./luna-nexo.sh [start|stop|status|logs|restart]

set -e

NEXO_DIR="/home/jhin/NEXO_DASHBOARD_PRO"
LUNA_KERNEL="/home/jhin/.luna-kernel"
LUNA_WEB="$NEXO_DIR/agents/luna-web"
PID_DIR="/tmp/luna-nexo-pids"

mkdir -p "$PID_DIR"

NEXO_PID_FILE="$PID_DIR/nexo.pid"
LUNA_PID_FILE="$PID_DIR/luna.pid"
VITE_PID_FILE="$PID_DIR/vite.pid"

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
  echo "║  Dashboard API:  http://localhost:3456                      ║"
  echo "║  Luna Web:       http://localhost:3456                      ║"
  echo "║  Luna Web Dev:   http://localhost:5173                      ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"

  # Matar processos antigos
  echo -e "${BOLD}Limpando processos antigos...${NC}"
  kill_port 3456
  kill_port 5173
  
  # Limpar PIDs antigos
  rm -f "$NEXO_PID_FILE" "$LUNA_PID_FILE" "$VITE_PID_FILE"

  # 1. Nexo Backend (cwd must be backend/ for dotenv to find .env)
  echo -e "${CYAN}▶ Iniciando NEXO Dashboard (porta 3456)...${NC}"
  cd "$NEXO_DIR/backend"
  PORT=3456 BIND_IP=127.0.0.1 \
    nohup node server.js > /dev/null 2>&1 &
  echo $! > "$NEXO_PID_FILE"
  sleep 2

  # 2. Luna Web is now served by Dashboard (porta 3456)
  # config-server.cjs deprecated — routes merged into backend/server.js

  # 3. Luna Web Vite
  if [ -f "$LUNA_WEB/node_modules/.bin/vite" ]; then
    echo -e "${YELLOW}▶ Iniciando Luna Web Vite (porta 5173)...${NC}"
    cd "$LUNA_WEB"
    nohup npx vite --host > /dev/null 2>&1 &
    echo $! > "$VITE_PID_FILE"
  else
    echo -e "${RED}⚠ Vite não encontrado em $LUNA_WEB${NC}"
  fi

  sleep 2
  echo ""
  echo -e "${GREEN}${BOLD}✓ Todos os serviços iniciados!${NC}"
  echo -e "${DIM}  Use './luna-nexo.sh status' para verificar${NC}"
  echo -e "${DIM}  Use './luna-nexo.sh stop' para encerrar${NC}"
  echo ""
}

stop_services() {
  colors
  echo -e "${BOLD}${RED}Encerrando todos os serviços...${NC}"
  
  for pid_file in "$NEXO_PID_FILE" "$LUNA_PID_FILE" "$VITE_PID_FILE"; do
    if [ -f "$pid_file" ]; then
      pid=$(cat "$pid_file")
      name=$(basename "$pid_file" .pid)
      if kill -0 "$pid" 2>/dev/null; then
        echo -e "  ${YELLOW}→ Parando $name (PID: $pid)${NC}"
        kill -TERM "$pid" 2>/dev/null || true
        sleep 1
        kill -KILL "$pid" 2>/dev/null || true
      fi
      rm -f "$pid_file"
    fi
  done
  
  # Garantir que nada ficou nas portas
  kill_port 3456
  kill_port 5173
  
  echo -e "${GREEN}✓ Todos os serviços encerrados.${NC}"
}

status_services() {
  colors
  echo -e "${BOLD}Status dos Serviços:${NC}\n"
  
  check_service() {
    local name=$1
    local port=$2
    local pid_file=$3
    local color=$4
    
    local pid=""
    [ -f "$pid_file" ] && pid=$(cat "$pid_file")
    
    if ss -tlnp 2>/dev/null | grep -q ":$port "; then
      echo -e "  ${color}●${NC} ${BOLD}$name${NC} ${GREEN}(rodando)${NC} — porta $port"
    else
      echo -e "  ${RED}●${NC} ${BOLD}$name${NC} ${RED}(parado)${NC} — porta $port"
    fi
  }
  
  check_service "NEXO Dashboard + Luna" 3456 "$NEXO_PID_FILE" "$CYAN"
  check_service "Luna Web Vite"          5173 "$VITE_PID_FILE" "$YELLOW"
  
  echo ""
  echo -e "${DIM}URLs:${NC}"
  echo -e "  ${CYAN}http://localhost:3456${NC} — Dashboard + Luna Web"
  echo -e "  ${YELLOW}http://localhost:5173${NC} — Luna Web Dev (Vite)"
}

show_logs() {
  colors
  echo -e "${BOLD}Logs em tempo real (Ctrl+C para sair):${NC}\n"
  
  # Iniciar serviços em foreground com logs coloridos
  kill_port 3456
  kill_port 5173
  
  # Nexo em background com pipe (cwd must be backend/ for dotenv)
  cd "$NEXO_DIR/backend"
  PORT=3456 BIND_IP=127.0.0.1 \
    node server.js 2>&1 | colorize_nexo &
  NEXO_BG=$!
  
  # Luna routes are now inside Dashboard server.js
  # config-server.cjs deprecated
  
  # Vite em background com pipe
  if [ -f "$LUNA_WEB/node_modules/.bin/vite" ]; then
    cd "$LUNA_WEB"
    npx vite --host 2>&1 | colorize_vite &
    VITE_BG=$!
  fi
  
  echo -e "${GREEN}Todos os serviços rodando com logs. Pressione Ctrl+C para parar.${NC}\n"
  
  # Esperar sinal
  trap 'echo -e "\n${RED}Encerrando...${NC}"; kill $NEXO_BG $LUNA_BG $VITE_BG 2>/dev/null; exit 0' INT TERM
  wait
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
