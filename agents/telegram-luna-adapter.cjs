// ============================================================
// LUNA TELEGRAM ADAPTER v4.1 — Cliente do Luna Web
// Adapter fino: não roda Luna Soul local. Consome a API do luna-server:3458.
// ============================================================

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

// v10.11-fix: Garantir que node_modules do projeto principal seja encontrado
// quando o PM2 roda com cwd=.../agents/
module.paths.unshift(path.join(__dirname, '..', 'node_modules'));

const { EventSource } = require('eventsource');

// v10.11-fix: Carrega .env do diretório correto.
// O .env real fica em ~/.luna-kernel/.env (compartilhado entre kernel e dashboard).
require('dotenv').config({ path: path.join(os.homedir(), '.luna-kernel', '.env') });

const getTelegramBot = require('../backend/services/telegram-bot-client.cjs');
const { SessionManager } = require('./session-manager.cjs');

const SESSION_DIR = path.join(__dirname, '..', 'data', 'telegram-sessions');
if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

const LUNA_API_URL = process.env.LUNA_API_URL || 'http://localhost:3458';
const STREAM_TIMEOUT_MS = 5 * 60 * 1000; // v4.2-fix: 5 min é suficiente; sem eventos por 90s já encerra

function sanitizeChatId(chatId) {
  return String(chatId).replace(/[^a-zA-Z0-9_-]/g, '');
}

// ── CONFIG ──
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN não configurado');
  process.exit(1);
}

// ── ADAPTER ──
class TelegramLunaAdapter {
  constructor() {
    // v10.11-fix: Usa singleton do telegram-bot-client com polling=true.
    // Isso evita 409 Conflict com o dashboard (que usa polling=false).
    this.bot = getTelegramBot(TOKEN, { polling: true });
    this.activeStreams = new Map(); // chatId → { messageId, lastEdit }
    this.activeUsers = new Map();   // v4.2-fix: userId → { since, messageId } para expirar locks travados
    this.awakeChats = new Set();    // chats em modo persistente (wake)
    this.processedMessageIds = new Set(); // v4.2-fix: deduplica mensagens do Telegram
    this.sleepingNotified = new Set(); // v4.2-fix: evita spam quando dormindo
    this._loadAwakeState();
  }

  async start() {
    console.log('🚀 Iniciando Luna Telegram Adapter v4.1...');

    this.sessionManager = new SessionManager();

    // v10.11-fix: Health-check no luna-server antes de aceitar mensagens
    const healthy = await this._healthCheck();
    if (!healthy) {
      console.warn('⚠️  luna-server não respondeu no health-check. O bot subiu, mas mensagens podem falhar até o server voltar.');
    } else {
      console.log('✅ luna-server respondendo em', LUNA_API_URL);
    }

    this._setupHandlers();

    // v4.2-fix: garante que não há webhook ativo causando 409 no polling
    try {
      await this.bot.setWebHook('');
      console.log('✅ Webhook removido, polling ativo');
    } catch (e) {
      console.warn('[TG] Não foi possível remover webhook:', e.message);
    }

    const me = await this.bot.getMe();
    console.log(`🤖 Bot: @${me.username}`);
  }

  stop() {
    if (this.bot) this.bot.stopPolling();
    console.log('🛑 Telegram Adapter parado');
  }

  async _healthCheck() {
    return new Promise((resolve) => {
      http.get(`${LUNA_API_URL}/health`, { timeout: 5000 }, (res) => {
        resolve(res.statusCode === 200);
      }).on('error', () => resolve(false));
    });
  }

  _setupHandlers() {
    // ── Comandos ──
    this.bot.onText(/^\/start/, (msg) => this._cmdStart(msg));
    this.bot.onText(/^\/modo\s+(.+)/, (msg, match) => this._cmdModo(msg, match));
    this.bot.onText(/^\/persona\s+(.+)/, (msg, match) => this._cmdModo(msg, match));
    this.bot.onText(/^\/status/, (msg) => this._cmdStatus(msg));
    this.bot.onText(/^\/newaba/, (msg) => this._cmdNewAba(msg));
    this.bot.onText(/^\/reiniciar/, (msg) => this._cmdReiniciar(msg));
    this.bot.onText(/^\/cancel/, (msg) => this._cmdCancel(msg));
    this.bot.onText(/^\/kimi(?:\s+(on|off))?/, (msg, match) => this._cmdKimi(msg, match));

    // ── Mensagens genéricas ──
    this.bot.on('message', async (msg) => {
      if (!msg.text || msg.text.startsWith('/')) return;
      // v4.2-fix: deduplica mensagens reenviadas pelo Telegram em caso de 409/restart
      if (msg.message_id) {
        if (this.processedMessageIds.has(msg.message_id)) {
          console.log(`[TG] Ignorando mensagem duplicada ${msg.message_id}`);
          return;
        }
        this.processedMessageIds.add(msg.message_id);
        // limpa cache para não crescer indefinidamente
        if (this.processedMessageIds.size > 1000) {
          const first = this.processedMessageIds.values().next().value;
          this.processedMessageIds.delete(first);
        }
      }
      await this._handleUserMessage(msg);
    });

    // ── Callback queries (botões inline) ──
    this.bot.on('callback_query', async (query) => {
      await this._handleCallbackQuery(query);
    });

    // ── Erros ──
    this.bot.on('polling_error', (err) => {
      const msg = err.message || err.code || String(err);
      console.warn('[TG] Polling error:', msg);
      // v4.2-fix: 409 geralmente significa outra instância fazendo polling
      if (msg.includes('409') || msg.includes('Conflict')) {
        console.error('[TG] ⚠️  Outra instância do bot parece estar rodando. Verifique processos duplicados no PM2.');
      }
    });
  }

  async _handleCallbackQuery(query) {
    const data = query.data || '';
    const chatId = query.message?.chat?.id;
    if (!chatId) return;

    if (data === 'kimi_on') {
      this.awakeChats.add(chatId);
      this._saveAwakeState();
      await this.bot.answerCallbackQuery(query.id, { text: 'Luna acordou!' });
      await this.bot.sendMessage(chatId,
        `🌙 *Luna acordou!*\n\nModo persistente ativo. Mande \`/kimi off\` para eu dormir.`,
        { parse_mode: 'Markdown' }
      );
    } else if (data === 'kimi_off') {
      this.awakeChats.delete(chatId);
      this._saveAwakeState();
      await this.bot.answerCallbackQuery(query.id, { text: 'Luna dormindo...' });
      await this.bot.sendMessage(chatId,
        `😴 *Luna dormindo...*\n\nNão vou mais responder mensagens automáticas. Mande \`/kimi on\` quando quiser!`,
        { parse_mode: 'Markdown' }
      );
    }
  }

  async _cmdStart(msg) {
    const chatId = msg.chat.id;
    const name = msg.from?.first_name || 'usuário';

    await this.bot.sendMessage(chatId,
      `🌙 *Oi ${name}! Sou a Luna.*\n\n` +
      `Comandos:\n` +
      `• \`/kimi on\` — eu acordo e respondo todas as mensagens\n` +
      `• \`/kimi off\` — eu durmo e ignoro mensagens automáticas\n` +
      `• \`/status\` — ver status atual\n` +
      `• \`/newaba\` — nova sessão de chat\n` +
      `• \`/reiniciar\` — limpa tudo e reinicia a Luna\n` +
      `• \`/cancel\` — cancela uma resposta travada`,
      { parse_mode: 'Markdown' }
    );
  }

  async _cmdStatus(msg) {
    const chatId = msg.chat.id;
    const awake = this.awakeChats.has(chatId);
    const serverOk = await this._healthCheck();
    await this.bot.sendMessage(chatId,
      `📊 *Status*\n\n` +
      `Luna: ${awake ? '🌙 Acordada' : '😴 Dormindo'}\n` +
      `Server: ${serverOk ? '✅ Online' : '❌ Offline'}\n\n` +
      `Mande \`/kimi ${awake ? 'off' : 'on'}\` para alternar.`,
      { parse_mode: 'Markdown' }
    );
  }

  async _cmdModo(msg, match) {
    const chatId = msg.chat.id;
    const mode = match[1].trim().toLowerCase();
    const validModes = ['instant', 'thinking', 'agent'];
    if (!validModes.includes(mode)) {
      await this.bot.sendMessage(chatId, `❌ Modo inválido. Use: ${validModes.join(', ')}`);
      return;
    }
    const prefPath = path.join(SESSION_DIR, `${sanitizeChatId(chatId)}-persona.json`);
    let pref = {};
    try { pref = JSON.parse(fs.readFileSync(prefPath, 'utf8')); } catch {}
    pref.persona = mode;
    fs.writeFileSync(prefPath, JSON.stringify(pref));
    await this.bot.sendMessage(chatId, `✅ Modo alterado para *${mode}*`, { parse_mode: 'Markdown' });
  }

  async _cmdNewAba(msg) {
    const chatId = msg.chat.id;
    const userId = `telegram-${chatId}`;
    const sessionId = userId;
    try {
      this.sessionManager.clearContext(sessionId);
      this.activeStreams.delete(chatId);
      this.activeUsers.delete(userId);
      this.processedMessageIds.clear();
      await this.bot.sendMessage(chatId, '🆕 *Nova sessão iniciada!*', { parse_mode: 'Markdown' });
    } catch (e) {
      await this.bot.sendMessage(chatId, `❌ Erro: ${e.message}`);
    }
  }

  async _cmdReiniciar(msg) {
    const chatId = msg.chat.id;
    const userId = `telegram-${chatId}`;
    const sessionId = userId;
    try {
      // Cancela stream ativo no servidor e limpa estado local
      await this._callServerCancel(sessionId);
      this.sessionManager.clearContext(sessionId);
      this.activeStreams.delete(chatId);
      this.activeUsers.delete(userId);
      this.processedMessageIds.clear();
      this.awakeChats.add(chatId);
      this._saveAwakeState();
      await this.bot.sendMessage(chatId,
        '🔄 *Luna reiniciada!*\n\nSessão zerada e estado limpo. Pode falar comigo agora.',
        { parse_mode: 'Markdown', reply_to_message_id: msg.message_id }
      );
    } catch (e) {
      console.error('[TG] /reiniciar error:', e);
      // Mesmo se o server falhar, limpa estado local
      this.sessionManager.clearContext(sessionId);
      this.activeStreams.delete(chatId);
      this.activeUsers.delete(userId);
      this.awakeChats.add(chatId);
      this._saveAwakeState();
      await this.bot.sendMessage(chatId,
        '⚠️ *Reinício parcial.*\n\nO servidor não respondeu, mas limpei o estado local. Tente novamente.',
        { parse_mode: 'Markdown', reply_to_message_id: msg.message_id }
      );
    }
  }

  async _cmdCancel(msg) {
    const chatId = msg.chat.id;
    const userId = `telegram-${chatId}`;
    const sessionId = userId;
    try {
      await this._callServerCancel(sessionId);
    } catch (e) {
      console.warn('[TG] /cancel server call failed:', e.message);
    }
    this.activeUsers.delete(userId);
    this.activeStreams.delete(chatId);
    await this.bot.sendMessage(chatId,
      '✋ *Cancelado.* Se a Luna estava travada, agora pode mandar uma nova mensagem.',
      { parse_mode: 'Markdown', reply_to_message_id: msg.message_id }
    );
  }

  async _cmdKimi(msg, match) {
    const chatId = msg.chat.id;
    const arg = (match[1] || '').trim().toLowerCase();

    if (arg === 'off') {
      this.awakeChats.delete(chatId);
      this._saveAwakeState();
      await this.bot.sendMessage(chatId,
        `😴 *Luna dormindo...*\n\nNão vou mais responder mensagens automáticas.\nMande \`/kimi on\` quando quiser me acordar!`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // /kimi ou /kimi on → acorda
    const wasAwake = this.awakeChats.has(chatId);
    this.awakeChats.add(chatId);
    this._saveAwakeState();

    if (!wasAwake) {
      await this.bot.sendMessage(chatId,
        `🌙 *Luna acordou!*\n\nEstou no modo persistente — vou responder *todas* as suas mensagens até você mandar \`/kimi off\`.`,
        { parse_mode: 'Markdown' }
      );
    } else {
      await this.bot.sendMessage(chatId,
        `🌙 *Já estou acordada!*\n\nModo persistente ativo. Mande \`/kimi off\` para eu dormir.`,
        { parse_mode: 'Markdown' }
      );
    }
  }

  _loadAwakeState() {
    try {
      const p = path.join(SESSION_DIR, 'awake-chats.json');
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (Array.isArray(data)) data.forEach(id => this.awakeChats.add(id));
    } catch { /* ignora se não existe */ }
  }

  _saveAwakeState() {
    try {
      const p = path.join(SESSION_DIR, 'awake-chats.json');
      fs.writeFileSync(p, JSON.stringify([...this.awakeChats]));
    } catch (e) { console.warn('[TG] Erro ao salvar awake state:', e.message); }
  }

  // ── CLIENTE HTTP+SSE DO LUNA SERVER ──

  async *_callLunaStream(sessionId, text, { mode = 'thinking', persona = 'default' }) {
    const events = [];
    let done = false;
    let error = null;

    // v10.11-fix: Garante que a sessão exista antes de abrir SSE.
    // O Telegram usa sessionId determinístico (telegram-<chatId>), que pode
    // ainda não existir no servidor.
    await this._ensureSession(sessionId);

    // Abre SSE *antes* de postar para não perder eventos iniciais
    const sse = new EventSource(`${LUNA_API_URL}/api/chat/stream?sessionId=${encodeURIComponent(sessionId)}`);

    sse.onmessage = (msg) => {
      try {
        const ev = JSON.parse(msg.data);
        events.push(ev);
        if (ev.type === 'response_delta' || ev.type === 'thinking_delta') {
          // log a cada ~20 eventos para não poluir
          if (events.length % 20 === 0) {
            console.log(`[TG] SSE progress: ${ev.type} (events=${events.length})`);
          }
        }
        // v4.2-fix: encerra o stream assim que o servidor sinaliza done ou error
        if (ev.type === 'done' || ev.type === 'error' || ev.type === 'stream_end') {
          done = true;
          sse.close();
        }
      } catch (e) {
        console.warn('[TG] SSE parse error:', e.message);
      }
    };
    sse.onerror = (e) => {
      error = e;
      done = true;
      sse.close();
    };
    sse.addEventListener('close', () => {
      done = true;
    });

    // Envia a mensagem
    const postBody = JSON.stringify({ message: text, sessionId, mode, persona });
    const postRes = await new Promise((resolve, reject) => {
      const req = http.request(`${LUNA_API_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postBody),
        },
        timeout: 10000,
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data }));
      });
      req.on('error', reject);
      req.on('timeout', () => reject(new Error('POST timeout')));
      req.write(postBody);
      req.end();
    });

    if (postRes.status !== 200) {
      sse.close();
      throw new Error(`Luna API respondeu ${postRes.status}: ${postRes.data}`);
    }

    // Consome até ver done/error ou timeout
    const deadline = Date.now() + STREAM_TIMEOUT_MS;
    let lastEventAt = Date.now();
    while (Date.now() < deadline) {
      while (events.length) {
        lastEventAt = Date.now();
        yield events.shift();
      }
      if (done) break;
      if (error) {
        sse.close();
        throw new Error('Erro na conexão SSE com Luna');
      }
      // v4.2-fix: se ficar mais de 90s sem eventos, encerra para não travar o chat
      if (Date.now() - lastEventAt > 90000) {
        sse.close();
        throw new Error('A Luna parou de enviar dados. Use /reiniciar ou /cancel se persistir.');
      }
      await new Promise(r => setTimeout(r, 200));
    }
    sse.close();
  }

  /** Envia cancelamento de stream para o luna-server. */
  async _callServerCancel(sessionId) {
    return new Promise((resolve, reject) => {
      const req = http.request(`${LUNA_API_URL}/api/chat/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        timeout: 8000,
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data }));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('cancel timeout')); });
      req.write(JSON.stringify({ sessionId }));
      req.end();
    });
  }

  /** Garante que a sessão exista no luna-server (cria se não existir). */
  async _ensureSession(sessionId) {
    const body = JSON.stringify({ action: 'create', sessionId });
    return new Promise((resolve, reject) => {
      const req = http.request(`${LUNA_API_URL}/api/chat/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 5000,
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data }));
      });
      req.on('error', (e) => {
        // Não falha fatalmente; o POST /api/chat também cria sessão
        console.warn('[TG] _ensureSession warning:', e.message);
        resolve({ status: 0, data: '' });
      });
      req.on('timeout', () => {
        req.destroy();
        resolve({ status: 0, data: '' });
      });
      req.write(body);
      req.end();
    });
  }

  // ── MENSAGEM PRINCIPAL ──

  async _handleUserMessage(msg) {
    const chatId = msg.chat.id;
    const userId = `telegram-${chatId}`;
    const text = msg.text;

    // Se o chat NÃO está no modo persistente, avisa uma vez e ignora
    if (!this.awakeChats.has(chatId)) {
      if (!this.sleepingNotified.has(chatId)) {
        this.sleepingNotified.add(chatId);
        await this.bot.sendMessage(chatId,
          '😴 *Luna dormindo.*\n\nMande `/kimi on` para eu acordar e responder suas mensagens.',
          { parse_mode: 'Markdown', reply_to_message_id: msg.message_id }
        );
      }
      return;
    }
    // Se acordou, reseta flag de notificação
    this.sleepingNotified.delete(chatId);

    // Health-check rápido
    const serverOk = await this._healthCheck();
    if (!serverOk) {
      await this.bot.sendMessage(chatId,
        '🌙 *Luna offline.*\n\nO servidor Luna não está respondendo agora. Tente novamente em alguns instantes.',
        { parse_mode: 'Markdown', reply_to_message_id: msg.message_id }
      );
      return;
    }

    // Evita overlapping, mas expira lock travado após 3 min
    this._clearStaleLocks();
    if (this.activeUsers.has(userId)) {
      await this.bot.sendMessage(chatId,
        '⏳ Aguarde a resposta anterior...\nSe travou, use /cancel ou /reiniciar.',
        { reply_to_message_id: msg.message_id }
      );
      return;
    }
    this.activeUsers.set(userId, { since: Date.now(), messageId: msg.message_id });

    // Carrega persona salva
    const prefPath = path.join(SESSION_DIR, `${sanitizeChatId(chatId)}-persona.json`);
    let persona = 'default';
    try {
      const pref = JSON.parse(fs.readFileSync(prefPath, 'utf8'));
      persona = pref.persona;
    } catch {}

    // Sessão persistente por chat
    const sessionId = `telegram-${chatId}`;

    // Envia "Pensando..."
    const thinkingMsg = await this.bot.sendMessage(chatId, '🧠 *Pensando...*', {
      parse_mode: 'Markdown',
      reply_to_message_id: msg.message_id,
    });

    this.activeStreams.set(chatId, {
      messageId: thinkingMsg.message_id,
      lastText: '',
      editCount: 0,
    });

    const timeoutId = setTimeout(async () => {
      console.warn(`[TG] Stream timeout for ${userId}, forcing cleanup`);
      this.activeUsers.delete(userId);
      this.activeStreams.delete(chatId);
      try {
        await this.bot.editMessageText(
          '⏱️ *Tempo esgotado.* A Luna não conseguiu responder a tempo.\nTente `/kimi off` e depois `/kimi on`.',
          { chat_id: chatId, message_id: thinkingMsg.message_id, parse_mode: 'Markdown' }
        );
      } catch {}
    }, STREAM_TIMEOUT_MS);

    try {
      const stream = this._callLunaStream(sessionId, text, { mode: 'thinking', persona });

      let fullResponse = '';
      let hasStartedResponding = false;

      for await (const ev of stream) {
        switch (ev.type) {
          case 'thinking_start':
            // já mostramos "Pensando..."
            break;

          case 'thinking_delta':
            // Opcional: mostrar thinking ao vivo (pode ser barulho no Telegram)
            break;

          case 'response_delta': {
            fullResponse = ev.fullResponse || ev.text || fullResponse;
            hasStartedResponding = true;
            await this._updateMessage(chatId, fullResponse);
            break;
          }

          case 'response_done': {
            fullResponse = ev.response || ev.text || fullResponse;
            hasStartedResponding = true;
            await this._updateMessage(chatId, fullResponse);
            break;
          }

          case 'action_start': {
            const toolName = ev.tool || 'tool';
            await this.bot.sendMessage(chatId, `🔧 *Executando:* \`${toolName}\``, {
              parse_mode: 'Markdown',
            });
            break;
          }

          case 'action_end': {
            const res = ev.result;
            const icon = res?.success !== false ? '✅' : '❌';
            const output = res?.stdout || res?.output || res?.text || res?.result?.stdout || res?.result?.output || res?.result?.text || '';
            const short = this._sanitizeText(output).slice(0, 500);
            await this.bot.sendMessage(chatId,
              `${icon} *${ev.tool}* concluído${short ? `\n\n\`\`\`\n${short}\n\`\`\`` : ''}`,
              { parse_mode: 'Markdown' }
            );
            break;
          }

          case 'error': {
            await this.bot.sendMessage(chatId, `❌ *Erro:* ${this._sanitizeText(ev.message || ev.error || 'desconhecido')}`, {
              parse_mode: 'Markdown',
            });
            break;
          }

          case 'done': {
            const meta = this.activeStreams.get(chatId);
            if (meta && fullResponse) {
              await this._finalizeMessage(chatId, fullResponse);
            }
            break;
          }
        }
      }

      // Se nunca chegou response_delta, edita com o que temos
      if (!hasStartedResponding && fullResponse) {
        await this._finalizeMessage(chatId, fullResponse);
      } else if (!hasStartedResponding && !fullResponse) {
        await this.bot.editMessageText(
          '😶 A Luna não retornou nenhuma resposta. Tente novamente.',
          { chat_id: chatId, message_id: thinkingMsg.message_id }
        );
      }

    } catch (e) {
      console.error('[TG] Erro no stream:', e);
      try {
        await Promise.race([
          this.bot.editMessageText(
            `❌ Erro: ${e.message}`,
            { chat_id: chatId, message_id: thinkingMsg.message_id }
          ),
          new Promise((_, reject) => setTimeout(() => reject(new Error('edit timeout')), 10000)),
        ]);
      } catch (sendErr) {
        console.warn('[TG] Failed to send error message:', sendErr.message);
      }
    } finally {
      clearTimeout(timeoutId);
      this.activeUsers.delete(userId);
      this.activeStreams.delete(chatId);
    }
  }

  /** Remove locks de usuários que travaram por mais de 3 minutos. */
  _clearStaleLocks() {
    const staleThreshold = Date.now() - 3 * 60 * 1000;
    for (const [userId, meta] of this.activeUsers.entries()) {
      if (meta.since < staleThreshold) {
        console.warn(`[TG] Removendo lock travado de ${userId}`);
        this.activeUsers.delete(userId);
        this.activeStreams.delete(userId.replace('telegram-', ''));
      }
    }
  }

  // ── HELPERS DE UI ──

  _sanitizeText(text) {
    if (!text) return '';
    return text
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '\r');
  }

  async _updateMessage(chatId, text) {
    const meta = this.activeStreams.get(chatId);
    if (!meta) return;

    text = this._sanitizeText(text);
    const safe = text.slice(0, 4000);
    if (safe === meta.lastText) return;

    const now = Date.now();
    if (now - meta.lastEdit < 2000) return;

    try {
      await Promise.race([
        this.bot.editMessageText(safe, {
          chat_id: chatId,
          message_id: meta.messageId,
          parse_mode: 'Markdown',
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('editMessageText timeout')), 8000)),
      ]);
      meta.lastText = safe;
      meta.lastEdit = now;
      meta.editCount++;
    } catch (e) {
      if (!e.message?.includes('not modified')) {
        console.warn('[TG] Edit error:', e.message);
      }
    }
  }

  async _finalizeMessage(chatId, text) {
    const meta = this.activeStreams.get(chatId);
    if (!meta) return;

    text = this._sanitizeText(text);
    const safe = text.slice(0, 4000);
    if (safe !== meta.lastText) {
      try {
        await this.bot.editMessageText(safe, {
          chat_id: chatId,
          message_id: meta.messageId,
          parse_mode: 'Markdown',
        });
      } catch (e) {
        console.warn('[TG] Finalize edit error:', e.message);
      }
    }
  }
}

module.exports = { TelegramLunaAdapter };

// ── BOOTSTRAP (somente quando executado diretamente) ──
if (require.main === module) {
  const adapter = new TelegramLunaAdapter();
  adapter.start().catch((err) => {
    console.error('❌ Erro fatal no adapter:', err);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    adapter.stop();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    adapter.stop();
    process.exit(0);
  });
}
