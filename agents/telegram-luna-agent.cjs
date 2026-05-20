// ============================================================
// LUNA TELEGRAM AGENT v3.0 — MODO RADAR + FRAMEWORK WIZARD
// Framework declarativo: adicionar wizard em nova ação = 5 linhas.
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

const DASHBOARD_ROUTES = {
  criar_tarefa: '/dashboard/tarefas',
  concluir_tarefa: '/dashboard/tarefas',
  registrar_pagamento: '/dashboard/financeiro',
  registrar_pagamento_com_split: '/dashboard/financeiro',
  registrar_despesa: '/dashboard/financeiro',
  registrar_despesa_com_split: '/dashboard/financeiro',
  consultar_caixa: '/dashboard/financeiro',
  projetar_caixa: '/dashboard/financeiro',
  criar_lead: '/dashboard/leads',
  listar_leads: '/dashboard/leads',
  criar_cliente: '/dashboard/leads',
  consultar_status: '/dashboard',
  criar_rascunho: '/dashboard/email',
  enviar_email: '/dashboard/email',
  salvar_ideia: '/dashboard/ideias',
  criar_ideia: '/dashboard/ideias',
  salvar_link: '/dashboard/links',
  adicionar_link: '/dashboard/links',
  criar_projeto: '/dashboard/projetos',
  listar_projetos: '/dashboard/projetos',
  criar_orcamento: '/dashboard/orcamentos',
  adicionar_cliente_workspace: '/dashboard/workspace',
};

// ── NLU & ActionExecutor ──
let lunaNLU = null;
let semanticNLU = null;

function getNLU() {
  if (!lunaNLU) lunaNLU = require('../backend/services/luna-nlu');
  return lunaNLU;
}
function getSemanticNLU() {
  if (!semanticNLU) semanticNLU = require('../backend/services/luna-semantic-nlu');
  return semanticNLU;
}

async function hybridClassify(text) {
  try {
    const nlu = getNLU();
    const sem = getSemanticNLU();
    const [nluResult, semResult] = await Promise.all([
      nlu.process(text, 'pt'),
      sem.classify(text, { lang: 'pt' }),
    ]);
    const nluOverconfident = nluResult.score >= 0.99 && nluResult.intent === 'financeiro.pagamento';
    const semanticStrong = semResult.score > 0.45;
    const semanticDisagrees = semResult.intent !== nluResult.intent;
    if (semResult.score > 0.80) {
      return { ...semResult, source: 'semantic', nluScore: nluResult.score };
    } else if (nluOverconfident && semanticStrong && semanticDisagrees) {
      return { ...semResult, source: 'semantic', reason: 'NLP.js overconfident', nluScore: nluResult.score };
    } else if (nluResult.score > semResult.score + 0.15) {
      return { intent: nluResult.intent, domain: nluResult.domain, score: nluResult.score, action: nluResult.action, entities: nluResult.entities, source: 'nlu', semanticScore: semResult.score };
    }
    return { ...semResult, source: 'semantic', nluScore: nluResult.score };
  } catch (e) {
    log('warn', `Hybrid classify erro: ${e.message}`);
    return getNLU().process(text, 'pt');
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
  else if (level === 'warn') console.warn(prefix, '⚠️', msg);
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
  if (label === 'amanha') { today.setDate(today.getDate() + 1); return today.toISOString().slice(0, 10); }
  if (label === 'semana') { today.setDate(today.getDate() + 7); return today.toISOString().slice(0, 10); }
  return null;
}
function escapeMarkdown(text) {
  return String(text || '').replace(/[_*\[\]()~`>#+=|{}.!-]/g, '\\$&');
}

// ── EXTRAÇÃO INTELIGENTE DE PARÂMETROS DO TEXTO ──
function extractInitialParams(actionType, text) {
  const params = {};
  const lower = text.toLowerCase();

  // Valor monetário: R$ 150,00 | 150€ | 150.50 | 150,50 | 150
  const valorMatch = text.match(/(?:R\$|€|\$)?\s*(\d{1,6}(?:[.,]\d{2})?)\s*(?:€|reais?)?/i);
  if (valorMatch) {
    const v = valorMatch[1].replace('.', ',').replace(',', '.');
    params.valor = parseFloat(v);
  }

  // Email
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  if (emailMatch) params.email = emailMatch[0];

  // Telefone/WhatsApp
  const telMatch = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,3}\)?[-.\s]?\d{4,5}[-.\s]?\d{4}/);
  if (telMatch) params.telefone = telMatch[0];

  // Título/nome após keyword
  if (actionType === 'criar_tarefa') {
    const m = text.replace(/^\//, '').replace(/^(?:criar|nova?)\s+tarefa\s+/i, '').trim();
    params.titulo = m || undefined;
  }
  if (actionType === 'criar_lead') {
    const m = text.replace(/^\//, '').replace(/^(?:criar|novo?)\s+lead\s+/i, '').trim();
    params.nome = m || undefined;
  }
  if (actionType === 'criar_ideia') {
    const m = text.replace(/^\//, '').replace(/^(?:salvar|criar|nova?)\s+ideia\s+/i, '').trim();
    params.titulo = m || undefined;
  }
  if (actionType === 'registrar_pagamento') {
    const deMatch = text.match(/(?:de|do|da)\s+([A-Za-zÀ-ÿ\s]{2,40})(?:\s|$|[.,])/i);
    if (deMatch) params.de = deMatch[1].trim();
  }
  if (actionType === 'registrar_despesa') {
    const paraMatch = text.match(/(?:para|pra)\s+([A-Za-zÀ-ÿ\s]{2,40})(?:\s|$|[.,])/i);
    if (paraMatch) params.para = paraMatch[1].trim();
  }
  if (actionType === 'enviar_email' || actionType === 'gerar_rascunho_email') {
    const paraMatch = text.match(/(?:para|pra)\s+([\w.-]+@[\w.-]+\.\w+|[A-Za-zÀ-ÿ\s]{2,30})(?:\s|$|[.,;])/i);
    if (paraMatch) params.para = paraMatch[1].trim();
    const assuntoMatch = text.match(/(?:assunto|sobre|re:)\s*[:\-]?\s*([^.,;\n]{2,60})/i);
    if (assuntoMatch) params.assunto = assuntoMatch[1].trim();
  }

  return params;
}

// ── WIZARD SCHEMAS (DECLARATIVO) ──
// Adicionar wizard em nova ação = adicionar entrada aqui.
const TEAM = [
  { key: 'abner', label: '👤 Abner' },
  { key: 'nonoke', label: '👤 Nonoke' },
  { key: 'elias', label: '👤 Elias' },
  { key: 'eu', label: '🙋 Eu mesmo' },
];
const PRAZOS = [
  { key: 'hoje', label: '📅 Hoje' },
  { key: 'amanha', label: '📅 Amanhã' },
  { key: 'semana', label: '📅 1 semana' },
  { key: 'sem', label: '❌ Sem prazo' },
];
const PRIORIDADES = [
  { key: 'P0', label: '🔴 P0 — Alta' },
  { key: 'P1', label: '🟡 P1 — Média' },
  { key: 'P2', label: '🟢 P2 — Baixa' },
];

const WIZARD_SCHEMAS = {
  criar_tarefa: {
    emoji: '📋',
    label: 'Criar tarefa',
    steps: [
      { field: 'titulo', type: 'hidden' },
      { field: 'responsavel', type: 'select', label: '👤 *Quem é o responsável?*', options: TEAM, map: v => v === 'eu' ? null : v },
      { field: 'prazo', type: 'select', label: '📅 *Qual o prazo?*', options: PRAZOS, map: v => v === 'sem' ? null : getDueDate(v) },
      { field: 'prioridade', type: 'select', label: '⚡ *Qual a prioridade?*', options: PRIORIDADES },
      { field: 'descricao', type: 'text', label: '📝 *Descrição da tarefa* \(_opcional_\)\n\nEnvie o texto ou digite `/pular`:', optional: true },
    ],
    buildParams: d => ({ titulo: d.titulo, descricao: d.descricao || d.titulo, responsavel: d.responsavel, prioridade: d.prioridade || 'P2', prazo: d.prazo }),
    formatSummary: d => {
      const due = d.prazo || 'Sem prazo';
      const pe = { P0: '🔴', P1: '🟡', P2: '🟢' }[d.prioridade] || '⚪';
      return `*${escapeMarkdown(d.titulo)}*\n👤 ${d.responsavel ? `@${d.responsavel}` : '—'} · ${pe} ${d.prioridade || 'P2'} · 📅 ${due}`;
    },
  },

  registrar_pagamento: {
    emoji: '💰',
    label: 'Registrar pagamento',
    steps: [
      { field: 'valor', type: 'number', label: '💰 *Qual o valor?*\n\nEnvie apenas o número \(ex: 150\):' },
      { field: 'de', type: 'text', label: '👤 *De quem é o pagamento?*\n\nNome do cliente ou origem:', optional: true },
      { field: 'descricao', type: 'text', label: '📝 *Descrição* \(_opcional_\):', optional: true },
    ],
    buildParams: d => ({ valor: d.valor, de: d.de, descricao: d.descricao }),
    formatSummary: d => `💰 R\$ ${d.valor}\n👤 ${escapeMarkdown(d.de || '—')}\n📝 ${escapeMarkdown(d.descricao || '—')}`,
  },

  registrar_despesa: {
    emoji: '💸',
    label: 'Registrar despesa',
    steps: [
      { field: 'valor', type: 'number', label: '💸 *Qual o valor da despesa?*\n\nEnvie apenas o número \(ex: 75\):' },
      { field: 'para', type: 'text', label: '📌 *Para quem\/o quê?*\n\nFornecedor ou motivo:', optional: true },
      { field: 'descricao', type: 'text', label: '📝 *Descrição* \(_opcional_\):', optional: true },
    ],
    buildParams: d => ({ valor: d.valor, para: d.para, descricao: d.descricao }),
    formatSummary: d => `💸 R\$ ${d.valor}\n📌 ${escapeMarkdown(d.para || '—')}\n📝 ${escapeMarkdown(d.descricao || '—')}`,
  },

  criar_lead: {
    emoji: '🤝',
    label: 'Registrar lead',
    steps: [
      { field: 'nome', type: 'text', label: '🤝 *Qual o nome do lead?*' },
      { field: 'telefone', type: 'text', label: '📞 *Telefone* \(_opcional_\):', optional: true },
      { field: 'email', type: 'text', label: '✉️ *Email* \(_opcional_\):', optional: true },
      { field: 'contexto', type: 'text', label: '📝 *Contexto\/notas* \(_opcional_\):', optional: true },
    ],
    buildParams: d => ({ nome: d.nome, telefone: d.telefone, email: d.email, contexto: d.contexto }),
    formatSummary: d => `🤝 ${escapeMarkdown(d.nome)}\n📞 ${escapeMarkdown(d.telefone || '—')}\n✉️ ${escapeMarkdown(d.email || '—')}`,
  },

  enviar_email: {
    emoji: '📤',
    label: 'Enviar email',
    steps: [
      { field: 'para', type: 'text', label: '✉️ *Para quem?*\n\nEmail do destinatário:' },
      { field: 'assunto', type: 'text', label: '📋 *Assunto:*' },
      { field: 'texto', type: 'text', label: '📝 *Mensagem:*', optional: true },
    ],
    buildParams: d => ({ para: d.para, assunto: d.assunto, texto: d.texto }),
    formatSummary: d => `📤 Para: ${escapeMarkdown(d.para)}\n📋 ${escapeMarkdown(d.assunto)}`,
  },

  gerar_rascunho_email: {
    emoji: '✉️',
    label: 'Criar rascunho de email',
    steps: [
      { field: 'para', type: 'text', label: '✉️ *Para quem?*\n\nEmail do destinatário:' },
      { field: 'assunto', type: 'text', label: '📋 *Assunto:*' },
      { field: 'texto', type: 'text', label: '📝 *Mensagem:*', optional: true },
    ],
    buildParams: d => ({ para: d.para, assunto: d.assunto, texto: d.texto }),
    formatSummary: d => `✉️ Para: ${escapeMarkdown(d.para)}\n📋 ${escapeMarkdown(d.assunto)}`,
  },

  criar_ideia: {
    emoji: '💡',
    label: 'Salvar ideia',
    steps: [
      { field: 'titulo', type: 'text', label: '💡 *Qual o título da ideia?*' },
      { field: 'conteudo', type: 'text', label: '📝 *Conteúdo\/descrição* \(_opcional_\):', optional: true },
      { field: 'prioridade', type: 'select', label: '⚡ *Prioridade?* \(_opcional_\)', options: [{ key: 'P0', label: '🔴 Alta' }, { key: 'P1', label: '🟡 Média' }, { key: 'P2', label: '🟢 Baixa' }, { key: 'skip', label: '⏭️ Pular' }], optional: true, map: v => v === 'skip' ? null : v },
    ],
    buildParams: d => ({ titulo: d.titulo, conteudo: d.conteudo || d.titulo, prioridade: d.prioridade || 'P2' }),
    formatSummary: d => `💡 ${escapeMarkdown(d.titulo)}\n⚡ ${d.prioridade || 'P2'}`,
  },
};

// ── NLU ──
async function classifyWithNLU(text) {
  try {
    const result = await hybridClassify(text);
    if (!result) return null;
    return {
      intent: result.intent, domain: result.domain, score: result.score,
      action: result.action, entities: result.entities,
      answer: result.answer || '', sentiment: result.sentiment || { vote: 'neutral', score: 0 },
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
    'email.rascunho': { type: 'gerar_rascunho_email', label: 'Criar rascunho de email', icon: 'Mail' },
    'email.enviar': { type: 'enviar_email', label: 'Enviar email', icon: 'Send' },
    'consultar_status': { type: 'consultar_status', label: 'Consultar status', icon: 'Activity' },
    'whatsapp.verificar_mencoes': { type: 'verificar_mencoes', label: 'Verificar menções', icon: 'AtSign' },
    'whatsapp.verificar_links': { type: 'verificar_links', label: 'Verificar links', icon: 'Link' },
    'ideia.salvar': { type: 'criar_ideia', label: 'Salvar ideia', icon: 'Lightbulb' },
    'link.salvar': { type: 'adicionar_link', label: 'Salvar link', icon: 'Link2' },
  };
  if (actionMap[intent]) return actionMap[intent];
  const domainMap = {
    tarefa: { type: 'criar_tarefa', label: 'Criar tarefa', icon: 'CheckSquare' },
    financeiro: { type: 'registrar_pagamento', label: 'Registrar financeiro', icon: 'DollarSign' },
    lead: { type: 'criar_lead', label: 'Registrar lead', icon: 'UserPlus' },
    email: { type: 'gerar_rascunho_email', label: 'Criar rascunho', icon: 'Mail' },
    ideia: { type: 'criar_ideia', label: 'Salvar ideia', icon: 'Lightbulb' },
    link: { type: 'adicionar_link', label: 'Salvar link', icon: 'Link2' },
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
    this.me = null;
    this.conversations = new Map(); // chatId -> { schemaKey, stepIndex, data, mentionId, messageId, author }
  }

  async start() {
    if (!this.token) { log('error', 'TELEGRAM_BOT_TOKEN não configurado.'); return false; }
    if (this.running) return true;
    const TelegramBot = require('node-telegram-bot-api');
    this.bot = new TelegramBot(this.token, { polling: true });
    try {
      this.me = await this.bot.getMe();
      log('success', `Bot conectado: @${this.me.username} (id: ${this.me.id})`);
    } catch (e) { log('error', `Falha ao conectar: ${e.message}`); this.bot = null; return false; }
    this.setupHandlers();
    this.running = true;
    log('success', 'Telegram Luna Agent iniciado');
    return true;
  }

  stop() {
    if (!this.running || !this.bot) return;
    this.bot.stopPolling();
    this.bot = null;
    this.running = false;
    log('success', 'Telegram Luna Agent parado');
  }

  setupHandlers() {
    this.bot.on('message', async (msg) => {
      try { await this.handleMessage(msg); } catch (e) { log('error', `Erro no handler: ${e.message}`); }
    });
    this.bot.on('callback_query', async (query) => {
      try { await this.handleCallback(query); } catch (e) { log('error', `Erro no callback: ${e.message}`); }
    });
  }

  isMention(msg) {
    const text = msg.text || msg.caption || '';
    if (!text) return false;
    if (text.startsWith('/')) return true;
    const botUsername = this.me?.username;
    if (botUsername && text.includes(`@${botUsername}`)) return true;
    if (/@(?:luna|kimi|kimiclaw)/i.test(text)) return true;
    return false;
  }

  cleanMentionText(text) {
    const botUsername = this.me?.username || 'lunanexobot';
    return text.replace(new RegExp(`@${botUsername}`, 'gi'), '').replace(/@(?:luna|kimi|kimiclaw)/gi, '').replace(/^\//, '').trim();
  }

  // ── MOTOR WIZARD GENÉRICO ──
  hasActiveWizard(chatId) { return this.conversations.has(chatId); }

  cancelWizard(chatId) { this.conversations.delete(chatId); }

  async startWizard(chatId, schemaKey, initialData) {
    const schema = WIZARD_SCHEMAS[schemaKey];
    if (!schema) return false;

    // Pula steps que já têm valor preenchido
    let stepIndex = 0;
    while (stepIndex < schema.steps.length) {
      const step = schema.steps[stepIndex];
      if (step.type === 'hidden' && initialData[step.field]) {
        stepIndex++;
        continue;
      }
      if (initialData[step.field] !== undefined && initialData[step.field] !== null) {
        stepIndex++;
        continue;
      }
      break;
    }

    this.conversations.set(chatId, { schemaKey, stepIndex, data: { ...initialData }, author: initialData.author, mentionId: initialData.mentionId });

    await this.bot.sendMessage(chatId, `${schema.emoji} *${schema.label}*\n\nVou te fazer algumas perguntas rápidas\.\.\.`, { parse_mode: 'MarkdownV2' });
    await this.sendWizardStep(chatId);
    return true;
  }

  async sendWizardStep(chatId) {
    const conv = this.conversations.get(chatId);
    if (!conv) return;
    const schema = WIZARD_SCHEMAS[conv.schemaKey];
    const step = schema.steps[conv.stepIndex];
    if (!step) {
      await this.showWizardSummary(chatId);
      return;
    }

    const keyboard = this.buildStepKeyboard(step);
    try {
      await this.bot.sendMessage(chatId, step.label, {
        parse_mode: 'MarkdownV2',
        reply_markup: keyboard,
      });
    } catch (e) {
      log('warn', `Falha ao enviar wizard step: ${e.message}`);
    }
  }

  buildStepKeyboard(step) {
    if (step.type === 'select') {
      const rows = [];
      const rowSize = step.options.length <= 3 ? step.options.length : 2;
      for (let i = 0; i < step.options.length; i += rowSize) {
        rows.push(step.options.slice(i, i + rowSize).map(opt => ({
          text: opt.label,
          callback_data: `wz:${step.field}:${opt.key}`,
        })));
      }
      return { inline_keyboard: rows };
    }
    return { remove_keyboard: true };
  }

  async advanceWizard(chatId, value) {
    const conv = this.conversations.get(chatId);
    if (!conv) return;
    const schema = WIZARD_SCHEMAS[conv.schemaKey];
    const step = schema.steps[conv.stepIndex];

    let finalValue = value;
    if (step.map) finalValue = step.map(value);
    if (step.type === 'number') finalValue = parseFloat(value);
    conv.data[step.field] = finalValue;

    // Avança para o próximo step não preenchido
    conv.stepIndex += 1;
    while (conv.stepIndex < schema.steps.length) {
      const nextStep = schema.steps[conv.stepIndex];
      if (conv.data[nextStep.field] !== undefined && conv.data[nextStep.field] !== null) {
        conv.stepIndex++;
        continue;
      }
      break;
    }

    if (conv.stepIndex >= schema.steps.length) {
      await this.showWizardSummary(chatId);
    } else {
      await this.sendWizardStep(chatId);
    }
  }

  async showWizardSummary(chatId) {
    const conv = this.conversations.get(chatId);
    if (!conv) return;
    const schema = WIZARD_SCHEMAS[conv.schemaKey];
    const summary = schema.formatSummary(conv.data);

    const text = `${schema.emoji} *Resumo — ${schema.label}:*\n\n${summary}\n\n_Tudo certo\?_`;
    const keyboard = {
      inline_keyboard: [[
        { text: '✅ Confirmar e criar', callback_data: 'wz:confirmar:sim' },
        { text: '❌ Cancelar', callback_data: 'wz:confirmar:nao' },
      ]],
    };
    try {
      await this.bot.sendMessage(chatId, text, { parse_mode: 'MarkdownV2', reply_markup: keyboard });
    } catch (e) {
      log('warn', `Falha no summary: ${e.message}`);
    }
  }

  async executeWizard(chatId) {
    const conv = this.conversations.get(chatId);
    if (!conv) return;
    const schema = WIZARD_SCHEMAS[conv.schemaKey];
    const params = schema.buildParams(conv.data);

    try {
      const executor = getActionExecutor();
      const result = await executor.execute(
        [{ type: conv.schemaKey, params }],
        { authorName: conv.author }
      );

      // Atualiza buffer
      const buffer = loadBuffer();
      const mention = buffer.newMentions?.find(m => m.id === conv.mentionId);
      if (mention) {
        mention.processed = true;
        mention.executedAt = new Date().toISOString();
        mention.executedAction = conv.schemaKey;
        mention.wizardData = { ...conv.data };
        saveBuffer(buffer);
      }

      const text = `${schema.emoji} *${schema.label} — criado com sucesso!*\n\n${schema.formatSummary(conv.data)}\n\n_Vai aparecer no dashboard em instantes\._`;
      await this.bot.sendMessage(chatId, text, { parse_mode: 'MarkdownV2' });
    } catch (e) {
      log('error', `Erro ao executar ${conv.schemaKey}: ${e.message}`);
      await this.bot.sendMessage(chatId, `❌ Erro: ${escapeMarkdown(e.message)}`, { parse_mode: 'MarkdownV2' });
    } finally {
      this.cancelWizard(chatId);
    }
  }

  async handleWizardMessage(msg) {
    const chatId = msg.chat.id;
    const conv = this.conversations.get(chatId);
    if (!conv) return false;

    const text = msg.text || '';
    if (text.toLowerCase() === '/cancelar') {
      this.cancelWizard(chatId);
      await this.bot.sendMessage(chatId, '❌ Cancelado.');
      return true;
    }

    const schema = WIZARD_SCHEMAS[conv.schemaKey];
    const step = schema.steps[conv.stepIndex];
    if (!step) return true;

    if (step.type === 'text' || step.type === 'number') {
      if (step.optional && text.toLowerCase() === '/pular') {
        await this.advanceWizard(chatId, null);
        return true;
      }
      if (step.type === 'number' && (isNaN(parseFloat(text)) || text.trim() === '')) {
        await this.bot.sendMessage(chatId, '⚠️ Por favor, envie um número válido.');
        return true;
      }
      await this.advanceWizard(chatId, text.trim());
      return true;
    }

    return true;
  }

  async handleWizardCallback(query) {
    const data = query.data || '';
    const chatId = query.message.chat.id;
    if (!data.startsWith('wz:')) return false;

    const conv = this.conversations.get(chatId);
    if (!conv) {
      try { await this.bot.answerCallbackQuery(query.id); } catch {}
      return true;
    }

    const [, field, value] = data.split(':');

    if (field === 'confirmar') {
      if (value === 'nao') {
        this.cancelWizard(chatId);
        await this.bot.editMessageText('❌ Cancelado.', { chat_id: chatId, message_id: query.message.message_id });
      } else {
        await this.bot.editMessageText('⏳ Processando...', { chat_id: chatId, message_id: query.message.message_id });
        await this.executeWizard(chatId);
      }
      try { await this.bot.answerCallbackQuery(query.id); } catch {}
      return true;
    }

    const schema = WIZARD_SCHEMAS[conv.schemaKey];
    const step = schema.steps[conv.stepIndex];
    if (!step || step.field !== field) {
      try { await this.bot.answerCallbackQuery(query.id); } catch {}
      return true;
    }

    // Edita a mensagem original para mostrar a escolha
    const opt = step.options.find(o => o.key === value);
    const label = opt ? opt.label : value;
    try {
      await this.bot.editMessageText(`${label}`, { chat_id: chatId, message_id: query.message.message_id });
    } catch {}

    await this.advanceWizard(chatId, value);
    try { await this.bot.answerCallbackQuery(query.id); } catch {}
    return true;
  }

  // ── HANDLER PRINCIPAL ──
  async handleMessage(msg) {
    const text = msg.text || msg.caption || '';
    if (!text.trim()) return;
    const chatId = msg.chat.id;

    // Wizard ativo?
    if (this.hasActiveWizard(chatId)) {
      await this.handleWizardMessage(msg);
      return;
    }

    if (!this.isMention(msg)) return;

    const authorName = msg.from?.first_name || msg.from?.username || 'usuário';
    const authorUsername = msg.from?.username || null;
    const cleanBody = this.cleanMentionText(text);

    log('info', `Menção de ${authorName} (${chatId}): ${text.slice(0, 80)}`);

    const nluResult = await classifyWithNLU(text);
    const suggestedAction = resolveSuggestedAction(nluResult);

    // Registra no buffer
    const mentionId = `tg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const buffer = loadBuffer();
    if (!buffer.newMentions) buffer.newMentions = [];
    const mentionEntry = {
      id: mentionId, source: 'telegram', body: text, cleanBody,
      author: authorName, authorUsername, authorRole: null,
      chat: String(chatId), chatName: msg.chat.title || msg.chat.first_name || `Chat ${chatId}`,
      chatType: msg.chat.type, time: normalizeTimestamp(msg.date ? msg.date * 1000 : Date.now()),
      processed: false, nlu: nluResult || null, suggestedAction,
      humanReviewed: false, humanIntent: null, humanAction: null, feedbackAt: null,
    };
    buffer.newMentions.push(mentionEntry);
    saveBuffer(buffer);
    log('info', `[RADAR] #${mentionId} intent=${nluResult?.intent || 'null'} action=${suggestedAction.type}`);

    // Se existe schema de wizard para essa ação → inicia wizard
    if (WIZARD_SCHEMAS[suggestedAction.type]) {
      const extracted = extractInitialParams(suggestedAction.type, text);
      // Para algumas ações, tenta extrair título do cleanBody se não veio extração
      if (suggestedAction.type === 'criar_tarefa' && !extracted.titulo) {
        extracted.titulo = cleanBody.replace(/^(criar|nova?)\s+tarefa\s*/i, '').trim() || 'Tarefa sem título';
      }
      if (suggestedAction.type === 'criar_ideia' && !extracted.titulo) {
        extracted.titulo = cleanBody.replace(/^(salvar|criar|nova?)\s+ideia\s*/i, '').trim() || 'Ideia sem título';
      }
      if (suggestedAction.type === 'criar_lead' && !extracted.nome) {
        extracted.nome = cleanBody.replace(/^(criar|novo?)\s+lead\s*/i, '').trim() || undefined;
      }

      await this.startWizard(chatId, suggestedAction.type, {
        ...extracted,
        author: authorName,
        mentionId,
      });
      return;
    }

    // Ação normal (consulta, sem wizard)
    await this.sendSuggestionReply(chatId, mentionEntry, msg.message_id);
  }

  async sendSuggestionReply(chatId, mention, replyToMessageId) {
    const nlu = mention.nlu || {};
    const suggestion = mention.suggestedAction || { type: 'review', label: 'Revisar manualmente' };
    const confidence = nlu.score || 0;

    const emojiMap = {
      criar_tarefa: '📋', concluir_tarefa: '✅', registrar_pagamento: '💰', registrar_despesa: '💸',
      consultar_caixa: '💵', projetar_caixa: '📈', criar_lead: '🤝', listar_leads: '👥',
      gerar_rascunho_email: '✉️', enviar_email: '📤', consultar_status: '📊',
      verificar_mencoes: '@️', verificar_links: '🔗', criar_ideia: '💡', adicionar_link: '🔗', review: '👀',
    };
    const emoji = emojiMap[suggestion.type] || '🤖';

    let text = `${emoji} *Detectei:* ${escapeMarkdown(suggestion.label)}\n\n`;
    text += `Confiança: *${Math.round(confidence * 100)}%*\n`;
    if (nlu.intent) text += `Intent: \`${escapeMarkdown(nlu.intent)}\`\n`;
    if (nlu.domain) text += `Domínio: \`${escapeMarkdown(nlu.domain)}\`\n`;
    text += `\n_To te aguardando no dashboard pra confirmar, ou clique em "Executar" aqui mesmo 👇_`;

    const route = DASHBOARD_ROUTES[suggestion.type] || '/dashboard';
    const dashboardUrl = `${CONFIG.DASHBOARD_URL}${route}`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ Executar', callback_data: `exec:${mention.id}` },
          { text: '📊 Dashboard', url: dashboardUrl },
        ],
        [
          { text: '❌ Não era isso', callback_data: `wrong:${mention.id}` },
        ],
      ],
    };

    try {
      await this.bot.sendMessage(chatId, text, {
        parse_mode: 'MarkdownV2',
        reply_markup: keyboard,
        reply_to_message_id: replyToMessageId,
      });
    } catch (e) {
      log('warn', `Falha ao enviar resposta: ${e.message}`);
    }
  }

  async handleCallback(query) {
    const data = query.data || '';
    const chatId = query.message.chat.id;
    const msgId = query.message.message_id;

    if (data.startsWith('wz:')) {
      await this.handleWizardCallback(query);
      return;
    }

    if (data.startsWith('exec:')) {
      const mentionId = data.split(':')[1];
      await this.handleExecute(mentionId, chatId, msgId);
    } else if (data.startsWith('wrong:')) {
      const mentionId = data.split(':')[1];
      await this.handleWrong(mentionId, chatId, msgId);
    }

    try { await this.bot.answerCallbackQuery(query.id); } catch {}
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
      // Chamar API do backend (que faz sync PG↔JSON automaticamente)
      const apiToken = process.env.INTERNAL_API_TOKEN;
      const res = await fetch(`${CONFIG.API_BASE}/luna/pending/${mentionId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`
        },
        body: JSON.stringify({ actionType })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const result = await res.json();

      mention.processed = true;
      mention.executedAt = new Date().toISOString();
      mention.executedAction = actionType;
      saveBuffer(buffer);

      await this.bot.editMessageText(`✅ *Ação executada!*

${escapeMarkdown(mention.suggestedAction.label)}

_Vai aparecer no dashboard em instantes._`, {
        chat_id: chatId, message_id: msgId, parse_mode: 'MarkdownV2',
      });
    } catch (e) {
      log('error', `Erro ao executar: ${e.message}`);
      await this.bot.editMessageText(`❌ Erro: ${escapeMarkdown(e.message)}`, { chat_id: chatId, message_id: msgId });
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
      `🤔 *Não era isso?*\n\nVai no dashboard e corrige a intenção:\n\`${escapeMarkdown(mention.nlu?.intent || 'sem intent')}\` → ?\n\nOu responda aqui com:\n\`/corrigir ${mentionId} <nova_intencao>\``,
      { chat_id: chatId, message_id: msgId, parse_mode: 'MarkdownV2' }
    );
  }

  getStatus() {
    return { running: this.running, botUsername: this.me?.username || null, botId: this.me?.id || null };
  }
}

// ── SINGLETON + CLI ──
let agentInstance = null;
async function startAgent() {
  if (!agentInstance) agentInstance = new TelegramLunaAgent();
  return await agentInstance.start();
}
function stopAgent() {
  if (agentInstance) { agentInstance.stop(); agentInstance = null; }
}
function getAgentStatus() {
  return agentInstance ? agentInstance.getStatus() : { running: false, botUsername: null, botId: null };
}

if (require.main === module) {
  startAgent();
  process.on('SIGINT', () => { log('info', 'SIGINT recebido, parando...'); stopAgent(); process.exit(0); });
}

module.exports = { TelegramLunaAgent, startAgent, stopAgent, getAgentStatus };
