#!/bin/bash
# ============================================================
# Luna Local Mode — Bot Telegram + Kimi Bridge no PC local
# ============================================================
# Este script gerencia o bot local e coordena com o Render:
#   1. Para o bot no Render (para evitar conflito 409)
#   2. Inicia Chrome + Bridge API + Bot Telegram local
#   3. Quando o PC desliga, volta o bot no Render
#
# Para rodar no startup do PC:
#   systemctl --user enable luna-local
#
# ============================================================

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RENDER_SERVICE_NAME="nexo-dashboard-pro"
LOG_FILE="/tmp/luna-local-mode.log"
PID_FILE="/tmp/luna-local-mode.pid"
CHROME_PID=""
BRIDGE_API_PID=""
BOT_PID=""
TUNNEL_PID=""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
  echo -e "${GREEN}[LunaLocal]${NC} $1" | tee -a "$LOG_FILE"
}

warn() {
  echo -e "${YELLOW}[LunaLocal]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
  echo -e "${RED}[LunaLocal]${NC} $1" | tee -a "$LOG_FILE"
}

# Save PID
echo $$ > "$PID_FILE"

# ── STOP RENDER ──
stop_render() {
  log "Stopping Render service..."
  if command -v render &>/dev/null; then
    render services stop "$RENDER_SERVICE_NAME" 2>/dev/null || warn "Could not stop Render via CLI"
  elif command -v curl &>/dev/null && [ -n "$RENDER_API_KEY" ]; then
    curl -s -X POST \
      -H "Authorization: Bearer $RENDER_API_KEY" \
      "https://api.render.com/v1/services/$RENDER_SERVICE_NAME/suspend" 2>/dev/null || warn "Could not stop Render via API"
  else
    warn "render-cli not found. Please stop the Render service manually at:"
    warn "https://dashboard.render.com"
  fi
}

# ── START RENDER ──
start_render() {
  log "Starting Render service..."
  if command -v render &>/dev/null; then
    render services resume "$RENDER_SERVICE_NAME" 2>/dev/null || warn "Could not start Render via CLI"
  elif command -v curl &>/dev/null && [ -n "$RENDER_API_KEY" ]; then
    curl -s -X POST \
      -H "Authorization: Bearer $RENDER_API_KEY" \
      "https://api.render.com/v1/services/$RENDER_SERVICE_NAME/resume" 2>/dev/null || warn "Could not start Render via API"
  else
    warn "render-cli not found. Please start the Render service manually at:"
    warn "https://dashboard.render.com"
  fi
}

# ── START CHROME ──
start_chrome() {
  log "Starting Chrome with CDP..."
  cd "$PROJECT_DIR"
  bash scripts/start-kimi-chrome.sh > /tmp/luna-chrome.log 2>&1 &
  CHROME_PID=$!
  sleep 5
  if ! curl -s http://localhost:9222/json/version > /dev/null 2>&1; then
    error "Chrome CDP not reachable! Check /tmp/luna-chrome.log"
    exit 1
  fi
  log "Chrome ready ✅"
}

# ── START BRIDGE API + TUNNEL ──
start_bridge_api() {
  log "Starting Bridge API..."
  cd "$PROJECT_DIR"
  NODE_PATH="$PROJECT_DIR/node_modules" \
  KIMI_BRIDGE_API_PORT=9223 \
  KIMI_CDP_URL=http://localhost:9222 \
  KIMI_BRIDGE_API_KEY="${KIMI_BRIDGE_API_KEY:-nexo-kimi-local-2026}" \
    node agents/kimi-bridge-api.cjs > /tmp/luna-bridge-api.log 2>&1 &
  BRIDGE_API_PID=$!
  sleep 3
  if ! curl -s http://127.0.0.1:9223/health > /dev/null 2>&1; then
    error "Bridge API not reachable! Check /tmp/luna-bridge-api.log"
    exit 1
  fi
  log "Bridge API ready ✅"
}

# ── START TUNNEL ──
start_tunnel() {
  log "Starting Cloudflare Tunnel..."
  CLOUDFLARED=""
  for c in /tmp/cloudflared cloudflared /usr/bin/cloudflared; do
    [ -x "$c" ] && CLOUDFLARED="$c" && break
  done
  if [ -z "$CLOUDFLARED" ]; then
    curl -L --output /tmp/cloudflared "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64" 2>/dev/null
    chmod +x /tmp/cloudflared
    CLOUDFLARED="/tmp/cloudflared"
  fi
  rm -f /tmp/cf-api-tunnel.log
  $CLOUDFLARED tunnel --url http://127.0.0.1:9223 > /tmp/cf-api-tunnel.log 2>&1 &
  TUNNEL_PID=$!
  sleep 8
  TUNNEL_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /tmp/cf-api-tunnel.log | head -1 || true)
  if [ -n "$TUNNEL_URL" ]; then
    log "Tunnel URL: ${YELLOW}${TUNNEL_URL}${NC}"
    log "Set this in Render Dashboard: KIMI_BRIDGE_URL=${TUNNEL_URL}"
  else
    warn "Tunnel URL not ready yet. Check /tmp/cf-api-tunnel.log"
  fi
}

# ── START BOT ──
start_bot() {
  log "Starting Telegram Bot (local mode)..."
  cd "$PROJECT_DIR"
  # Disable remote bridge so bot connects locally
  unset KIMI_BRIDGE_URL
  node agents/telegram-luna-agent.cjs > /tmp/luna-bot.log 2>&1 &
  BOT_PID=$!
  sleep 3
  if pgrep -f "telegram-luna-agent.cjs" > /dev/null; then
    log "Bot started ✅"
  else
    error "Bot failed to start! Check /tmp/luna-bot.log"
  fi
}

# ── STOP ALL ──
stop_all() {
  log "Shutting down Luna Local Mode..."
  [ -n "$BOT_PID" ] && kill "$BOT_PID" 2>/dev/null || true
  [ -n "$TUNNEL_PID" ] && kill "$TUNNEL_PID" 2>/dev/null || true
  [ -n "$BRIDGE_API_PID" ] && kill "$BRIDGE_API_PID" 2>/dev/null || true
  [ -n "$CHROME_PID" ] && kill "$CHROME_PID" 2>/dev/null || true
  pkill -f "kimi-bridge-api.cjs" 2>/dev/null || true
  pkill -f "telegram-luna-agent.cjs" 2>/dev/null || true
  pkill -f "cloudflared tunnel" 2>/dev/null || true
  sleep 2
  start_render
  rm -f "$PID_FILE"
  log "Cleanup done. Render should be back online."
}

# ── TRAP SIGNALS ──
trap stop_all INT TERM EXIT

# ── MAIN ──
log "═══════════════════════════════════════════════════"
log "  🌙 LUNA LOCAL MODE"
log "═══════════════════════════════════════════════════"

stop_render
start_chrome
start_bridge_api
start_tunnel
start_bot

log ""
log "${GREEN}🎉 Luna Local Mode is running!${NC}"
log "Press Ctrl+C to stop and return to Render."
log ""

# Keep alive
wait
