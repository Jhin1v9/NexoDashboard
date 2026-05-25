/**
 * Kimi Bridge API v1.0
 * Micro HTTP API that wraps KimiBridge for remote access via tunnel.
 *
 * Why this exists:
 * - Chrome CDP cannot be safely exposed over the internet (Host header validation,
 *   no auth, raw DevTools protocol).
 * - This API exposes only safe endpoints with API key auth.
 * - The Telegram bot on Render calls this API via Cloudflare Tunnel.
 *
 * Architecture:
 * [Telegram Bot @ Render] → [Cloudflare Tunnel] → [This API @ localhost:9223]
 *                                                    → [KimiBridge] → [Chrome CDP localhost:9222]
 *
 * Endpoints:
 * POST /ask       — Send message and get response
 * POST /new-chat  — Create new chat for user
 * GET  /status    — Get user session status
 * GET  /health    — Health check
 *
 * Env:
 *   KIMI_BRIDGE_API_PORT=9223
 *   KIMI_BRIDGE_API_KEY=<secret>
 *   KIMI_CDP_URL=http://localhost:9222
 */

const express = require('express');
const { KimiBridge } = require('./kimi-bridge.cjs');

const PORT = parseInt(process.env.KIMI_BRIDGE_API_PORT, 10) || 9223;
const API_KEY = process.env.KIMI_BRIDGE_API_KEY || 'nexo-kimi-local-2026';
const CDP_URL = process.env.KIMI_CDP_URL || 'http://localhost:9222';

const app = express();
app.use(express.json({ limit: '1mb' }));

// Lazy-init bridge
let bridge = null;
let bridgeReady = false;

async function getBridge() {
  if (!bridge) {
    bridge = new KimiBridge({ cdpUrl: CDP_URL, debug: true });
    await bridge.connect();
    bridgeReady = true;
    console.log(`[KimiBridgeAPI] Connected to Chrome at ${CDP_URL}`);
  }
  return bridge;
}

// Auth middleware
function requireAuth(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.apiKey;
  if (key !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Health check (no auth required)
app.get('/health', async (req, res) => {
  try {
    const b = await getBridge();
    const status = await b.getGlobalStatus();
    res.json({ status: 'ok', bridge: status });
  } catch (err) {
    res.status(503).json({ status: 'error', message: err.message });
  }
});

// Ask endpoint
app.post('/ask', requireAuth, async (req, res) => {
  const { userId, text, mode } = req.body;
  if (!userId || !text) {
    return res.status(400).json({ error: 'userId and text are required' });
  }

  try {
    const b = await getBridge();
    const result = await b.sendMessage(userId, text, { mode });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[KimiBridgeAPI] /ask error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// New chat endpoint
app.post('/new-chat', requireAuth, async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    const b = await getBridge();
    const result = await b.newChat(userId);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[KimiBridgeAPI] /new-chat error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Status endpoint
app.get('/status', requireAuth, async (req, res) => {
  const { userId } = req.query;
  try {
    const b = await getBridge();
    if (userId) {
      const status = await b.getStatus(userId);
      res.json({ success: true, ...status });
    } else {
      const status = await b.getGlobalStatus();
      res.json({ success: true, ...status });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('[KimiBridgeAPI] Shutting down...');
  if (bridge) {
    try { await bridge.disconnect(); } catch {}
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[KimiBridgeAPI] SIGTERM received...');
  if (bridge) {
    try { await bridge.disconnect(); } catch {}
  }
  process.exit(0);
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[KimiBridgeAPI] Listening on http://127.0.0.1:${PORT}`);
  console.log(`[KimiBridgeAPI] API Key: ${API_KEY.slice(0, 4)}...${API_KEY.slice(-4)}`);
});
