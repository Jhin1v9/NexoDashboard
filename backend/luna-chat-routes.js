/**
 * Luna Chat Routes — Express router for Luna Web chat API
 * Adapted from config-server.cjs for integration into Dashboard server.js
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');
const router = express.Router();
const db = require('./db');
const dataStore = require('./datastore');
const JSZip = require('jszip');

// v8.5-fix: auth middleware reference (injected via setupAuth)
let requireAuth = (req, res, next) => next();
// Proxy that resolves to the latest requireAuth at request time
function requireAuthProxy(req, res, next) {
  // SSE/EventSource cannot send custom headers, so accept token via query param as fallback
  if (!req.headers.authorization && req.query && req.query.token) {
    req.headers.authorization = 'Bearer ' + req.query.token;
  }
  return requireAuth(req, res, next);
}

// v5.2: Centralized config
const config = require('../../.luna-kernel/config/luna-config');

// ============================================================
// Luna Soul lazy initialization
// ============================================================
const LUNA_DIR = config.LUNA_KERNEL_DIR;
const SOUL_PATH = path.join(LUNA_DIR, 'luna-soul.cjs');
const ENV_PATH = config.PATHS.env;
let lunaSoul = null;
let lunaReady = false;

async function getLunaSoul() {
  if (lunaSoul && lunaReady) return lunaSoul;
  try {
    const { LunaSoul } = require(SOUL_PATH);
    lunaSoul = new LunaSoul({});
    await lunaSoul.init();
    lunaReady = true;
    console.log('🧠 Luna Soul inicializado para web chat');

    // v8.0: Wire extension handler to LunaSoul for tool execution
    try {
      const expressApp = require('./luna-server').app || global.__lunaApp;
      if (expressApp && expressApp.locals && expressApp.locals.extensionHandler) {
        expressApp.locals.extensionHandler.setToolExecutor(async (tool, params, sessionId) => {
          // Map web session to Luna Soul session
          const webSessionId = sessionId?.replace('web-', '') || sessionId;
          const result = await lunaSoul._handleAction(
            { tool, params, mode: 'ACTION' },
            webSessionId,
            { userId: sessionId }
          );
          return result;
        });
        console.log('[LunaExt] Tool executor wired to Luna Soul');
      }
    } catch (e) {
      console.warn('[LunaExt] Failed to wire tool executor:', e.message);
    }

    return lunaSoul;
  } catch (e) {
    console.error('❌ Erro ao inicializar Luna Soul:', e.message);
    throw e;
  }
}

// ============================================================
// Web Chat Sessions — híbrido: memória + PostgreSQL
// ============================================================
const webSessions = new Map();
const activeStreams = new Map();
const sseConnections = new Map(); // sessionId -> Set of {res, keepAlive, checkInterval}
const activeUsers = new Map(); // userId -> { lastSeen: timestamp, name: string }

// Periodic cleanup of inactive users (after 10 min of no heartbeat)
setInterval(() => {
  const now = Date.now();
  for (const [uid, data] of activeUsers) {
    if (now - data.lastSeen > 10 * 60 * 1000) {
      activeUsers.delete(uid);
    }
  }
}, 60 * 1000);

// Periodic cleanup of orphaned activeStreams (e.g. client disconnect without close event)
setInterval(() => {
  const now = Date.now();
  const maxAge = config.TIMEOUTS.orphanStreamCleanup;
  for (const [id, meta] of activeStreams) {
    if (meta.createdAt && (now - meta.createdAt > maxAge)) {
      console.warn(`[WEB] Cleaning orphaned stream ${id} (age ${Math.round((now - meta.createdAt) / 1000)}s)`);
      activeStreams.delete(id);
    }
  }
}, 60000); // check every minute

async function dbRunWithRetry(sql, params, retries = 3) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      return await db.run(sql, params);
    } catch (e) {
      lastErr = e;
      const delay = Math.min(1000 * Math.pow(2, i), 5000);
      console.warn(`[DB] Retry ${i + 1}/${retries} in ${delay}ms: ${e.message}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  console.error('[DB] Failed after retries:', lastErr.message);
  throw lastErr;
}

function generateWebSessionId() {
  return 'web-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
}

function createWebSession(userId = 'anonymous', title = 'Nova conversa', mode = 'instant', persona = 'default') {
  const id = generateWebSessionId();
  const session = {
    id,
    userId,
    title,
    mode,
    persona,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  webSessions.set(id, session);
  // Persistir no PostgreSQL (fire-and-forget with retry)
  dbRunWithRetry(
    `INSERT INTO luna_chat_sessions (id, user_id, title, mode, persona, messages, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW(), NOW())`,
    [id, userId, title, mode, persona, JSON.stringify([])]
  ).catch(e => console.error('[DB] Erro ao criar sessão:', e.message));
  return session;
}

async function loadSessionFromDB(id) {
  try {
    const row = await db.get(
      `SELECT id, title, mode, persona, messages, created_at, updated_at 
       FROM luna_chat_sessions WHERE id = $1`,
      [id]
    );
    if (!row) return null;
    const session = {
      id: row.id,
      title: row.title,
      mode: row.mode,
      persona: row.persona || 'default',
      messages: Array.isArray(row.messages) ? row.messages : (typeof row.messages === 'string' ? JSON.parse(row.messages) : []),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    webSessions.set(id, session);
    return session;
  } catch (e) {
    console.error('[DB] Erro ao carregar sessão:', e.message);
    return null;
  }
}

function getWebSession(id) {
  return webSessions.get(id);
}

function deleteWebSession(id) {
  const stream = activeStreams.get(id);
  if (stream) {
    stream.cancelled = true;
    activeStreams.delete(id);
  }
  const result = webSessions.delete(id);
  // Deletar do PostgreSQL (fire-and-forget with retry)
  dbRunWithRetry(
    `DELETE FROM luna_chat_sessions WHERE id = $1`,
    [id]
  ).catch(e => console.error('[DB] Erro ao deletar sessão:', e.message));
  return result;
}

function renameWebSession(id, title) {
  const session = webSessions.get(id);
  if (session) {
    session.title = title;
    session.updatedAt = new Date().toISOString();
    // Atualizar no PostgreSQL (fire-and-forget with retry)
    dbRunWithRetry(
      `UPDATE luna_chat_sessions SET title = $1, updated_at = NOW() WHERE id = $2`,
      [title, id]
    ).catch(e => console.error('[DB] Erro ao renomear sessão:', e.message));
    return true;
  }
  return false;
}

const MAX_MESSAGES_PER_SESSION = 500;

function addMessageToSession(sessionId, message) {
  const session = webSessions.get(sessionId);
  if (session) {
    session.messages.push(message);
    // v8.5-fix: sliding window to prevent unbounded memory growth
    if (session.messages.length > MAX_MESSAGES_PER_SESSION) {
      session.messages = session.messages.slice(-MAX_MESSAGES_PER_SESSION);
      session.messages.unshift({
        id: 'compact-' + Date.now(),
        role: 'system',
        type: 'system',
        content: '💾 Contexto compactado automaticamente. Mensagens mais antigas foram resumidas.',
        timestamp: new Date().toISOString(),
      });
    }
    session.updatedAt = new Date().toISOString();
    // Persistir no PostgreSQL (fire-and-forget with retry)
    dbRunWithRetry(
      `UPDATE luna_chat_sessions SET messages = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(session.messages), sessionId]
    ).catch(e => console.error('[DB] Erro ao salvar mensagem:', e.message));
  }
}

// ============================================================
// .env I/O
// ============================================================
function readEnv() {
  const env = {};
  if (fs.existsSync(ENV_PATH)) {
    const content = fs.readFileSync(ENV_PATH, 'utf-8');
    content.split('\n').forEach(line => {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (match) env[match[1]] = match[2];
    });
  }
  return env;
}

function writeEnv(env) {
  // Read existing env to preserve keys not in the payload
  const existing = readEnv();
  const merged = { ...existing, ...env };

  let content = '# Luna Kernel v5.0 — Environment Configuration\n';
  content += '# Generated by Luna Config Panel\n';
  content += '# NEXO DIGITAL S.L.\n\n';
  content += '# ── REQUIRED ──\n\n';
  const required = ['TELEGRAM_BOT_TOKEN', 'INTERNAL_API_TOKEN', 'JWT_SECRET'];
  const optional = [
    'KIMI_TIMEOUT', 'KIMI_MAX_PAGES', 'KIMI_IDLE_TIMEOUT',
    'KIMI_COOLDOWN_MS', 'KIMI_MAX_TYPE_LENGTH', 'KIMI_LOG_MAX_MB',
    'LUNA_COMPACT_THRESHOLD', 'LUNA_COMPACT_TOKEN_THRESHOLD',
    'LUNA_CHROME_PATH', 'LUNA_DEBUG', 'LUNA_CONFIG_PORT'
  ];

  required.forEach(key => {
    if (merged[key] !== undefined && merged[key] !== '') {
      content += `${key}=${merged[key]}\n`;
    }
  });

  content += '\n# ── OPTIONAL ──\n\n';
  optional.forEach(key => {
    if (merged[key] !== undefined && merged[key] !== '') {
      content += `${key}=${merged[key]}\n`;
    }
  });

  // Also preserve any other keys not in required/optional lists
  const knownKeys = new Set([...required, ...optional]);
  const extraKeys = Object.keys(merged).filter(k => !knownKeys.has(k));
  if (extraKeys.length > 0) {
    content += '\n# ── CUSTOM ──\n\n';
    extraKeys.forEach(key => {
      if (merged[key] !== undefined && merged[key] !== '') {
        content += `${key}=${merged[key]}\n`;
      }
    });
  }

  fs.writeFileSync(ENV_PATH, content, 'utf-8');
  return true;
}

function readSystemPrompt() {
  if (!fs.existsSync(SOUL_PATH)) return { found: false, content: '' };
  const content = fs.readFileSync(SOUL_PATH, 'utf-8');
  const match = content.match(/function buildSystemPrompt\(opts = \{\}\) \{[\s\S]*?return `([\s\S]*?)`;\s*\}\s*\/\/\s*==+\s*\/\/\s*JSON PARSER/);
  if (match) return { found: true, content: match[1] };
  const match2 = content.match(/function buildSystemPrompt\([\s\S]*?return `([\s\S]*?)`;\s*\}\s*const/);
  if (match2) return { found: true, content: match2[1] };
  return { found: false, content: '' };
}

function writeSystemPrompt(newPrompt) {
  if (!fs.existsSync(SOUL_PATH)) return false;
  let content = fs.readFileSync(SOUL_PATH, 'utf-8');
  const pattern = /(function buildSystemPrompt\(opts = \{\}\) \{[\s\S]*?return `)[\s\S]*?(`;\s*\}\s*\/\/\s*==+\s*\/\/\s*JSON PARSER)/;
  if (pattern.test(content)) {
    content = content.replace(pattern, '$1' + newPrompt + '$2');
    fs.writeFileSync(SOUL_PATH, content, 'utf-8');
    return true;
  }
  const pattern2 = /(function buildSystemPrompt\([\s\S]*?return `)[\s\S]*?(`;\s*\}\s*const)/;
  if (pattern2.test(content)) {
    content = content.replace(pattern2, '$1' + newPrompt + '$2');
    fs.writeFileSync(SOUL_PATH, content, 'utf-8');
    return true;
  }
  return false;
}

// ============================================================
// SSE helper
// ============================================================
function sendSSE(res, event, data) {
  res.write(`event: message\n`);
  res.write(`data: ${JSON.stringify({ ...data, type: event })}\n\n`);
}

// ============================================================
// Chat Routes
// ============================================================

// POST /api/chat — send message
router.post('/api/chat', requireAuthProxy, async (req, res) => {
  const { message, sessionId, mode = 'instant', files, messageId: clientMessageId } = req.body;
  if (!message) return res.status(400).json({ ok: false, error: 'message obrigatório' });

  const userId = req.user?.id || 'anonymous';
  let session = sessionId ? getWebSession(sessionId) : null;
  // v10.3-fix: Load from DB if not in memory (survives server restarts)
  if (!session && sessionId) {
    session = await loadSessionFromDB(sessionId);
  }
  if (!session) {
    session = createWebSession(userId, message.slice(0, 40), mode);
  }
  // v8.5-fix: validate session ownership
  if (session.userId && session.userId !== userId) {
    return res.status(403).json({ ok: false, error: 'Acesso negado a esta sessão' });
  }
  session.mode = mode;

  // v5.3-fix: If message > 3KB, convert to .txt file to optimize Kimi input
  let finalMessage = message;
  let finalFiles = files || [];
  const messageBytes = Buffer.byteLength(message, 'utf8');
  if (messageBytes > 3072) {
    const tmpDir = path.join(require('os').tmpdir(), 'luna-txt-uploads');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const tmpFile = path.join(tmpDir, `message-${session.id || Date.now()}.txt`);
    fs.writeFileSync(tmpFile, message, 'utf8');
    const base64 = fs.readFileSync(tmpFile, 'base64');
    finalFiles = [...finalFiles, {
      name: 'message.txt',
      type: 'text/plain',
      size: messageBytes,
      data: `data:text/plain;base64,${base64}`,
    }];
    finalMessage = `[Arquivo anexado: message.txt (${messageBytes} bytes)]`;
    console.log(`[WEB] Message ${messageBytes} bytes converted to message.txt for session ${session.id}`);
    setTimeout(() => { try { fs.unlinkSync(tmpFile); } catch {} }, 60000);
  }

  // v6.1-fix: Use client-provided messageId for deduplication, or generate one
  const messageId = clientMessageId || ('msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7));

  addMessageToSession(session.id, {
    id: 'msg-' + Date.now(),
    role: 'user',
    type: 'text',
    content: message, // original message in history
    files: finalFiles,
    timestamp: new Date().toISOString(),
  });

  // v5.3-fix: Cancel any existing stream for this session before starting a new one.
  // If user sends a new message while Luna is still "thinking", we abort the old
  // stream so it doesn't block forever.
  const existingStream = activeStreams.get(session.id);
  if (existingStream) {
    existingStream.cancelled = true;
    try {
      const luna = await getLunaSoul();
      if (luna && luna.kimiBridge) {
        const userId = 'web-' + session.id;
        await luna.kimiBridge.cancelStream(userId);
        console.log(`[WEB] Cancelled previous stream for session ${session.id} before new message`);
      }
    } catch (e) {
      console.warn('[WEB] Failed to cancel previous stream:', e.message);
    }
  }

  activeStreams.set(session.id, { cancelled: false, createdAt: Date.now(), messageId });

  res.json({ ok: true, sessionId: session.id, status: 'processing' });

  // Process in background
  try {
    const luna = await getLunaSoul();
    const stream = luna.processMessageStream(finalMessage, {
      sessionId: session.id,
      userId: 'web-' + session.id,          // bridge page isolation key
      userName: req.user?.name || 'Usuário', // for system prompt personalization
      userRealId: req.user?.id || 'anonymous',
      userRole: req.user?.role || 'User',
      mode: ['instant', 'thinking', 'agent', 'swarm'].includes(mode) ? mode : 'instant',
      persona: session.persona || 'default',
      files: finalFiles,
    });

    // v5.4-fix: Deduplicate events before adding to session history
    const emittedEventHashes = new Set();

    for await (const ev of stream) {
      const streamMeta = activeStreams.get(session.id);
      if (!streamMeta || streamMeta.cancelled) break;

      if (['response_delta', 'response_detected', 'action_start', 'action_end', 'action_progress', 'error', 'done', 'response_done', 'thinking_start', 'thinking_delta', 'login_required', 'system', 'context_limit'].includes(ev.type)) {
        // v4.0-fix: For 'done' events, capture the final response from ev.result.response or ev.response
        // v9.5-fix: Include ev.error for error events so the message is not lost
        let content = ev.type === 'done'
          ? (ev.result?.response || ev.response || ev.text || ev.fullResponse || '')
          : (ev.error || ev.text || ev.fullResponse || '');

        // v10.3-fix: Strip tool JSON blocks from response_delta before persisting
        if (ev.type === 'response_delta' && content) {
          const hasToolJson = /"tool"\s*:/.test(content) || /"params"\s*:\s*\{/.test(content);
          if (hasToolJson) {
            // Attempt to strip inline JSON blocks with brace counting
            let stripped = '';
            let i = 0;
            while (i < content.length) {
              if (content[i] === '{') {
                let depth = 1, j = i + 1;
                let inString = false, escape = false;
                while (j < content.length && depth > 0) {
                  const c = content[j];
                  if (escape) { escape = false; }
                  else if (c === '\\') { escape = true; }
                  else if (c === '"') { inString = !inString; }
                  else if (!inString) { if (c === '{') depth++; else if (c === '}') depth--; }
                  j++;
                }
                if (depth === 0) {
                  const block = content.slice(i, j);
                  if (!/"tool"\s*:/.test(block)) {
                    stripped += block;
                  }
                  i = j;
                  continue;
                }
              }
              stripped += content[i];
              i++;
            }
            content = stripped;
          }
          // Skip empty deltas after stripping
          if (!content.trim()) continue;
        }

        // v10.3-fix: Deduplicate done events per messageId — luna-soul emits both response_done and done
        const existingDoneForMessage = (type) => {
          const sess = getWebSession(session.id);
          return sess && sess.messages.some(m => m.type === type && m.messageId === messageId);
        };

        if (ev.type === 'done' && existingDoneForMessage('done')) {
          continue; // Skip duplicate done for same message
        }
        
        // v5.4-fix: Skip duplicate events (same type + content within 5s window)
        // v10.1-fix: Never deduplicate incremental events (delta/progress) — they are
        // inherently sequential and dropping them causes content loss.
        // v10.3-fix: response_delta may carry the FULL accumulated text instead of a delta.
        // Deduplicate by content hash to prevent duplicate history entries.
        const isIncremental = ['response_delta', 'thinking_delta', 'action_progress'].includes(ev.type);
        const dedupKey = `${ev.type}:${content.slice(0, 200)}:${ev.tool || ''}`;
        if ((!isIncremental || ev.type === 'response_delta') && ev.type !== 'done' && ev.type !== 'response_done' && emittedEventHashes.has(dedupKey)) {
          continue;
        }
        if (!isIncremental || ev.type === 'response_delta') emittedEventHashes.add(dedupKey);
        
        // v8.4-fix: response_done is translated to 'done' below — don't add original
        if (ev.type !== 'response_done') {
          addMessageToSession(session.id, {
            id: 'ev-' + Date.now(),
            role: 'assistant',
            type: ev.type,
            content: content,
            fullThinking: ev.fullThinking || undefined,
            tool: ev.tool,
            params: ev.params,
            result: ev.result,
            messageId: messageId,
            timestamp: new Date().toISOString(),
          });
        }

        // v6.3-fix: luna-soul emits 'response_done' instead of 'done' — translate it
        if (ev.type === 'response_done' && !existingDoneForMessage('done')) {
          addMessageToSession(session.id, {
            id: 'done-' + Date.now(),
            role: 'assistant',
            type: 'done',
            content: content,
            result: { response: content },
            messageId: messageId,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
  } catch (e) {
    console.error('[WEB] Erro no processamento:', e.message);
    console.error('[WEB] Stack trace:', e.stack);
    const isLoginRequired = e.message === 'KIMI_LOGIN_REQUIRED' || e.message?.includes('login');
    addMessageToSession(session.id, {
      id: 'err-' + Date.now(),
      role: 'assistant',
      type: isLoginRequired ? 'login_required' : 'error',
      content: isLoginRequired
        ? 'Sessão do Kimi expirada. Por favor, faça login novamente no Chrome e recarregue a página.'
        : e.message,
      timestamp: new Date().toISOString(),
    });
  } finally {
    // v8.5-fix: Use session.id (the effective session) instead of sessionId from body (which may be undefined for new conversations)
    const effectiveSessionId = session ? session.id : sessionId;
    if (effectiveSessionId) {
      const finalSession = getWebSession(effectiveSessionId);
      if (finalSession) {
        // v10.3-fix: Only add fallback done if NO done exists for THIS messageId
        const hasFinalEventForMessage = finalSession.messages.some(m =>
          m.messageId === messageId && (m.type === 'done' || m.type === 'error' || m.type === 'login_required' || m.type === 'context_limit')
        );
        if (!hasFinalEventForMessage) {
          addMessageToSession(effectiveSessionId, {
            id: 'done-' + Date.now(),
            role: 'assistant',
            type: 'done',
            content: '',
            result: { response: '' },
            messageId: messageId,
            timestamp: new Date().toISOString(),
          });
        }
      }
      activeStreams.delete(effectiveSessionId);
    }
  }
});

// GET /api/chat/stream — SSE streaming
router.get('/api/chat/stream', requireAuthProxy, async (req, res) => {
  const sessionId = req.query.sessionId;
  if (!sessionId) {
    return res.status(400).send('sessionId obrigatório');
  }

  // Garantir que a sessão está carregada na memória
  let currentSession = getWebSession(sessionId);
  if (!currentSession) {
    currentSession = await loadSessionFromDB(sessionId);
  }
  if (!currentSession) {
    return res.status(404).send('Sessão não encontrada');
  }

  // v8.5-fix: validate session ownership
  const userId = req.user?.id || 'anonymous';
  if (currentSession.userId && currentSession.userId !== userId) {
    return res.status(403).send('Acesso negado a esta sessão');
  }

  // v8.5-fix: Do NOT close existing SSE connections automatically.
  // Allow multiple connections per session (e.g. reconnects, multiple tabs).
  // Only close stale connections older than 2 minutes.
  const existingConnections = sseConnections.get(sessionId);
  if (existingConnections) {
    const now = Date.now();
    for (const conn of existingConnections) {
      if (conn.createdAt && (now - conn.createdAt > 120000)) {
        console.log(`[SSE] Closing stale connection for session ${sessionId}`);
        clearInterval(conn.keepAlive);
        clearInterval(conn.checkInterval);
        try { conn.res.end(); } catch (e) {}
        existingConnections.delete(conn);
      }
    }
  }

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
  });

  sendSSE(res, 'connected', { type: 'connected', sessionId });

  // v8.5-fix: send full history on connect so reconnecting clients don't miss messages
  // v10.1-fix: snapshot messages atomically to prevent race condition where
  // a new message is added between the loop and lastMsgIndex assignment
  const initialMessages = [...currentSession.messages];
  for (const msg of initialMessages) {
    const eventData = {
      id: msg.id,
      type: msg.type,
      role: msg.role,
      sessionId,
      timestamp: msg.timestamp,
    };
    if (msg.content) eventData.text = msg.content;
    if (msg.content) eventData.fullResponse = msg.content;
    if (msg.content) eventData.response = msg.content;
    if (msg.fullThinking) eventData.fullThinking = msg.fullThinking;
    if (msg.tool) eventData.tool = msg.tool;
    if (msg.params) eventData.params = msg.params;
    if (msg.result) eventData.result = msg.result;
    if (msg.messageId) eventData.messageId = msg.messageId;
    if (msg.type === 'error') eventData.error = msg.content;
    if (msg.role === 'user') {
      eventData.content = msg.content;
      if (msg.files && msg.files.length > 0) eventData.files = msg.files;
    }
    sendSSE(res, msg.type, eventData);
  }

  const keepAlive = setInterval(() => {
    res.write(':keepalive\n\n');
  }, 15000);

  let lastMsgIndex = initialMessages.length; // Start from snapshot position, not current

  const checkInterval = setInterval(() => {
    const session = getWebSession(sessionId);
    if (!session) {
      // Sessão foi removida da memória, tenta recarregar
      return;
    }

    const newMessages = session.messages.slice(lastMsgIndex);
    for (const msg of newMessages) {
      const eventData = {
        id: msg.id,
        type: msg.type,
        role: msg.role,
        sessionId,
        timestamp: msg.timestamp,
      };
      if (msg.content) eventData.text = msg.content;
      if (msg.content) eventData.fullResponse = msg.content;
      if (msg.content) eventData.response = msg.content;
      if (msg.fullThinking) eventData.fullThinking = msg.fullThinking;
      if (msg.tool) eventData.tool = msg.tool;
      if (msg.params) eventData.params = msg.params;
      if (msg.result) eventData.result = msg.result;
      if (msg.messageId) eventData.messageId = msg.messageId;
      if (msg.type === 'error') eventData.error = msg.content;
      if (msg.role === 'user') {
        eventData.content = msg.content;
        if (msg.files && msg.files.length > 0) eventData.files = msg.files;
      }

      sendSSE(res, msg.type, eventData);
    }
    lastMsgIndex = session.messages.length;
  }, 100);

  // Track this connection
  let connSet = sseConnections.get(sessionId);
  if (!connSet) {
    connSet = new Set();
    sseConnections.set(sessionId, connSet);
  }
  const conn = { res, keepAlive, checkInterval, createdAt: Date.now() };
  connSet.add(conn);

  req.on('close', () => {
    clearInterval(checkInterval);
    clearInterval(keepAlive);
    connSet.delete(conn);
    if (connSet.size === 0) {
      sseConnections.delete(sessionId);
    }
  });
});

// GET /api/chat/sessions — busca do PostgreSQL (persistência entre reinícios)
router.get('/api/chat/sessions', requireAuthProxy, async (req, res) => {
  const userId = req.user?.id || 'anonymous';
  try {
    const rows = await db.query(
      `SELECT id, title, mode, messages, created_at, updated_at
       FROM luna_chat_sessions WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 100`,
      [userId]
    );
    const sessions = rows.map(row => ({
      id: row.id,
      title: row.title,
      mode: row.mode || 'instant',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      messageCount: Array.isArray(row.messages) ? row.messages.length : 0,
    }));
    res.json({ ok: true, sessions });
  } catch (e) {
    console.error('[DB] Erro ao listar sessões:', e.message);
    // Fallback para memória — filtrar por userId
    const sessions = Array.from(webSessions.values())
      .filter(s => !s.userId || s.userId === userId)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .map(s => ({
        id: s.id,
        title: s.title,
        mode: s.mode || 'instant',
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        messageCount: s.messages.length,
      }));
    res.json({ ok: true, sessions });
  }
});

// GET /api/chat/session/:id/messages
router.get('/api/chat/session/:id/messages', requireAuthProxy, async (req, res) => {
  let session = getWebSession(req.params.id);
  if (!session) {
    session = await loadSessionFromDB(req.params.id);
  }
  if (!session) return res.status(404).json({ ok: false, error: 'Sessão não encontrada' });

  const total = session.messages.length;
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  const beforeTimestamp = req.query.before; // ISO timestamp cursor (optional)

  let paginated;
  let hasMore;

  if (beforeTimestamp && beforeTimestamp !== 'null' && beforeTimestamp !== 'undefined') {
    // v10.3-fix: Timestamp-based pagination — find messages BEFORE the given timestamp
    const beforeDate = new Date(beforeTimestamp);
    const beforeIdx = session.messages.findIndex(m => m.timestamp && new Date(m.timestamp).getTime() >= beforeDate.getTime());
    const endIdx = beforeIdx >= 0 ? beforeIdx : total;
    const startIdx = Math.max(0, endIdx - limit);
    paginated = session.messages.slice(startIdx, endIdx);
    hasMore = startIdx > 0;
  } else {
    // No cursor — return the last `limit` messages (most recent)
    const startIdx = Math.max(0, total - limit);
    paginated = session.messages.slice(startIdx, total);
    hasMore = startIdx > 0;
  }

  res.json({ ok: true, messages: paginated, total, hasMore });
});

// POST /api/chat/session — create/rename/delete
router.post('/api/chat/session', requireAuthProxy, async (req, res) => {
  const { action, sessionId, title, persona } = req.body;

  switch (action) {
    case 'create': {
      const userId = req.user?.id || 'anonymous';
      const session = createWebSession(userId, title || 'Nova conversa');
      res.json({ ok: true, session: { id: session.id, title: session.title } });
      break;
    }
    case 'rename': {
      if (!sessionId || !title) return res.status(400).json({ ok: false, error: 'sessionId e title obrigatórios' });
      let session = getWebSession(sessionId);
      if (!session) session = await loadSessionFromDB(sessionId);
      if (session && renameWebSession(sessionId, title)) {
        res.json({ ok: true });
      } else {
        res.status(404).json({ ok: false, error: 'Sessão não encontrada' });
      }
      break;
    }
    case 'setPersona': {
      if (!sessionId || !persona) return res.status(400).json({ ok: false, error: 'sessionId e persona obrigatórios' });
      let session = getWebSession(sessionId);
      if (!session) session = await loadSessionFromDB(sessionId);
      if (session) {
        session.persona = persona;
        session.updatedAt = new Date().toISOString();
        dbRunWithRetry(
          `UPDATE luna_chat_sessions SET persona = $1, updated_at = NOW() WHERE id = $2`,
          [persona, sessionId]
        ).catch(e => console.error('[DB] Erro ao atualizar persona:', e.message));
        res.json({ ok: true, persona });
      } else {
        res.status(404).json({ ok: false, error: 'Sessão não encontrada' });
      }
      break;
    }
    case 'delete': {
      if (!sessionId) return res.status(400).json({ ok: false, error: 'sessionId obrigatório' });
      if (deleteWebSession(sessionId)) {
        res.json({ ok: true });
      } else {
        res.status(404).json({ ok: false, error: 'Sessão não encontrada' });
      }
      break;
    }
    default:
      res.status(400).json({ ok: false, error: 'Ação inválida. Use: create, rename, setPersona, delete' });
  }
});

// POST /api/chat/cancel
router.post('/api/chat/cancel', requireAuthProxy, async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ ok: false, error: 'sessionId obrigatório' });
  const stream = activeStreams.get(sessionId);
  if (stream) {
    stream.cancelled = true;
    activeStreams.delete(sessionId);
  }
  // v7.0: SOFT cancel when user clicks red button — agent keeps running in background.
  // Only frees the input. The agent continues sending events to frontend.
  try {
    const luna = await getLunaSoul();
    if (luna && luna.kimiBridge) {
      const userId = 'web-' + sessionId;
      await luna.kimiBridge.cancelStream(userId, true); // soft = true
    }
  } catch (e) {
    console.warn('[CANCEL] Kimi bridge cancel failed:', e.message);
  }
  res.json({ ok: true, message: 'Stream cancelado' });
});

// ============================================================
// Export API — JSON / Markdown / TXT (single or ZIP batch)
// ============================================================

function formatSessionAsJSON(session) {
  return JSON.stringify({
    id: session.id,
    title: session.title,
    mode: session.mode,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messages: session.messages || [],
  }, null, 2);
}

function formatSessionAsMarkdown(session) {
  let md = `# ${session.title || 'Sem título'}\n\n`;
  md += `- **ID:** ${session.id}\n`;
  md += `- **Modo:** ${session.mode || 'instant'}\n`;
  md += `- **Criado em:** ${session.createdAt || '-'}\n`;
  md += `- **Atualizado em:** ${session.updatedAt || '-'}\n\n`;
  md += `---\n\n`;
  const msgs = session.messages || [];
  for (const msg of msgs) {
    if (msg.type === 'text' || msg.type === 'response_delta') {
      const role = msg.role === 'user' ? '👤 Usuário' : '🤖 Luna';
      const time = msg.timestamp ? new Date(msg.timestamp).toLocaleString('pt-BR') : '';
      md += `### ${role}${time ? ` · ${time}` : ''}\n\n`;
      md += msg.content || '';
      md += '\n\n---\n\n';
    }
  }
  return md;
}

function formatSessionAsTXT(session) {
  let txt = `=== ${session.title || 'Sem titulo'} ===\n`;
  txt += `ID: ${session.id}\n`;
  txt += `Modo: ${session.mode || 'instant'}\n`;
  txt += `Criado: ${session.createdAt || '-'}\n`;
  txt += `Atualizado: ${session.updatedAt || '-'}\n`;
  txt += `========================\n\n`;
  const msgs = session.messages || [];
  for (const msg of msgs) {
    if (msg.type === 'text' || msg.type === 'response_delta') {
      const role = msg.role === 'user' ? '[Usuario]' : '[Luna]';
      txt += `${role} ${msg.content || ''}\n\n`;
    }
  }
  return txt;
}

router.post('/api/chat/export', requireAuthProxy, async (req, res) => {
  const { sessionIds, format = 'json' } = req.body;
  if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
    return res.status(400).json({ ok: false, error: 'sessionIds deve ser um array não vazio' });
  }
  if (!['json', 'markdown', 'txt'].includes(format)) {
    return res.status(400).json({ ok: false, error: 'Formato inválido. Use json, markdown ou txt' });
  }

  try {
    // Load sessions from DB or memory cache
    const sessions = [];
    for (const id of sessionIds) {
      let session = webSessions.get(id);
      if (!session) {
        session = await loadSessionFromDB(id);
      }
      if (session) sessions.push(session);
    }

    if (sessions.length === 0) {
      return res.status(404).json({ ok: false, error: 'Nenhuma sessão encontrada' });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (sessions.length === 1) {
      // Single session — return file directly
      const session = sessions[0];
      let content, filename, mime;
      if (format === 'json') {
        content = formatSessionAsJSON(session);
        filename = `luna-chat-${session.id}-${timestamp}.json`;
        mime = 'application/json';
      } else if (format === 'markdown') {
        content = formatSessionAsMarkdown(session);
        filename = `luna-chat-${session.id}-${timestamp}.md`;
        mime = 'text/markdown';
      } else {
        content = formatSessionAsTXT(session);
        filename = `luna-chat-${session.id}-${timestamp}.txt`;
        mime = 'text/plain';
      }
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', mime);
      res.send(content);
    } else {
      // Multiple sessions — return ZIP
      const zip = new JSZip();
      for (const session of sessions) {
        let content, ext;
        if (format === 'json') {
          content = formatSessionAsJSON(session);
          ext = 'json';
        } else if (format === 'markdown') {
          content = formatSessionAsMarkdown(session);
          ext = 'md';
        } else {
          content = formatSessionAsTXT(session);
          ext = 'txt';
        }
        const safeTitle = (session.title || 'sem-titulo').replace(/[^a-zA-Z0-9\-_\s]/g, '').replace(/\s+/g, '-').slice(0, 40);
        zip.file(`${safeTitle}-${session.id.slice(-6)}.${ext}`, content);
      }
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      const filename = `luna-export-${timestamp}.zip`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/zip');
      res.send(zipBuffer);
    }
  } catch (e) {
    console.error('[EXPORT] Erro:', e.message);
    res.status(500).json({ ok: false, error: 'Erro ao exportar conversas' });
  }
});

// ============================================================
// Config API
// ============================================================

router.get('/api/config', (req, res) => {
  const env = readEnv();
  const promptResult = readSystemPrompt();
  res.json({
    ok: true,
    env,
    systemPrompt: promptResult.content,
    systemPromptFound: promptResult.found,
    paths: { env: ENV_PATH, soul: SOUL_PATH },
  });
});

router.post('/api/config', (req, res) => {
  const body = req.body;
  const results = [];
  if (body.env) {
    try { writeEnv(body.env); results.push('env'); }
    catch (e) { return res.status(500).json({ ok: false, error: `Erro ao salvar .env: ${e.message}` }); }
  }
  if (body.systemPrompt !== undefined) {
    try {
      if (writeSystemPrompt(body.systemPrompt)) results.push('systemPrompt');
      else return res.status(500).json({ ok: false, error: 'Não foi possível atualizar o system prompt' });
    } catch (e) { return res.status(500).json({ ok: false, error: `Erro ao salvar system prompt: ${e.message}` }); }
  }
  res.json({ ok: true, saved: results });
});

// ============================================================
// Test Routes
// ============================================================

async function testTelegram(token) {
  try {
    const https = require('https');
    return new Promise((resolve) => {
      const request = https.get(
        `https://api.telegram.org/bot${token}/getMe`,
        { timeout: 10000 },
        (r) => {
          let data = '';
          r.on('data', chunk => data += chunk);
          r.on('end', () => {
            try {
              const json = JSON.parse(data);
              resolve(json.ok ? { ok: true, bot: json.result } : { ok: false, error: json.description });
            } catch (e) { resolve({ ok: false, error: 'Resposta inválida da API' }); }
          });
        }
      );
      request.on('error', (e) => resolve({ ok: false, error: e.message }));
      request.on('timeout', () => { request.destroy(); resolve({ ok: false, error: 'Timeout' }); });
    });
  } catch (e) { return { ok: false, error: e.message }; }
}

function testNode() {
  try {
    const version = execSync('node -v', { encoding: 'utf-8', timeout: 5000 }).trim();
    const major = parseInt(version.replace('v', '').split('.')[0]);
    return { ok: true, version, sufficient: major >= 20, message: major >= 20 ? `Node.js ${version} ✅` : `Node.js ${version} — precisa v20+` };
  } catch (e) { return { ok: false, error: 'Node.js não encontrado no PATH' }; }
}

function testChrome() {
  const commands = ['google-chrome', 'chromium-browser', 'chromium', 'google-chrome-stable'];
  for (const cmd of commands) {
    try {
      const version = execSync(`${cmd} --version 2>/dev/null`, { encoding: 'utf-8', timeout: 5000 }).trim();
      return { ok: true, command: cmd, version };
    } catch (e) { /* try next */ }
  }
  return { ok: false, error: 'Chrome/Chromium não encontrado. Instale: sudo apt-get install google-chrome-stable' };
}

router.post('/api/test/telegram', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ ok: false, error: 'Token obrigatório' });
  const result = await testTelegram(token);
  res.status(result.ok ? 200 : 400).json(result);
});

router.get('/api/test/node', (req, res) => {
  res.json(testNode());
});

router.get('/api/test/chrome', (req, res) => {
  res.json(testChrome());
});

// ============================================================
// Plan Mode State
// ============================================================
const planModeSessions = new Map(); // sessionId -> { status, plan, planPath, createdAt }

// ============================================================
// Plan Mode Routes
// ============================================================

// POST /api/plan — start plan mode investigation
router.post('/api/plan', requireAuthProxy, async (req, res) => {
  const { message, sessionId } = req.body;
  if (!message) return res.status(400).json({ ok: false, error: 'message obrigatório' });

  const userId = req.user?.id || 'anonymous';
  let session = sessionId ? getWebSession(sessionId) : null;
  if (!session) {
    session = createWebSession(userId, '🔍 Plano: ' + message.slice(0, 30), 'thinking');
  }
  // v8.5-fix: validate session ownership
  if (session.userId && session.userId !== userId) {
    return res.status(403).json({ ok: false, error: 'Acesso negado a esta sessão' });
  }

  // Mark session in plan mode
  planModeSessions.set(session.id, { status: 'investigating', plan: null, planPath: null, createdAt: Date.now() });

  res.json({ ok: true, sessionId: session.id, status: 'investigating' });

  // Process in background
  try {
    const luna = await getLunaSoul();
    const stream = luna.processPlanModeStream(message, {
      sessionId: session.id,
      userId: 'web-plan-' + session.id,
      userName: req.user?.name || 'Usuário',
      userRealId: req.user?.id || 'anonymous',
      userRole: req.user?.role || 'User',
    });

    for await (const ev of stream) {
      const planMeta = planModeSessions.get(session.id);
      if (!planMeta) break;

      if (ev.type === 'plan_start') {
        planMeta.status = 'investigating';
      } else if (ev.type === 'plan_delta') {
        planMeta.plan = ev.fullPlan || '';
      } else if (ev.type === 'plan_awaiting_approval') {
        planMeta.status = 'awaiting_approval';
        planMeta.plan = ev.plan || '';
        planMeta.planPath = ev.planPath || null;
      } else if (['thinking_delta', 'action_start', 'action_end', 'action_progress', 'error', 'login_required'].includes(ev.type)) {
        // Forward to SSE via session messages
        addMessageToSession(session.id, {
          id: 'plan-ev-' + Date.now(),
          role: 'assistant',
          type: ev.type,
          content: ev.text || ev.message || ev.error || '',
          fullThinking: ev.fullThinking || undefined,
          tool: ev.tool,
          params: ev.params,
          result: ev.result,
          timestamp: new Date().toISOString(),
        });
      }

      // Also emit via SSE by adding as a message
      if (['plan_start', 'plan_delta', 'plan_display', 'plan_awaiting_approval'].includes(ev.type)) {
        addMessageToSession(session.id, {
          id: 'plan-' + Date.now(),
          role: 'assistant',
          type: ev.type,
          content: ev.plan || ev.message || '',
          plan: ev.plan || undefined,
          planPath: ev.planPath || undefined,
          timestamp: new Date().toISOString(),
        });
      }
    }
  } catch (e) {
    console.error('[WEB] Erro no plan mode:', e.message);
    planModeSessions.set(session.id, { status: 'error', error: e.message });
    addMessageToSession(session.id, {
      id: 'plan-err-' + Date.now(),
      role: 'assistant',
      type: 'error',
      content: e.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// POST /api/plan/approve — approve plan and switch to execution
router.post('/api/plan/approve', requireAuthProxy, (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ ok: false, error: 'sessionId obrigatório' });

  const planMeta = planModeSessions.get(sessionId);
  if (!planMeta) return res.status(404).json({ ok: false, error: 'Nenhum plano ativo para esta sessão' });

  planMeta.status = 'approved';

  const session = getWebSession(sessionId);
  if (session) {
    session.planMode = false;
    session.planStatus = 'approved';
  }

  // Notify via SSE
  addMessageToSession(sessionId, {
    id: 'plan-approved-' + Date.now(),
    role: 'assistant',
    type: 'plan_approved',
    content: '✅ Plano aprovado! Pode continuar com mensagens normais.',
    timestamp: new Date().toISOString(),
  });

  res.json({ ok: true, status: 'approved' });
});

// POST /api/plan/reject — reject plan
router.post('/api/plan/reject', requireAuthProxy, (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ ok: false, error: 'sessionId obrigatório' });

  const planMeta = planModeSessions.get(sessionId);
  if (!planMeta) return res.status(404).json({ ok: false, error: 'Nenhum plano ativo para esta sessão' });

  planMeta.status = 'rejected';

  const session = getWebSession(sessionId);
  if (session) {
    session.planMode = false;
    session.planStatus = 'rejected';
  }

  addMessageToSession(sessionId, {
    id: 'plan-rejected-' + Date.now(),
    role: 'assistant',
    type: 'plan_rejected',
    content: '❌ Plano rejeitado. Pode solicitar um novo plano com /plan.',
    timestamp: new Date().toISOString(),
  });

  res.json({ ok: true, status: 'rejected' });
});

// POST /api/plan/revise — revise plan
router.post('/api/plan/revise', requireAuthProxy, (req, res) => {
  const { sessionId, revisedPlan } = req.body;
  if (!sessionId) return res.status(400).json({ ok: false, error: 'sessionId obrigatório' });

  const planMeta = planModeSessions.get(sessionId);
  if (!planMeta) return res.status(404).json({ ok: false, error: 'Nenhum plano ativo para esta sessão' });

  planMeta.plan = revisedPlan || planMeta.plan;
  planMeta.status = 'awaiting_approval';

  addMessageToSession(sessionId, {
    id: 'plan-revised-' + Date.now(),
    role: 'assistant',
    type: 'plan_revised',
    content: '✏️ Plano revisado. Aguardando aprovação.',
    plan: planMeta.plan,
    timestamp: new Date().toISOString(),
  });

  res.json({ ok: true, status: 'awaiting_approval' });
});

// ============================================================
// Local System Commands (/api/system/*)
// ============================================================

const LUNA_NEXO_SCRIPT = '/home/jhin/NEXO_DASHBOARD_PRO/luna-nexo.sh';

function runScript(action, timeoutMs = 30000) {
  return new Promise((resolve) => {
    const cmd = `bash "${LUNA_NEXO_SCRIPT}" ${action} 2>&1`;
    exec(cmd, { timeout: timeoutMs }, (error, stdout, stderr) => {
      if (error && error.killed) {
        resolve({ ok: false, error: 'Timeout — comando demorou demais' });
        return;
      }
      const output = stdout || stderr || '';
      resolve({ ok: !error, output: output.trim(), error: error?.message });
    });
  });
}

function getServiceStatus() {
  const results = {};
  const services = [
    { name: 'nexo-dashboard', port: 3456, label: 'Dashboard NEXO PRO' },
    { name: 'luna-web-server', port: 3458, label: 'Luna Web Server' },
    { name: 'luna-web-vite', port: 5173, label: 'Luna Web Vite' },
  ];
  for (const svc of services) {
    try {
      execSync(`ss -tlnp | grep -q ':${svc.port} '`, { timeout: 3000 });
      results[svc.name] = { status: 'running', port: svc.port, label: svc.label };
    } catch {
      results[svc.name] = { status: 'stopped', port: svc.port, label: svc.label };
    }
  }
  // Telegram bot
  try {
    const tgPid = execSync("pgrep -f 'telegram-luna-adapter.cjs' | head -1", { encoding: 'utf-8', timeout: 3000 }).trim();
    if (tgPid) {
      const uptime = execSync(`ps -p ${tgPid} -o etime= 2>/dev/null || echo '?'`, { encoding: 'utf-8', timeout: 3000 }).trim();
      results['telegram-bot'] = { status: 'running', pid: parseInt(tgPid), uptime, label: 'Bot do Telegram' };
    } else {
      results['telegram-bot'] = { status: 'stopped', label: 'Bot do Telegram' };
    }
  } catch {
    results['telegram-bot'] = { status: 'stopped', label: 'Bot do Telegram' };
  }
  // Kimi Bridge status via Luna Soul
  try {
    if (lunaSoul && lunaSoul.kimiBridge) {
      const kb = lunaSoul.kimiBridge;
      results['kimi-bridge'] = {
        status: kb.browser ? 'connected' : 'disconnected',
        label: 'Kimi Bridge',
        pages: kb.userSessions?.size || 0,
        contexts: kb.userContexts?.size || 0,
        semaphore: kb.semaphore?.current || 0,
        maxPages: kb.maxPages || 999,
      };
    } else {
      results['kimi-bridge'] = { status: 'disconnected', label: 'Kimi Bridge' };
    }
  } catch {
    results['kimi-bridge'] = { status: 'disconnected', label: 'Kimi Bridge' };
  }
  return results;
}

router.post('/api/system/restart', async (req, res) => {
  res.json({ ok: true, message: '🔄 Reiniciando todos os serviços...' });
  setTimeout(() => runScript('restart'), 500);
});

router.post('/api/system/stop', async (req, res) => {
  res.json({ ok: true, message: '🛑 Parando todos os serviços...' });
  setTimeout(() => runScript('stop'), 500);
});

router.post('/api/system/start', async (req, res) => {
  const result = await runScript('start', 60000);
  res.json({ ok: result.ok, message: result.ok ? '▶ Serviços iniciados' : result.error, output: result.output });
});

router.get('/api/system/status', async (req, res) => {
  const status = getServiceStatus();
  res.json({ ok: true, status });
});

// POST /api/system/bridge-start — force KimiBridge reconnect (manual override when bridge drops)
router.post('/api/system/bridge-start', async (req, res) => {
  try {
    const luna = await getLunaSoul();
    if (!luna) {
      return res.status(503).json({ ok: false, error: 'Luna Soul não inicializado' });
    }
    if (!luna.kimiBridge) {
      const { KimiBridge } = require(path.join(LUNA_DIR, 'kimi-bridge.cjs'));
      luna.kimiBridge = new KimiBridge();
    }
    if (luna.kimiBridge.browser) {
      return res.json({ ok: true, message: '✅ Kimi Bridge já está conectado', alreadyConnected: true });
    }
    console.log('[BRIDGE-START] Forçando conexão do Kimi Bridge...');
    await luna.kimiBridge.connect();
    console.log('[BRIDGE-START] Kimi Bridge conectado com sucesso');
    res.json({
      ok: true,
      message: '🔌 Kimi Bridge conectado com sucesso!',
      pages: luna.kimiBridge.userSessions?.size || 0,
      contexts: luna.kimiBridge.userContexts?.size || 0,
    });
  } catch (e) {
    console.error('[BRIDGE-START] Erro ao conectar bridge:', e.message);
    res.status(500).json({ ok: false, error: `Falha ao conectar bridge: ${e.message}` });
  }
});

router.get('/api/system/health', async (req, res) => {
  const start = Date.now();
  const status = getServiceStatus();
  const allRunning = Object.values(status).every(s => s.status === 'running' || s.status === 'connected');

  // v10.0-fix: Enhanced health check with bridge metrics
  let bridgeMetrics = null;
  try {
    if (lunaSoul && lunaSoul.kimiBridge) {
      const kb = lunaSoul.kimiBridge;
      const memUsage = process.memoryUsage();
      bridgeMetrics = {
        browserConnected: !!kb.browser,
        pages: kb.userSessions?.size || 0,
        contexts: kb.userContexts?.size || 0,
        cdpUrl: kb.cdpUrl || null,
        memory: {
          rssMB: Math.round(memUsage.rss / 1024 / 1024),
          heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
          externalMB: Math.round(memUsage.external / 1024 / 1024),
        },
      };
    }
  } catch (e) {
    bridgeMetrics = { error: e.message };
  }

  res.json({
    ok: allRunning,
    status,
    timestamp: new Date().toISOString(),
    lunaSoulReady: lunaReady,
    latencyMs: Date.now() - start,
    bridge: bridgeMetrics,
  });
});

router.get('/api/system/logs', async (req, res) => {
  const lines = parseInt(req.query.lines) || 50;
  const result = await new Promise((resolve) => {
    exec(`journalctl --user -u luna-server -n ${lines} --no-pager 2>&1 || echo "Logs não disponíveis via journalctl"`, { timeout: 10000 }, (error, stdout) => {
      resolve({ output: stdout?.trim() || 'Nenhum log disponível' });
    });
  });
  res.json({ ok: true, logs: result.output });
});

// POST /api/system/test-connection — test Telegram, Dashboard, or Kimi
router.post('/api/system/test-connection', async (req, res) => {
  const { type } = req.body;
  if (!type) return res.status(400).json({ ok: false, error: 'type obrigatório (telegram, dashboard, kimi)' });

  if (type === 'telegram') {
    const token = req.body.token;
    if (!token) return res.status(400).json({ ok: false, error: 'token obrigatório' });
    try {
      const https = require('https');
      const result = await new Promise((resolve, reject) => {
        const req = https.get(`https://api.telegram.org/bot${token}/getMe`, (resp) => {
          let data = '';
          resp.on('data', chunk => data += chunk);
          resp.on('end', () => {
            try {
              const json = JSON.parse(data);
              if (json.ok) resolve({ ok: true, bot: json.result });
              else resolve({ ok: false, error: json.description || 'Token inválido' });
            } catch { resolve({ ok: false, error: 'Resposta inválida da API do Telegram' }); }
          });
        });
        req.on('error', (e) => resolve({ ok: false, error: e.message }));
        req.setTimeout(10000, () => { req.destroy(); resolve({ ok: false, error: 'Timeout' }); });
      });
      res.json(result);
    } catch (e) {
      res.json({ ok: false, error: e.message });
    }
  } else if (type === 'dashboard') {
    const token = req.body.token;
    if (!token) return res.status(400).json({ ok: false, error: 'token obrigatório' });
    try {
      jwt.verify(token, process.env.JWT_SECRET || 'nexo-test-secret-2026');
      res.json({ ok: true, message: 'Token válido' });
    } catch (e) {
      res.json({ ok: false, error: 'Token inválido: ' + e.message });
    }
  } else if (type === 'kimi') {
    try {
      if (lunaSoul && lunaSoul.kimiBridge && lunaSoul.kimiBridge.browser) {
        res.json({ ok: true, message: 'Kimi Bridge conectado ao Chrome', pages: lunaSoul.kimiBridge.userSessions?.size || 0 });
      } else {
        res.json({ ok: false, error: 'Kimi Bridge não conectado' });
      }
    } catch (e) {
      res.json({ ok: false, error: e.message });
    }
  } else {
    res.status(400).json({ ok: false, error: 'Tipo desconhecido. Use: telegram, dashboard, kimi' });
  }
});

// POST /api/luna/execute — execute a Luna tool directly (no Kimi Bridge)
router.post('/api/luna/execute', async (req, res) => {
  const { tool, params } = req.body;
  if (!tool) return res.status(400).json({ ok: false, error: 'tool obrigatorio' });

  try {
    const lunaTools = require(path.join(LUNA_DIR, 'luna-tools.cjs'));
    const fn = lunaTools[tool];
    if (!fn || typeof fn !== 'function') {
      return res.status(400).json({ ok: false, error: `Tool desconhecida: ${tool}` });
    }
    const result = await fn(params);
    res.json({ ok: true, result });
  } catch (e) {
    console.error(`[LUNA TOOL] ${tool} error:`, e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/selfhost/download — generate self-host package
router.post('/api/selfhost/download', async (req, res) => {
  try {
    const tmpDir = `/tmp/luna-selfhost-${Date.now()}`;
    fs.mkdirSync(tmpDir, { recursive: true });

    // ── Copy core Luna Kernel files (no clone needed — works offline) ──
    const copyRecursive = (src, dest) => {
      if (!fs.existsSync(src)) return;
      const stat = fs.statSync(src);
      if (stat.isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        for (const entry of fs.readdirSync(src)) {
          // Skip node_modules, logs, backups, temp, sensitive cookies
          if (['node_modules', '.git', 'logs', 'backup', 'backups', '.tmp', 'tmp', 'cookies', '.old', 'luna-web', 'plans', 'config-server.cjs.BAK'].includes(entry)) continue;
          copyRecursive(path.join(src, entry), path.join(dest, entry));
        }
      } else {
        fs.copyFileSync(src, dest);
      }
    };
    copyRecursive(LUNA_DIR, tmpDir);

    // ── Generate pre-configured .env ──
    const env = readEnv();
    const envContent = `# Luna Kernel v5.0 — Self-Host Package
# Generated by Luna Config Panel
# NEXO DIGITAL S.L.
# ============================================================

# ── REQUIRED ──

TELEGRAM_BOT_TOKEN=${env.TELEGRAM_BOT_TOKEN || 'your_telegram_bot_token_here'}
INTERNAL_API_TOKEN=${env.INTERNAL_API_TOKEN || 'your_dashboard_api_token_here'}
JWT_SECRET=${env.JWT_SECRET || require('crypto').randomBytes(32).toString('hex')}

# ── OPTIONAL ──

KIMI_TIMEOUT=${env.KIMI_TIMEOUT || '120000'}
KIMI_MAX_PAGES=${env.KIMI_MAX_PAGES || '5'}
KIMI_IDLE_TIMEOUT=${env.KIMI_IDLE_TIMEOUT || '600000'}
KIMI_COOLDOWN_MS=${env.KIMI_COOLDOWN_MS || '5000'}
KIMI_MAX_TYPE_LENGTH=${env.KIMI_MAX_TYPE_LENGTH || '500'}
KIMI_LOG_MAX_MB=${env.KIMI_LOG_MAX_MB || '10'}
LUNA_COMPACT_THRESHOLD=${env.LUNA_COMPACT_THRESHOLD || '24'}
LUNA_COMPACT_TOKEN_THRESHOLD=${env.LUNA_COMPACT_TOKEN_THRESHOLD || '120000'}
# LUNA_CHROME_PATH=/usr/bin/google-chrome
LUNA_DEBUG=${env.LUNA_DEBUG || 'false'}
LUNA_CONFIG_PORT=3458
`;
    fs.writeFileSync(path.join(tmpDir, '.env'), envContent, 'utf-8');

    // ── Generate README.md with full tutorial ──
    const readme = `# 🌙 Luna Kernel v5.0 — Pacote Self-Host

> Pacote gerado pela Luna Config Panel — pronto para instalar em outro PC.

---

## 📋 Pré-requisitos

| Software | Versão | Como verificar |
|----------|--------|----------------|
| Node.js  | v20+   | \`node -v\` |
| Git      | qualquer | \`git --version\` |
| Chrome / Chromium | qualquer | \`google-chrome --version\` |

Se não tiver o Node.js v20+:
\`\`\`bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verifique
node -v  # deve mostrar v20.x ou superior
\`\`\`

Se não tiver o Chrome:
\`\`\`bash
sudo apt-get install -y google-chrome-stable
\`\`\`

---

## 🚀 Instalação (3 passos)

### 1. Descompacte o pacote
\`\`\`bash
cd ~/Downloads   # ou onde salvou o zip
unzip luna-selfhost.zip -d luna-kernel
cd luna-kernel
\`\`\`

### 2. Instale as dependências
\`\`\`bash
npm install
\`\`\`

### 3. Inicie a Luna

**Opção A — Interface Web (recomendado):**
\`\`\`bash
node luna-server.js
# Acesse: http://localhost:3458
\`\`\`

**Opção B — Bot do Telegram:**
\`\`\`bash
node telegram-luna-adapter.cjs
\`\`\`

**Opção C — PM2 (roda em background, não fecha ao fechar o terminal):**
\`\`\`bash
npm install -g pm2
pm2 start luna-server.js --name luna-web
pm2 start telegram-luna-adapter.cjs --name luna-telegram
pm2 save
pm2 startup
\`\`\`

---

## 🔐 Login

O arquivo \`.env\` já vem pré-configurado com os tokens.

Para acessar a web interface:
1. Abra http://localhost:3458
2. Login: \`abner\`
3. Senha: \`7741\`

> ⚠️  O \`.env\` deste pacote já contém os tokens do bot do Telegram e da API. **Não compartilhe este arquivo publicamente.**

---

## 🧠 Como Usar

### Interface Web
- Clique em **"Nova Sessão"** para começar
- Escolha o modo: \`instant\` (rápido) ou \`thinking\` (mais preciso)
- A Luna pode criar arquivos, executar comandos, navegar na web, etc.

### Telegram
- Adicione o bot ao seu grupo ou converse diretamente
- Use \`/kimi on\` para a Luna responder todas as mensagens
- Use \`/kimi off\` para desligar

---

## 📁 O que está neste pacote

| Arquivo / Pasta | Descrição |
|-----------------|-----------|
| \`luna-soul.cjs\` | Cérebro da Luna (AI + ferramentas) |
| \`luna-tools.cjs\` | Ferramentas: criar arquivos, executar comandos, etc. |
| \`kimi-bridge.cjs\` | Conexão com o Kimi AI via Chrome |
| \`luna-server.js\` | Servidor web com chat em tempo real |
| \`telegram-luna-adapter.cjs\` | Bot do Telegram |
| \`.env\` | Configurações pré-preenchidas |
| \`luna-extension/\` | Extensão do Chrome para o Kimi Bridge |

---

## 🔧 Problemas comuns

**\`npm install\` falha?**
\`\`\`bash
# Limpe o cache e tente de novo
rm -rf node_modules package-lock.json
npm install
\`\`\`

**Chrome não encontrado?**
Edite o \`.env\` e adicione:
\`\`\`
LUNA_CHROME_PATH=/usr/bin/google-chrome
\`\`\`

**Porta 3458 já em uso?**
Edite o \`.env\` e mude:
\`\`\`
LUNA_CONFIG_PORT=3459
\`\`\`

---

## 👨‍👦 Compartilhando com a família

Este pacote pode ser copiado para **qualquer PC Linux** (ou WSL no Windows) com Node.js v20+.

1. Copie o \`luna-selfhost.zip\` para o PC do seu pai/mãe/irmão
2. Siga os 3 passos de instalação acima
3. Pronto! Todos usam a **mesma conta** e acessam o mesmo histórico.

---

NEXO DIGITAL S.L. — Private Use Only
`;
    fs.writeFileSync(path.join(tmpDir, 'README.md'), readme, 'utf-8');

    // ── Generate quick-start.sh ──
    const startSh = `#!/bin/bash
# Luna Kernel — Quick Start
cd "\$(dirname "\$0")"
echo "🌙 Instalando dependências..."
npm install
echo "🌙 Iniciando Luna Web Server..."
node luna-server.js
`;
    fs.writeFileSync(path.join(tmpDir, 'quick-start.sh'), startSh, 'utf-8');
    fs.chmodSync(path.join(tmpDir, 'quick-start.sh'), 0o755);

    // ── Create zip ──
    const zipPath = `${tmpDir}.zip`;
    await new Promise((resolve, reject) => {
      exec(`cd ${tmpDir} && zip -r ${zipPath} .`, { timeout: 60000 }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.download(zipPath, 'luna-selfhost.zip', (err) => {
      // Cleanup temp files after sending
      setTimeout(() => {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
        try { fs.unlinkSync(zipPath); } catch {}
      }, 30000);
      if (err) console.error('Download error:', err.message);
    });
  } catch (e) {
    console.error('[SELFHOST] Erro ao gerar pacote:', e);
    res.status(500).json({ ok: false, error: 'Erro ao gerar pacote: ' + e.message });
  }
});

// ============================================================
// Auto-Health Monitor
// ============================================================
const AUTO_HEALTH_INTERVAL_MS = 30000; // 30s
const HEALTH_CHECK_TIMEOUT_MS = 15000; // 15s
let lastHealthCheckOk = true;
let healthCheckConsecutiveFailures = 0;

setInterval(async () => {
  try {
    // Check if Luna Soul is responsive
    if (!lunaReady || !lunaSoul) {
      healthCheckConsecutiveFailures++;
      console.warn(`[AUTO-HEALTH] Luna Soul não inicializado. Falha #${healthCheckConsecutiveFailures}`);
    } else {
      // Quick health ping: try to access session manager
      const hasSessions = lunaSoul.sessionManager !== undefined;
      if (hasSessions) {
        healthCheckConsecutiveFailures = 0;
        lastHealthCheckOk = true;
      } else {
        healthCheckConsecutiveFailures++;
        console.warn(`[AUTO-HEALTH] Luna Soul sem session manager. Falha #${healthCheckConsecutiveFailures}`);
      }
    }

    // Also check if port 3458 is listening
    const portOpen = await new Promise((resolve) => {
      exec('ss -tlnp | grep -q ":3458 "', { timeout: 5000 }, (err) => resolve(!err));
    });
    if (!portOpen) {
      healthCheckConsecutiveFailures++;
      console.error(`[AUTO-HEALTH] Porta 3458 fechada! Falha #${healthCheckConsecutiveFailures}`);
    }

    // Restart if 3 consecutive failures
    if (healthCheckConsecutiveFailures >= 3) {
      console.error('[AUTO-HEALTH] ⚠️ 3 falhas consecutivas. Reiniciando serviços...');
      healthCheckConsecutiveFailures = 0;
      runScript('restart', 60000);
    }
  } catch (e) {
    console.error('[AUTO-HEALTH] Erro no health check:', e.message);
  }
}, AUTO_HEALTH_INTERVAL_MS);

// ============================================================
// Auth Routes (new)
// ============================================================
// NOTE: validateCredentials, generateToken, requireAuth are injected
// from server.js via router.locals or passed as options.
// For now, we export a function that accepts these dependencies.

function setupAuth({ validateCredentials, generateToken, requireAuth: injectedRequireAuth }) {
  requireAuth = injectedRequireAuth || requireAuth;
  router.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ ok: false, error: 'Username e senha obrigatórios' });
    }
    const user = await validateCredentials(username, password);
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Credenciais inválidas' });
    }
    const token = generateToken(user.id);
    res.json({ ok: true, token, user });
  });

  router.get('/api/auth/me', requireAuthProxy, (req, res) => {
    res.json({ ok: true, user: req.user });
  });
}

// GET /api/personas — list available personas
router.get('/api/personas', (req, res) => {
  try {
    const fs = require('fs');
    const personasDir = config.PATHS.personas;
    const personas = [];
    if (fs.existsSync(personasDir)) {
      const files = fs.readdirSync(personasDir).filter(f => f.endsWith('.md'));
      for (const file of files) {
        const content = fs.readFileSync(path.join(personasDir, file), 'utf8');
        const nameMatch = content.match(/name:\s*(.+)/);
        const descMatch = content.match(/description:\s*(.+)/);
        personas.push({
          id: file.replace('.md', ''),
          name: nameMatch ? nameMatch[1].trim() : file.replace('.md', ''),
          description: descMatch ? descMatch[1].trim() : '',
        });
      }
    }
    res.json({ ok: true, personas });
  } catch (e) {
    console.error('[PERSONAS] Error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ============================================================
// System Routes — heartbeat, turnoff, health
// ============================================================

// POST /api/system/heartbeat — keep the agent page alive + track active users
router.post('/api/system/heartbeat', async (req, res) => {
  const { userId } = req.body;
  // v10.2: Track active users for presence panel
  const realUserId = req.user?.id || userId || 'anonymous';
  const userName = req.user?.name || realUserId;
  activeUsers.set(realUserId, { lastSeen: Date.now(), name: userName });

  try {
    const luna = await getLunaSoul();
    if (luna.kimiBridge) {
      const uid = userId || 'web-default';
      luna.kimiBridge.setPersistent(uid);
      // Update lastActivity to prevent idle cleanup
      const session = luna.kimiBridge.userSessions.get(uid);
      if (session) {
        session.lastActivity = Date.now();
      }
    }
    res.json({ ok: true, persistent: true });
  } catch (e) {
    console.error('[HEARTBEAT] Error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/users/active — list active users with presence status
router.get('/api/users/active', requireAuthProxy, async (req, res) => {
  const now = Date.now();
  let usersData = { users: {} };
  try {
    usersData = await dataStore.getUsers();
  } catch (e) {
    console.warn('[UsersActive] dataStore.getUsers falhou:', e.message);
  }

  const users = [];
  for (const [uid, user] of Object.entries(usersData.users || {})) {
    const active = activeUsers.get(uid);
    const lastSeenMs = active ? now - active.lastSeen : Infinity;
    let status = 'offline';
    if (active && lastSeenMs <= 2 * 60 * 1000) status = 'online';
    else if (active && lastSeenMs <= 10 * 60 * 1000) status = 'away';

    users.push({
      userId: uid,
      name: user.name || uid,
      role: user.role || 'user',
      color: user.color || null,
      status,
      lastSeen: active ? new Date(active.lastSeen).toISOString() : null,
    });
  }

  res.json({ ok: true, users });
});

// POST /api/system/turnoff — explicitly close the agent page
router.post('/api/system/turnoff', async (req, res) => {
  const { userId } = req.body;
  try {
    const luna = await getLunaSoul();
    if (luna.kimiBridge) {
      const uid = userId || 'web-default';
      luna.kimiBridge.unsetPersistent(uid);
      const session = luna.kimiBridge.userSessions.get(uid);
      if (session && session.page && !session.page.isClosed()) {
        await session.page.close().catch(() => {});
      }
      luna.kimiBridge.userSessions.delete(uid);
      const ctx = luna.kimiBridge.userContexts.get(uid);
      if (ctx && typeof ctx.close === 'function') {
        await ctx.close().catch(() => {});
        luna.kimiBridge.userContexts.delete(uid);
      }
    }
    res.json({ ok: true, message: 'Luna desligada. Envie uma mensagem para acordar.' });
  } catch (e) {
    console.error('[TURNOFF] Error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = { router, setupAuth, getLunaSoul };
