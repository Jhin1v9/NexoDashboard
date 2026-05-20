// ============================================================
// LUNA TELEGRAM AGENT v2.0 — MODO RADAR + WIZARD INTERATIVO
// Recebe @mentions e comandos no Telegram, classifica com NLP.js,
// registra no buffer newMentions[], e executa via wizard interativo.
// ============================================================

const fs = require('fs');
const path = require('path');

// ── CONFIG ──
const CONFIG = {
  BUFFER_FILE: path.join(__dirname, '../backend/data/luna-buffer.json'),
  API_BASE: 'http://localhost:3456/api',
  CHECKPOINT_FILE: path.join(__dirname, '../backend/data/luna-checkpoint.json'),
  DASHBOARD_URL: process.env.DASHBOARD_URL || 'https://nexodashboard.onrender.com',
};

// NLU e ActionExecutor para execução direta (sem precisar de auth HTTP)
let lunaNLU = null;
let semanticNLU = null;

function getNLU() {
  if (!lunaNLU) {
    lunaNLU = require('../backend/services/luna-nlu');
  }
  return lunaNLU;
}

function getSemanticNLU() {
  if (!semanticNLU) {
    semanticNLU = require('../backend/services/luna-semantic-nlu');
  }
  return semanticNLU;
}

// Classificador híbrido: Semantic Embedding + NLP.js ensemble
async function hybridClassify(text) {
  try {
    const nlu = getNLU();
    const sem = getSemanticNLU();
    
    const [nluResult, semResult] = await Promise.all([
      nlu.process(text, 'pt'),
      sem.classify(text, { lang: 'pt' }),
    ]);
    
    // Ensemble inteligente
    const nluOverconfident = nluResult.score >= 0.99 && nluResult.intent === 'financeiro.pagamento';
    const semanticStrong = semResult.score > 0.45;
    const semanticDisagrees = semResult.intent !== nluResult.intent;
    
    if (semResult.score > 0.80) {
      return { ...semResult, source: 'semantic', nluScore: nluResult.score };
    } else if (nluOverconfident && semanticStrong && semanticDisagrees) {
      return { ...semResult, source: 'semantic', reason: 'NLP.js overconfident', nluScore: nluResult.score };
    } else if (nluResult.score > semResult.score + 0.15) {
      return {
        intent: nluResult.intent,
        domain: nluResult.domain,
        score: nluResult.score,
        action: nluResult.action,
        entities: nluResult.entities,
        source: 'nlu',
        semanticScore: semResult.score,
      };
    }
    return { ...semResult, source: 'semantic', nluScore: nluResult.score };
  } catch (e) {
    log('warn', `Hybrid classify erro: ${e.message}`);
    // Fallback para NLU puro
    const nlu = getNLU();
    return await nlu.process(text, 'pt');
  }
}

let actionExecutor = null;
function getActionExecutor() {
  if (!actionExecutor) {
    const { ActionExecutor } = require('./core/ActionExecutor');
    actionExecutor = new ActionExecutor({ apiBase: CONFIG.API_BASE });
  }
  return actionExecutor;
}

function log(level, ...args) {
  const prefix = `[TELEGRAM-LUNA ${new Date().toISOString().slice(11,19)}]`;
  const msg = args.join(' ');
  if (level === 'error') console.error(prefix, '❌', msg);
  else if (level === 'warn')  console.warn(prefix, '⚠️', msg);
  else if (level === 'success') console.log(prefix, '✅', msg);
  else console.log(prefix, 'ℹ️', msg);
}

// ── HELPERS ──
function readJSON(file, defaultValue = null) {
  try {
    let raw = fs.readFileSync(file, 'utf8');
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.substring(1);
    return JSON.parse(raw);
  } catch { return defaultValue; }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function loadBuffer() {
  return readJSON(CONFIG.BUFFER_FILE, {
    newMentions: [], newLinks: [], newTasks: [], newIdeas: [],
    newLeads: [], newFinance: [], ignoredMessages: [],
    lastBufferUpdate: new Date().toISOString()
  });
}

function saveBuffer(buffer) {
  buffer.lastBufferUpdate = new Date().toISOString();
  writeJSON(CONFIG.BUFFER_FILE, buffer);
}

function normalizeTimestamp(value) {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') {
    const millis = value < 10000000000 ? value * 1000 : value;
    return new Date(millis).toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function getDueDate(label) {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (label === 'hoje') return today.toISOString().slice(0, 10);
  if (label === 'amanha') {
    today.setDate(today.getDate() + 1);
    return today.toISOString().slice(0, 10);
  }
  if (label === 'semana') {
    today.setDate(today.getDate() + 7);
    return today.toISOString().slice(0, 10);
  }
  return null;
}

// ── NLU INTEGRATION (Hybrid: Semantic + NLP.js) ──
async function classifyWithNLU(text) {
  try {
    const result = await hybridClassify(text);
    if (!result) return null;
    return {
      intent: result.intent,
      domain: result.domain,
      score: result.score,
      action: result.action,
      entities: result.entities,
      answer: result.answer || '',
      sentiment: result.sentiment || { vote: 'neutral', score: 0 },
      source: result.source || 'nlu',
    };
  } catch (e) {
    log('warn', `Hybrid NLU erro: ${e.message}`);
    return null;
  }
}

function resolveSuggestedAction(nluResult) {
  if (!nluResult) return { type: 'review', label: 'Revisar manualmente' };
  const intent = nluResult.intent;
  const domain = nluResult.domain;
  const actionMap = {
    'tarefa.criar': { type: 'criar_tarefa', label: 'Criar tarefa', icon: 'CheckSquare' },
    'tarefa.concluir': { type: 'concluir_tarefa', label: 'Concluir tarefa', icon: 'CheckCircle' },
    'financeiro.pagamento': { type: 'registrar_pagamento', label: 'Registrar pagamento', icon: 'DollarSign' },
    'financeiro.despesa': { type: 'registrar_despesa', label: 'Registrar despesa', icon: 'Receipt' },
    'financeiro.saldo': { type: 'consultar_caixa', label: 'Consultar caixa', icon: 'Wallet' },
    'financeiro.projecao': { type: 'projetar_caixa', label: 'Projeção de caixa', icon: 'TrendingUp' },
    'lead.criar': { type: 'criar_lead', label: 'Registrar lead', icon: 'UserPlus' },
    'lead.status': { type: 'listar_leads', label: 'Ver leads', icon: 'Users' },
    'email.rascunho': { type: 'criar_rascunho', label: 'Criar rascunho de email', icon: 'Mail' },
    'email.enviar': { type: 'enviar_email', label: 'Enviar email', icon: 'Send' },
    'consultar_status': { type: 'consultar_status', label: 'Consultar status', icon: 'Activity' },
    'whatsapp.verificar_mencoes': { type: 'verificar_mencoes', label: 'Verificar menções', icon: 'AtSign' },
    'whatsapp.verificar_links': { type: 'verificar_links', label: 'Verificar links', icon: 'Link' },
    'ideia.salvar': { type: 'salvar_ideia', label: 'Salvar ideia', icon: 'Lightbulb' },
    'link.salvar': { type: 'salvar_link', label: 'Salvar link', icon: 'Link2' },
  };
  if (actionMap[intent]) return actionMap[intent];
  const domainMap = {
    'tarefa': { type: 'criar_tarefa', label: 'Criar tarefa', icon: 'CheckSquare' },
    'financeiro': { type: 'registrar_pagamento', label: 'Registrar financeiro', icon: 'DollarSign' },
    'lead': { type: 'criar_lead', label: 'Registrar lead', icon: 'UserPlus' },
    'email': { type: 'criar_rascunho', label: 'Criar rascunho', icon: 'Mail' },
    'ideia': { type: 'salvar_ideia', label: 'Salvar ideia', icon: 'Lightbulb' },
    'link': { type: 'salvar_link', label: 'Salvar link', icon: 'Link2' },
  };
  if (domain && domainMap[domain]) return domainMap[domain];
  return { type: 'review', label: 'Revisar manualmente', icon: 'HelpCircle' };
}

// ── TELEGRAM AGENT CLASS ──
class TelegramLunaAgent {
  constructor(opts = {}) {
    this.token = opts.token || process.env.TELEGRAM_BOT_TOKEN;
    this.bot = null;
    this.running = false;
    this.me = null; // bot info
    this.conversations = new Map(); // chatId -> { step, data, mentionId, messageId }
  }

  async start() {
    if (!this.token) {
      log('error', 'TELEGRAM_BOT_TOKEN não configurado. Adicione no .env');
      return false;
    }
    if (this.running) {
      log('warn', 'Bot já está rodando');
      return true;
    }

    const TelegramBot = require('node-telegram-bot-api');
    this.bot = new TelegramBot(this.token, { polling: true });

    // Obter info do bot para saber o @username
    try {
      this.me = await this.bot.getMe();
      log('success', `Bot conectado: @${this.me.username} (id: ${this.me.id})`);
    } catch (e) {
      log('error', `Falha ao conectar: ${e.message}`);
      this.bot = null;
      return false;
    }

    this.setupHandlers();
    this.running = true;
    log('success', 'Telegram Luna Agent iniciado');
    return true;
  }

  stop() {
    if (!this.running || !this.bot) {
      log('warn', 'Bot não está rodando');
      return;
    }
    this.bot.stopPolling();
    this.bot = null;
    this.running = false;
    log('success', 'Telegram Luna Agent parado');
  }

  setupHandlers() {
    // Handler de mensagens de texto
    this.bot.on('message', async (msg) => {
      try {
        await this.handleMessage(msg);
      } catch (e) {
        log('error', `Erro no handler: ${e.message}`);
      }
    });

    // Handler de callbacks (botões inline)
    this.bot.on('callback_query', async (query) => {
      try {
        await this.handleCallback(query);
      } catch (e) {
        log('error', `Erro no callback: ${e.message}`);
      }
    });
  }

  isMention(msg) {
    const text = msg.text || msg.caption || '';
    if (!text) return false;

    // Comandos sempre são "menções"
    if (text.startsWith('/')) return true;

    // Menção ao bot via @username
    const botUsername = this.me?.username;
    if (botUsername && text.includes(`@${botUsername}`)) return true;

    // Menções genéricas
    if (/@(?:luna|kimi|kimiclaw)/i.test(text)) return true;

    return false;
  }

  cleanMentionText(text) {
    const botUsername = this.me?.username || 'lunanexobot';
    return text
      .replace(new RegExp(`@${botUsername}`, 'gi'), '')
      .replace(/@(?:luna|kimi|kimiclaw)/gi, '')
      .replace(/^\//, '')
      .trim();
  }

  // ── WIZARD HELPERS ──
  hasActiveWizard(chatId) {
    return this.conversations.has(chatId);
  }

  startWizard(chatId, data) {
    this.conversations.set(chatId, { step: 0, data, mentionId: data.mentionId, messageId: data.messageId });
  }

  cancelWizard(chatId) {
    this.conversations.delete(chatId);
  }

  async askWizardStep(chatId, stepData) {
    const { text, keyboard } = stepData;
    try {
      await this.bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } catch (e) {
      log('warn', `Falha ao enviar wizard step: ${e.message}`);
    }
  }

  getWizardKeyboard(step) {
    if (step === 'responsavel') {
      return {
        inline_keyboard: [
          [
            { text: '👤 Abner', callback_data: 'wiz:resp:abner' },
            { text: '👤 Nonoke', callback_data: 'wiz:resp:nonoke' },
          ],
          [
            { text: '👤 Elias', callback_data: 'wiz:resp:elias' },
            { text: '🙋 Eu mesmo', callback_data: 'wiz:resp:eu' },
          ],
        ]
      };
    }
    if (step === 'prazo') {
      return {
        inline_keyboard: [
          [
            { text: '📅 Hoje', callback_data: 'wiz:prazo:hoje' },
            { text: '📅 Amanhã', callback_data: 'wiz:prazo:amanha' },
          ],
          [
            { text: '📅 1 semana', callback_data: 'wiz:prazo:semana' },
            { text: '❌ Sem prazo', callback_data: 'wiz:prazo:sem' },
          ],
        ]
      };
    }
    if (step === 'prioridade') {
      return {
        inline_keyboard: [
          [
            { text: '🔴 P0 — Alta', callback_data: 'wiz:prio:P0' },
            { text: '🟡 P1 — Média', callback_data: 'wiz:prio:P1' },
            { text: '🟢 P2 — Baixa', callback_data: 'wiz:prio:P2' },
          ],
        ]
      };
    }
    if (step === 'confirmar') {
      return {
        inline_keyboard: [
          [
            { text: '✅ Confirmar e criar', callback_data: 'wiz:confirmar:sim' },
            { text: '❌ Cancelar', callback_data: 'wiz:confirmar:nao' },
          ],
        ]
      };
    }
    return { remove_keyboard: true };
  }

  async handleWizardMessage(msg) {
    const chatId = msg.chat.id;
    const conv = this.conversations.get(chatId);
    if (!conv) return false;

    const text = msg.text || '';
    const step = conv.step;

    // Passo 0 = título já veio do comando inicial
    // Passo 4 = descrição (texto livre)
    if (step === 4) {
      conv.data.descricao = text.trim() || null;
      await this.showWizardSummary(chatId);
      return true;
    }

    // Se chegou aqui com mensagem inesperada durante wizard, ignora
    return true;
  }

  async showWizardSummary(chatId) {
    const conv = this.conversations.get(chatId);
    if (!conv) return;

    const d = conv.data;
    const dueLabel = d.prazo ? d.prazo.toUpperCase() : 'Sem prazo';
    const prioEmoji = { P0: '🔴', P1: '🟡', P2: '🟢' }[d.prioridade] || '⚪';

    let text = `📋 *Resumo da tarefa:*\n\n`;
    text += `*Nome:* ${d.titulo}\n`;
    text += `*Responsável:* ${d.responsavel ? `@${d.responsavel}` : 'Não definido'}\n`;
    text += `*Prazo:* ${dueLabel}\n`;
    text += `*Prioridade:* ${prioEmoji} ${d.prioridade || 'P2'}\n`;
    text += `*Descrição:* ${d.descricao || '—'}\n`;
    text += `\n_Tudo certo?_`;

    await this.askWizardStep(chatId, {
      text,
      keyboard: this.getWizardKeyboard('confirmar'),
    });
  }

  async handleWizardCallback(query) {
    const data = query.data || '';
    const chatId = query.message.chat.id;
    const msgId = query.message.message_id;

    if (!data.startsWith('wiz:')) return false;

    const conv = this.conversations.get(chatId);
    if (!conv) {
      await this.bot.editMessageText('⚠️ Sessão expirada. Envie o comando novamente.', { chat_id: chatId, message_id: msgId });
      return true;
    }

    const [, action, value] = data.split(':');

    if (action === 'resp') {
      const nameMap = { abner: 'Abner', nonoke: 'Nonoke', elias: 'Elias', eu: query.from.first_name || query.from.username || 'eu' };
      conv.data.responsavel = value === 'eu' ? (query.from.username || query.from.first_name || 'eu') : value;
      conv.step = 2;
      await this.bot.editMessageText(`👤 Responsável: *${nameMap[value] || value}*`, {
        chat_id: chatId, message_id: msgId, parse_mode: 'Markdown'
      });
      await this.askWizardStep(chatId, {
        text: '📅 *Qual o prazo?*',
        keyboard: this.getWizardKeyboard('prazo'),
      });
      return true;
    }

    if (action === 'prazo') {
      conv.data.prazo = value === 'sem' ? null : getDueDate(value);
      conv.data.prazoLabel = value;
      conv.step = 3;
      const label = value === 'sem' ? 'Sem prazo' : value.charAt(0).toUpperCase() + value.slice(1);
      await this.bot.editMessageText(`📅 Prazo: *${label}*`, {
        chat_id: chatId, message_id: msgId, parse_mode: 'Markdown'
      });
      await this.askWizardStep(chatId, {
        text: '⚡ *Qual a prioridade?*',
        keyboard: this.getWizardKeyboard('prioridade'),
      });
      return true;
    }

    if (action === 'prio') {
      conv.data.prioridade = value;
      conv.step = 4;
      await this.bot.editMessageText(`⚡ Prioridade: *${value}*`, {
        chat_id: chatId, message_id: msgId, parse_mode: 'Markdown'
      });
      await this.askWizardStep(chatId, {
        text: '📝 *Descrição da tarefa* (opcional)\n\nEnvie o texto ou digite "/pular" para deixar em branco:',
        keyboard: { remove_keyboard: true },
      });
      return true;
    }

    if (action === 'confirmar') {
      if (value === 'nao') {
        this.cancelWizard(chatId);
        await this.bot.editMessageText('❌ Criação de tarefa cancelada.', { chat_id: chatId, message_id: msgId });
        return true;
      }
      // Executar
      await this.executeWizardTask(chatId, msgId);
      return true;
    }

    return true;
  }

  async executeWizardTask(chatId, msgId) {
    const conv = this.conversations.get(chatId);
    if (!conv) return;

    const d = conv.data;
    const params = {
      titulo: d.titulo,
      descricao: d.descricao || d.titulo,
      responsavel: d.responsavel,
      prioridade: d.prioridade || 'P2',
      prazo: d.prazo,
    };

    try {
      const executor = getActionExecutor();
      const result = await executor.execute(
        [{ type: 'criar_tarefa', params }],
        { authorName: d.author }
      );

      // Atualiza buffer
      const buffer = loadBuffer();
      const mention = buffer.newMentions?.find(m => m.id === d.mentionId);
      if (mention) {
        mention.processed = true;
        mention.executedAt = new Date().toISOString();
        mention.executedAction = 'criar_tarefa';
        mention.wizardData = { ...d };
        saveBuffer(buffer);
      }

      const dueLabel = d.prazo ? d.prazo : 'Sem prazo';
      const prioEmoji = { P0: '🔴', P1: '🟡', P2: '🟢' }[d.prioridade] || '⚪';

      let text = `✅ *Tarefa criada com sucesso!*\n\n`;
      text += `*${d.titulo}*\n`;
      text += `👤 ${d.responsavel || '—'} · ${prioEmoji} ${d.prioridade || 'P2'} · 📅 ${dueLabel}\n\n`;
      text += `_Vai aparecer no dashboard em instantes._`;

      await this.bot.editMessageText(text, {
        chat_id: chatId,
        message_id: msgId,
        parse_mode: 'Markdown',
      });
    } catch (e) {
      log('error', `Erro ao criar tarefa: ${e.message}`);
      await this.bot.editMessageText(`❌ Erro ao criar tarefa: ${e.message}`, { chat_id: chatId, message_id: msgId });
    } finally {
      this.cancelWizard(chatId);
    }
  }

  async handleMessage(msg) {
    const text = msg.text || msg.caption || '';
    if (!text.trim()) return;

    const chatId = msg.chat.id;

    // Se está no meio de um wizard, processa como resposta do wizard
    if (this.hasActiveWizard(chatId)) {
      if (text.toLowerCase() === '/pular') {
        const conv = this.conversations.get(chatId);
        if (conv && conv.step === 4) {
          conv.data.descricao = null;
          await this.showWizardSummary(chatId);
          return;
        }
      }
      if (text.toLowerCase() === '/cancelar') {
        this.cancelWizard(chatId);
        await this.bot.sendMessage(chatId, '❌ Wizard cancelado.');
        return;
      }
      await this.handleWizardMessage(msg);
      return;
    }

    // Só processa se é menção ao bot
    if (!this.isMention(msg)) return;

    const authorName = msg.from?.first_name || msg.from?.username || 'usuário';
    const authorUsername = msg.from?.username || null;
    const cleanBody = this.cleanMentionText(text);

    log('info', `Menção de ${authorName} (${chatId}): ${text.slice(0, 80)}`);

    // 1. CLASSIFICA COM NLU
    const nluResult = await classifyWithNLU(text);
    const suggestedAction = resolveSuggestedAction(nluResult);

    // 2. REGISTRA NO BUFFER
    const mentionId = `tg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const buffer = loadBuffer();
    if (!buffer.newMentions) buffer.newMentions = [];

    const mentionEntry = {
      id: mentionId,
      source: 'telegram',
      body: text,
      cleanBody,
      author: authorName,
      authorUsername,
      authorRole: null,
      chat: String(chatId),
      chatName: msg.chat.title || msg.chat.first_name || `Chat ${chatId}`,
      chatType: msg.chat.type, // private, group, supergroup
      time: normalizeTimestamp(msg.date ? msg.date * 1000 : Date.now()),
      processed: false,
      nlu: nluResult || null,
      suggestedAction,
      humanReviewed: false,
      humanIntent: null,
      humanAction: null,
      feedbackAt: null,
    };
    buffer.newMentions.push(mentionEntry);
    saveBuffer(buffer);
    log('info', `[RADAR] Menção #${mentionId} registrada | intent=${nluResult?.intent || 'null'} | sugestao=${suggestedAction.type}`);

    // 3. SE FOR TAREFA.CRIAR → INICIA WIZARD INTERATIVO
    if (suggestedAction.type === 'criar_tarefa') {
      const extractedTitle = cleanBody
        .replace(/^(criar|nova?|tarefa|task)\s+/i, '')
        .replace(/\s+/g, ' ')
        .trim() || 'Tarefa sem título';

      this.startWizard(chatId, {
        titulo: extractedTitle,
        responsavel: null,
        prazo: null,
        prioridade: null,
        descricao: null,
        author: authorName,
        mentionId,
        messageId: msg.message_id,
      });

      await this.bot.sendMessage(chatId, `📋 *Criar tarefa: "${extractedTitle}"*\n\nVou te fazer algumas perguntas rápidas...`, {
        parse_mode: 'Markdown',
      });

      await this.askWizardStep(chatId, {
        text: '👤 *Quem é o responsável?*',
        keyboard: this.getWizardKeyboard('responsavel'),
      });
      return;
    }

    // 4. RESPOSTA PADRÃO PARA OUTRAS INTENTS
    await this.sendSuggestionReply(chatId, mentionEntry, msg.message_id);
  }

  async sendSuggestionReply(chatId, mention, replyToMessageId) {
    const nlu = mention.nlu || {};
    const suggestion = mention.suggestedAction || { type: 'review', label: 'Revisar manualmente' };
    const confidence = nlu.score || 0;

    const emojiMap = {
      'criar_tarefa': '📋', 'concluir_tarefa': '✅',
      'registrar_pagamento': '💰', 'registrar_despesa': '💸',
      'consultar_caixa': '💵', 'projetar_caixa': '📈',
      'criar_lead': '🤝', 'listar_leads': '👥',
      'criar_rascunho': '✉️', 'enviar_email': '📤',
      'consultar_status': '📊', 'verificar_mencoes': '@️',
      'verificar_links': '🔗', 'salvar_ideia': '💡',
      'salvar_link': '🔗', 'review': '👀'
    };
    const emoji = emojiMap[suggestion.type] || '🤖';

    let text = `${emoji} *Detectei:* ${suggestion.label}\n\n`;
    text += `Confiança: *${Math.round(confidence * 100)}%*\n`;
    if (nlu.intent) text += `Intent: \`${nlu.intent}\`\n`;
    if (nlu.domain) text += `Domínio: \`${nlu.domain}\`\n`;
    text += `\n_To te aguardando no dashboard pra confirmar, ou clique em "Executar" aqui mesmo 👇_`;

    const dashboardUrl = `${CONFIG.DASHBOARD_URL}/dashboard/tarefas`;
    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ Executar', callback_data: `exec:${mention.id}` },
          { text: '📊 Dashboard', url: dashboardUrl }
        ],
        [
          { text: '❌ Não era isso', callback_data: `wrong:${mention.id}` }
        ]
      ]
    };

    try {
      await this.bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
        reply_to_message_id: replyToMessageId
      });
    } catch (e) {
      log('warn', `Falha ao enviar resposta: ${e.message}`);
    }
  }

  async handleCallback(query) {
    const data = query.data || '';
    const chatId = query.message.chat.id;
    const msgId = query.message.message_id;

    // Primeiro: verifica se é callback do wizard
    if (data.startsWith('wiz:')) {
      await this.handleWizardCallback(query);
      try { await this.bot.answerCallbackQuery(query.id); } catch {}
      return;
    }

    if (data.startsWith('exec:')) {
      const mentionId = data.split(':')[1];
      await this.handleExecute(mentionId, chatId, msgId);
    } else if (data.startsWith('wrong:')) {
      const mentionId = data.split(':')[1];
      await this.handleWrong(mentionId, chatId, msgId);
    }

    // Responde ao callback para remover o "carregando..."
    try {
      await this.bot.answerCallbackQuery(query.id);
    } catch (e) {}
  }

  async handleExecute(mentionId, chatId, msgId) {
    const buffer = loadBuffer();
    const mention = buffer.newMentions?.find(m => m.id === mentionId);
    if (!mention) {
      await this.bot.editMessageText('⚠️ Menção não encontrada no buffer.', { chat_id: chatId, message_id: msgId });
      return;
    }

    const actionType = mention.suggestedAction?.type;
    if (!actionType || actionType === 'review') {
      await this.bot.editMessageText('👀 Essa menção precisa de revisão manual no dashboard.', { chat_id: chatId, message_id: msgId });
      return;
    }

    try {
      const executor = getActionExecutor();
      const result = await executor.execute(
        [{ type: actionType, params: { body: mention.body, author: mention.author } }],
        { authorName: mention.author }
      );

      mention.processed = true;
      mention.executedAt = new Date().toISOString();
      mention.executedAction = actionType;
      saveBuffer(buffer);

      const successText = `✅ *Ação executada!*\n\n${mention.suggestedAction.label}\n\n_Vai aparecer no dashboard em instantes._`;
      await this.bot.editMessageText(successText, {
        chat_id: chatId,
        message_id: msgId,
        parse_mode: 'Markdown'
      });
    } catch (e) {
      log('error', `Erro ao executar: ${e.message}`);
      await this.bot.editMessageText(`❌ Erro: ${e.message}`, { chat_id: chatId, message_id: msgId });
    }
  }

  async handleWrong(mentionId, chatId, msgId) {
    const buffer = loadBuffer();
    const mention = buffer.newMentions?.find(m => m.id === mentionId);
    if (!mention) {
      await this.bot.editMessageText('⚠️ Menção não encontrada.', { chat_id: chatId, message_id: msgId });
      return;
    }

    await this.bot.editMessageText(
      `🤔 *Não era isso?*\n\n` +
      `Vai no dashboard e corrige a intenção:\n` +
      `\`${mention.nlu?.intent || 'sem intent'}\` → ?\n\n` +
      `Ou responda aqui com:\n` +
      `\`/corrigir ${mentionId} <nova_intencao>\``,
      { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown' }
    );
  }

  getStatus() {
    return {
      running: this.running,
      botUsername: this.me?.username || null,
      botId: this.me?.id || null,
    };
  }
}

// ── SINGLETON + CLI ──
let agentInstance = null;

async function startAgent() {
  if (!agentInstance) agentInstance = new TelegramLunaAgent();
  return await agentInstance.start();
}

function stopAgent() {
  if (agentInstance) {
    agentInstance.stop();
    agentInstance = null;
  }
}

function getAgentStatus() {
  return agentInstance ? agentInstance.getStatus() : { running: false, botUsername: null, botId: null };
}

// Se rodar diretamente via CLI
if (require.main === module) {
  startAgent();
  process.on('SIGINT', () => {
    log('info', 'SIGINT recebido, parando...');
    stopAgent();
    process.exit(0);
  });
}

module.exports = { TelegramLunaAgent, startAgent, stopAgent, getAgentStatus };
