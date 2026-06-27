#!/bin/bash
# ============================================================
# Start Kimi Bridge API + Cloudflare Tunnel
# ============================================================
# This script starts the local Bridge API (Express server)
# and exposes it via Cloudflare Tunnel so the Render bot can connect.
#
# Architecture:
#   [Telegram Bot @ Render] → [Cloudflare Tunnel] → [This API @ localhost:9223]
#                                                    → [KimiBridge] → [Chrome CDP]
#
# Requirements:
#   - Chrome running with --remote-debugging-port=9222
#   - cloudflared binary available
#
# Usage:
#   ./scripts/start-kimi-bridge-api.sh
# ============================================================

set -e

API_PORT="${KIMI_BRIDGE_API_PORT:-9223}"
CDP_URL="${KIMI_CDP_URL:-http://localhost:9222}"
API_KEY="${KIMI_BRIDGE_API_KEY:-nexo-kimi-local-2026}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}[KimiBridgeAPI]${NC} Starting Bridge API..."
echo -e "${GREEN}[KimiBridgeAPI]${NC} API Port: ${API_PORT}"
echo -e "${GREEN}[KimiBridgeAPI]${NC} CDP URL: ${CDP_URL}"
echo -e "${GREEN}[KimiBridgeAPI]${NC} API Key: ${API_KEY:0:4}...${API_KEY: -4}"

# Check Chrome CDP is reachable
if ! curl -s "${CDP_URL}/json/version" > /dev/null 2>&1; then
  echo -e "${RED}[KimiBridgeAPI]${NC} ERROR: Chrome CDP not reachable at ${CDP_URL}"
  echo -e "${YELLOW}[KimiBridgeAPI]${NC} Start Chrome first: ./scripts/start-kimi-chrome.sh"
  exit 1
fi

echo -e "${GREEN}[KimiBridgeAPI]${NC} Chrome CDP is reachable ✅"

# Find cloudflared
CLOUDFLARED=""
for candidate in /tmp/cloudflared cloudflared /usr/bin/cloudflared; do
  if [ -x "${candidate}" ]; then
    CLOUDFLARED="${candidate}"
    break
  fi
done

if [ -z "${CLOUDFLARED}" ]; then
  echo -e "${YELLOW}[KimiBridgeAPI]${NC} Downloading cloudflared..."
  curl -L --output /tmp/cloudflared "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64" 2>/dev/null
  chmod +x /tmp/cloudflared
  CLOUDFLARED="/tmp/cloudflared"
fi

# Kill existing processes
pkill -f "kimi-bridge-api.cjs" 2>/dev/null || true
sleep 1

# Start Bridge API in background
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "${PROJECT_DIR}"

NODE_PATH="${PROJECT_DIR}/node_modules" \
KIMI_BRIDGE_API_PORT="${API_PORT}" \
KIMI_CDP_URL="${CDP_URL}" \
KIMI_BRIDGE_API_KEY="${API_KEY}" \
  node agents/kimi-bridge-api.cjs &

API_PID=$!
echo -e "${GREEN}[KimiBridgeAPI]${NC} API started (PID: ${API_PID})"

# Wait for API to be ready
for i in {1..30}; do
  if curl -s "http://127.0.0.1:${API_PORT}/health" > /dev/null 2>&1; then
    echo -e "${GREEN}[KimiBridgeAPI]${NC} API is ready ✅"
    break
  fi
  sleep 1
done

# Start Cloudflare Tunnel
echo -e "${GREEN}[KimiBridgeAPI]${NC} Starting Cloudflare Tunnel..."
echo -e "${YELLOW}[KimiBridgeAPI]${NC} Waiting for tunnel URL..."

${CLOUDFLARED} tunnel --url "http://127.0.0.1:${API_PORT}" 2>&1 &
TUNNEL_PID=$!

# Wait and extract tunnel URL
for i in {1..30}; do
  TUNNEL_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /tmp/cf-tunnel.log 2>/dev/null | head -1 || true)
  if [ -n "${TUNNEL_URL}" ]; then
    echo ""
    echo -e "${GREEN}══════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  🎉 KIMI BRIDGE API IS LIVE!${NC}"
    echo -e "${GREEN}══════════════════════════════════════════════════════${NC}"
    echo -e "  Tunnel URL: ${YELLOW}${TUNNEL_URL}${NC}"
    echo -e "  API Key:    ${YELLOW}${API_KEY}${NC}"
    echo ""
    echo -e "  ${GREEN}Set this in Render Dashboard:${NC}"
    echo -e "  KIMI_BRIDGE_URL = ${TUNNEL_URL}"
    echo -e "  KIMI_BRIDGE_API_KEY = ${API_KEY}"
    echo ""
    echo -e "  ${GREEN}Test locally:${NC}"
    echo -e "  curl -H 'X-API-Key: ${API_KEY}' ${TUNNEL_URL}/health"
    echo -e "${GREEN}══════════════════════════════════════════════════════${NC}"
    echo ""
    break
  fi
  sleep 1
done

if [ -z "${TUNNEL_URL}" ]; then
  echo -e "${RED}[KimiBridgeAPI]${NC} Failed to get tunnel URL. Check logs."
  kill ${API_PID} 2>/dev/null || true
  kill ${TUNNEL_PID} 2>/dev/null || true
  exit 1
fi

# Keep script alive, show logs on Ctrl+C
trap 'echo -e "\n${YELLOW}[KimiBridgeAPI]${NC} Stopping..."; kill ${API_PID} ${TUNNEL_PID} 2>/dev/null; exit 0' INT TERM

echo -e "${GREEN}[KimiBridgeAPI]${NC} Running. Press Ctrl+C to stop."
wait
