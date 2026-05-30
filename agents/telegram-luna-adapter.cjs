// ============================================================
// LUNA TELEGRAM ADAPTER v4.0 — Kernel Unificado
// Adapter fino: apenas transport layer. Toda inteligência vive no Luna Soul.
// ============================================================

const fs = require('fs');
const path = require('path');
const os = require('os');

// Load .env manually before any module that needs env vars
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const eq = line.indexOf('=');
    if (eq > 0 && !line.startsWith('#')) {
      const key = line.slice(0, eq).trim();
      const val = line.slice(eq + 1).trim();
      if (key && process.env[key] === undefined) process.env[key] = val;
    }
  });
}

const TelegramBot = require('node-telegram-bot-api');
const { LunaSoul } = require(path.join(os.homedir(), '.luna-kernel', 'luna-soul.cjs'));
const { SessionManager } = require('./session-manager.cjs');

const SESSION_DIR = path.join(__dirname, '..', 'data', 'telegram-sessions');
if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

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
    this.bot = new TelegramBot(TOKEN, { polling: true });
    this.luna = null;
    this.activeStreams = new Map(); // chatId → { messageId, lastEdit }
    this.activeUsers = new Set();   // evita overlapping requests
    this.awakeChats = new Set();    // chats em modo persistente (wake)
    this._loadAwakeState();
  }

  async start() {
    console.log('🚀 Iniciando Luna Telegram Adapter v4.0...');

    this.sessionManager = new SessionManager();
    this.luna = new LunaSoul({});
    await this.luna.init();
    console.log('✅ Luna Soul inicializado');

    this._setupHandlers();
    console.log('✅ Telegram polling ativo');

    const me = await this.bot.getMe();
    console.log(`🤖 Bot: @${me.username}`);
  }

  stop() {
    if (this.bot) this.bot.stopPolling();
    console.log('🛑 Telegram Adapter parado');
  }

  _setupHandlers() {
    // ── Comandos ──
    this.bot.onText(/^\/start/, (msg) => this._cmdStart(msg));
    this.bot.onText(/^\/modo\s+(.+)/, (msg, match) => this._cmdModo(msg, match));
    this.bot.onText(/^\/persona\s+(.+)/, (msg, match) => this._cmdModo(msg, match));
    this.bot.onText(/^\/status/, (msg) => this._cmdStatus(msg));
    this.bot.onText(/^\/newaba/, (msg) => this._cmdNewAba(msg));
    this.bot.onText(/^\/kimi(?:\s+(on|off))?/, (msg, match) => this._cmdKimi(msg, match));

    // ── Mensagens genéricas ──
    this.bot.on('message', async (msg) => {
      if (!msg.text || msg.text.startsWith('/')) return;
      await this._handleUserMessage(msg);
    });

    // ── Callback queries (botões inline) ──
    this.bot.on('callback_query', async (query) => {
      await this._handleCallbackQuery(query);
    });

    // ── Erros ──
    this.bot.on('polling_error', (err) => {
      console.warn('[TG] Polling error:', err.message || err);
    });
  }

  async _handleCallbackQuery(query) {
    const data = query.data || '';
    const chatId = query.message?.chat?.id;
    const messageId = query.message?.message_id;
    const voter = query.from?.username?.toLowerCase() || query.from?.first_name?.toLowerCase();

    // Votação: vote:<sessionId>:<yes|no>
    if (data.startsWith('vote:')) {
      const parts = data.split(':');
      if (parts.length === 3) {
        const sessionId = parts[1];
        const vote = parts[2]; // 'yes' or 'no'
        await this._handleVoteCallback(chatId, messageId, query.id, sessionId, vote, voter);
        return;
      }
    }

    // Tarefa: task:<taskId>:complete | task:<taskId>:assign
    if (data.startsWith('task:')) {
      const parts = data.split(':');
      if (parts.length === 3) {
        const taskId = parts[1];
        const action = parts[2]; // 'complete' or 'assign'
        await this._handleTaskCallback(chatId, messageId, query.id, taskId, action, voter);
        return;
      }
    }

    // Callback não reconhecido
    await this.bot.answerCallbackQuery(query.id, { text: 'Ação não reconhecida' });
  }

  async _handleTaskCallback(chatId, messageId, queryId, taskId, action, voter) {
    try {
      const voterMap = {
        'abner': 'abner',
        'nonoke': 'nonoke',
        'elias': 'elias',
        'elias israel mendes': 'elias',
        'jhinofour': 'abner',
        'jhino four': 'abner',
        'jhin four': 'abner',
        'jhino': 'abner',
      };
      const internalUser = voterMap[voter] || voter;
      const baseUrl = 'http://localhost:3456';
      const apiToken = process.env.INTERNAL_API_TOKEN;

      if (action === 'complete') {
        const res = await fetch(`${baseUrl}/api/tasks/${taskId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiToken}` },
          body: JSON.stringify({ status: 'completed' }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          await this.bot.answerCallbackQuery(queryId, { text: `❌ ${err.error || 'Erro ao concluir'}` });
          return;
        }
        await this.bot.answerCallbackQuery(queryId, { text: '✅ Tarefa concluída!' });
        // Update message buttons
        try {
          await this.bot.editMessageReplyMarkup({ inline_keyboard: [[
            { text: '✅ Concluída', callback_data: 'noop' },
            { text: '🔗 Abrir Dashboard', url: `${baseUrl}/tarefas` }
          ]] }, { chat_id: chatId, message_id: messageId });
        } catch {}
      } else if (action === 'assign') {
        const res = await fetch(`${baseUrl}/api/tasks/${taskId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiToken}` },
          body: JSON.stringify({ assignee: internalUser }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          await this.bot.answerCallbackQuery(queryId, { text: `❌ ${err.error || 'Erro ao assumir'}` });
          return;
        }
        await this.bot.answerCallbackQuery(queryId, { text: `👤 Tarefa atribuída a ${internalUser}` });
        // Update message buttons
        try {
          await this.bot.editMessageReplyMarkup({ inline_keyboard: [[
            { text: '✅ Concluir', callback_data: `task:${taskId}:complete` },
            { text: `👤 ${internalUser}`, callback_data: 'noop' }
          ], [
            { text: '🔗 Abrir Dashboard', url: `${baseUrl}/tarefas` }
          ]] }, { chat_id: chatId, message_id: messageId });
        } catch {}
      }
    } catch (err) {
      console.error('[TG] Erro no callback de tarefa:', err.message);
      await this.bot.answerCallbackQuery(queryId, { text: '❌ Erro ao processar ação' });
    }
  }

  async _handleVoteCallback(chatId, messageId, queryId, sessionId, vote, voter) {
    try {
      // Mapear username/nome do Telegram para ID interno
      const voterMap = {
        'abner': 'abner',
        'nonoke': 'nonoke',
        'elias': 'elias',
        'elias israel mendes': 'elias',
        'jhinofour': 'abner',
        'jhino four': 'abner',
        'jhin four': 'abner',
        'jhino': 'abner',
      };
      const internalVoter = voterMap[voter] || voter;
      console.log(`[VOTE] Received voter='${voter}' -> internal='${internalVoter}'`);

      const secret = process.env.TELEGRAM_BOT_TOKEN;
      const baseUrl = `http://localhost:3456`;

      const res = await fetch(`${baseUrl}/api/voting/telegram-vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, voter: internalVoter, vote, secret }),
      });

      const result = await res.json();

      if (!res.ok) {
        // Verificar se é voto duplicado
        const isDuplicate = (result.error || '').toLowerCase().includes('já votou') || (result.error || '').toLowerCase().includes('already voted');
        if (isDuplicate) {
          await this.bot.answerCallbackQuery(queryId, { 
            text: '⚠️ VOCÊ JÁ VOTOU!\nNão é possível alterar o voto.',
            show_alert: true 
          });
        } else {
          await this.bot.answerCallbackQuery(queryId, { text: `❌ ${result.error || 'Erro ao votar'}`, show_alert: true });
        }
        return;
      }

      const session = result.session;
      const yesVotes = Object.values(session.votes).filter(v => v && v.vote === 'yes').length;
      const noVotes = Object.values(session.votes).filter(v => v && v.vote === 'no').length;
      const pending = 3 - yesVotes - noVotes;

      // Determinar emoji de status
      const statusConfig = {
        open:    { emoji: '🟢', label: 'ABERTA' },
        voting:  { emoji: '🔵', label: 'EM VOTAÇÃO' },
        approved:{ emoji: '🎉', label: 'APROVADA!' },
        rejected:{ emoji: '💀', label: 'REJEITADA' },
        closed:  { emoji: '⚪', label: 'ENCERRADA' },
      };
      const st = statusConfig[session.status] || { emoji: '⚪', label: session.status.toUpperCase() };

      // Barra de progresso visual
      const barYes = '█'.repeat(yesVotes);
      const barNo = '▒'.repeat(noVotes);
      const barPending = '░'.repeat(pending);
      const progressBar = `${barYes}${barNo}${barPending}`;

      // Montar mensagem PREMIUM
      let text = `╔══════════════════════╗\n`;
      text += `👑 *SESSÃO DE VOTAÇÃO*\n`;
      text += `╚══════════════════════╝\n\n`;
      text += `🗳️ *${this._escapeMarkdown(session.title)}*\n\n`;
      text += `${st.emoji} *Status:* ${st.label}\n`;
      text += `📊 *Progresso:* ${progressBar}\n`;
      text += `   ✅ SIM: ${yesVotes}  ❌ NÃO: ${noVotes}  ⏳ Faltam: ${pending}\n\n`;
      text += `━━━━━━━━━━━━━━━━━━━━━━\n`;
      text += `*Votos dos CEOs:*\n`;

      for (const [ceo, v] of Object.entries(session.votes)) {
        const voteEmoji = v ? (v.vote === 'yes' ? '✅' : '❌') : '⏳';
        const voteLabel = v ? (v.vote === 'yes' ? 'APROVOU' : 'REJEITOU') : 'AGUARDANDO';
        text += `${voteEmoji} *${ceo.toUpperCase()}* — ${voteLabel}\n`;
      }

      // Mensagem de resultado
      if (session.status === 'approved') {
        text += `\n🎉 *QUÓRUM ALCANÇADO!*\n`;
        if (session.executionResult?.success) {
          text += `🚀 Ação executada *automaticamente*!\n`;
        } else {
          text += `⚙️ Ação será executada em breve.\n`;
        }
      } else if (session.status === 'rejected') {
        text += `\n💀 *PROPOSTA VETADA*\n`;
        text += `🛡️ A ação NÃO será executada.\n`;
      } else if (yesVotes >= session.quorumRequired) {
        text += `\n🔥 *FALTAM 0 VOTOS!* Aguardando encerramento...\n`;
      } else {
        text += `\n⏱️ *Faltam:* ${session.quorumRequired - yesVotes} voto(s) para aprovação\n`;
      }

      text += `\n🔗 [▸ ABRIR DASHBOARD](http://192.168.1.33:3456/votacao)`;

      // Atualizar mensagem original
      await this.bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: session.status === 'open' || session.status === 'voting' ? {
          inline_keyboard: [[
            { text: '✅ APROVAR', callback_data: `vote:${session.id}:yes` },
            { text: '❌ REJEITAR', callback_data: `vote:${session.id}:no` }
          ]]
        } : undefined,
        disable_web_page_preview: true,
      });

      // Feedback claro no popup
      const voteText = vote === 'yes' ? '✅ APROVAR' : '❌ REJEITAR';
      await this.bot.answerCallbackQuery(queryId, { 
        text: `${voteText}\nVoto registrado com sucesso!\n${yesVotes}/${session.quorumRequired} votos para aprovação.`,
        show_alert: true 
      });
    } catch (err) {
      console.error('[TG] Erro no callback de votação:', err.message);
      await this.bot.answerCallbackQuery(queryId, { text: '❌ Erro ao processar voto', show_alert: true });
    }
  }

  _escapeMarkdown(text) {
    return String(text || '').replace(/[_*\[\]()~`>#+=|{}.!-]/g, '\\$&');
  }

  // ── COMANDOS ──

  async _cmdStart(msg) {
    const chatId = msg.chat.id;
    const name = msg.from?.first_name || 'usuário';
    await this.bot.sendMessage(chatId,
      `🌙 *Olá, ${name}!* Sou Luna, sua agente autônoma unificada.\n\n` +
      `Posso ajudar com:\n` +
      `• 💻 Código e arquivos no seu PC\n` +
      `• 📋 Tarefas e leads no dashboard\n` +
      `• 🔍 Pesquisa na internet\n\n` +
      `*Comandos:*\n` +
      `/kimi — ativar modo persistente (respondo todas as msgs)\n` +
      `/kimi off — desativar modo persistente\n` +
      `/modo [engenheiro|arquiteto|produto|devops|default] — trocar persona\n` +
      `/newaba — nova sessão de chat\n` +
      `/status — status do sistema`,
      { parse_mode: 'Markdown' }
    );
  }

  async _cmdModo(msg, match) {
    const chatId = msg.chat.id;
    const persona = match[1].trim().toLowerCase();
    const valid = ['engenheiro', 'arquiteto', 'produto', 'devops', 'default', 'dev'];

    if (!valid.includes(persona)) {
      await this.bot.sendMessage(chatId,
        `⚠️ Persona desconhecida: *${persona}*\n` +
        `Disponíveis: ${valid.join(', ')}`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Persiste preferência
    const prefPath = path.join(SESSION_DIR, `${sanitizeChatId(chatId)}-persona.json`);
    fs.writeFileSync(prefPath, JSON.stringify({ persona, updatedAt: new Date().toISOString() }));

    await this.bot.sendMessage(chatId, `✅ Persona alterada para: *${persona}*`, { parse_mode: 'Markdown' });
  }

  async _cmdStatus(msg) {
    const chatId = msg.chat.id;
    const status = this.luna?.kimiBridge?.getStatus?.() || { running: false };
    const isAwake = this.awakeChats.has(chatId);
    await this.bot.sendMessage(chatId,
      `📊 *Status Luna*\n\n` +
      `Chrome: ${status.running ? '🟢 Conectado' : '🔴 Desconectado'}\n` +
      `Modo persistente: ${isAwake ? '🟢 Ativo (respondo todas as msgs)' : '🔴 Inativo'}\n` +
      `Sessões ativas: ${this.activeStreams.size}\n` +
      `Usuários processando: ${this.activeUsers.size}`,
      { parse_mode: 'Markdown' }
    );
  }

  async _cmdNewAba(msg) {
    const chatId = msg.chat.id;
    const userId = `telegram-${chatId}`;
    const sessionId = userId;
    try {
      await this.luna.newThread(userId);
      this.sessionManager.clearContext(sessionId);
      await this.bot.sendMessage(chatId, '🆕 *Nova sessão iniciada!*', { parse_mode: 'Markdown' });
    } catch (e) {
      await this.bot.sendMessage(chatId, `❌ Erro: ${e.message}`);
    }
  }

  async _cmdKimi(msg, match) {
    const chatId = msg.chat.id;
    const arg = (match[1] || '').trim().toLowerCase();

    if (arg === 'off') {
      this.awakeChats.delete(chatId);
      this._saveAwakeState();
      await this.bot.sendMessage(chatId,
        `😴 *Luna dormindo...*\n\nNão vou mais responder mensagens automáticas.\nMande \`/kimi\` quando quiser me acordar!`,
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

  // ── MENSAGEM PRINCIPAL ──

  async _handleUserMessage(msg) {
    const chatId = msg.chat.id;
    const userId = `telegram-${chatId}`;
    const text = msg.text;
    const name = msg.from?.first_name || 'usuário';

    // Se o chat NÃO está no modo persistente, ignora mensagens genéricas
    if (!this.awakeChats.has(chatId)) {
      return;
    }

    // Evita overlapping
    if (this.activeUsers.has(userId)) {
      await this.bot.sendMessage(chatId, '⏳ Aguarde a resposta anterior...', {
        reply_to_message_id: msg.message_id,
      });
      return;
    }
    this.activeUsers.add(userId);

    // Carrega persona salva
    const prefPath = path.join(SESSION_DIR, `${sanitizeChatId(chatId)}-persona.json`);
    let persona = 'default';
    try {
      const pref = JSON.parse(fs.readFileSync(prefPath, 'utf8'));
      persona = pref.persona;
    } catch {}

    // Cria/recupera sessão persistente por chat
    const sessionId = `telegram-${chatId}`;
    let session = this.sessionManager.loadSession(sessionId);
    if (!session) {
      session = this.sessionManager.createSession({
        id: sessionId,
        title: `Telegram ${chatId}`,
        mode: 'CHAT',
        persona,
        metadata: { source: 'telegram', chatId },
      });
    }

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

    const STREAM_TIMEOUT = 5 * 60 * 1000; // 5 minutos
    const timeoutId = setTimeout(() => {
      console.warn(`[TG] Stream timeout for ${userId}, forcing cleanup`);
      this.activeUsers.delete(userId);
      this.activeStreams.delete(chatId);
    }, STREAM_TIMEOUT);

    try {
      const stream = this.luna.processMessageStream(text, {
        sessionId: session.id,
        userId,
        mode: session.mode,
        persona,
      });

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
            fullResponse = ev.fullResponse || '';
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
            // Mensagem final já foi editada pelo response_delta
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
      }

    } catch (e) {
      console.error('[TG] Erro no stream:', e);
      // Robust error delivery: never let a stuck sendMessage keep activeUsers locked
      try {
        await Promise.race([
          this.bot.sendMessage(chatId, `❌ Erro interno: ${e.message}`),
          new Promise((_, reject) => setTimeout(() => reject(new Error('send timeout')), 10000)),
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

  // ── HELPERS DE UI ──

  _sanitizeText(text) {
    if (!text) return '';
    // Converte \n literal (dois chars: backslash + n) em quebra de linha real
    // Isso acontece quando o Kimi retorna texto com newlines escapados
    return text
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '\r');
  }

  async _updateMessage(chatId, text) {
    const meta = this.activeStreams.get(chatId);
    if (!meta) return;

    // Sanitiza newlines escapados antes de enviar pro Telegram
    text = this._sanitizeText(text);

    // Telegram limit: 4096 chars. Trunca para edição.
    const safe = text.slice(0, 4000);
    if (safe === meta.lastText) return; // evita edições desnecessárias

    // Rate limit: no máximo 1 edição a cada 2s
    const now = Date.now();
    if (now - meta.lastEdit < 2000) return;

    try {
      await this.bot.editMessageText(safe, {
        chat_id: chatId,
        message_id: meta.messageId,
        parse_mode: 'Markdown',
      });
      meta.lastText = safe;
      meta.lastEdit = now;
      meta.editCount++;
    } catch (e) {
      // Edit conflicts (message not modified) são normais
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
    try {
      await this.bot.editMessageText(safe, {
        chat_id: chatId,
        message_id: meta.messageId,
        parse_mode: 'Markdown',
      });
    } catch {
      // Se edit falhar, manda nova mensagem
      await this.bot.sendMessage(chatId, safe, { parse_mode: 'Markdown' });
    }
  }
}

// ── CLI / SINGLETON ──
let instance = null;

async function start() {
  if (!instance) instance = new TelegramLunaAdapter();
  await instance.start();
  return instance;
}

function stop() {
  if (instance) instance.stop();
  instance = null;
}

module.exports = { TelegramLunaAdapter, start, stop };

// Se executado diretamente
if (require.main === module) {
  start().catch(e => {
    console.error('❌ Falha ao iniciar:', e);
    process.exit(1);
  });
  process.on('SIGINT', () => { stop(); process.exit(0); });
}
