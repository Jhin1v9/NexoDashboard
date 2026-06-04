// ============================================================
// LUNA TELEGRAM AGENT v3.0 — MODO RADAR + FRAMEWORK WIZARD
// Framework declarativo: adicionar wizard em nova ação = 5 linhas.
// ============================================================

// Resolve root deps when this file is loaded from backend/server.js
module.paths.unshift(require('path').resolve(__dirname, '../node_modules'));

require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const fs = require('fs');
const path = require('path');

// ── KIMI BRIDGE v2 ──
const { KimiBridge } = require('./kimi-bridge.cjs');

// ── COMPUTER USE ENGINE ──
const { ComputerUseEngine } = require('./computer-use-engine.cjs');
const { ComputerUseReAct } = require('./computer-use-react.cjs');

// Remote bridge API config (for Render → local Chrome via tunnel)
const KIMI_BRIDGE_URL = process.env.KIMI_BRIDGE_URL || null;
const KIMI_BRIDGE_API_KEY = process.env.KIMI_BRIDGE_API_KEY || 'nexo-kimi-local-2026';

// ── DASHBOARD CONTEXT BUILDER ──
// Auto-fetches dashboard data IN REAL-TIME from local API to enrich Kimi prompts
const http = require('http');
const DASHBOARD_DATA_DIR = path.join(__dirname, '../backend/data');

function loadJson(file) {
  try {
    const p = path.join(DASHBOARD_DATA_DIR, file);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch { return null; }
}

// Helper: fetch JSON from local backend API
// Uses INTERNAL_API_TOKEN for authenticated endpoints
function fetchLocalApi(endpoint) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3456,
      path: endpoint,
      method: 'GET',
      timeout: 3000,
      headers: {}
    };
    // Add auth header if INTERNAL_API_TOKEN is set
    const internalToken = process.env.INTERNAL_API_TOKEN;
    if (internalToken) {
      options.headers['Authorization'] = `Bearer ${internalToken}`;
    }
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

// Helper: escape Telegram Markdown characters that could break parse_mode: 'Markdown'
function sanitizeTelegramMarkdown(text) {
  if (!text) return '';
  // Escape unpaired markdown characters that Telegram can't parse
  // We replace problematic patterns while preserving intentional formatting
  let sanitized = text
    .replace(/\*/g, '⭐')     // asterisks → star emoji
    .replace(/_/g, '\_')      // underscores → escaped
    .replace(/`/g, '\`')      // backticks → escaped
    .replace(/\[/g, '\[')     // brackets → escaped
    .replace(/\]/g, '\]');    // brackets → escaped
  return sanitized;
}

async function buildDashboardContext(userQuery = '', userName = '') {
  const q = userQuery.toLowerCase();
  const isDashboardQuery = /tarefa|lead|ideia|orçamento|projeto|cliente|financeiro|pagamento|despesa|status|dashboard|nexo/i.test(q);
  if (!isDashboardQuery) return null;

  // Fetch data in parallel from local API
  const [tasksData, leadsData, ideasData, financeData] = await Promise.all([
    fetchLocalApi('/api/tasks'),
    fetchLocalApi('/api/leads'),
    fetchLocalApi('/api/ideas'),
    fetchLocalApi('/api/finance/summary'),
  ]);

  const tasks = Array.isArray(tasksData) ? tasksData : (tasksData || []);
  const leads = leadsData?.data?.leads || leadsData?.leads || [];
  const ideas = ideasData?.data?.ideas || ideasData?.ideas || [];
  const finance = financeData || {};

  const nameLine = userName ? `\n👤 *Usuário atual:* ${userName}` : '';
  const nameInstruction = userName
    ? `\n⚠️ IMPORTANTE: O usuário que está fazendo esta pergunta é **${userName}**. Não confunda ${userName} com outros nomes (Abner, Nonoke, Elias) que aparecem como autores de tarefas/leads no sistema.`
    : '';
  const lines = [`📋 *CONTEXTO NEXO DASHBOARD* (dados em tempo real):${nameLine}${nameInstruction}`];

  if (tasks.length) {
    lines.push(`\n📝 *Tarefas ativas (${tasks.length}):*`);
    tasks.slice(0, 10).forEach((t, i) => {
      const title = t.title || t.body || t.text || 'Sem título';
      const status = t.status || 'pending';
      const priority = t.priority ? ` [${t.priority}]` : '';
      lines.push(`${i + 1}. ${title} — ${status}${priority}`);
    });
  }

  if (leads.length) {
    lines.push(`\n👤 *Leads (${leads.length}):*`);
    leads.slice(0, 10).forEach((l, i) => {
      lines.push(`${i + 1}. ${l.name || l.context || 'Sem nome'} — ${l.status || 'novo'}`);
    });
  }

  if (ideas.length) {
    lines.push(`\n💡 *Ideias (${ideas.length}):*`);
    ideas.slice(0, 5).forEach((idea, i) => {
      lines.push(`${i + 1}. ${idea.title || idea.body || 'Sem título'}`);
    });
  }

  if (finance && (finance.totalExpected || finance.totalReceived || finance.cashBoxBalance)) {
    lines.push(`\n💰 *Financeiro:*`);
    lines.push(`- Esperado: €${finance.totalExpected || 0} | Recebido: €${finance.totalReceived || 0} | Pendente: €${finance.totalPending || 0}`);
    lines.push(`- Caixa: €${finance.cashBoxBalance || 0}`);
  }

  lines.push('\n---\nResponda usando os dados acima quando relevante. Se não souber algo específico, diga que vai verificar no dashboard.');

  const result = lines.join('\n');
  // Limit context size to avoid overloading Kimi input (max ~3000 chars)
  if (result.length > 3000) {
    return result.slice(0, 3000) + '\n\n...[contexto truncado por tamanho]';
  }
  return result;
}

// ── CONFIG ──
const CONFIG = {
  BUFFER_FILE: path.join(__dirname, '../backend/data/luna-buffer.json'),
  API_BASE: process.env.API_BASE || 'http://localhost:3456/api',
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
    actionExecutor = new ActionExecutor({
      apiBase: CONFIG.API_BASE,
      apiKey: process.env.INTERNAL_API_TOKEN
    });
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
function unescapeMarkdown(text) {
  return String(text || '').replace(/\\([_*\[\]()~`>#+=|{}.!-])/g, '$1');
}

/** Envia mensagem com MarkdownV2, e se der erro de parse, envia como texto legível */
async function safeSendMarkdownV2(bot, method, chatId, text, extra = {}) {
  try {
    if (method === 'sendMessage') {
      return await bot.sendMessage(chatId, text, { ...extra, parse_mode: 'MarkdownV2' });
    }
    if (method === 'editMessageText') {
      return await bot.editMessageText(text, { ...extra, parse_mode: 'MarkdownV2' });
    }
  } catch (e) {
    if (e.message && e.message.includes("can't parse entities")) {
      log('warn', `MarkdownV2 falhou, enviando sem formatação: ${e.message}`);
      const safeExtra = { ...extra };
      delete safeExtra.parse_mode;
      const plain = unescapeMarkdown(text);
      if (method === 'sendMessage') {
        return await bot.sendMessage(chatId, plain, safeExtra);
      }
      if (method === 'editMessageText') {
        return await bot.editMessageText(plain, safeExtra);
      }
    }
    throw e;
  }
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
      { field: 'descricao', type: 'text', label: '📝 *Descrição da tarefa* \\(_opcional_\\)\n\nEnvie o texto ou digite `/pular`:', optional: true }
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
      { field: 'valor', type: 'number', label: '💰 *Qual o valor?*\n\nEnvie apenas o número \\(ex: 150\\):' },
      { field: 'de', type: 'text', label: '👤 *De quem é o pagamento?*\n\nNome do cliente ou origem:', optional: true },
      { field: 'descricao', type: 'text', label: '📝 *Descrição* \\(_opcional_\\):', optional: true },
    ],
    buildParams: d => ({ valor: d.valor, de: d.de, descricao: d.descricao }),
    formatSummary: d => `💰 R\$ ${d.valor}\n👤 ${escapeMarkdown(d.de || '—')}\n📝 ${escapeMarkdown(d.descricao || '—')}`,
  },

  registrar_despesa: {
    emoji: '💸',
    label: 'Registrar despesa',
    steps: [
      { field: 'valor', type: 'number', label: '💸 *Qual o valor da despesa?*\n\nEnvie apenas o número \\(ex: 75\\):' },
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
      { field: 'telefone', type: 'text', label: '📞 *Telefone* \\(_opcional_\\):', optional: true },
      { field: 'email', type: 'text', label: '✉️ *Email* \\(_opcional_\\):', optional: true },
      { field: 'contexto', type: 'text', label: '📝 *Contexto\\/notas* \\(_opcional_\\):', optional: true },
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
      { field: 'conteudo', type: 'text', label: '📝 *Conteúdo\\/descrição* \\(_opcional_\\):', optional: true },
      { field: 'prioridade', type: 'select', label: '⚡ *Prioridade?* \\(_opcional_\\)', options: [{ key: 'P0', label: '🔴 Alta' }, { key: 'P1', label: '🟡 Média' }, { key: 'P2', label: '🟢 Baixa' }, { key: 'skip', label: '⏭️ Pular' }], optional: true, map: v => v === 'skip' ? null : v }
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
    this.kimiBridge = null; // lazy init
  }

  async getKimiBridge() {
    if (!this.kimiBridge) {
      this.kimiBridge = new KimiBridge({ debug: true });
      await this.kimiBridge.connect();
      log('success', 'Kimi Bridge v2 connected locally');
    }
    return this.kimiBridge;
  }

  /**
   * Call remote bridge API when KIMI_BRIDGE_URL is set (Render → local tunnel)
   */
  async _callBridgeApi(endpoint, body) {
    const res = await fetch(`${KIMI_BRIDGE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': KIMI_BRIDGE_API_KEY,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Bridge API ${res.status}`);
    }
    return res.json();
  }

  async start() {
    if (!this.token) { log('error', 'TELEGRAM_BOT_TOKEN não configurado.'); return false; }
    if (this.running) return true;
    const TelegramBot = require('node-telegram-bot-api');
    this.bot = new TelegramBot(this.token, { polling: true });
    log("info", "Telegram polling started");
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
    // Kimi Bridge command handlers (onText has priority over generic message handler)
    this._setupKimiHandlers();

    this.bot.on('message', async (msg) => {
      try { await this.handleMessage(msg); } catch (e) { log('error', `Erro no handler: ${e.message}`); }
    });
    this.bot.on('callback_query', async (query) => {
      try { await this.handleCallback(query); } catch (e) { log('error', `Erro no callback: ${e.message}`); }
    });
    this.bot.on('polling_error', (err) => {
      log('warn', `Polling error (bot continua rodando): ${err.message || err}`);
    });
    this.bot.on('error', (err) => {
      log('warn', `Bot error (bot continua rodando): ${err.message || err}`);
    });
  }

  // ── KIMI BRIDGE HANDLERS ──
  _setupKimiHandlers() {
    // Helper: local or remote bridge
    const askBridge = async (userId, text, mode, onPartial = null) => {
      if (KIMI_BRIDGE_URL) {
        // Remote API does not support streaming callbacks (HTTP request/response)
        return this._callBridgeApi('/ask', { userId, text, mode });
      }
      const bridge = await this.getKimiBridge();
      return bridge.sendMessage(userId, text, { mode, onPartialResponse: onPartial });
    };

    // Helper: create a Telegram message updater for streaming
    // Flow:
    //   1. "🧠 Pensando..." (initial)
    //   2. When Kimi writes then pauses → edit with partial text
    //   3. If Kimi is still thinking → append "🧠 Pensando..." to partial text
    //   4. When done → edit with clean final text
    // Simple helper: sends "Pensando..." and later edits with final response
    const sendThinkingThenEdit = async (chatId, replyToId, modeEmoji) => {
      const msg = await this.bot.sendMessage(chatId, `${modeEmoji} *Pensando...*`, {
        parse_mode: 'Markdown',
        reply_to_message_id: replyToId,
      });
      const messageId = msg.message_id;

      const finalize = async (finalText, mode) => {
        const emoji = mode === 'instant' ? '⚡' : '🧠';
        const safeText = sanitizeTelegramMarkdown(finalText);
        const fullText = `${emoji} ⭐Kimi⭐\n\n${safeText}`;
        if (fullText.length <= 4000) {
          try {
            await this.bot.editMessageText(fullText, {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: 'Markdown',
            });
            return messageId;
          } catch {
            try {
              await this.bot.editMessageText(fullText.replace(/⭐/g, '*').replace(/\_/g, '_'), {
                chat_id: chatId,
                message_id: messageId,
              });
              return messageId;
            } catch {}
          }
        }
        await this.bot.deleteMessage(chatId, messageId).catch(() => {});
        return sendLongMessage(chatId, fullText, { parse_mode: 'Markdown', reply_to_message_id: replyToId });
      };

      return { messageId, finalize };
    };

    // Helper: split long messages for Telegram (4096 char limit)
    const sendLongMessage = async (chatId, text, opts) => {
      const MAX = 4000;
      if (text.length <= MAX) {
        return await this.bot.sendMessage(chatId, text, opts);
      }
      const parts = [];
      for (let i = 0; i < text.length; i += MAX) {
        parts.push(text.slice(i, i + MAX));
      }
      let lastMsg;
      for (let i = 0; i < parts.length; i++) {
        const partOpts = i === 0 ? opts : { parse_mode: opts.parse_mode };
        lastMsg = await this.bot.sendMessage(chatId, parts[i], partOpts);
      }
      return lastMsg;
    };

    // Track users with active requests to prevent overlapping
    const activeUsers = new Set();

    // /kimi [pergunta] — default Instant mode
    this.bot.onText(/^\/kimi(?:\s+(.+))?/, async (msg, match) => {
      log('info', `[KIMI] /kimi from ${msg.from?.first_name || 'unknown'}: ${msg.text?.slice(0, 60)}`);
      const userId = msg.from.id;
      const userName = msg.from.first_name || msg.from.username || '';
      const question = match[1]?.trim();
      const chatId = msg.chat.id;

      if (!question) {
        await this.bot.sendMessage(chatId, '🌙 Use: `/kimi [sua pergunta]`\n\nModo: ⚡ Instant (resposta rápida)', { parse_mode: 'Markdown', reply_to_message_id: msg.message_id });
        return;
      }

      if (activeUsers.has(userId)) {
        await this.bot.sendMessage(chatId, '⏳ Aguarde a resposta anterior terminar...', { reply_to_message_id: msg.message_id });
        return;
      }
      activeUsers.add(userId);

      const { messageId, finalize } = await sendThinkingThenEdit(chatId, msg.message_id, '⚡');

      try {
        const context = await buildDashboardContext(question, userName);
        const namePrefix = userName ? `[Usuário: ${userName}] ` : '';

        // If user replied to a message, include the replied message as context
        let replyContext = '';
        if (msg.reply_to_message && msg.reply_to_message.text) {
          const replyText = msg.reply_to_message.text.trim();
          const replyAuthor = msg.reply_to_message.from?.first_name || msg.reply_to_message.from?.username || 'Usuário';
          replyContext = `--- MENSAGEM MARCADA (contexto) ---\nDe: ${replyAuthor}\n${replyText}\n--- FIM DO CONTEXTO ---\n\n`;
        }

        const noGreeting = '\n\n(Responda de forma direta e objetiva, sem saudações como "Oi" ou "Olá", e sem nomear o usuário no início.)';

        const enrichedQuestion = context
          ? `${context}\n\n${replyContext}--- PERGUNTA DO USUÁRIO ---\n${namePrefix}${question}${noGreeting}`
          : `${replyContext}${namePrefix}${question}${noGreeting}`;

        const result = await askBridge(userId, enrichedQuestion, 'instant', null);

        await finalize(result.response, result.mode || 'instant');
      } catch (err) {
        log('error', `Kimi error: ${err.message}`);
        try {
          await this.bot.editMessageText(`❌ Erro no Kimi: ${err.message}`, {
            chat_id: chatId,
            message_id: messageId,
          });
        } catch {}
      } finally {
        activeUsers.delete(userId);
      }
    });

    // /kimi_instant [pergunta]
    this.bot.onText(/^\/kimi_instant(?:\s+(.+))?/, async (msg, match) => {
      const userId = msg.from.id;
      const userName = msg.from.first_name || msg.from.username || '';
      const question = match[1]?.trim();
      const chatId = msg.chat.id;

      if (!question) {
        await this.bot.sendMessage(chatId, '⚡ Use: `/kimi_instant [sua pergunta]`', { parse_mode: 'Markdown', reply_to_message_id: msg.message_id });
        return;
      }

      if (activeUsers.has(userId)) {
        await this.bot.sendMessage(chatId, '⏳ Aguarde a resposta anterior terminar...', { reply_to_message_id: msg.message_id });
        return;
      }
      activeUsers.add(userId);

      const { messageId, finalize } = await sendThinkingThenEdit(chatId, msg.message_id, '⚡');

      try {
        const context = await buildDashboardContext(question, userName);
        const namePrefix = userName ? `[Usuário: ${userName}] ` : '';

        // If user replied to a message, include the replied message as context
        let replyContext = '';
        if (msg.reply_to_message && msg.reply_to_message.text) {
          const replyText = msg.reply_to_message.text.trim();
          const replyAuthor = msg.reply_to_message.from?.first_name || msg.reply_to_message.from?.username || 'Usuário';
          replyContext = `--- MENSAGEM MARCADA (contexto) ---\nDe: ${replyAuthor}\n${replyText}\n--- FIM DO CONTEXTO ---\n\n`;
        }

        const noGreeting = '\n\n(Responda de forma direta e objetiva, sem saudações como "Oi" ou "Olá", e sem nomear o usuário no início.)';

        const enrichedQuestion = context
          ? `${context}\n\n${replyContext}--- PERGUNTA DO USUÁRIO ---\n${namePrefix}${question}${noGreeting}`
          : `${replyContext}${namePrefix}${question}${noGreeting}`;
        const result = await askBridge(userId, enrichedQuestion, 'instant', null);
        await finalize(result.response, 'instant');
      } catch (err) {
        log('error', `Kimi instant error: ${err.message}`);
        try {
          await this.bot.editMessageText(`❌ Erro: ${err.message}`, {
            chat_id: chatId,
            message_id: messageId,
          });
        } catch {}
      } finally {
        activeUsers.delete(userId);
      }
    });

    // /kimi_thinking [pergunta]
    this.bot.onText(/^\/kimi_thinking(?:\s+(.+))?/, async (msg, match) => {
      const userId = msg.from.id;
      const userName = msg.from.first_name || msg.from.username || '';
      const question = match[1]?.trim();
      const chatId = msg.chat.id;

      if (!question) {
        await this.bot.sendMessage(chatId, '🧠 Use: `/kimi_thinking [sua pergunta]`', { parse_mode: 'Markdown', reply_to_message_id: msg.message_id });
        return;
      }

      if (activeUsers.has(userId)) {
        await this.bot.sendMessage(chatId, '⏳ Aguarde a resposta anterior terminar...', { reply_to_message_id: msg.message_id });
        return;
      }
      activeUsers.add(userId);

      const { messageId, finalize } = await sendThinkingThenEdit(chatId, msg.message_id, '🧠');

      try {
        const context = await buildDashboardContext(question, userName);
        const namePrefix = userName ? `[Usuário: ${userName}] ` : '';

        // If user replied to a message, include the replied message as context
        let replyContext = '';
        if (msg.reply_to_message && msg.reply_to_message.text) {
          const replyText = msg.reply_to_message.text.trim();
          const replyAuthor = msg.reply_to_message.from?.first_name || msg.reply_to_message.from?.username || 'Usuário';
          replyContext = `--- MENSAGEM MARCADA (contexto) ---\nDe: ${replyAuthor}\n${replyText}\n--- FIM DO CONTEXTO ---\n\n`;
        }

        const noGreeting = '\n\n(Responda de forma direta e objetiva, sem saudações como "Oi" ou "Olá", e sem nomear o usuário no início.)';

        const enrichedQuestion = context
          ? `${context}\n\n${replyContext}--- PERGUNTA DO USUÁRIO ---\n${namePrefix}${question}${noGreeting}`
          : `${replyContext}${namePrefix}${question}${noGreeting}`;
        const result = await askBridge(userId, enrichedQuestion, 'instant', null);
        await finalize(result.response, 'thinking');
      } catch (err) {
        log('error', `Kimi thinking error: ${err.message}`);
        try {
          await this.bot.editMessageText(`❌ Erro: ${err.message}`, {
            chat_id: chatId,
            message_id: messageId,
          });
        } catch {}
      } finally {
        activeUsers.delete(userId);
      }
    });

    // /kimi_novo — creates new chat for user
    this.bot.onText(/^\/kimi_novo/, async (msg) => {
      const userId = msg.from.id;
      const chatId = msg.chat.id;
      try {
        if (KIMI_BRIDGE_URL) {
          await this._callBridgeApi('/new-chat', { userId });
        } else {
          const bridge = await this.getKimiBridge();
          await bridge.newChat(userId);
        }
        await this.bot.sendMessage(chatId, '🆕 *Novo chat criado!*\n\nSeu histórico anterior foi preservado em outra aba.', {
          parse_mode: 'Markdown',
          reply_to_message_id: msg.message_id,
        });
      } catch (err) {
        log('error', `Kimi novo error: ${err.message}`);
        await this.bot.sendMessage(chatId, `❌ Erro: ${err.message}`, { reply_to_message_id: msg.message_id });
      }
    });

    // /kimi_status — shows bridge status
    this.bot.onText(/^\/kimi_status/, async (msg) => {
      const userId = msg.from.id;
      const chatId = msg.chat.id;
      try {
        let globalStatus, userStatus;
        if (KIMI_BRIDGE_URL) {
          const res = await fetch(`${KIMI_BRIDGE_URL}/status?userId=${userId}`, {
            headers: { 'X-API-Key': KIMI_BRIDGE_API_KEY },
          });
          const data = await res.json();
          globalStatus = data;
          userStatus = data;
        } else {
          const bridge = await this.getKimiBridge();
          globalStatus = await bridge.getGlobalStatus();
          userStatus = await bridge.getStatus(userId);
        }
        const lines = [
          '📊 *Kimi Bridge Status*',
          '',
          `🔗 ${KIMI_BRIDGE_URL ? 'Bridge API (remoto)' : 'CDP local'}`,
          `📄 Páginas ativas: ${globalStatus.activePages || 0}/${globalStatus.maxPages || 5}`,
          '',
          `👤 *Sua sessão:*`,
          userStatus.active
            ? `• Modo: ${userStatus.mode === 'instant' ? '⚡ Instant' : '🧠 Thinking'}\n• Processando: ${userStatus.processing ? 'sim' : 'não'}`
            : `• Sem sessão ativa (será criada no primeiro /kimi)`,
        ];
        await this.bot.sendMessage(chatId, lines.join('\n'), {
          parse_mode: 'Markdown',
          reply_to_message_id: msg.message_id,
          disable_web_page_preview: true,
        });
      } catch (err) {
        log('error', `Kimi status error: ${err.message}`);
        await this.bot.sendMessage(chatId, `❌ Erro: ${err.message}`, { reply_to_message_id: msg.message_id });
      }
    });

    // ── COMPUTER USE HANDLERS ──
    const pcActiveUsers = new Set();
    let pcCurrentTask = null;
    const pcEngine = new ComputerUseEngine();

    // /pc <command> — Headless shell execution
    this.bot.onText(/^\/pc(?:\s+(.+))?/, async (msg, match) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const command = match[1]?.trim();

      if (!command) {
        await this.bot.sendMessage(chatId,
          '🖥️ *Computer Use Agent*\n\n' +
          '`/pc <comando>` — Executa comando shell\n' +
          '`/pc_screenshot` — Tira screenshot do PC\n' +
          '`/pc_interactive <comando>` — Modo interativo (mouse/teclado)\n' +
          '`/pc_assisted <tarefa>` — Kimi raciocina e executa passo a passo\n' +
          '`/pc_stop` — Cancela tarefa em andamento',
          { parse_mode: 'Markdown', reply_to_message_id: msg.message_id });
        return;
      }

      const statusMsg = await this.bot.sendMessage(chatId, '💻 Executando...', { reply_to_message_id: msg.message_id });

      try {
        const result = await pcEngine.executeSingle({ type: 'shell', params: { command } });
        const emoji = result.success ? '✅' : '❌';
        const output = result.stdout || result.stderr || 'Sem saída';
        const text = `${emoji} *Comando:* \`${command}\`\n\n\`\`\`\n${output.slice(0, 3500)}\n\`\`\``;
        await this.bot.editMessageText(text, { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'Markdown' });
      } catch (err) {
        await this.bot.editMessageText(`❌ Erro: ${err.message}`, { chat_id: chatId, message_id: statusMsg.message_id });
      }
    });

    // /pc_screenshot — Take and send screenshot
    this.bot.onText(/^\/pc_screenshot/, async (msg) => {
      const chatId = msg.chat.id;
      const statusMsg = await this.bot.sendMessage(chatId, '📸 Tirando screenshot...', { reply_to_message_id: msg.message_id });

      try {
        const result = await pcEngine.executeSingle({ type: 'screenshot' });
        if (result.success && result.screenshot) {
          await this.bot.deleteMessage(chatId, statusMsg.message_id).catch(() => {});
          await this.bot.sendPhoto(chatId, result.screenshot, { caption: '📸 Screenshot do PC', reply_to_message_id: msg.message_id });
        } else {
          await this.bot.editMessageText('❌ Falha ao tirar screenshot', { chat_id: chatId, message_id: statusMsg.message_id });
        }
      } catch (err) {
        await this.bot.editMessageText(`❌ Erro: ${err.message}`, { chat_id: chatId, message_id: statusMsg.message_id });
      }
    });

    // /pc_interactive <command> — Interactive mode (mouse/keyboard)
    this.bot.onText(/^\/pc_interactive(?:\s+(.+))?/, async (msg, match) => {
      const chatId = msg.chat.id;
      const command = match[1]?.trim();

      if (!command) {
        await this.bot.sendMessage(chatId, '⚡ Use: `/pc_interactive <comando>`\nEx: `/pc_interactive abre o Chrome`', { parse_mode: 'Markdown', reply_to_message_id: msg.message_id });
        return;
      }

      await this.bot.sendMessage(chatId, `🖱️ Modo interativo: "${command}"\n\n⚠️ Isso vai controlar o mouse e teclado do seu PC.`, { reply_to_message_id: msg.message_id });
      // For now, just inform user that full interactive mode needs /pc_assisted
      await this.bot.sendMessage(chatId, '💡 Use `/pc_assisted ' + command + '` para que a Kimi execute passo a passo.', { reply_to_message_id: msg.message_id });
    });

    // /pc_assisted <task> — Full ReAct loop with Kimi
    this.bot.onText(/^\/pc_assisted(?:\s+(.+))?/, async (msg, match) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const task = match[1]?.trim();

      if (!task) {
        await this.bot.sendMessage(chatId, '🧠 Use: `/pc_assisted <tarefa>`\nEx: `/pc_assisted Abre o Chrome e vai pro Gmail`', { parse_mode: 'Markdown', reply_to_message_id: msg.message_id });
        return;
      }

      if (pcActiveUsers.has(userId)) {
        await this.bot.sendMessage(chatId, '⏳ Já há uma tarefa em andamento. Use `/pc_stop` para cancelar.', { reply_to_message_id: msg.message_id });
        return;
      }
      pcActiveUsers.add(userId);

      const statusMsg = await this.bot.sendMessage(chatId, '🤖 [Computer Use]\n📝 ' + task + '\n\n① Iniciando...', { reply_to_message_id: msg.message_id });
      let messageText = '🤖 [Computer Use]\n📝 ' + task + '\n';

      try {
        const bridge = await this.getKimiBridge();
        const self = this;
        const react = new ComputerUseReAct({
          kimiBridge: bridge,
          userId: String(userId),
          mode: 'thinking',
          maxIterations: 15,
          async onStep(step) {
            messageText += '\n' + step.message;
            try {
              await self.bot.editMessageText(messageText.slice(0, 4000), {
                chat_id: chatId,
                message_id: statusMsg.message_id,
              });
            } catch {}
          },
        });

        pcCurrentTask = react;
        const result = await react.runTask(task);
        pcCurrentTask = null;

        if (result.success) {
          messageText += '\n\n✅ *Tarefa concluída!*';
        } else {
          messageText += '\n\n❌ *Erro:* ' + result.error;
        }

        await this.bot.editMessageText(messageText.slice(0, 4000), {
          chat_id: chatId,
          message_id: statusMsg.message_id,
          parse_mode: 'Markdown',
        });
      } catch (err) {
        await this.bot.editMessageText(`❌ Erro: ${err.message}`, { chat_id: chatId, message_id: statusMsg.message_id });
      } finally {
        pcActiveUsers.delete(userId);
        pcCurrentTask = null;
      }
    });

    // /pc_stop — Cancel current task
    this.bot.onText(/^\/pc_stop/, async (msg) => {
      const chatId = msg.chat.id;
      if (pcCurrentTask) {
        pcCurrentTask.cancel();
        await this.bot.sendMessage(chatId, '🛑 Tarefa cancelada.', { reply_to_message_id: msg.message_id });
      } else {
        await this.bot.sendMessage(chatId, 'ℹ️ Nenhuma tarefa em andamento.', { reply_to_message_id: msg.message_id });
      }
    });

    // /help — shows complete command guide
    this.bot.onText(/^\/help/, async (msg) => {
      const chatId = msg.chat.id;
      const helpText = [
        '🤖 *Guia do @lunanexobot*',
        '',
        '*🌙 Kimi Bridge (IA)*',
        '`/kimi [pergunta]` — Pergunta no modo atual (⚡ Instant)',
        '`/kimi_instant [pergunta]` — Resposta rápida, sem reasoning',
        '`/kimi_thinking [pergunta]` — Raciocínio passo a passo',
        '`/kimi_novo` — Cria novo chat na Kimi',
        '`/kimi_status` — Status do bridge e sua sessão',
        '',
        '*🖥️ Computer Use Agent (Controle do PC)*',
        '`/pc <comando>` — Executa comando shell no PC',
        '`/pc_screenshot` — Tira screenshot do PC',
        '`/pc_interactive <comando>` — Modo interativo (mouse/teclado)',
        '`/pc_assisted <tarefa>` — Kimi raciocina e executa passo a passo',
        '`/pc_stop` — Cancela tarefa em andamento',
        '',
        '*💬 Luna Agent (Dashboard)*',
        'Mencione `@lunanexobot` ou `@luna` para criar tarefas, leads, ideias, registrar financeiro, etc.',
        'Exemplo: `@luna Criar tarefa: revisar contrato XYZ`',
        '',
        '*🖥️ Modo Local (PC ligado = streaming visual)*',
        'Se o bot estiver lento ou sem streaming, seu PC pode estar desligado.',
        'Ligar modo local via terminal:',
        '`systemctl --user start luna-local`',
        'Ver status: `systemctl --user status luna-local`',
        'Ver logs: `tail -f /tmp/luna-local-mode.log`',
        '',
        '*📁 Outros*',
        '`/help` — Mostra este guia',
        '',
        'ℹ️ Tutorial completo: `docs/TELEGRAM-BOT-GUIDE.md`',
      ].join('\n');
      await this.bot.sendMessage(chatId, helpText, {
        parse_mode: 'Markdown',
        reply_to_message_id: msg.message_id,
        disable_web_page_preview: true,
      });
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

    await safeSendMarkdownV2(this.bot, 'sendMessage', chatId, `${schema.emoji} *${escapeMarkdown(schema.label)}*\n\nVou te fazer algumas perguntas rápidas\.\.\.`);
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
      await safeSendMarkdownV2(this.bot, 'sendMessage', chatId, step.label, { reply_markup: keyboard });
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

    const text = `${schema.emoji} *Resumo — ${escapeMarkdown(schema.label)}:*\n\n${summary}\n\n_Tudo certo\?_`;
    const keyboard = {
      inline_keyboard: [[
        { text: '✅ Confirmar e criar', callback_data: 'wz:confirmar:sim' },
        { text: '❌ Cancelar', callback_data: 'wz:confirmar:nao' },
      ]],
    };
    try {
      await safeSendMarkdownV2(this.bot, 'sendMessage', chatId, text, { reply_markup: keyboard });
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

      const text = `${schema.emoji} *${escapeMarkdown(schema.label)} — criado com sucesso!*\n\n${schema.formatSummary(conv.data)}\n\n_Vai aparecer no dashboard em instantes\._`;
      await safeSendMarkdownV2(this.bot, 'sendMessage', chatId, text);
    } catch (e) {
      log('error', `Erro ao executar ${conv.schemaKey}: ${e.message}`);
      await safeSendMarkdownV2(this.bot, 'sendMessage', chatId, `❌ Erro: ${escapeMarkdown(e.message)}`);
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
  // ── COMPUTER USE DETECTOR (chat privado sem /pc) ──
  _isComputerUseCommand(text) {
    const pcPatterns = [
      /\b(abre|abrir|fecha|fechar|minimize|minimizar|maximiza|maximizar)\s+(o\s+)?(chrome|terminal|telegram|vscode|app|aplicativo|navegador)\b/i,
      /\b(clica|click|clique|digita|digitar|escreve|escrever|cola|colar)\s+(em|no|na|aqui)?\b/i,
      /\b(executa|executar|roda|rodar|run)\s+(o\s+)?(comando|script|programa)?\b/i,
      /\b(tira|tire|captura|capturar)\s+(um\s+)?(screenshot|print|printscreen|captura\s+de\s+tela)\b/i,
      /\b(vai|vai\s+para|navega|navegar|entra|entrar|acesse|acessar)\s+(em|no|na|para)\b/i,
      /\b(instala|instalar|update|atualiza|atualizar|upgrade)\b/i,
      /\b(configura|configurar|define|definir|ajusta|ajustar)\s+(o\s+)?(sistema|pc|computador|rede|wifi|display|tela)\b/i,
      /\b(mostra|me\s+mostra|me\s+diga|qual\s+(é|eh))\s+(o\s+)?(ip|hora|data|espaco|memoria|cpu|processos|disco|versao)\b/i,
      /\b(lista|listar|mostra|mostrar)\s+(os\s+)?(arquivos|pastas|diretorios|processos|janelas)\b/i,
      /\b(cria|criar|deleta|deletar|apaga|apagar|remove|remover)\s+(um\s+)?(arquivo|pasta|diretorio)\b/i,
      /\b(abre|abrir|mostra|mostrar)\s+(o\s+)?(downloads|documentos|desktop|home)\b/i,
      /\b(desliga|reinicia|suspender|lock|bloqueia)\s+(o\s+)?(pc|computador|tela)\b/i,
    ];
    return pcPatterns.some(p => p.test(text));
  }

  async _handlePrivateComputerUse(msg, text) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    log('info', `[PC_AUTO] Chat privado detectou comando de PC: ${text.slice(0, 60)}`);

    // Simple commands → direct execution
    const simpleShellPatterns = [
      { regex: /\b(mostra|me\s+diga|qual)\s+(o\s+)?(ip|hora|data|dia)\b/i, command: (t) => t.match(/ip/i) ? 'ip addr show | grep "inet " | head -2' : 'date' },
      { regex: /\b(espaco|memoria|ram|cpu|processos)\b/i, command: () => 'free -h && echo "---" && df -h / && echo "---" && ps aux --sort=-%cpu | head -5' },
      { regex: /\b(lista|listar)\s+(os\s+)?arquivos\b/i, command: () => 'ls -lah ~/' },
      { regex: /\b(tira|captura)\s+(um\s+)?screenshot\b/i, command: null, type: 'screenshot' },
    ];

    for (const pattern of simpleShellPatterns) {
      if (pattern.regex.test(text)) {
        const statusMsg = await this.bot.sendMessage(chatId, '🖥️ Executando...', { reply_to_message_id: msg.message_id });

        try {
          let result;
          if (pattern.type === 'screenshot') {
            const ssResult = await pcEngine.executeSingle({ type: 'screenshot' });
            if (ssResult.success && ssResult.screenshot) {
              await this.bot.deleteMessage(chatId, statusMsg.message_id).catch(() => {});
              await this.bot.sendPhoto(chatId, ssResult.screenshot, { caption: '📸 Screenshot do PC', reply_to_message_id: msg.message_id });
              return;
            }
          } else {
            const cmd = typeof pattern.command === 'function' ? pattern.command(text) : pattern.command;
            result = await pcEngine.executeSingle({ type: 'shell', params: { command: cmd } });
            const output = result.stdout || result.stderr || 'Sem saída';
            const emoji = result.success ? '✅' : '❌';
            await this.bot.editMessageText(`${emoji} \`${cmd}\`\n\n\`\`\`\n${output.slice(0, 3500)}\n\`\`\``, {
              chat_id: chatId,
              message_id: statusMsg.message_id,
              parse_mode: 'Markdown',
            });
            return;
          }
        } catch (err) {
          await this.bot.editMessageText(`❌ Erro: ${err.message}`, { chat_id: chatId, message_id: statusMsg.message_id });
          return;
        }
      }
    }

    // Complex commands → ReAct loop
    const statusMsg = await this.bot.sendMessage(chatId, '🤖 [Computer Use]\n📝 ' + text + '\n\n① Analisando...', { reply_to_message_id: msg.message_id });
    let messageText = '🤖 [Computer Use]\n📝 ' + text + '\n';

    try {
      const bridge = await this.getKimiBridge();
      const self = this;
      const react = new ComputerUseReAct({
        kimiBridge: bridge,
        userId: String(userId),
        mode: 'thinking',
        maxIterations: 12,
        async onStep(step) {
          messageText += '\n' + step.message;
          try {
            await self.bot.editMessageText(messageText.slice(0, 4000), {
              chat_id: chatId,
              message_id: statusMsg.message_id,
            });
          } catch {}
        },
      });

      const result = await react.runTask(text);

      if (result.success) {
        messageText += '\n\n✅ *Tarefa concluída!*';
      } else {
        messageText += '\n\n❌ *Erro:* ' + result.error;
      }

      await this.bot.editMessageText(messageText.slice(0, 4000), {
        chat_id: chatId,
        message_id: statusMsg.message_id,
        parse_mode: 'Markdown',
      });
    } catch (err) {
      await this.bot.editMessageText(`❌ Erro: ${err.message}`, { chat_id: chatId, message_id: statusMsg.message_id });
    }
  }

  async handleMessage(msg) {
    log('info', `[MSG] from ${msg.from?.first_name || 'unknown'}: ${(msg.text || '').slice(0, 60)}`);
    const text = msg.text || msg.caption || '';
    if (!text.trim()) return;
    const chatId = msg.chat.id;

    // Kimi and PC commands are handled by onText — skip here to avoid double processing
    if (/^\/kimi/.test(text)) return;
    if (/^\/pc/.test(text)) return;

    // ── CHAT PRIVADO: detecção automática de comandos de PC ──
    if (msg.chat.type === 'private' && this._isComputerUseCommand(text)) {
      await this._handlePrivateComputerUse(msg, text);
      return;
    }

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

    const nluResult = await classifyWithNLU(cleanBody);
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
      await safeSendMarkdownV2(this.bot, 'sendMessage', chatId, text, { reply_markup: keyboard, reply_to_message_id: replyToMessageId });
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

      await safeSendMarkdownV2(this.bot, 'editMessageText', null, `✅ *Ação executada!*\n\n${escapeMarkdown(mention.suggestedAction.label)}\n\n_Vai aparecer no dashboard em instantes\._`, { chat_id: chatId, message_id: msgId });
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
    await safeSendMarkdownV2(this.bot, 'editMessageText', null,
      `🤔 *Não era isso?*\n\nVai no dashboard e corrige a intenção:\n\`${escapeMarkdown(mention.nlu?.intent || 'sem intent')}\` → ?\n\nOu responda aqui com:\n\`/corrigir ${mentionId} <nova_intencao>\``,
      { chat_id: chatId, message_id: msgId }
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
