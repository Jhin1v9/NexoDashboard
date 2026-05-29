#!/bin/bash
# ============================================================
# Start Chrome with remote debugging for Kimi Bridge v2
# ============================================================

set -e

PROFILE_DIR="/tmp/chrome-user-profile"
CDP_PORT="${KIMI_CDP_PORT:-9222}"

# Clean lock files that may prevent Chrome from starting
rm -f "${PROFILE_DIR}/SingletonLock"
rm -f "${PROFILE_DIR}/SingletonSocket"
rm -f "${PROFILE_DIR}/SingletonCookie"

# Copy profile from user's Chrome if it doesn't exist yet
if [ ! -d "${PROFILE_DIR}/Default" ]; then
  echo "[start-kimi-chrome] Copying Chrome profile..."
  mkdir -p "${PROFILE_DIR}"
  if [ -d "${HOME}/.config/google-chrome/Default" ]; then
    cp -r "${HOME}/.config/google-chrome/Default" "${PROFILE_DIR}/"
  elif [ -d "${HOME}/.config/chromium/Default" ]; then
    cp -r "${HOME}/.config/chromium/Default" "${PROFILE_DIR}/"
  else
    echo "[start-kimi-chrome] WARNING: No existing Chrome profile found. Starting fresh."
  fi
fi

# Find Chrome executable
candidates=(
  "${LUNA_CHROME_PATH}"
  "${CHROME_PATH}"
  "/usr/bin/google-chrome"
  "/usr/bin/google-chrome-stable"
  "/opt/google/chrome/google-chrome"
  "/usr/bin/chromium"
  "/usr/bin/chromium-browser"
  "/snap/bin/chromium"
)

CHROME_BIN=""
for candidate in "${candidates[@]}"; do
  if [ -n "${candidate}" ] && [ -x "${candidate}" ]; then
    CHROME_BIN="${candidate}"
    break
  fi
done

if [ -z "${CHROME_BIN}" ]; then
  echo "[start-kimi-chrome] ERROR: Chrome not found. Install Google Chrome or set CHROME_PATH."
  exit 1
fi

echo "[start-kimi-chrome] Using Chrome: ${CHROME_BIN}"
echo "[start-kimi-chrome] Profile: ${PROFILE_DIR}"
echo "[start-kimi-chrome] CDP Port: ${CDP_PORT}"

# Launch Chrome with remote debugging
exec "${CHROME_BIN}" \
  --remote-debugging-port="${CDP_PORT}" \
  --user-data-dir="${PROFILE_DIR}" \
  --no-first-run \
  --no-default-browser-check \
  --disable-dev-shm-usage \
  --disable-background-timer-throttling \
  --disable-backgrounding-occluded-windows \
  --disable-renderer-backgrounding \
  --window-size=1920,1080 \
  "https://kimi.com"
