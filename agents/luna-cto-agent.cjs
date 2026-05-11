// ============================================================
// LUNA v15.1 "VISION EXTRACTOR" — CORRIGIDO
// Sem erros de sintaxe, sem fechar shell, keep-alive ativo
// ============================================================

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cron = require('node-cron');
const { LunaBrain } = require('./LunaBrain_v16.js');
const { SmartClassifier, resolveAuthor } = require('./SmartClassifier_v16.js');
const { LunaMemory } = require('./LunaMemory_v17.js');

// ── LUNA v18.0 CONSCIOUS — Novos Módulos Inteligentes ──
const { LunaOrchestrator } = require('./core/LunaOrchestrator.js');
const { LunaReasoningEngine } = require('./core/LunaReasoningEngine.js');
const { FeedbackLoop } = require('./proactive/FeedbackLoop.js');
const { ProactiveEngine } = require('./proactive/ProactiveEngine.js');

function normalizeWhatsAppTimestamp(value) {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') {
    const millis = value < 10000000000 ? value * 1000 : value;
    return new Date(millis).toISOString();
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric) && /^\d+$/.test(String(value))) {
    const millis = numeric < 10000000000 ? numeric * 1000 : numeric;
    return new Date(millis).toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function isLidId(value = '') {
  return /@lid$/i.test(String(value));
}

// Playwright importado no topo (não dinamicamente)
let chromium = null;
try {
  chromium = require('playwright').chromium;
} catch (e) {
  console.error('❌ Playwright não instalado! Execute: npm install playwright');
  console.error(e.message);
}   // ← fecha o catch (linha 20)

// ============================================
// LUNA v16.0 — SCHEMA LOADER
// Colar aqui: entre o catch e a CONFIGURAÇÃO
// ============================================

const SCHEMA_BASE = path.join(__dirname, '..', 'backend', 'data');

let SCHEMAS = {};

function loadSchema(schemaName) {
  try {
    const filePath = path.join(SCHEMA_BASE, 'schema', `${schemaName}.json`);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    const configPath = path.join(SCHEMA_BASE, 'config', `${schemaName}.json`);
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    console.warn(`[SCHEMA] ⚠️  Schema não encontrado: ${schemaName}`);
    return null;
  } catch (err) {
    console.error(`[SCHEMA] ❌ Erro ao carregar ${schemaName}:`, err.message);
    return null;
  }
}
function loadAllSchemas() {
  console.log('[SCHEMA] 🔄 Carregando schemas v16.0...');
  
  SCHEMAS = {
    contacts: loadSchema('contacts-map'),
    clients: loadSchema('clients-registry'),
    projects: loadSchema('projects-registry'),
    groups: loadSchema('groups-config'),
    version: loadSchema('schema-version'),
    nlp: loadSchema('nlp-enrichment-schema'),
    privacy: loadSchema('message-privacy-schema'),
    integrations: loadSchema('integrations-config'),
    dashboard: loadSchema('luna-dashboard-config'),
    commands: loadSchema('commands-config')
  };
  
  const loaded = Object.entries(SCHEMAS).filter(([k, v]) => v !== null).length;
  console.log(`[SCHEMA] ✅ ${loaded}/10 schemas carregados`);
  
  return SCHEMAS;
}
// Carregar no startup
SCHEMAS = loadAllSchemas();

// Exportar para acesso global
global.SCHEMAS = SCHEMAS;

// =====================================================  ← (linha 21 original)
// CONFIGURAÇÃO v15.1
// =====================================================

/**
 * Verifica se um chat/grupo está autorizado para monitoramento.
 * Só monitora grupos explicitamente configurados em groups-config.json com monitoring.enabled = true.
 * DMs (chats individuais) são ignorados por padrão para proteger privacidade.
 */
const isAuthorizedChat = (chatId) => {
  const id = (chatId || '').trim();
  
  // Ignorar DMs individuais — proteção de privacidade
  if (id.endsWith('@c.us')) {
    return false;
  }
  
  // Verificar se é um grupo monitorado pelo schema groups-config
  if (SCHEMAS.groups && SCHEMAS.groups.groups) {
    const groupValues = Object.values(SCHEMAS.groups.groups);
    // Verifica por match no ID do grupo (@g.us)
    const byId = groupValues.find(g => g.groupId === id || id.includes(g.id));
    if (byId) {
      return byId.monitoring?.enabled === true;
    }
    // Verifica por match no nome do grupo
    const byName = groupValues.find(g => {
      const names = [
        g.originalName,
        g.displayName,
        ...(g.aliases || [])
      ].filter(Boolean).map(n => n.toLowerCase());
      return names.some(n => id.toLowerCase().includes(n));
    });
    if (byName) {
      return byName.monitoring?.enabled === true;
    }
  }
  
  // Fallback: verificar contra CONFIG.GROUPS (hardcoded whitelist)
  const n = id.toLowerCase();
  return CONFIG.GROUPS.some(g => n.includes(g.name.toLowerCase()));
};

const SESSION_DATA_PATH = path.join(__dirname, '..', 'ARTIFACTS', 'wwebjs-auth');

const CONFIG = {
  REPORT_TO: 'Production',
  REPORT_DESTINATION: {
    name: 'Production',
    number: '34685093192',
    groupName: 'Production'
  },
  GROUPS: [
    { name: 'Production', type: 'internal', id: 'nexo-production-2026' },
    { name: 'Paulo', type: 'client' }
  ],
  SCAN_INTERVAL: 10 * 60 * 1000,
  REPORT_INTERVAL: 30 * 60 * 1000,
  MAX_SILENCE_REPORTS: 1,
  MAX_SCROLLS: 50,
  CDP_PORT: 9223,
  CDP_TIMEOUT: 30000,
  SCROLL_WAIT: 300,
  SCROLL_STABLE_TIME: 5000,

  CHECKPOINT_FILE: path.join(__dirname, '../backend/data/luna-checkpoint.json'),
  BUFFER_FILE: path.join(__dirname, '../backend/data/luna-buffer.json'),
  OUTPUT_FILE: path.join(__dirname, '../backend/data/whatsapp-agent-data.json'),
  WHATSAPP_HISTORY_FILE: path.join(__dirname, '../backend/data/whatsapp-history.json'),
  FULL_EXTRACT_FILE: path.join(__dirname, '../backend/data/full-extract.json'),
  NEWS_FILE: path.join(__dirname, '../backend/data/nexo-news.json'),
  REPORTS_DIR: path.join(__dirname, '../backend/data/reports'),
  ARTIFACTS_DIR: path.join(__dirname, '../ARTIFACTS'),
  DEBUG_DIR: path.join(__dirname, '../ARTIFACTS/debug')
};

function resolveChromeExecutable() {
  const candidates = [
    process.env.LUNA_CHROME_PATH,
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/opt/google/chrome/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ].filter(Boolean);

  return candidates.find(candidate => fs.existsSync(candidate)) || null;
}

const CHROME_EXECUTABLE = resolveChromeExecutable();

// Criar diretórios
[CONFIG.REPORTS_DIR, CONFIG.ARTIFACTS_DIR, CONFIG.DEBUG_DIR, SESSION_DATA_PATH].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// ============================================================
// KEEP-ALIVE — Não deixa o shell fechar
// ============================================================
process.on('uncaughtException', (err) => {
  console.error('[KEEP-ALIVE] Uncaught Exception:', err.message);
  console.error('[KEEP-ALIVE] Luna continua rodando...');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[KEEP-ALIVE] Unhandled Rejection:', reason);
  console.error('[KEEP-ALIVE] Luna continua rodando...');
});

// ============================================================
// LOGGER v15.1
// ============================================================
class Logger {
  constructor() {
    this.logFile = path.join(CONFIG.ARTIFACTS_DIR, 'luna-v15.log');
    this.events = [];
  }
  _h() { return new Date().toISOString(); }
  _w(n, msg) {
    const line = `[${n}] [${this._h()}] ${msg}`;
    console.log(line);
    try {
      fs.appendFileSync(this.logFile, line + '\n');
    } catch (e) { /* ignora erro de log */ }
    this.events.push({ type: n, msg, time: this._h() });
    if (this.events.length > 200) this.events.shift();
  }
  info(m) { this._w('INFO', m); }
  success(m) { this._w('SUCCESS', m); }
  error(m) { this._w('ERROR', m); }
  warn(m) { this._w('WARN', m); }
  scan(m) { this._w('SCAN', m); }
  extract(m) { this._w('EXTRACT', m); }
  playwright(m) { this._w('PLAYWRIGHT', m); }
  extraordinary(m) { console.log(`✨ ${m} ✨`); this._w('EXTRAORDINARY', m); }
  getEvents() { return this.events; }
}
const log = new Logger();

// ============================================================
// CHECKPOINT MANAGER v15.1
// ============================================================
class CheckpointManager {
  constructor() {
    this.checkpoint = this.load(CONFIG.CHECKPOINT_FILE, {
      lastScan: null,
      knownMessageHashes: [],
      processedCount: 0,
      silenceCount: 0,
      lastReport: null,
      fullExtractDone: false,
      lastFullExtract: null
    });
    this.buffer = this.load(CONFIG.BUFFER_FILE, {
      newMessages: [],
      newTasks: [],
      newIdeas: [],
      newDecisions: [],
      newLinks: [],
      newMentions: [],
      newNews: [],
      newLeads: [],
      newFinance: [],
      newTasksDone: [],
      lastBufferUpdate: null
    });
  }

  load(file, def) {
    try {
      if (fs.existsSync(file)) {
        const d = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
        if (typeof d.silenceCount !== 'number' || isNaN(d.silenceCount)) d.silenceCount = 0;
        if (typeof d.fullExtractDone !== 'boolean') d.fullExtractDone = false;
        return d;
      }
    } catch (e) { log.error(`Load checkpoint: ${e.message}`); }
    return def;
  }

  save() {
    try {
      fs.writeFileSync(CONFIG.CHECKPOINT_FILE, JSON.stringify(this.checkpoint, null, 2));
      fs.writeFileSync(CONFIG.BUFFER_FILE, JSON.stringify(this.buffer, null, 2));
    } catch (e) {
      log.error(`Save checkpoint: ${e.message}`);
    }
  }

  reloadBuffer() {
    this.buffer = this.load(CONFIG.BUFFER_FILE, this.buffer || {});
    return this.buffer;
  }

  saveBuffer() {
    try {
      fs.writeFileSync(CONFIG.BUFFER_FILE, JSON.stringify(this.buffer, null, 2));
    } catch (e) {
      log.error(`Save buffer: ${e.message}`);
    }
  }

  hashMessage(msg) {
    const body = (msg.body || msg.text || msg.content || '').slice(0, 100);
    const author = msg.author || msg.from || msg.sender || 'unknown';
    const time = msg.timestamp || msg.time || msg.date || Date.now();
    return crypto.createHash('md5').update(`${author}:${body}:${time}`).digest('hex');
  }

  isNew(msg) {
    return !this.checkpoint.knownMessageHashes.includes(this.hashMessage(msg));
  }

  markProcessed(msg) {
    const h = this.hashMessage(msg);
    if (!this.checkpoint.knownMessageHashes.includes(h)) {
      this.checkpoint.knownMessageHashes.push(h);
      this.checkpoint.processedCount++;
    }
  }

  markFullExtractDone() {
    this.checkpoint.fullExtractDone = true;
    this.checkpoint.lastFullExtract = new Date().toISOString();
  }

  resetForFullExtract() {
    this.checkpoint.fullExtractDone = false;
    log.info('Checkpoint resetado para extração completa');
  }
}

// ============================================================
// PLAYWRIGHT CDP EXTRACTOR v15.1
// ============================================================
class PlaywrightExtractor {
  constructor() {
    this.browser = null;
    this.page = null;
    this.connected = false;
  }

  async connect() {
    if (!chromium) {
      log.error('Playwright não disponível. Instale com: npm install playwright');
      return false;
    }

    try {
      log.playwright('Conectando no Chrome CDP...');

      this.browser = await chromium.connectOverCDP(`http://localhost:${CONFIG.CDP_PORT}`);
      const contexts = this.browser.contexts();

      if (contexts.length === 0) {
        throw new Error('Nenhum contexto encontrado no Chrome');
      }

      const pages = contexts[0].pages();
      if (pages.length === 0) {
        throw new Error('Nenhuma aba encontrada');
      }

      this.page = pages.find(p => p.url().includes('web.whatsapp.com')) || pages[0];
      this.connected = true;

      log.success(`Playwright conectado! URL: ${this.page.url()}`);
      return true;
    } catch (e) {
      log.error(`Falha ao conectar Playwright: ${e.message}`);
      this.connected = false;
      return false;
    }
  }

  async disconnect() {
    try {
      if (this.browser) {
        if (typeof this.browser.disconnect === 'function') {
          await this.browser.disconnect();
        } else if (typeof this.browser.close === 'function') {
          await this.browser.close();
        }
        log.playwright('Desconectado do Chrome (Chrome continua aberto)');
      }
    } catch (e) {
      log.warn(`Erro ao desconectar: ${e.message}`);
    }
    this.connected = false;
    this.browser = null;
    this.page = null;
  }

  async findChat(chatName) {
    if (!this.page) return null;

    const strategies = [
      { type: 'testid', selector: `[data-testid="chat-list"] [title*="${chatName}"]` },
      { type: 'testid-fuzzy', selector: `[data-testid*="chat"] [title*="${chatName}"]` },
      { type: 'aria', selector: `[aria-label*="${chatName}"]` },
      { type: 'text', selector: `text=/.*${chatName}.*/i` },
      { type: 'position', selector: `[data-testid="cell-frame-container"]:nth-child(1)` }
    ];

    for (const strategy of strategies) {
      try {
        const element = this.page.locator(strategy.selector).first();
        const count = await element.count();
        if (count > 0) {
          log.playwright(`Chat encontrado via ${strategy.type}: ${chatName}`);
          return element;
        }
      } catch (e) {
        log.warn(`Estratégia ${strategy.type} falhou para ${chatName}`);
      }
    }

    log.error(`Chat NAO encontrado: ${chatName}`);
    return null;
  }

  async clickChat(chatElement, chatName) {
    if (!chatElement) return false;

    try {
      const box = await chatElement.boundingBox();
      if (!box) {
        log.warn(`Bounding box nao encontrado para ${chatName}`);
        return false;
      }

      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;

      log.playwright(`Clicando no centro de ${chatName}: (${Math.round(centerX)}, ${Math.round(centerY)})`);

      await this.page.mouse.click(centerX, centerY);
      await this.page.waitForTimeout(2000);

      const chatTitle = await this.page.locator('[data-testid="conversation-header-title"]').textContent().catch(() => '');
      if (chatTitle.toLowerCase().includes(chatName.toLowerCase()) || chatTitle.toLowerCase().includes('production')) {
        log.success(`Chat ${chatName} aberto com sucesso!`);
        return true;
      }

      log.warn(`Chat pode nao ter aberto. Titulo atual: ${chatTitle}`);
      return false;
    } catch (e) {
      log.error(`Erro ao clicar no chat: ${e.message}`);
      return false;
    }
  }

  async scrollToTop() {
    if (!this.page) return 0;
    log.playwright('Carregando historico (extracao acumulativa)...');
    const allMessagesMap = new Map();
    let scrollCount = 0;
    let lastCount = 0;
    let stableCount = 0;
    
    while (scrollCount < CONFIG.MAX_SCROLLS) {
      const currentMessages = await this.page.evaluate(() => {
        const msgs = [];
        const elements = document.querySelectorAll('[data-testid="msg-container"], [data-testid="msg-image"], [data-testid="msg-video"], .message, .msg');
        elements.forEach(el => {
          try {
            const textEl = el.querySelector('.selectable-text, .copyable-text, [dir="ltr"]');
            const text = textEl ? textEl.innerText : '';
            let author = 'Desconhecido';
            let authorPhone = null;
            
            // Estratégia 1: data-pre-plain-text [hora] Nome: 
            const preText = el.getAttribute('data-pre-plain-text');
            if (preText) {
              const match = preText.match(/\]\s*([^:]+):/);
              if (match) author = match[1].trim();
            }
            
            // Estratégia 2: data-id contém número de telefone (formato WhatsApp Web)
            // Ex: false_34689135159@c.us_3EB0... ou true_34685093192@c.us_...
            if (author === 'Desconhecido') {
              const dataId = el.getAttribute('data-id') || '';
              const phoneMatch = dataId.match(/_(\d+)(@c\.us|@lid)/);
              if (phoneMatch) {
                authorPhone = phoneMatch[1] + phoneMatch[2];
                author = authorPhone;
              }
            }
            
            // Estratégia 3: elemento irmão com classe de nome de contato
            if (author === 'Desconhecido') {
              const nameEl = el.querySelector('[data-testid="msg-meta"] span[title], .message-author, [dir="auto"][class*="copyable-text"]');
              if (nameEl && nameEl.title) {
                author = nameEl.title.trim();
              }
            }
            
            // Estratégia 4: container pai tem atributo com número
            if (author === 'Desconhecido') {
              const container = el.closest('[data-id]') || el.parentElement;
              if (container) {
                const containerId = container.getAttribute('data-id') || '';
                const phoneMatch = containerId.match(/_(\d+)(@c\.us|@lid)/);
                if (phoneMatch) {
                  authorPhone = phoneMatch[1] + phoneMatch[2];
                  author = authorPhone;
                }
              }
            }

            // Estratégia 5: nome do autor embutido no início do texto (WhatsApp Web v2.30+)
            if (author === 'Desconhecido' && text.includes('\n')) {
              const firstLine = text.split('\n')[0].trim();
              if (firstLine && firstLine.length > 1 && firstLine.length < 30 && !firstLine.includes('http')) {
                author = firstLine;
                text = text.substring(firstLine.length + 1).trim();
              }
            }
            
            const timeEl = el.querySelector('[data-testid="msg-meta"], .msg-time');
            const time = timeEl ? timeEl.innerText : '';
            const id = el.getAttribute('data-id') || Array.from(text + author + time).slice(0, 50).join('');
            if (text || id) msgs.push({ id, author, text, time, authorPhone });
          } catch (e) {}
        });
        return msgs;
      });
      
      let addedCount = 0;
      for (const msg of currentMessages) {
        if (!allMessagesMap.has(msg.id)) {
          allMessagesMap.set(msg.id, msg);
          addedCount++;
        }
      }
      
      const totalUnique = allMessagesMap.size;
      log.playwright(`Scroll ${scrollCount+1}/${CONFIG.MAX_SCROLLS} — ${currentMessages.length} visiveis | ${addedCount} novas | Total: ${totalUnique}`);
      
      if (totalUnique === lastCount) {
        stableCount++;
        if (stableCount >= 5) {
          log.success(`Historico completo! ${totalUnique} mensagens`);
          break;
        }
      } else {
        stableCount = 0;
        lastCount = totalUnique;
      }
      
            await this.page.evaluate(() => {
        const chat = document.querySelector('[data-testid="conversation-panel-messages"]');
        if (chat) chat.scrollTop = 0;
      });
      
      await this.page.waitForTimeout(800);
      scrollCount++;
    }
    
    this._accumulatedMessages = Array.from(allMessagesMap.values());
    log.success(`${this._accumulatedMessages.length} mensagens unicas extraidas`);
    return scrollCount;
  }
  async extractMessages() {
    if (!this.page) return [];

    log.extract('Obtendo mensagens acumuladas...');

    if (this._accumulatedMessages && this._accumulatedMessages.length > 0) {
      log.success(`${this._accumulatedMessages.length} mensagens do acumulador`);
      return this._accumulatedMessages;
    }

    // Fallback: extrai do DOM atual
    const messages = await this.page.evaluate(() => {
      const msgs = [];
      const elements = document.querySelectorAll(
        '[data-testid="msg-container"], [data-testid="msg-image"], [data-testid="msg-video"], .message, .msg'
      );
      elements.forEach(el => {
        try {
          const textEl = el.querySelector('.selectable-text, .copyable-text, [dir="ltr"]');
          const text = textEl ? textEl.innerText : '';
          let author = 'Desconhecido';
          let authorPhone = null;
          
          // Estratégia 1: data-pre-plain-text [hora] Nome: 
          const preText = el.getAttribute('data-pre-plain-text');
          if (preText) {
            const match = preText.match(/\]\s*([^:]+):/);
            if (match) author = match[1].trim();
          }
          
          // Estratégia 2: data-id contém número de telefone
          if (author === 'Desconhecido') {
            const dataId = el.getAttribute('data-id') || '';
            const phoneMatch = dataId.match(/_(\d+)(@c\.us|@lid)/);
            if (phoneMatch) {
              authorPhone = phoneMatch[1] + phoneMatch[2];
              author = authorPhone;
            }
          }
          
          // Estratégia 3: elemento com title do contato
          if (author === 'Desconhecido') {
            const nameEl = el.querySelector('[data-testid="msg-meta"] span[title], .message-author');
            if (nameEl && nameEl.title) {
              author = nameEl.title.trim();
            }
          }
          
          // Estratégia 4: container pai
          if (author === 'Desconhecido') {
            const container = el.closest('[data-id]') || el.parentElement;
            if (container) {
              const containerId = container.getAttribute('data-id') || '';
              const phoneMatch = containerId.match(/_(\d+)(@c\.us|@lid)/);
              if (phoneMatch) {
                authorPhone = phoneMatch[1] + phoneMatch[2];
                author = authorPhone;
              }
            }
          }

          // Estratégia 5: nome do autor embutido no início do texto (WhatsApp Web v2.30+)
          if (author === 'Desconhecido' && text.includes('\n')) {
            const firstLine = text.split('\n')[0].trim();
            if (firstLine && firstLine.length > 1 && firstLine.length < 30 && !firstLine.includes('http')) {
              author = firstLine;
              text = text.substring(firstLine.length + 1).trim();
            }
          }
          
          const timeEl = el.querySelector('[data-testid="msg-meta"], .msg-time');
          const time = timeEl ? timeEl.innerText : '';
          const id = el.getAttribute('data-id') || Array.from(text + author + time).slice(0, 50).join('');
          if (text || id) msgs.push({ id, author, text, time, authorPhone });
        } catch (e) {}
      });
      return msgs;
    });

    log.success(`${messages.length} mensagens extraidas do DOM`);
    return messages;
  }

  async extractChat(chatName) {
    log.extract(`=== EXTRAINDO: ${chatName} ===`);

    const chatElement = await this.findChat(chatName);
    if (!chatElement) {
      log.error(`Chat ${chatName} nao encontrado`);
      return [];
    }

    const clicked = await this.clickChat(chatElement, chatName);
    if (!clicked) {
      log.warn(`Nao consegui clicar em ${chatName}, tentando continuar...`);
    }

    const scrolls = await this.scrollToTop();
    const messages = await this.extractMessages();

    log.extract(`${chatName}: ${messages.length} mensagens (apos ${scrolls} scrolls)`);

    return messages.map(m => ({
      ...m,
      chatName,
      extractedAt: new Date().toISOString()
    }));
  }
}
// DEPRECATED: resolveAuthor() movido para SmartClassifier_v16.js
// Importação: const { resolveAuthor } = require('./SmartClassifier_v16.js');
// ============================================================
// ANALISADOR DE LINKS v15.1
// ============================================================
class LinkAnalyzer {
  async analyze(url, context = '') {
    try {
      let fetch;
      try {
        fetch = (await import('node-fetch')).default;
      } catch (e) {
        log.warn('node-fetch nao disponivel, usando https nativo');
        return this.analyzeNative(url, context);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });

      clearTimeout(timeout);

      const contentType = response.headers.get('content-type') || '';
      const title = this.inferTitle(url, contentType);
      const type = this.classifyLink(url, contentType);

      return {
        url,
        title,
        type,
        contentType,
        context: context.slice(0, 100),
        status: response.status,
        analyzedAt: new Date().toISOString()
      };
    } catch (e) {
      return {
        url,
        title: 'Nao foi possivel analisar',
        type: 'link_desconhecido',
        error: e.message,
        context: context.slice(0, 100),
        analyzedAt: new Date().toISOString()
      };
    }
  }

  analyzeNative(url, context) {
    const https = require('https');
    return new Promise((resolve) => {
      const req = https.get(url, { method: 'HEAD', timeout: 5000 }, (res) => {
        const contentType = res.headers['content-type'] || '';
        resolve({
          url,
          title: this.inferTitle(url, contentType),
          type: this.classifyLink(url, contentType),
          contentType,
          context: context.slice(0, 100),
          status: res.statusCode,
          analyzedAt: new Date().toISOString()
        });
      });
      req.on('error', () => resolve({ url, title: 'Erro', type: 'erro', context: context.slice(0, 100), analyzedAt: new Date().toISOString() }));
      req.on('timeout', () => { req.destroy(); resolve({ url, title: 'Timeout', type: 'timeout', context: context.slice(0, 100), analyzedAt: new Date().toISOString() }); });
    });
  }

  inferTitle(url, contentType) {
    if (contentType.includes('pdf')) return 'Documento PDF';
    if (contentType.includes('image')) return 'Imagem';
    if (contentType.includes('video')) return 'Video';
    if (url.includes('instagram.com') || url.includes('instagr.am')) return 'Instagram';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube';
    if (url.includes('github.com')) return 'GitHub';
    return 'Link Externo';
  }

  classifyLink(url, contentType) {
    if (url.includes('instagram.com') || url.includes('instagr.am')) return 'social';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'video';
    if (contentType.includes('pdf')) return 'documento';
    if (url.includes('vercel.app') || url.includes('netlify.app') || url.includes('github.io')) return 'demo';
    if (url.includes('github.com')) return 'codigo';
    return 'externo';
  }
}

// ============================================================
// MAIN AGENT — v15.1
// ============================================================
class LunaAgent {
  constructor() {
    this.cp = new CheckpointManager();
    this.brain = new LunaBrain({
      model: process.env.LUNA_QWEN_MODEL || process.env.LUNA_LLM_MODEL || process.env.LUNA_GEMMA_MODEL || 'qwen3:1.7b',
      host: process.env.OLLAMA_HOST || 'http://localhost:11434'
    });
    this.memory = new LunaMemory(); // v17.0 — Memória contextual
    
    // ── LUNA v18.0 CONSCIOUS ──
    this.orchestrator = new LunaOrchestrator(process.env.OLLAMA_HOST || 'http://localhost:11434');
    this.orchestrator.agents.people.memory = this.memory; // Injeta memory no PeopleAgent
    this.reasoning = new LunaReasoningEngine(this.orchestrator, this.brain);
    this.feedback = new FeedbackLoop(); // v18.0 — Aprende com correções
    this.proactive = new ProactiveEngine(this.orchestrator.dataAPI, this.orchestrator.kg, this.orchestrator.sm); // v18.0 — Alertas inteligentes
    this.lastLunaResponse = {}; // Guarda última resposta por autor
    // ────────────────────────────
    
    this.linkAnalyzer = new LinkAnalyzer();
    this.extractor = new PlaywrightExtractor();
    this.client = null;
    this.ready = false;
    this.lastReport = null;
    this.reportGroup = null;
    this.running = false;
    this.threadHistory = [];
    this.fullExtractRunning = false;
    this.processedMessageIds = new Set();
    this.pendingQuestion = null;
    if (!fs.existsSync(CONFIG.WHATSAPP_HISTORY_FILE)) {
      fs.writeFileSync(CONFIG.WHATSAPP_HISTORY_FILE, '[]', 'utf8');
      log.info('[HISTORY] whatsapp-history.json criado');
    }
  }

  async init(options = {}) {
    const { once = false, schedule = true, fullExtract = false, headless = false } = options;
    const isHeadless = headless || process.argv.includes('--headless');
    log.extraordinary('=== LUNA v15.1 "VISION EXTRACTOR" ===');
    log.info(`whatsapp-web.js + Playwright CDP hibrido (headless: ${isHeadless})`);

    this.client = new Client({
      authStrategy: new LocalAuth({ clientId: 'luna-main', dataPath: SESSION_DATA_PATH, rmMaxRetries: 1 }),
      puppeteer: {
        headless: isHeadless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--no-first-run',
          '--no-default-browser-check',
          `--remote-debugging-port=${CONFIG.CDP_PORT}`
        ],
        ...(CHROME_EXECUTABLE ? { executablePath: CHROME_EXECUTABLE } : {})
      }
    });

    const shutdown = async (signal) => {
      log.warn(`[SHUTDOWN] ${signal} recebido. Salvando sessao WhatsApp antes de sair...`);
      try {
        if (this.client) await this.client.destroy();
        log.success('[SHUTDOWN] Sessao WhatsApp persistida.');
      } catch (e) {
        log.warn(`[SHUTDOWN] Falha ao destruir client: ${e.message}`);
      } finally {
        process.exit(0);
      }
    };
    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));

    this.client.on('qr', (qr) => {
      log.warn('QR Code! Escaneie:');
      qrcode.generate(qr, { small: true });
    });

    this.client.on('authenticated', () => {
      log.success(`[AUTH] WhatsApp autenticado. Sessao salva em: ${SESSION_DATA_PATH}`);
    });

    this.client.on('loading_screen', (percent, message) => {
      log.info(`[LOADING] WhatsApp ${percent}% - ${message || ''}`);
    });

    const readyPromise = new Promise((resolve, reject) => {
      this.client.on('ready', async () => {
        try {
          log.extraordinary('WhatsApp pronto!');
          this.ready = true;

          if (fullExtract || !this.cp.checkpoint.fullExtractDone) {
            log.extraordinary('Iniciando EXTRACAO COMPLETA...');
            await this.runFullExtract();
          }

          if (this.brain?.warmUpGemma) {
            await this.brain.warmUpGemma();
          }

          const result = await this.startMonitoring({ schedule: schedule && !once });
          if (once) { log.info('Modo once: mantendo sessao aberta.'); }
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });

        this.client.on('message_create', async (msg) => {
      
      const rawBody = msg.body || '';
      const body = rawBody.toLowerCase();
      const isMention = /@luna|@kimi|@kimiclaw/i.test(rawBody);
      const isCommand = rawBody.trim().startsWith('/');
      const hasPendingAnswer = Boolean(this.getPendingMatch(msg));

      // Comandos e menções dos CEOs devem SEMPRE ser processados, mesmo que venham
      // da própria sessão (msg.fromMe), porque os CEOs usam o WhatsApp da Luna.
      // Só ignoramos mensagens próprias que NÃO são comandos/menções (evita loop no scan).
      if (msg.fromMe && !isCommand && !isMention && !hasPendingAnswer) {
        log.info('[SELF] Ignorando mensagem propria (nao eh comando nem mencao)');
        return;
      }

      // COMANDOS e MENCOES sao interacoes DIRETAS dos CEOs.
      // O filtro de privacidade protege contra SCAN passivo, NAO contra comandos diretos.
      // CEOs tem prioridade absoluta — nunca bloquear /status, /ajuda, @luna, etc.
      if (!isCommand && !isMention && !hasPendingAnswer) {
        // Para mensagens normais (scan passivo), obter o ID do CHAT correto.
        // msg.from pode ser @lid ou @c.us do autor individual (WhatsApp Web v2.30+).
        // Precisamos obter o chat REAL via msg.getChat() para nunca bloquear msgs de grupo valido.
        let chatId = (msg.from && msg.from.includes('@g.us')) ? msg.from :
                     (msg.to && msg.to.includes('@g.us')) ? msg.to :
                     null;
        
        // Se ainda nao temos o chatId do grupo, tentar obter via getChat()
        if (!chatId && msg.getChat) {
          try {
            const chat = await msg.getChat();
            if (chat && chat.id && chat.id._serialized) {
              chatId = chat.id._serialized;
            }
          } catch (e) {
            // getChat pode falhar em alguns casos, ignorar silenciosamente
          }
        }
        
        // Fallback final
        if (!chatId) chatId = msg.from;
        
        if (!isAuthorizedChat(chatId)) {
          log.info(`[PRIVACY] Ignorando mensagem de chat nao autorizado: chat=${chatId} | from=${msg.from} | author=${msg.author || 'n/a'}`);
          return;
        }
      }

      const messageId = msg.id?._serialized || msg.id || `${msg.from}:${msg.timestamp}:${msg.body}`;
      if (this.processedMessageIds.has(messageId)) return;
      this.processedMessageIds.add(messageId);
      if (this.processedMessageIds.size > 500) {
        this.processedMessageIds = new Set(Array.from(this.processedMessageIds).slice(-250));
      }

      if (await this.handlePendingAnswer(msg)) return;

      if (isMention) {
        log.info(`MENCAO de ${msg.pushname || msg.from}: ${(msg.body || '').slice(0, 80)}`);
        await this.handleMention(msg);
        return;
      }

      if (isCommand) {
        log.info(`[COMANDO] Recebido de ${msg.pushname || msg.from}: ${rawBody.slice(0, 80)}`);
        await this.handleCommand(msg);
        return;
      }

      try {
        const actor = this.getMessageActor(msg);
        const timestamp = normalizeWhatsAppTimestamp(msg.timestamp);
        const classification = await this.brain.classify({
          body: msg.body || '',
          text: msg.body || '',
          author: actor.key,
          authorName: actor.name,
          from: msg.from,
          timestamp,
          id: messageId
        }, this.threadHistory || []);

        const classified = {
          id: messageId,
          body: msg.body || '',
          text: msg.body || '',
          author: actor.key,
          authorName: actor.name,
          authorRole: actor.role,
          from: msg.from,
          timestamp,
          classification
        };

        this.updateBufferFromClassified([classified]);
        await this.saveToHistory([classified]);
        
        // v17.0 — Guardar na memória contextual
        try {
          this.memory.storeMessage({
            id: classified.id,
            author: classified.author,
            authorName: classified.authorName,
            body: classified.body,
            category: classification.category,
            timestamp: classified.timestamp,
            from: classified.from
          });
        } catch (memErr) {
          log.warn(`[MEMORY] Falha ao guardar na memória: ${memErr.message}`);
        }
        
        this.cp.save();
        log.info(`[LIVE] Mensagem classificada em tempo real: ${classification.category}`);

        if (classification.category === 'tarefaRealizada' && classification.object) {
          const isKnownTask = this.hasSimilarOpenTask(classification.object);
          this.askTaskDoneConfirmation(msg, classification.object, actor.name, isKnownTask);
          const qualifier = isKnownTask ? 'como concluida' : 'como nova tarefa concluida';
          await msg.reply(`Boa, ${actor.name.split(' ')[0]}!\n\nAnoto '${classification.object}' ${qualifier}?`);
        }
      } catch (error) {
        log.warn(`[LIVE] Falha ao classificar mensagem em tempo real: ${error.message}`);
      }
    });

    this.client.on('auth_failure', (msg) => log.error(`Auth: ${msg}`));
    this.client.on('disconnected', (reason) => {
      log.warn(`Desconectado: ${reason}`);
      this.ready = false;
    });

    try {
      await this.client.initialize();
    } catch (e) {
      const transient = /Execution context was destroyed|Target closed|Protocol error/i.test(e.message || '');
      if (!transient) throw e;
      log.warn(`[INIT] Chrome/WhatsApp recarregou durante boot (${e.message}). Tentando reaproveitar sessao salva em 5s...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      try {
        if (this.client) await this.client.destroy();
      } catch (_) {}
      return this.init(options);
    }
    return readyPromise;
  }

  cleanMentionText(body = '') {
    return body.replace(/@luna|@kimi|@kimiclaw/gi, '').trim();
  }

  buildContextGreeting(authorName) {
    const buffer = this.cp.buffer || {};
    const tasks = buffer.newTasks?.length || 0;
    const leads = buffer.newLeads?.length || 0;
    const finance = buffer.newFinance?.length || 0;

    if (tasks === 0 && leads === 0 && finance === 0) {
      return `Oi, chefe!\n\nTa limpo aqui por enquanto. Quer que eu faca uma varredura focada no grupo?`;
    }

    return `Oi, chefe!\n\nTo vendo ${tasks} tarefa(s), ${leads} lead(s) e ${finance} sinal(is) financeiro(s) no radar.\nBora resolver alguma coisa?`;
  }

  extractCompletedObject(text = '') {
    const clean = text.replace(/@luna|@kimi|@kimiclaw/gi, '').trim();
    const actionMatch = clean.match(/\b(consegui|terminei|fiz|subi|pronto|acabei|finalizei|consertei|corrigi|resolvi|publiquei|atualizei|enviei|mandei)\s+(?:de\s+)?(.+)/i);
    if (actionMatch) {
      const verb = actionMatch[1].toLowerCase();
      let object = actionMatch[2].replace(/^(o|a|os|as|um|uma)\s+/i, '').trim();
      if (verb === 'subi') object = `subir ${object}`;
      return object || clean;
    }

    return clean
      .replace(/@luna|@kimi|@kimiclaw/gi, '')
      .replace(/\b(consegui|fiz|terminei|consertei|corrigi|resolvi|subi|publiquei|enviei|mandei|atualizei)\b/gi, '')
      .replace(/^(o|a|os|as|um|uma)\s+/i, '')
      .replace(/\b(a|o|os|as|um|uma)\b\s*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  getMessageActor(msg = {}) {
    const rawId = msg.author || msg.from || '';
    const pushname = (msg.pushname || msg.notifyName || msg._data?.notifyName || '').trim();
    const preferred = isLidId(rawId) && pushname ? pushname : (rawId || pushname || 'time');
    const resolved = resolveAuthor(preferred);
    const fallback = resolveAuthor(pushname);
    const finalResolved = resolved.confidence > 0 ? resolved : fallback;
    return {
      key: rawId || pushname || preferred,
      name: finalResolved.confidence > 0 ? finalResolved.name : (pushname || preferred),
      role: finalResolved.role || null,
      chatId: msg.from
    };
  }

  isYesAnswer(text = '') {
    const answer = text.trim().toLowerCase();
    return ['sim', 'yes', 'ok', 'beleza', 'pode', 'anota', 'marca', 'feito', 'claro', 'pode ser'].some(w => answer.includes(w));
  }

  isNoAnswer(text = '') {
    const answer = text.trim().toLowerCase();
    return ['não', 'nao', 'no', 'nope', 'deixa', 'não precisa', 'nao precisa', 'deixa quieto'].some(w => answer.includes(w));
  }

  getPendingMatch(msg = {}) {
    if (!this.pendingQuestion || this.pendingQuestion.expiresAt <= Date.now()) {
      this.pendingQuestion = null;
      return null;
    }

    const actor = this.getMessageActor(msg);
    const sameChat = this.pendingQuestion.chatId === actor.chatId;
    const samePerson = this.pendingQuestion.askedTo === actor.key || this.pendingQuestion.askedToName === actor.name;
    return sameChat && samePerson ? this.pendingQuestion : null;
  }

  saveBufferToFile() {
    this.cp.saveBuffer ? this.cp.saveBuffer() : this.cp.save();
  }

  async executePendingAction(question, confirmed) {
    if (!confirmed || !question) return;

    if (question.type === 'confirmTaskDone') {
      if (!this.cp.buffer.newTasksDone) this.cp.buffer.newTasksDone = [];
      this.cp.buffer.newTasksDone.push({
        text: question.data.taskText,
        author: question.data.author,
        completedAt: new Date().toISOString(),
        source: 'implicit_detected'
      });
      this.saveBufferToFile();
      log.info(`[DIALOG] Tarefa concluida anotada: ${question.data.taskText}`);
    }
  }

  async handlePendingAnswer(msg) {
    const pending = this.getPendingMatch(msg);
    if (!pending) return false;

    const answer = msg.body || '';
    const cleanAnswer = this.cleanMentionText(answer);

    // ── LUNA v18.0: Receber título de link ──
    if (pending.type === 'waitingLinkTitle') {
      if (cleanAnswer && cleanAnswer.length > 2) {
        // Atualizar o link no buffer com o título fornecido
        const url = pending.data.url;
        const links = this.cp.buffer?.newLinks || [];
        const link = links.find(l => l.url === url);
        if (link) {
          link.title = cleanAnswer;
          link.enrichedAt = new Date().toISOString();
        }
        await msg.reply(`✅ Título anotado: "${cleanAnswer}" para ${url}\n\nLink enriquecido! 🧠`);
        this.pendingQuestion = null;
        return true;
      } else {
        await msg.reply('Me fala o título direitinho que eu anoto! 😊');
        return true;
      }
    }
    // ─────────────────────────────────────────

    if (this.isYesAnswer(answer)) {
      await this.executePendingAction(pending, true);
      await msg.reply(`Feito! ${pending.data.taskText} anotado como concluido.`);
      this.pendingQuestion = null;
      return true;
    }

    if (this.isNoAnswer(answer)) {
      await msg.reply('Beleza, deixa quieto entao!');
      this.pendingQuestion = null;
      return true;
    }

    return false;
  }

  askTaskDoneConfirmation(msg, taskText, authorName, isKnownTask = false) {
    const actor = this.getMessageActor(msg);
    this.pendingQuestion = {
      type: 'confirmTaskDone',
      data: {
        taskText,
        author: authorName,
        category: 'tarefaRealizada',
        isKnownTask
      },
      timestamp: Date.now(),
      askedTo: actor.key,
      askedToName: actor.name,
      chatId: actor.chatId,
      expiresAt: Date.now() + 120000
    };
  }

  askLinkTitle(msg, url, authorName) {
    const actor = this.getMessageActor(msg);
    this.pendingQuestion = {
      type: 'waitingLinkTitle',
      data: {
        url,
        author: authorName
      },
      timestamp: Date.now(),
      askedTo: actor.key,
      askedToName: actor.name,
      chatId: actor.chatId,
      expiresAt: Date.now() + 300000 // 5 minutos
    };
  }

  hasSimilarOpenTask(taskText = '') {
    const needle = taskText.toLowerCase().replace(/[^\w\s]/g, '').trim();
    if (!needle) return false;
    return (this.cp.buffer.newTasks || []).some(task => {
      const hay = (task.body || task.text || '').toLowerCase().replace(/[^\w\s]/g, '');
      return hay.includes(needle) || needle.includes(hay.slice(0, 40).trim());
    });
  }

  parseMentionWorkItems(body = '', authorName = 'time') {
    if (!this.cp.buffer.newTasks) this.cp.buffer.newTasks = [];
    if (!this.cp.buffer.newLeads) this.cp.buffer.newLeads = [];

    const lines = body.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const tasks = [];
    const leads = [];
    let leadMode = false;

    for (const line of lines) {
      const lower = line.toLowerCase();
      if (/clientes?|leads?|potentes/.test(lower)) {
        leadMode = true;
        continue;
      }

      const item = line.replace(/^[-*•]\s*/, '').trim();
      if (!item || /@luna|anota|tarefas?:/i.test(item)) continue;
      if (/^vamos preparar/i.test(item)) continue;

      if (leadMode || /cliente|onadance|reformas|mapio|ccb|gesse|lucas|jess/i.test(item)) {
        leads.push(item);
      } else {
        tasks.push(item);
      }
    }

    const time = new Date().toISOString();
    for (const task of tasks) {
      this.cp.buffer.newTasks.push({ body: task, author: authorName, priority: /progreso|andamento/i.test(task) ? 'P2' : 'P1', time });
    }
    for (const lead of leads) {
      this.cp.buffer.newLeads.push({ name: lead.split(/[-,]/)[0].trim(), context: lead, author: authorName, time, status: 'novo', priority: 'P1' });
    }
    if (tasks.length || leads.length) this.cp.save();

    return { tasks, leads };
  }

  buildHumanMentionReply(body = '', authorName = 'chefe', quotedBody = '') {
    const clean = this.cleanMentionText(body);
    const lower = clean.toLowerCase();
    const hasUrl = /https?:\/\/[^\s]+/i.test(clean) || /https?:\/\/[^\s]+/i.test(quotedBody);
    const isGreeting = /^(oi|ola|olá|opa|e ai|e aí|bom dia|boa tarde|boa noite)[!.\s]*$/i.test(clean);
    const looksLikeList = /anota|tarefas?:|clientes?|potentes|^- /im.test(clean) && clean.split(/\r?\n/).length > 2;
    const completed = /\b(consegui|fiz|terminei|consertei|corrigi|resolvi|subi|publiquei|atualizei)\b/i.test(clean);
    const ambiguousPc = /\bpc\b/i.test(clean) && clean.split(/\s+/).length <= 5;

    // Se a menção está vazia mas há uma mensagem citada, não é greeting — é análise da msg citada
    if ((isGreeting || !clean) && quotedBody) {
      return null; // Deixa a IA analisar a mensagem citada
    }

    if (isGreeting || !clean) {
      return this.buildContextGreeting(authorName);
    }

    if (looksLikeList) {
      const parsed = this.parseMentionWorkItems(clean, authorName);
      const inProgress = parsed.tasks.filter(t => /progreso|andamento|em progresso/i.test(t)).length;
      const pending = Math.max(parsed.tasks.length - inProgress, 0);
      return `Anotado, chefe!\n\n${parsed.tasks.length} tarefa(s) + ${parsed.leads.length} lead(s) no radar.\n${inProgress} em andamento, ${pending} pendente(s).\n\nQuer que eu marque alguma como P1?`;
    }

    if (completed) {
      const object = this.extractCompletedObject(clean) || clean;
      return `Boa, ${authorName.split(' ')[0]}!\n\nAnoto '${object}' como tarefa concluida?`;
    }

    if (ambiguousPc) {
      return `Anotado! '${clean}'.\n\nSo pra confirmar: e aquele PC que estragou e precisa arrumar, ou e outra coisa? Me explica que eu deixo certinho.`;
    }

    if (hasUrl) {
      const url = clean.match(/https?:\/\/[^\s]+/i)?.[0] || 'link';
      const source = /instagram/i.test(url) ? 'Instagram' : 'link';
      // Guardar pendingQuestion para receber o título do link depois
      this.askLinkTitle(msg, url, authorName);
      return `🔗 Link do ${source} anotado!\n\nQual o título/nome desse link? Me fala que eu enriqueço o registro. 😊`;
    }

    return null;
  }

  async handleMention(msg) {
    let body = msg.body || '';
    let quotedBody = '';
    let isQuotedMention = false;

    // Se a menção é em resposta a uma mensagem anterior (reply/quote),
    // analisar o conteúdo da mensagem citada, mesmo que a menção em si esteja "vazia"
    if (msg.hasQuotedMsg) {
      try {
        const quotedMsg = await msg.getQuotedMessage();
        if (quotedMsg) {
          quotedBody = quotedMsg.body || quotedMsg.text || '';
          isQuotedMention = true;
          log.info(`[MENCAO] ${msg.pushname || msg.from} marcou Luna em uma mensagem citada: "${quotedBody.slice(0, 60)}..."`);
        }
      } catch (e) {
        log.warn(`[MENCAO] Falha ao obter mensagem citada: ${e.message}`);
      }
    }

    // Se a menção em si está vazia MAS há uma mensagem citada, usar o texto da citada
    const cleanBody = this.cleanMentionText(body);
    if (!cleanBody && isQuotedMention && quotedBody) {
      body = quotedBody;
      log.info(`[MENCAO] Usando texto da mensagem citada como conteúdo da análise`);
    }

    if (!body.trim() && !quotedBody) {
      log.warn('[MENCAO] Menção realmente vazia (sem texto e sem mensagem citada), ignorando');
      return;
    }

    log.info(`MENCAO de ${msg.pushname || msg.from}: ${body.slice(0, 80)}`);

    try {
      if (await this.handlePendingAnswer(msg)) return;

      const author = resolveAuthor(msg.author || msg.pushname || msg.from);
      const authorName = author.name || msg.pushname || msg.from || 'chefe';
      const authorKey = msg.author || msg.from;

      // ── FEEDBACK LOOP v18.0: Detectar correção ──
      if (this.feedback && this.lastLunaResponse[authorKey]) {
        const correction = this.feedback.detectCorrection(body, this.lastLunaResponse[authorKey]);
        if (correction && correction.isCorrection) {
          this.feedback.recordCorrection(
            this.lastLunaResponse[authorKey],
            correction.value || body,
            'response',
            authorName
          );
          await msg.reply(`📝 *Anotado!* Obrigada pela correção, ${authorName.split(' ')[0]}. Vou lembrar disso da próxima vez. 🧠`);
          log.success(`[Feedback] Correção aprendida de ${authorName}`);
          return;
        }
      }
      // ─────────────────────────────────────────────

      const humanReply = this.buildHumanMentionReply(body, authorName, quotedBody);
      if (humanReply) {
        if (/\b(consegui|fiz|terminei|finalizei|consertei|corrigi|resolvi|subi|publiquei|atualizei)\b/i.test(this.cleanMentionText(body))) {
          const taskText = this.extractCompletedObject(body) || this.cleanMentionText(body);
          this.askTaskDoneConfirmation(msg, taskText, authorName, this.hasSimilarOpenTask(taskText));
        }
        await msg.reply(humanReply);
        log.success('Resposta humana de cenario enviada!');
        return;
      }

      const buffer = this.cp.buffer || {};
      const context = {
        urgency: 'normal',
        sentiment: 'neutral',
        topic: 'general',
        userMood: 'neutral',
        authorName,
        authorRole: author.role || null,
        bufferSummary: {
          tasks: buffer.newTasks?.length || 0,
          ideas: buffer.newIdeas?.length || 0,
          links: buffer.newLinks?.length || 0,
          leads: buffer.newLeads?.length || 0,
          finance: buffer.newFinance?.length || 0
        },
        highlights: {
          task: buffer.newTasks?.[0]?.body || null,
          lead: buffer.newLeads?.[0]?.context || null,
          finance: buffer.newFinance?.[0]?.body || null
        }
      };

      // Se há mensagem citada, incluir no contexto para a IA saber que está analisando uma msg específica
      const textForIA = isQuotedMention && quotedBody
        ? `[Mensagem citada por ${authorName}]: "${quotedBody}"\n\n[Comentário de ${authorName}]: ${body || '(sem comentário adicional)'}`
        : body;

      // ── LUNA v18.0 CONSCIOUS: Usar ReasoningEngine para perguntas factuais ──
      let responseText = null;
      const isFactualQuestion = /\b(como esta|status|quantas?|quanto|quem|qual|onde|quando|resumo|panorama|foco|prioridade|atrasad|pagamento|tarefa|projeto|lead|cliente)\b/i.test(textForIA);
      
      if (isFactualQuestion && this.reasoning) {
        try {
          log.info('[CONSCIOUS] Usando ReasoningEngine para resposta baseada em dados');
          const reasoningResult = await this.reasoning.think(textForIA, { author: authorName, authorRole: author.role });
          if (reasoningResult && reasoningResult.text) {
            responseText = reasoningResult.text;
            log.success('[CONSCIOUS] Resposta baseada em dados gerada!');
          }
        } catch (reasoningErr) {
          log.warn(`[CONSCIOUS] ReasoningEngine falhou, fallback para LLM: ${reasoningErr.message}`);
        }
      }
      
      // Fallback para LLM tradicional se reasoning não funcionou ou não é factual
      if (!responseText) {
        const response = await this.brain.generateResponse(textForIA, context);
        responseText = response?.text || null;
      }
      // ─────────────────────────────────────────────────────────────────────

      if (responseText) {
        await msg.reply(responseText);
        // ── FEEDBACK LOOP v18.0: Guardar última resposta ──
        if (this.feedback) {
          this.lastLunaResponse[authorKey] = responseText;
        }
        // ───────────────────────────────────────────────────
        log.success('Resposta IA enviada!');
      } else {
        await msg.reply(
          `🌙 *Luna aqui.*\n\n` +
          `Vi ${this.cp.buffer.newTasks?.length || 0} tarefa(s), ` +
          `${this.cp.buffer.newLinks?.length || 0} link(s), ` +
          `${this.cp.buffer.newLeads?.length || 0} lead(s) e ` +
          `${this.cp.buffer.newFinance?.length || 0} sinal(is) financeiro(s) no buffer.\n\n` +
          `Me diz o foco: execucao, cliente, financeiro ou relatorio?`
        );
      }
    } catch (err) {
      log.error(`Falha IA: ${err.message}`);
      await msg.reply(
        `🌙 *Luna em fallback contextual.*\n\n` +
        `A IA falhou agora, mas o buffer segue vivo:\n` +
        `• ${this.cp.buffer.newTasks?.length || 0} tarefas\n` +
        `• ${this.cp.buffer.newIdeas?.length || 0} ideias\n` +
        `• ${this.cp.buffer.newLinks?.length || 0} links\n` +
        `• ${this.cp.buffer.newLeads?.length || 0} leads\n\n` +
        `Pode mandar /status, /stats ou /relatorio que eu organizo.`
      );
    }
  }

  async handleCommand(msg) {
    try {
      this.cp.reloadBuffer();
      log.info('[BUGFIX] Buffer persistente recarregado antes do comando');

    if (await this.handlePendingAnswer(msg)) return;

    const raw = (msg.body || '').trim();
    const cmd = raw.toLowerCase();
    const buffer = this.cp.buffer || {};
    const dashboardUrl = CONFIG.DASHBOARD_URL || 'https://nexo-digital.app/dashboard';

    const truncate = (text, max = 80) => {
      const t = (text || '').toString().trim();
      if (!t) return '(sem texto)';
      return t.length > max ? `${t.slice(0, max - 3)}...` : t;
    };

    const relativeTime = (ts) => {
      if (!ts) return 'agora';
      const d = new Date(normalizeWhatsAppTimestamp(ts));
      if (Number.isNaN(d.getTime())) return 'agora';
      const delta = Date.now() - d.getTime();
      const min = Math.floor(delta / 60000);
      if (min < 1) return 'agora';
      if (min < 60) return `ha ${min} min`;
      const hr = Math.floor(min / 60);
      if (hr < 24) return `ha ${hr}h`;
      const day = Math.floor(hr / 24);
      return `ha ${day}d`;
    };

    const formatPriority = (p) => {
      const v = (p || 'P2').toString().toUpperCase();
      if (v === 'P0' || v === 'HIGH') return 'P0';
      if (v === 'P1' || v === 'MEDIUM') return 'P1';
      return 'P2';
    };

    const extractSearchArg = (full, prefix) => {
      const p = (prefix || '').toLowerCase();
      const c = (full || '').trim();
      if (!c.toLowerCase().startsWith(p)) return '';
      return c.slice(prefix.length).trim();
    };

    const extractNumberArg = (full, prefix, def = 10, min = 1, max = 50) => {
      const arg = extractSearchArg(full, prefix);
      const n = parseInt(arg, 10);
      if (!Number.isFinite(n)) return def;
      return Math.max(min, Math.min(max, n));
    };

    const buildCreativeFallback = (section, lastItem) => {
      if (section === 'tarefas' && !lastItem) {
        return `Eita, ta limpo aqui!\n\nNenhuma tarefa no radar agora.\nQuer que eu faca uma varredura focada pra pegar o que ta rolando no grupo?`;
      }
      const fallbackText = lastItem
        ? `Nada novo em ${section} no ultimo scan.\nUltimo registro: "${truncate(lastItem.body || lastItem.text || lastItem.context || '', 90)}" por ${lastItem.author || lastItem.sender || 'time'} (${relativeTime(lastItem.time || lastItem.timestamp)}).`
        : `Sem novidades em ${section} por enquanto.\nSinal bom: o fluxo esta limpo. Se quiser, eu faco uma varredura focada agora.`;
      return `${fallbackText}\n\nQuer que eu transforme isso em uma acao objetiva para o time?`;
    };

    const safeList = (arr) => (Array.isArray(arr) ? arr : []);
    const ideas = safeList(buffer.newIdeas);
    const links = safeList(buffer.newLinks);
    const leads = safeList(buffer.newLeads);
    const news = safeList(buffer.newNews);
    const tasks = safeList(buffer.newTasks);
    const tasksDone = safeList(buffer.newTasksDone);
    const decisions = safeList(buffer.newDecisions);
    const messages = safeList(buffer.newMessages);
    const ignored = safeList(buffer.ignoredMessages);

    if (cmd === '/status') {
      await msg.reply(
        `📊 *STATUS NEXO*\n\n` +
        `🟢 Projetos ativos: ${tasks.length}\n` +
        `💡 Ideias: ${ideas.length}\n` +
        `🔗 Links: ${links.length}\n` +
        `📰 News: ${news.length}\n` +
        `🎣 Leads: ${leads.length}\n\n` +
        `🤖 Luna v16.0 | NEXO Status`
      );
    }
    else if (cmd === '/relatorio' || cmd === '/reporte') {
      await msg.reply('📊 Gerando relatorio inteligente...');
      await this.forceReport(msg.from);
    }
    else if (cmd === '/tarefas feitas' || cmd === '/tareas hechas') {
      const list = tasksDone.length > 0
        ? tasksDone.slice(0, 10).map(t => `• ${truncate(t.text || t.body, 70)} (por ${t.author || 'time'}, ${relativeTime(t.completedAt || t.time)})`).join('\n')
        : `Ainda nao tenho tarefas concluidas confirmadas.\n\nQuando alguem disser "sim" depois da minha pergunta, eu salvo aqui certinho.`;
      await msg.reply(`✅ *TAREFAS FEITAS*\n\n${list}\n\n🤖 Luna v16.2 | Feitas`);
    }
    else if (cmd === '/tarefas' || cmd === '/tareas') {
      const list = tasks.length > 0
        ? tasks.slice(0, 5).map(t => `• [${formatPriority(t.priority)}] ${truncate(t.body || t.text, 64)} (por ${t.author || 'time'})`).join('\n')
        : buildCreativeFallback('tarefas', null);
      await msg.reply(`📝 *TAREFAS NEXO*\n\n${list}\n\n🤖 Luna v16.0 | Tarefas`);
    }
    else if (cmd === '/extrair' || cmd === '/extraer') {
      await msg.reply('🔄 Iniciando extracao completa...');
      await this.runFullExtract();
      await msg.reply('✅ Extracao completa finalizada!');
    }
    else if (cmd === '/ajuda' || cmd === '/ayuda' || cmd === '/comandos') {
      await msg.reply(
        `🌙 *E aí, chefes! Sou a Luna, sua parceira no NEXO.*\n\n` +
        `📊 *VISÃO GERAL:*\n` +
        `/status — Projetos e tarefas\n` +
        `/dashboard — Central NEXO\n` +
        `/relatorio — Report inteligente\n` +
        `/tarefas — Tarefas pendentes\n` +
        `/tarefas feitas — Concluidas confirmadas\n\n` +
        `🧠 *INTELIGÊNCIA:*\n` +
        `/ideas — Ideias do time\n` +
        `/links — Links analisados\n` +
        `/leads — Oportunidades\n` +
        `/news — Notícias do grupo\n` +
        `/ignoradas — Mensagens sem sinal NEXO\n` +
        `/mencoes — Minhas menções no grupo\n\n` +
        `💰 *NEGÓCIOS:*\n` +
        `/financeiro — Movimentações\n` +
        `/decisoes — Acordos do time\n\n` +
        `🔍 *BUSCA:*\n` +
        `/buscar [termo] — Procurar no histórico\n` +
        `/ultimas [N] — Últimas mensagens\n\n` +
        `📈 *ANALYTICS:*\n` +
        `/stats — Estatísticas do grupo\n` +
        `/sentimento — Como o time tá\n` +
        `/estado — Meu mood atual\n\n` +
        `⚙️ *CONTROLE OPERACIONAL:*\n` +
        `/scan — Forçar varredura do grupo\n` +
        `/analise — Análise completa (deep scan)\n` +
        `/buffer — Ver conteúdo do buffer\n` +
        `/limpar — Limpar TODO o buffer\n` +
        `/cache — Limpar cache de msgs processadas\n` +
        `/health — Health check dos serviços\n` +
        `/restart — Reiniciar a Luna\n` +
        `/ping — Testar se estou online\n\n` +
        `❓ *SOBRE MIM:*\n` +
        `/ajuda — Este menu\n` +
        `/ayuda — Alias, porque somos internacionais\n` +
        `/comandos — Command Center\n` +
        `/sobre — Quem sou eu\n\n` +
        `💬 *Mencione @Luna pra conversar!*\n` +
        `🤖 *Luna v16.3 | NEXO Digital*`
      );
    }
    else if (cmd === '/ideas') {
      const body = ideas.length > 0
        ? ideas.slice(0, 3).map((i, idx) => (
          `${idx + 1}️⃣ ${i.author || 'Time'}: "${truncate(i.body || i.text, 72)}"\n` +
          `   → Categoria: ideiaNova | Prioridade: P2`
        )).join('\n\n')
        : buildCreativeFallback('ideas', ideas[ideas.length - 1] || messages[messages.length - 1]);
      await msg.reply(
        `🧠 *LABORATORIO NEXO*\n\n` +
        `${ideas.length} ideia(s) em ebuliacao:\n\n${body}\n\n` +
        `🎯 Sugestao: quer que eu converta a melhor ideia em tarefa P1 agora?\n\n` +
        `🔬 Luna v16.0 | Laboratorio NEXO`
      );
    }
    else if (cmd === '/links') {
      const body = links.length > 0
        ? links.slice(0, 3).map((l, idx) => (
          `${idx + 1}️⃣ ${truncate(l.title || l.url, 58)}\n` +
          `   🏷️ Tipo: ${l.type || 'link'}\n` +
          `   👤 Compartilhado por: ${l.author || 'Time'}\n` +
          `   💬 Contexto: "${truncate(l.context || l.text, 72)}"\n` +
          `   🎯 Relevancia: ${/cliente|orcamento|projeto/i.test((l.context || '')) ? 'Alta' : 'Media'}`
        )).join('\n\n')
        : buildCreativeFallback('links', links[links.length - 1] || messages[messages.length - 1]);
      await msg.reply(
        `🌐 *NEXO INTELLIGENCE*\n\n` +
        `📎 ${links.length} link(s) detectado(s):\n\n${body}\n\n` +
        `🕵️ Quer que eu detalhe um link especifico em resumo executivo?\n\n` +
        `🌐 Luna v16.0 | NEXO Intelligence`
      );
    }
    else if (cmd === '/leads') {
      const validLeads = leads.filter(l => !/^(apd|apdd|a paz de deus|deus abencoe|boa tarde|bom dia|boa noite|oi|ola|irm[aã]o)\b/i.test((l.context || l.body || '').trim()));
      const heat = (txt) => /quero|contratar|fechar|urgente|proposal|proposta|orcamento|orçamento|presupuesto/i.test(txt || '') ? 'QUENTE' : (/saber|talvez|depois|curiosidade/i.test(txt || '') ? 'FRIO' : 'MORNO');
      const body = validLeads.length > 0
        ? validLeads.slice(0, 3).map((l) => {
          const h = heat(l.context || l.body || '');
          const icon = h === 'QUENTE' ? '🔥' : (h === 'MORNO' ? '🟠' : '❄️');
          return `${icon} ${h}: ${l.name || 'Lead sem nome'}\n` +
            `   💬 Contexto: "${truncate(l.context || l.body, 80)}"\n` +
            `   👤 Detectado por: ${l.author || 'Time'}\n` +
            `   ⏰ ${relativeTime(l.time || l.timestamp)}\n` +
            `   🎯 Acao: ${h === 'QUENTE' ? 'Responder em ate 1h' : 'Nutrir e acompanhar'}`;
        }).join('\n\n')
        : buildCreativeFallback('leads', validLeads[validLeads.length - 1] || messages[messages.length - 1]);
      const hot = validLeads.filter(l => heat(l.context || l.body || '') === 'QUENTE').length;
      const warm = validLeads.filter(l => heat(l.context || l.body || '') === 'MORNO').length;
      const cold = Math.max(0, validLeads.length - hot - warm);
      await msg.reply(
        `🎯 *PIPELINE NEXO*\n\n${body}\n\n` +
        `📊 Pipeline: ${hot} quente | ${warm} morno | ${cold} frio\n\n` +
        `🤖 Luna v16.0 | Pipeline NEXO`
      );
    }
    else if (cmd === '/ignoradas' || cmd === '/ignorados') {
      const body = ignored.length > 0
        ? ignored.slice(-10).reverse().map(i => `• "${truncate(i.body || i.text, 70)}" — ${i.reason || 'Ignorada'} (${relativeTime(i.time || i.timestamp)})`).join('\n')
        : 'Nenhuma mensagem ignorada registrada desde o ultimo reset.';
      await msg.reply(`🚫 *MENSAGENS IGNORADAS*\n\n${body}\n\n🤖 Luna v16.1 | Filtro NEXO`);
    }
    else if (cmd === '/news') {
      const body = news.length > 0
        ? news.slice(0, 3).map((n, idx) => (
          `${idx + 1}️⃣ ${n.author || 'Time'} compartilhou:\n` +
          `   "${truncate(n.body || n.text, 90)}"\n` +
          `   🏷️ Categoria: NEWS\n` +
          `   💡 Insight: pode virar tarefa se conectarmos com projeto ativo`
        )).join('\n\n')
        : buildCreativeFallback('news', news[news.length - 1] || messages[messages.length - 1]);
      await msg.reply(
        `📡 *NEXO NEWS*\n\n${body}\n\n` +
        `🤔 Quer que eu converta alguma noticia em acao rastreavel?\n\n` +
        `📡 Luna v16.0 | NEXO News`
      );
    }
    else if (cmd === '/estado') {
      const es = (this.brain && this.brain.emotionalState) || {};
      const personality = (this.brain && this.brain.activePersonality) || 'default';
      const felicidade = Math.round((es.happiness || 0.7) * 100);
      const energia = Math.round((es.energy || 0.8) * 100);
      const calma = Math.round((es.calm || 0.6) * 100);
      const excitacao = Math.round((es.excitement || 0.85) * 100);
      await msg.reply(
        `🌙 *ESTADO DA LUNA*\n\n` +
        `🎭 Personalidade ativa: ${personality}\n\n` +
        `😊 Felicidade: ${felicidade}%\n` +
        `⚡ Energia: ${energia}%\n` +
        `💙 Calma: ${calma}%\n` +
        `🎉 Excitacao: ${excitacao}%\n\n` +
        `🎯 Mood atual: "Foco total em gerar clareza e acao para a NEXO."\n\n` +
        `🌙 Luna v16.0 | Sentient Mode`
      );
    }
    else if (cmd === '/dashboard') {
      await msg.reply(
        `📊 *CENTRAL NEXO*\n\n` +
        `🌐 Dashboard online:\n${dashboardUrl}\n\n` +
        `📈 Status em tempo real:\n` +
        `• 🟢 WhatsApp: Online\n` +
        `• 🟢 Playwright: Conectado (CDP ${CONFIG.CDP_PORT})\n` +
        `• 🟢 Scan: operacional\n` +
        `• 📨 Mensagens no buffer: ${messages.length}\n\n` +
        `⚡ Dica: use /stats para analytics detalhado.\n\n` +
        `📊 Luna v16.0 | Central NEXO`
      );
    }
    else if (cmd === '/financeiro') {
      const financePool = [...messages, ...tasks].filter(x => /pag|fatura|caixa|orcamento|€|euro|cobrar|pendente/i.test((x.body || x.text || x.context || '').toLowerCase()));
      const paid = financePool.filter(x => /pagou|pago|recebido|confirmado/i.test((x.body || x.text || '').toLowerCase()));
      const pending = financePool.filter(x => /nao pag|pendente|cobrar|aguardando/i.test((x.body || x.text || '').toLowerCase()));
      const body = financePool.length > 0
        ? financePool.slice(0, 3).map((f) => {
          const txt = (f.body || f.text || '').toLowerCase();
          const status = /pagou|pago|recebido|confirmado/.test(txt) ? '🟢 Receita confirmada' : '🔴 Acao necessaria';
          return `• ${truncate(f.body || f.text || f.context, 88)}\n` +
            `  👤 ${f.author || 'Time'} | ${relativeTime(f.time || f.timestamp)}\n` +
            `  ${status}`;
        }).join('\n\n')
        : buildCreativeFallback('financeiro', financePool[financePool.length - 1] || messages[messages.length - 1]);
      await msg.reply(
        `💰 *NEXO FINANCEIRO*\n\n${body}\n\n` +
        `💵 Resumo: ${paid.length} pago | ${pending.length} pendente\n` +
        `🎯 Acao sugerida: priorizar follow-up nos pendentes de hoje.\n\n` +
        `💰 Luna v16.0 | NEXO Financeiro`
      );
    }
    else if (cmd === '/decisoes') {
      const body = decisions.length > 0
        ? decisions.slice(0, 4).map((d, idx) => (
          `${idx + 1}️⃣ ${d.author || 'Time'}: "${truncate(d.body || d.text, 84)}"\n` +
          `   ⏰ ${relativeTime(d.time || d.timestamp)}\n` +
          `   ✅ Status: decisao ativa\n` +
          `   🎯 Impacto: alinhamento de execucao`
        )).join('\n\n')
        : buildCreativeFallback('decisoes', decisions[decisions.length - 1] || messages[messages.length - 1]);
      await msg.reply(
        `⚖️ *ACORDOS NEXO*\n\n${body}\n\n` +
        `⚠️ Alerta: toda decisao forte deve virar tarefa rastreavel.\n\n` +
        `⚖️ Luna v16.0 | Acordos NEXO`
      );
    }
    else if (cmd.startsWith('/buscar')) {
      const term = extractSearchArg(raw, '/buscar').toLowerCase();
      if (!term) {
        await msg.reply(
          `🔍 *NEXO SEARCH*\n\nUso: /buscar [termo]\nExemplo: /buscar cliente\n\n` +
          `🤖 Luna v16.0 | NEXO Search`
        );
        return;
      }
      const pool = [...messages, ...tasks, ...ideas, ...news, ...decisions];
      const hits = pool.filter(i => {
        const text = `${i.body || ''} ${i.text || ''} ${i.context || ''} ${i.author || ''}`.toLowerCase();
        return text.includes(term);
      }).slice(0, 5);
      const body = hits.length > 0
        ? hits.map((h, idx) => (
          `${idx + 1}️⃣ ${h.author || 'Time'} — ${relativeTime(h.time || h.timestamp)}\n` +
          `   "...${truncate(h.body || h.text || h.context, 80)}..."\n` +
          `   🏷️ Categoria: ${h.category || 'registro'}`
        )).join('\n\n')
        : `Nenhum match exato para "${term}".\nMas eu posso tentar sinonimos ou busca por autor.`;
      await msg.reply(
        `🔍 *NEXO SEARCH: "${term}"*\n\n${body}\n\n` +
        `💡 Dica: use /ultimas 20 para varredura cronologica.\n\n` +
        `🔍 Luna v16.0 | NEXO Search`
      );
    }
    else if (cmd.startsWith('/ultimas')) {
      const n = extractNumberArg(raw, '/ultimas', 10, 1, 50);
      const timeline = [...messages, ...tasks, ...ideas, ...news, ...decisions]
        .sort((a, b) => new Date(b.time || b.timestamp || 0) - new Date(a.time || a.timestamp || 0))
        .slice(0, n);
      const body = timeline.length > 0
        ? timeline.map((t) => (
          `🕐 ${relativeTime(t.time || t.timestamp)} — ${t.author || 'Time'}:\n` +
          `   "${truncate(t.body || t.text || t.context, 82)}"\n` +
          `   🏷️ ${t.category || 'registro'} | ⚡ ${formatPriority(t.priority)}`
        )).join('\n\n')
        : buildCreativeFallback('timeline', messages[messages.length - 1]);
      await msg.reply(
        `📨 *TIMELINE NEXO — Ultimas ${n}*\n\n${body}\n\n` +
        `📊 Resumo: ${timeline.length} item(ns) no recorte.\n\n` +
        `📨 Luna v16.0 | Timeline NEXO`
      );
    }
    else if (cmd === '/stats') {
      const total = messages.length + tasks.length + ideas.length + links.length + leads.length + news.length + decisions.length;
      const participants = new Set([...messages, ...tasks, ...ideas, ...news, ...decisions].map(x => x.author).filter(Boolean));
      await msg.reply(
        `📊 *NEXO ANALYTICS*\n\n` +
        `💬 Mensagens: ${messages.length}\n` +
        `👥 Participantes ativos: ${participants.size}\n` +
        `🟢 Tarefas: ${tasks.length}\n` +
        `💡 Ideias: ${ideas.length}\n` +
        `🔗 Links: ${links.length}\n` +
        `🎣 Leads: ${leads.length}\n` +
        `💰 Financeiro (sinais): ${[...messages, ...tasks].filter(x => /pag|fatura|caixa|orcamento/i.test((x.body || x.text || '').toLowerCase())).length}\n` +
        `⚖️ Decisoes: ${decisions.length}\n\n` +
        `🏆 Volume total no buffer: ${total}\n` +
        `🎯 Acao sugerida: atacar primeiro tarefas P0/P1.\n\n` +
        `📊 Luna v16.0 | NEXO Analytics`
      );
    }
    else if (cmd === '/sentimento') {
      const pool = [...messages, ...tasks, ...ideas, ...news].slice(-50);
      const pos = pool.filter(x => /show|perfeito|gostei|otimo|boa|top|excelente/.test((x.body || x.text || '').toLowerCase())).length;
      const neg = pool.filter(x => /bug|problema|ruim|atraso|erro|falha|critico/.test((x.body || x.text || '').toLowerCase())).length;
      const neu = Math.max(0, pool.length - pos - neg);
      const pct = (n) => pool.length ? Math.round((n / pool.length) * 100) : 0;
      await msg.reply(
        `💭 *PULSE NEXO — Sentimento do Grupo*\n\n` +
        `😊 Positivo: ${pct(pos)}%\n` +
        `😐 Neutro: ${pct(neu)}%\n` +
        `😟 Negativo: ${pct(neg)}%\n\n` +
        `🎯 Insight: ${neg > pos ? 'ha tensao operacional em alguns pontos.' : 'clima geral esta construtivo e produtivo.'}\n` +
        `💡 Sugestao: celebrar entregas rapidas para manter moral alta.\n\n` +
        `💭 Luna v16.0 | Pulse NEXO`
      );
    }
    else if (cmd === '/sobre') {
      const uptimeH = Math.floor(process.uptime() / 3600);
      const processed = this.cp?.checkpoint?.processedCount || 0;
      await msg.reply(
        `🌙 *IDENTIDADE LUNA*\n\n` +
        `🎭 Nome: Luna\n` +
        `🧠 Cerebro: Qwen3 1.7B (Ollama local)\n` +
        `👁️ Visao: Playwright CDP + Chrome\n` +
        `💬 Voz: whatsapp-web.js\n` +
        `🏠 Casa: NEXO Digital\n\n` +
        `📊 Stats vitais:\n` +
        `• Uptime: ${uptimeH}h\n` +
        `• Mensagens processadas: ${processed}\n` +
        `• Classificacoes em buffer: ${messages.length + tasks.length + ideas.length + news.length}\n` +
        `• Aprendizados: em evolucao continua\n\n` +
        `💬 "Nao sou perfeita. Sou progressiva, analitica e obcecada em gerar clareza para a NEXO."\n\n` +
        `🌙 Luna v16.0 | NEXO Intelligence`
      );
    }
    else if (cmd === '/health' || cmd === '/checar' || cmd === '/estado') {
      const { execSync } = require('child_process');
      const checks = [];
      try {
        execSync('curl -s http://localhost:3456/api/nexo-state > /dev/null', { timeout: 3000 });
        checks.push('🟢 Backend: OK');
      } catch { checks.push('🔴 Backend: OFF'); }
      try {
        execSync('curl -s http://localhost:3457 > /dev/null', { timeout: 3000 });
        checks.push('🟢 Frontend: OK');
      } catch { checks.push('🔴 Frontend: OFF'); }
      try {
        execSync('curl -s http://localhost:11434/api/tags > /dev/null', { timeout: 3000 });
        checks.push('🟢 Ollama: OK');
      } catch { checks.push('🔴 Ollama: OFF'); }
      try {
        execSync('curl -s http://localhost:9223/json/version > /dev/null', { timeout: 3000 });
        checks.push('🟢 Chrome CDP: OK');
      } catch { checks.push('🔴 Chrome CDP: OFF'); }
      try {
        execSync('pgrep -f "luna-cto-agent.cjs" > /dev/null', { timeout: 1000 });
        checks.push('🟢 Luna Agent: OK');
      } catch { checks.push('🔴 Luna Agent: OFF'); }
      const uptimeH = Math.floor(process.uptime() / 3600);
      const uptimeM = Math.floor((process.uptime() % 3600) / 60);
      await msg.reply(
        `🩺 *HEALTH CHECK NEXO*\n\n` +
        checks.join('\n') +
        `\n\n🤖 Luna uptime: ${uptimeH}h ${uptimeM}m\n` +
        `🧠 Modelo: qwen3:1.7b\n` +
        `🌙 Luna v16.2 | Health Check`
      );
    }
    else if (cmd === '/restart' || cmd === '/reiniciar') {
      await msg.reply(
        `🔄 *Reiniciando Luna...*\n\n` +
        `Vou desligar e voltar ja, chefe.\n` +
        `O systemd me levanta em 5 segundos.\n\n` +
        `🌙 Luna v16.2 | Restart`
      );
      log.warn('[COMANDO] Reinicio solicitado pelo CEO via WhatsApp');
      setTimeout(() => process.kill(process.pid, 'SIGTERM'), 2000);
    }
    // ═══════════════════════════════════════════════════════════════
    // NOVOS COMANDOS v16.3 — Controle Operacional via WhatsApp
    // ═══════════════════════════════════════════════════════════════
    else if (cmd === '/limpar' || cmd === '/clear' || cmd === '/resetar') {
      // Limpa TODO o buffer (mensagens, tarefas, links, etc.) mas mantém checkpoint
      const antes = {
        msgs: messages.length,
        tasks: tasks.length,
        ideas: ideas.length,
        links: links.length,
        leads: leads.length
      };
      this.cp.buffer = {
        newMessages: [],
        newTasks: [],
        newIdeas: [],
        newDecisions: [],
        newLinks: [],
        newMentions: [],
        newNews: [],
        newLeads: [],
        newFinance: [],
        newTasksDone: [],
        lastBufferUpdate: new Date().toISOString()
      };
      this.cp.save();
      this.processedMessageIds.clear();
      await msg.reply(
        `🧹 *BUFFER LIMPO*\n\n` +
        `Removidos do radar:\n` +
        `• ${antes.msgs} mensagens\n` +
        `• ${antes.tasks} tarefas\n` +
        `• ${antes.ideas} ideias\n` +
        `• ${antes.links} links\n` +
        `• ${antes.leads} leads\n\n` +
        `🔄 Cache de mensagens processadas também zerado.\n` +
        `Pronta para novo scan!\n\n` +
        `🌙 Luna v16.3 | Limpeza completa`
      );
      log.info('[COMANDO] Buffer limpo por comando WhatsApp');
    }
    else if (cmd === '/cache' || cmd === '/limpar-cache') {
      // Só limpa o cache de mensagens processadas (permite reprocessar)
      const antes = this.processedMessageIds.size;
      this.processedMessageIds.clear();
      // Também limpa knownMessageHashes do checkpoint para permitir re-scan
      const hashesAntes = this.cp.checkpoint.knownMessageHashes.length;
      this.cp.checkpoint.knownMessageHashes = [];
      this.cp.save();
      await msg.reply(
        `🗑️ *CACHE ZERADO*\n\n` +
        `• ${antes} IDs de mensagens em memória removidos\n` +
        `• ${hashesAntes} hashes do checkpoint apagados\n\n` +
        `Agora posso reprocessar mensagens que já li antes.\n` +
        `Use /scan para forçar uma nova varredura!\n\n` +
        `🌙 Luna v16.3 | Cache limpo`
      );
      log.info('[COMANDO] Cache de mensagens processadas limpo');
    }
    else if (cmd === '/buffer' || cmd === '/ver-buffer') {
      const b = this.cp.buffer || {};
      const total = (b.newMessages?.length || 0) +
                    (b.newTasks?.length || 0) +
                    (b.newIdeas?.length || 0) +
                    (b.newLinks?.length || 0) +
                    (b.newLeads?.length || 0) +
                    (b.newFinance?.length || 0) +
                    (b.newNews?.length || 0) +
                    (b.newDecisions?.length || 0);
      await msg.reply(
        `📦 *BUFFER ATUAL*\n\n` +
        `💬 Mensagens: ${b.newMessages?.length || 0}\n` +
        `📝 Tarefas: ${b.newTasks?.length || 0}\n` +
        `💡 Ideias: ${b.newIdeas?.length || 0}\n` +
        `🔗 Links: ${b.newLinks?.length || 0}\n` +
        `🎣 Leads: ${b.newLeads?.length || 0}\n` +
        `💰 Financeiro: ${b.newFinance?.length || 0}\n` +
        `📰 News: ${b.newNews?.length || 0}\n` +
        `⚖️ Decisões: ${b.newDecisions?.length || 0}\n` +
        `✅ Tarefas feitas: ${b.newTasksDone?.length || 0}\n\n` +
        `📊 Total: ${total} itens\n` +
        `🕐 Última atualização: ${b.lastBufferUpdate ? relativeTime(b.lastBufferUpdate) : 'nunca'}\n\n` +
        `🌙 Luna v16.3 | Buffer Status`
      );
    }
    else if (cmd === '/scan' || cmd === '/varredura' || cmd === '/escanear') {
      await msg.reply(
        `🔍 *SCAN FORÇADO*\n\n` +
        `Iniciando varredura completa do grupo agora...\n` +
        `Isso pode levar 1-2 minutos.\n\n` +
        `🌙 Luna v16.3 | Scan iniciado`
      );
      log.info('[COMANDO] Scan forçado por comando WhatsApp');
      // Executa scan em background para não bloquear
      setTimeout(async () => {
        try {
          await this.runOnce();
          await msg.reply(
            `✅ *SCAN CONCLUÍDO*\n\n` +
            `Varredura finalizada!\n` +
            `Use /buffer ou /status para ver o que encontrei.\n\n` +
            `🌙 Luna v16.3 | Scan completo`
          );
        } catch (e) {
          log.error(`[COMANDO] Erro no scan forçado: ${e.message}`);
          await msg.reply(
            `❌ *SCAN FALHOU*\n\n` +
            `Erro: ${e.message.slice(0, 100)}\n` +
            `Tente /health para verificar o estado dos serviços.\n\n` +
            `🌙 Luna v16.3 | Scan erro`
          );
        }
      }, 100);
    }
    else if (cmd === '/analise' || cmd === '/analizar' || cmd === '/analisar') {
      await msg.reply(
        `🧠 *ANÁLISE COMPLETA*\n\n` +
        `Iniciando análise profunda de todas as mensagens do grupo...\n` +
        `Isso pode levar 2-3 minutos.\n\n` +
        `🌙 Luna v16.3 | Análise iniciada`
      );
      log.info('[COMANDO] Análise completa forçada por comando WhatsApp');
      setTimeout(async () => {
        try {
          await this.runFullExtract();
          await msg.reply(
            `✅ *ANÁLISE COMPLETA FINALIZADA*\n\n` +
            `Extração profunda concluída!\n` +
            `Use /status ou /buffer para ver os resultados.\n\n` +
            `🌙 Luna v16.3 | Análise completa`
          );
        } catch (e) {
          log.error(`[COMANDO] Erro na análise completa: ${e.message}`);
          await msg.reply(
            `❌ *ANÁLISE FALHOU*\n\n` +
            `Erro: ${e.message.slice(0, 100)}\n\n` +
            `🌙 Luna v16.3 | Análise erro`
          );
        }
      }, 100);
    }
    else if (cmd === '/mencoes' || cmd === '/menciones' || cmd === '/mentions') {
      const mencoes = safeList(buffer.newMentions);
      const body = mencoes.length > 0
        ? mencoes.slice(0, 5).map((m, idx) => (
          `${idx + 1}️⃣ ${m.author || 'Time'}: "${truncate(m.body || m.text, 70)}"\n` +
          `   ⏰ ${relativeTime(m.time || m.timestamp)}`
        )).join('\n\n')
        : 'Nenhuma menção registrada no buffer atual.';
      await msg.reply(
        `👋 *MINHAS MENÇÕES*\n\n` +
        `${body}\n\n` +
        `Total: ${mencoes.length} menção(ões)\n\n` +
        `🌙 Luna v16.3 | Menções`
      );
    }
    else if (cmd === '/links' || cmd === '/analise-links') {
      // Comando expandido — análise detalhada de links
      const allLinks = safeList(buffer.newLinks);
      const urlsInMsgs = [...messages, ...tasks, ...ideas, ...news]
        .map(m => (m.body || m.text || '').match(/https?:\/\/[^\s]+/gi))
        .filter(Boolean)
        .flat();
      const uniqueUrls = [...new Set(urlsInMsgs)];
      const body = allLinks.length > 0
        ? allLinks.slice(0, 5).map((l, idx) => (
          `${idx + 1}️⃣ ${truncate(l.title || l.url, 50)}\n` +
          `   🔗 ${truncate(l.url, 50)}\n` +
          `   👤 ${l.author || 'Time'} | ${relativeTime(l.time)}\n` +
          `   🏷️ Tipo: ${l.type || 'link'}`
        )).join('\n\n')
        : uniqueUrls.length > 0
          ? `Links detectados em mensagens (não enriquecidos):\n${uniqueUrls.slice(0, 5).map(u => `• ${truncate(u, 60)}`).join('\n')}`
          : 'Nenhum link no buffer. Use /scan para buscar novos links no grupo.';
      await msg.reply(
        `🔗 *ANÁLISE DE LINKS*\n\n` +
        `${body}\n\n` +
        `📊 Links enriquecidos: ${allLinks.length}\n` +
        `📊 URLs brutas em mensagens: ${uniqueUrls.length}\n\n` +
        `🌙 Luna v16.3 | Link Analysis`
      );
    }
    else if (cmd === '/ping' || cmd === '/teste') {
      const uptimeH = Math.floor(process.uptime() / 3600);
      const uptimeM = Math.floor((process.uptime() % 3600) / 60);
      const mem = process.memoryUsage();
      log.info(`[COMANDO] Executando /ping para ${msg.from}`);
      try {
        await msg.reply(
          `🏓 *PONG!*\n\n` +
          `✅ Luna online e respondendo!\n\n` +
          `⏱️ Uptime: ${uptimeH}h ${uptimeM}m\n` +
          `💾 Memória: ${Math.round(mem.heapUsed / 1024 / 1024)}MB / ${Math.round(mem.heapTotal / 1024 / 1024)}MB\n` +
          `📨 Msgs processadas: ${this.cp.checkpoint.processedCount || 0}\n` +
          `🧠 Cache em memória: ${this.processedMessageIds.size} IDs\n\n` +
          `🌙 Luna v16.3 | Online`
        );
        log.success('[COMANDO] Resposta /ping enviada com sucesso');
      } catch (replyErr) {
        log.error(`[COMANDO] Falha ao enviar resposta /ping: ${replyErr.message}`);
      }
    }
    else {
      log.warn(`[COMANDO] Comando nao reconhecido: ${cmd}`);
      await msg.reply(
        `🌙 *Comando nao reconhecido, chefe.*\n\n` +
        `Vi que voce mandou: *${cmd}*\n` +
        `Mas ainda nao aprendi esse.\n\n` +
        `Quer ver o que sei fazer? Manda */ajuda* que eu mostro o menu completo.`
      );
    }
    } catch (err) {
      log.error(`[COMANDO] Erro fatal ao processar comando: ${err.message}`);
      log.error(err.stack);
      try {
        await msg.reply(`🌙 *Ops, chefia!*\n\nDeu um erro aqui ao processar seu comando. Pode tentar de novo?\n\n_Erro: ${err.message.slice(0, 120)}_`);
      } catch (replyErr) {
        log.error(`[COMANDO] Falha ao enviar mensagem de erro: ${replyErr.message}`);
      }
    }
  }
  async runFullExtract() {
    if (this.fullExtractRunning) {
      log.warn('Extracao completa ja rodando!');
      return;
    }
    this.fullExtractRunning = true;

    try {
      log.extraordinary('=== EXTRACAO COMPLETA INICIADA ===');

      const connected = await this.extractor.connect();
      if (!connected) {
        log.error('Nao foi possivel conectar Playwright. Pulando extracao completa.');
        return;
      }

      const allMessages = [];
      const allClassified = [];

      for (const group of CONFIG.GROUPS) {
        log.extract(`Extraindo: ${group.name}`);
        const messages = await this.extractor.extractChat(group.name);

        if (messages.length > 0) {
          for (const msg of messages) {
            const classified = await this.brain.classify(msg, this.threadHistory || []);
            allClassified.push({ ...msg, classification: classified });
            this.cp.markProcessed(msg);
          }
          allMessages.push(...messages);
        }
      }

      const linkResults = [];
      for (const item of allClassified) {
        if (item.classification.urls && item.classification.urls.length > 0) {
          for (const url of item.classification.urls) {
            const analyzed = await this.linkAnalyzer.analyze(url, item.text);
            linkResults.push(analyzed);
          }
        }
      }

      const fullExtract = {
        extractedAt: new Date().toISOString(),
        totalMessages: allMessages.length,
        messages: allClassified,
        links: linkResults,
        stats: this.generateStats(allClassified)
      };

      fs.writeFileSync(CONFIG.FULL_EXTRACT_FILE, JSON.stringify(fullExtract, null, 2));
      log.success(`Extracao completa salva: ${allMessages.length} mensagens, ${linkResults.length} links`);

      this.updateBufferFromClassified(allClassified);
      await this.saveToHistory(allClassified);
      this.cp.markFullExtractDone();
      this.cp.save();
      log.info('[BUGFIX] Buffer persistente atualizado pela extracao completa');

      log.extraordinary('=== EXTRACAO COMPLETA FINALIZADA ===');

    } catch (e) {
      log.error(`Erro na extracao completa: ${e.message}`);
    } finally {
      await this.extractor.disconnect();
      this.fullExtractRunning = false;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // FASE 1 v17.0 — PROACTIVE INTELLIGENCE
  // A Luna deixa de ser reativa e começa a agir sozinha
  // ═══════════════════════════════════════════════════════════════

  startProactiveEngine() {
    log.extraordinary('[PROACTIVE] Motor de inteligencia proativa iniciado');

    // Morning Brief — todo dia às 8h (CET)
    cron.schedule('0 8 * * *', () => {
      log.info('[PROACTIVE] Disparando Morning Brief...');
      this.sendMorningBrief();
    }, { timezone: 'Europe/Madrid' });

    // Check Tarefas Atrasadas — todo dia às 17h
    cron.schedule('0 17 * * *', () => {
      log.info('[PROACTIVE] Verificando tarefas atrasadas...');
      this.checkOverdueTasks();
    }, { timezone: 'Europe/Madrid' });

    // Check Leads — todo dia às 10h e 16h
    cron.schedule('0 10,16 * * *', () => {
      log.info('[PROACTIVE] Verificando follow-up de leads...');
      this.checkLeadFollowUps();
    }, { timezone: 'Europe/Madrid' });

    // Check Financial — todo dia às 9h
    cron.schedule('0 9 * * *', () => {
      log.info('[PROACTIVE] Verificando alertas financeiros...');
      this.checkFinancialAlerts();
    }, { timezone: 'Europe/Madrid' });

    // Pre-meeting Briefs — a cada 15 minutos
    cron.schedule('*/15 * * * *', () => {
      this.sendPreMeetingBriefs();
    }, { timezone: 'Europe/Madrid' });

    // Weekly Report — todo domingo às 20h
    cron.schedule('0 20 * * 0', () => {
      log.info('[PROACTIVE] Enviando relatório semanal...');
      this.sendWeeklyReport();
    }, { timezone: 'Europe/Madrid' });

    log.success('[PROACTIVE] Scheduler configurado: Morning Brief 8h, Tarefas 17h, Leads 10h/16h, Financeiro 9h, Meetings */15min');
  }

  async sendMessageToGroup(text) {
    try {
      const groupId = CONFIG.GROUPS[0]?.id;
      if (!groupId) {
        log.error('[PROACTIVE] ID do grupo Production nao configurado. Mensagem NAO enviada.');
        return;
      }
      const chat = await this.client.getChatById(groupId);
      if (!chat) {
        log.error('[PROACTIVE] Grupo Production nao encontrado. Mensagem NAO enviada.');
        return;
      }
      // SEGURANCA: verificar se o chat eh realmente o grupo Production
      const chatName = chat.name || '';
      if (!chatName.toLowerCase().includes('production')) {
        log.error(`[PROACTIVE] SEGURANCA: Chat encontrado nao eh Production (nome: ${chatName}). Mensagem NAO enviada.`);
        return;
      }
      await chat.sendMessage(text);
      log.success('[PROACTIVE] Mensagem enviada ao grupo Production');
    } catch (e) {
      log.error(`[PROACTIVE] Falha ao enviar mensagem: ${e.message}`);
    }
  }

  async sendMorningBrief() {
    try {
      // ── LUNA v18.0 CONSCIOUS: Usar ProactiveEngine ──
      if (this.proactive) {
        const msg = await this.proactive.generateDailyBrief();
        await this.sendMessageToGroup(msg);
        log.success('[PROACTIVE] Morning Brief inteligente enviado');
        return;
      }
      // ────────────────────────────────────────────────

      // Fallback para template antigo
      this.cp.reloadBuffer();
      const buffer = this.cp.buffer || {};
      const tasks = buffer.newTasks || [];
      const leads = buffer.newLeads || [];
      const p0 = tasks.filter(t => (t.priority || '').toString().toUpperCase() === 'P0');
      const p1 = tasks.filter(t => (t.priority || '').toString().toUpperCase() === 'P1');
      let msg = `🌙 *Bom dia, chefes!*\n\n📊 *Resumo do dia:*\n\n`;
      if (p0.length > 0 || p1.length > 0) {
        msg += `⚠️ *TAREFAS PENDENTES:*\n→ ${p0.length} P0 | ${p1.length} P1\n\n`;
      }
      if (leads.length > 0) msg += `🔥 *LEADS:* ${leads.length}\n\n`;
      msg += `🎯 *FOCO DO DIA:* ${p0.length > 0 ? 'Resolver P0s' : p1.length > 0 ? 'Avançar P1s' : 'Manter o ritmo! 💪'}\n\n_🌙 Luna v18.0 | Morning Brief_`;
      await this.sendMessageToGroup(msg);
      log.success('[PROACTIVE] Morning Brief enviado');
    } catch (e) {
      log.error(`[PROACTIVE] Erro no Morning Brief: ${e.message}`);
    }
  }

  async checkOverdueTasks() {
    try {
      this.cp.reloadBuffer();
      const tasks = this.cp.buffer.newTasks || [];
      const now = Date.now();
      const overdue = tasks.filter(t => {
        const taskTime = new Date(t.time || t.timestamp || 0).getTime();
        const age = now - taskTime;
        const isHighPriority = /P0|P1/i.test(t.priority || '');
        return isHighPriority && age > 48 * 60 * 60 * 1000; // > 48h
      });

      if (overdue.length > 0) {
        let msg = `⏰ *TAREFAS PARADAS*\n\n`;
        msg += `Chefes, ${overdue.length} tarefa(s) P0/P1 estão sem movimento há mais de 48h:\n\n`;
        overdue.slice(0, 3).forEach((t, i) => {
          msg += `${i + 1}. ${t.body?.slice(0, 50) || 'Tarefa'}...\n`;
        });
        if (overdue.length > 3) msg += `...e mais ${overdue.length - 3}\n`;
        msg += `\nPrecisam de ajuda ou é só priorizar? 🎯`;
        await this.sendMessageToGroup(msg);
        log.success(`[PROACTIVE] ${overdue.length} tarefas atrasadas alertadas`);
      }
    } catch (e) {
      log.error(`[PROACTIVE] Erro checkOverdueTasks: ${e.message}`);
    }
  }

  async checkLeadFollowUps() {
    try {
      this.cp.reloadBuffer();
      const leads = this.cp.buffer.newLeads || [];
      const now = Date.now();

      const needsFollowUp = leads.filter(l => {
        const leadTime = new Date(l.time || l.timestamp || 0).getTime();
        const age = now - leadTime;
        const isHot = /quente|hot|urgente|fechar/i.test(l.context || l.body || '');
        return isHot && age > 24 * 60 * 60 * 1000 && age < 96 * 60 * 60 * 1000;
      });

      if (needsFollowUp.length > 0) {
        let msg = `🔥 *FOLLOW-UP DE LEADS*\n\n`;
        msg += `${needsFollowUp.length} lead(s) quente(s) sem resposta há mais de 24h:\n\n`;
        needsFollowUp.slice(0, 3).forEach((l, i) => {
          msg += `${i + 1}. ${l.name || 'Lead'}: ${l.context?.slice(0, 40) || ''}...\n`;
        });
        msg += `\nBora não deixar esfriar! 🚀`;
        await this.sendMessageToGroup(msg);
      }
    } catch (e) {
      log.error(`[PROACTIVE] Erro checkLeadFollowUps: ${e.message}`);
    }
  }

  async checkFinancialAlerts() {
    try {
      this.cp.reloadBuffer();
      const finance = this.cp.buffer.newFinance || [];
      const now = Date.now();

      const overduePayments = finance.filter(f => {
        const txt = (f.body || f.text || '').toLowerCase();
        const isPending = /pendente|nao pag|aguardando|cobrar/.test(txt);
        const finTime = new Date(f.time || f.timestamp || 0).getTime();
        const age = now - finTime;
        return isPending && age > 7 * 24 * 60 * 60 * 1000; // > 7 dias
      });

      if (overduePayments.length > 0) {
        let msg = `💰 *ALERTA FINANCEIRO*\n\n`;
        msg += `${overduePayments.length} pagamento(s) pendente(s) há mais de 7 dias:\n\n`;
        overduePayments.slice(0, 3).forEach((f, i) => {
          msg += `${i + 1}. ${f.body?.slice(0, 50) || 'Pagamento'}...\n`;
        });
        msg += `\n_Querem que eu prepare um resumo completo do financeiro?_`;
        await this.sendMessageToGroup(msg);
      }
    } catch (e) {
      log.error(`[PROACTIVE] Erro checkFinancialAlerts: ${e.message}`);
    }
  }

  detectMeetingsInMessages(messages = []) {
    const meetings = [];
    const now = new Date();
    const todayStr = now.toDateString();

    for (const msg of messages) {
      const text = (msg.body || msg.text || '').toLowerCase();
      // Padrões: "call 14h", "reunião 15:30", "zoom amanhã 10h"
      const meetingPatterns = [
        /(call|reuni[ãa]o|zoom|meet|hangout)\s*(?:as?|às)?\s*(\d{1,2})[:h]?(\d{2})?/i,
        /(\d{1,2})[:h](\d{2})\s*(call|reuni[ãa]o|zoom)/i,
      ];

      for (const pattern of meetingPatterns) {
        const match = text.match(pattern);
        if (match) {
          const hour = parseInt(match[2] || match[1], 10);
          const minute = parseInt(match[3] || match[2] || 0, 10) || 0;
          if (hour >= 8 && hour <= 22) {
            meetings.push({
              time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
              description: msg.body?.slice(0, 60) || 'Reunião',
              author: msg.author || 'Time'
            });
          }
        }
      }
    }
    return meetings;
  }

  detectMeetingsToday() {
    try {
      // Buscar nas mensagens recentes do histórico
      const historyFile = path.join(__dirname, '../backend/data/whatsapp-history.json');
      if (!fs.existsSync(historyFile)) return [];
      const history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
      const messages = history.messages || history || [];
      const recentMsgs = messages.slice(-100); // últimas 100
      return this.detectMeetingsInMessages(recentMsgs);
    } catch (e) {
      return [];
    }
  }

  async sendPreMeetingBriefs() {
    try {
      const meetings = this.detectMeetingsToday();
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      for (const meeting of meetings) {
        const [mHour, mMinute] = meeting.time.split(':').map(Number);
        const diffMinutes = (mHour - currentHour) * 60 + (mMinute - currentMinute);

        // Se a reunião é em 10-20 minutos
        if (diffMinutes >= 10 && diffMinutes <= 20) {
          // Verificar se já enviamos brief para esta reunião (evitar spam)
          const briefKey = `brief_${meeting.time}_${now.toDateString()}`;
          if (this.sentBriefs?.has(briefKey)) continue;
          if (!this.sentBriefs) this.sentBriefs = new Set();

          let msg = `🎯 *BRIEF PARA REUNIÃO*\n\n`;
          msg += `📅 ${meeting.time} — ${meeting.description}\n\n`;
          msg += `💡 *Contexto:* Última interação com ${meeting.author}\n`;
          msg += `🎯 *Sugestão:* Preparar números e próximos passos\n\n`;
          msg += `_Boa call, chefes! 🚀_`;

          await this.sendMessageToGroup(msg);
          this.sentBriefs.add(briefKey);
          log.info(`[PROACTIVE] Pre-meeting brief enviado para ${meeting.time}`);
        }
      }
    } catch (e) {
      log.error(`[PROACTIVE] Erro sendPreMeetingBriefs: ${e.message}`);
    }
  }

  async sendWeeklyReport() {
    try {
      // ── LUNA v18.0 CONSCIOUS: Usar ProactiveEngine ──
      if (this.proactive) {
        const msg = await this.proactive.generateWeeklyReport();
        await this.sendMessageToGroup(msg);
        log.success('[PROACTIVE] Relatório semanal inteligente enviado');
        return;
      }
      // ────────────────────────────────────────────────

      // Fallback para template antigo
      this.cp.reloadBuffer();
      const buffer = this.cp.buffer || {};
      const tasks = buffer.newTasks || [];
      const tasksDone = buffer.newTasksDone || [];
      let msg = `📊 *RELATÓRIO SEMANAL NEXO*\n\n`;
      msg += `📝 Tarefas: ${tasks.length} total | ${tasksDone.length} concluídas\n\n`;
      msg += `_🌙 Luna v18.0 | Relatório Semanal_`;
      await this.sendMessageToGroup(msg);
      log.success('[PROACTIVE] Relatório semanal enviado');
    } catch (e) {
      log.error(`[PROACTIVE] Erro no relatório semanal: ${e.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // FIM FASE 1 — PROACTIVE INTELLIGENCE
  // ═══════════════════════════════════════════════════════════════

  async runOnce() {
    if (this.running) {
      log.warn('Scan ja rodando!');
      return { status: 'busy', hasNews: false };
    }
    this.running = true;

    try {
      log.scan('=== SCAN INICIADO ===');

      if (!this.cp.checkpoint.fullExtractDone) {
        log.warn('Extracao completa nunca feita! Executando agora...');
        await this.runFullExtract();
        return { status: 'full_extract', hasNews: true };
      }

      const connected = await this.extractor.connect();
      if (!connected) {
        log.error('Playwright nao conectou. Pulando scan.');
        return { status: 'error', hasNews: false };
      }

      const newMessages = [];

      for (const group of CONFIG.GROUPS) {
        const messages = await this.extractor.extractChat(group.name);

        for (const msg of messages) {
          if (this.cp.isNew(msg)) {
            newMessages.push(msg);
            this.cp.markProcessed(msg);
          }
        }
      }

      await this.extractor.disconnect();

      log.info(`${newMessages.length} mensagens novas detectadas`);

      if (newMessages.length > 0) {
        const classified = await Promise.all(newMessages.map(m => (
          this.brain.classify(m, this.threadHistory || []).then(classification => ({
            ...m,
            classification
          }))
        )));

        this.updateBufferFromClassified(classified);
        await this.saveToHistory(classified);
        this.cp.saveBuffer();
        log.info('[BUGFIX] Buffer persistente atualizado pelo scan incremental');

        await this.notifyOps({
          messages: newMessages,
          newCount: newMessages.length,
          classified: classified
        });

        this.cp.checkpoint.silenceCount = 0;
      } else {
        this.cp.checkpoint.silenceCount = (this.cp.checkpoint.silenceCount || 0) + 1;
        log.info(`Silencio #${this.cp.checkpoint.silenceCount}`);
      }

      this.cp.checkpoint.lastScan = new Date().toISOString();
      if (this.brain?.recoverAfterSuccessfulScan) this.brain.recoverAfterSuccessfulScan();
      this.cp.save();

      return {
        status: 'ok',
        hasNews: newMessages.length > 0,
        newMessages: newMessages.length
      };

    } catch (e) {
      log.error(`Scan error: ${e.message}`);
      return { status: 'error', hasNews: false, error: e.message };
    } finally {
      this.running = false;
    }
  }

  updateBufferFromClassified(classified) {
        // Protecao: garante que arrays existem
    if (!this.cp.buffer.newTasks) this.cp.buffer.newTasks = [];
    if (!this.cp.buffer.newIdeas) this.cp.buffer.newIdeas = [];
    if (!this.cp.buffer.newDecisions) this.cp.buffer.newDecisions = [];
    if (!this.cp.buffer.newLinks) this.cp.buffer.newLinks = [];
    if (!this.cp.buffer.newLeads) this.cp.buffer.newLeads = [];
    if (!this.cp.buffer.newNews) this.cp.buffer.newNews = [];
    if (!this.cp.buffer.newFinance) this.cp.buffer.newFinance = [];
    if (!this.cp.buffer.newTasksDone) this.cp.buffer.newTasksDone = [];
    if (!this.cp.buffer.ignoredMessages) this.cp.buffer.ignoredMessages = [];
    for (const item of classified) {
      const c = item.classification;
      if (!c) continue;
      const text = item.text || item.body || '';
      const authorName = item.authorName || resolveAuthor(item.author || item.from).name;
      const time = normalizeWhatsAppTimestamp(item.timestamp || item.time);
      const financeMatch = /(pagou|pago|pagamento|fatura|caixa|orcamento|orçamento|cobrar|pendente|euro|eur|€)/i.test(text);

      switch (c.category) {
        case 'ignored':
          this.cp.buffer.ignoredMessages.push({
            body: text,
            author: authorName,
            time,
            reason: c.ignoreReason || 'Mensagem ignorada',
            category: 'ignored'
          });
          break;
        case 'tarefaRealizada':
        case 'tarefaPendente':
          this.cp.buffer.newTasks.push({
            body: text,
            object: c.object || null,
            author: authorName,
            priority: c.priority,
            time
          });
          break;
        case 'ideiaNova':
          this.cp.buffer.newIdeas.push({ body: text, author: authorName, time });
          break;
        case 'decisao':
          this.cp.buffer.newDecisions.push({ body: text, author: authorName, time });
          break;
        case 'link':
          this.cp.buffer.newLinks.push({ url: c.urls?.[0] || c.entities?.urls?.[0]?.url, context: text, title: c.entities?.urls?.[0]?.title, type: c.entities?.urls?.[0]?.type, author: authorName, time });
          break;
        case 'lead':
          if (c.business?.leadScore >= 40 && !c.ignored) {
            this.cp.buffer.newLeads.push({ ...(c.business?.lead || {}), name: c.possibleNewClient || c.business?.lead?.name || 'Lead nao identificado', context: text, author: authorName, time });
          } else {
            this.cp.buffer.ignoredMessages.push({ body: text, author: authorName, time, reason: 'Lead sem intencao comercial suficiente', category: 'ignored' });
          }
          break;
        case 'financeiroPagamento':
        case 'financeiroPendente':
          this.cp.buffer.newFinance.push({ body: text, author: authorName, time, category: c.category, priority: c.priority, value: c.business?.financialValue || null });
          break;
        case 'noticia':
        default:
          this.cp.buffer.newNews.push({ body: text, author: authorName, time, chat: item.chatName });
          break;
      }

      if (financeMatch && c.category !== 'ignored' && !['financeiroPagamento', 'financeiroPendente'].includes(c.category)) {
        this.cp.buffer.newFinance.push({ body: text, author: authorName, time, category: c.category, priority: c.priority || 'P2', value: c.business?.financialValue || null });
      }
    }

    this.cp.buffer.lastBufferUpdate = new Date().toISOString();
  }

  generateStats(classified) {
    const stats = {};
    for (const item of classified) {
      const cat = item.classification.category;
      stats[cat] = (stats[cat] || 0) + 1;
    }
    return stats;
  }

  async startMonitoring(options = {}) {
    const { schedule = true } = options;
    log.info('Monitoramento iniciado');

    const chats = await this.client.getChats();
    this.reportGroup = chats.find(c => c.isGroup && c.name?.toLowerCase().includes(CONFIG.REPORT_TO.toLowerCase()));

    if (this.reportGroup) {
      log.success(`Grupo de relatorios: ${this.reportGroup.name}`);
    } else {
      log.warn('Grupo de relatorios nao encontrado!');
    }

    await this.runOnce();

    if (schedule) {
      setInterval(() => this.runOnce(), CONFIG.SCAN_INTERVAL);
      setInterval(() => this.sendScheduledReport(), CONFIG.REPORT_INTERVAL);
      // Iniciar motor proativo v17.0
      this.startProactiveEngine();
    }

    return { status: 'monitoring' };
  }

  async sendScheduledReport() {
    try {
      await this.runOnce();
    } catch (error) {
      log.warn(`[REPORT] Nao consegui atualizar o buffer antes do relatorio: ${error.message}`);
    }

    const buffer = this.cp.buffer;
    const hasNews = buffer.newMessages?.length > 0 || 
                   buffer.newTasks?.length > 0 || 
                   buffer.newIdeas?.length > 0 ||
                   buffer.newLinks?.length > 0 ||
                   buffer.newLeads?.length > 0 ||
                   buffer.newFinance?.length > 0;

    if (!hasNews) {
      this.cp.checkpoint.silenceCount = (this.cp.checkpoint.silenceCount || 0) + 1;

      if (this.cp.checkpoint.silenceCount === 1 && this.reportGroup) {
        await this.reportGroup.sendMessage(`🌙 *LUNA REPORT*\n\n🔇 Sem novidades nos ultimos 30 minutos.\n\n🤖 Luna v16.0`);
      }
      return;
    }

    let report = `🌙 *LUNA REPORT INTELIGENTE*\n\n`;
    report += `📊 *O QUE VI:*\n`;
    report += `• ${buffer.newMessages?.length || 0} mensagens novas\n`;
    report += `• ${buffer.newTasks?.length || 0} tarefas\n`;
    report += `• ${buffer.newIdeas?.length || 0} ideias\n`;
    report += `• ${buffer.newLinks?.length || 0} links\n`;
    report += `• ${buffer.newLeads?.length || 0} possiveis clientes\n`;
    report += `• ${buffer.newNews?.length || 0} noticias\n`;
    report += `• ${buffer.newFinance?.length || 0} sinais financeiros\n\n`;

    report += `❓ *O QUE NAO VI:*\n`;
    // Lista dinâmica de clientes ativos a partir do schema (não hardcoded)
    const activeClients = Object.values(SCHEMAS.clients?.clients || {})
      .filter(c => c.status === 'ativo' || c.status === 'em-progresso')
      .map(c => ({ name: c.name, company: c.company, keywords: [c.name?.toLowerCase(), c.company?.toLowerCase(), c.id?.toLowerCase()].filter(Boolean) }));
    
    const unmentionedClients = activeClients.filter(client => {
      return !buffer.newMessages?.some(m => client.keywords.some(kw => (m.body || '').toLowerCase().includes(kw)));
    });
    
    if (unmentionedClients.length > 0) {
      const clientNames = unmentionedClients.map(c => c.company || c.name).join(', ');
      report += `• Nenhuma mencao a clientes ativos: ${clientNames}.\n`;
    }
    if ((buffer.newMessages?.filter(m => /pagou|fatura|caixa/.test((m.body || '').toLowerCase())) || []).length === 0) {
      report += `• Nenhuma atualizacao financeira. O caixa esta atualizado?\n`;
    }
    report += `\n`;

    if (buffer.newLeads?.length > 0) {
      report += `🎣 *POSSIVEIS CLIENTES:*\n`;
      for (const lead of buffer.newLeads.slice(0, 3)) {
        report += `• ${lead.name || 'Nao identificado'}: ${(lead.context || '').slice(0, 60)}...\n`;
      }
      report += `\n`;
    }

    if (buffer.newFinance?.length > 0) {
      report += `💰 *SINAIS FINANCEIROS:*\n`;
      for (const item of buffer.newFinance.slice(0, 3)) {
        report += `• ${(item.body || '').slice(0, 70)}... (${item.author || 'time'})\n`;
      }
      report += `\n`;
    }

    report += `🤖 Luna v16.0 | ${new Date().toLocaleString('pt-BR')}`;

    if (this.reportGroup) {
      await this.reportGroup.sendMessage(report);
      log.success('Relatorio inteligente enviado!');
    }

    this.cp.checkpoint.silenceCount = 0;
    this.cp.checkpoint.lastReport = new Date().toISOString();
    this.cp.save();
    log.info('[BUGFIX] Relatorio enviado sem limpar buffer persistente');
  }

  async forceReport(to) {
    const originalGroup = this.reportGroup;
    if (to) {
      const chats = await this.client.getChats();
      this.reportGroup = chats.find(c => c.id?._serialized === to || c.from === to);
    }
    await this.sendScheduledReport();
    this.reportGroup = originalGroup;
  }

  async saveToHistory(messages) {
    try {
      const historyPath = CONFIG.WHATSAPP_HISTORY_FILE;
      let history = [];
      if (fs.existsSync(historyPath)) {
        const raw = fs.readFileSync(historyPath, 'utf8').replace(/^\uFEFF/, '');
        const parsed = raw.trim() ? JSON.parse(raw) : [];
        history = Array.isArray(parsed) ? parsed : (parsed.messages || []);
      } else {
        fs.writeFileSync(historyPath, '[]', 'utf8');
      }

      const aliasMap = {
        'Abner': 'Abner Gabriel',
        'Nonoke': 'Enoque G. Santos',
        'Elias': 'Elias Mendes',
        'abner': 'Abner Gabriel',
        'nonoke': 'Enoque G. Santos',
        'enoque': 'Enoque G. Santos',
        'elias': 'Elias Mendes'
      };

      const seen = new Set(history.map(m => m.id).filter(Boolean));
      for (const msg of messages) {
        // Prioridade: authorPhone (extraído do data-id do DOM) > author > from
        const authorIdentifier = msg.authorPhone || msg.authorName || msg.pushname || msg.author || msg.from || 'Desconhecido';
        const resolved = resolveAuthor(authorIdentifier);
        const resolvedName = resolved.confidence > 0 ? resolved.name : (aliasMap[authorIdentifier] || authorIdentifier);
        const timestamp = normalizeWhatsAppTimestamp(msg.timestamp || msg.time);
        const id = msg.id || crypto.createHash('md5').update(`${authorIdentifier}:${msg.text || msg.body || ''}:${timestamp}`).digest('hex');
        if (seen.has(id)) continue;
        seen.add(id);
        history.push({
          id,
          author: resolvedName,
          authorName: resolvedName,
          authorRole: msg.authorRole || resolved.role || null,
          originalAuthor: authorIdentifier,
          authorId: msg.authorPhone || msg.author || msg.from || null,
          text: msg.text || msg.body || '',
          body: msg.body || msg.text || '',
          chat: msg.chatName || (msg.from || '').replace(/@g\.us|@c\.us/, '') || '',
          timestamp,
          classification: msg.classification || null,
          resolvedAuthor: resolved.confidence > 0 ? {
            name: resolved.name,
            shortName: resolved.shortName || resolved.name,
            color: resolved.color || '#6B7280',
            avatarEmoji: resolved.avatarEmoji || '👤',
            role: resolved.role || 'member',
            phone: resolved.phone || msg.authorPhone || msg.author || msg.from || null,
            isNexo: resolved.isNexo || false,
            isFounder: resolved.isFounder || false,
            confidence: resolved.confidence
          } : null
        });
      }

      if (history.length > 5000) history = history.slice(-5000);

      fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
      log.info(`[HISTORY] ${messages.length} msgs processadas (total: ${history.length})`);
    } catch (e) {
      log.error(`Erro ao salvar historico: ${e.message}`);
    }
  }

  async notifyOps(data) {
    log.info(`[NOTIFY] Enviando ${data.newCount || 0} novas mensagens para ops`);
    try {
      const payload = {
        source: 'luna-whatsapp',
        timestamp: new Date().toISOString(),
        newMessages: data.newCount || 0,
        bufferSize: this.cp.buffer.newMessages?.length || 0,
        tasks: this.cp.buffer.newTasks?.length || 0,
        ideas: this.cp.buffer.newIdeas?.length || 0,
        links: this.cp.buffer.newLinks?.length || 0,
        leads: this.cp.buffer.newLeads?.length || 0
      };
      let fetch;
      try { fetch = (await import('node-fetch')).default; } catch (e) { return; }
      await fetch('http://localhost:3456/api/ops/changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {});
    } catch (e) { /* Silencioso */ }
  }
}

// ============================================================
// EXECUCAO — KEEP-ALIVE ATIVO
// ============================================================
async function runAgent(options = {}) {
  const agent = new LunaAgent();
  const result = await agent.init(options);
  return result;
}

function diagnose() {
  const checks = {
    whatsappWebJs: Boolean(require.resolve('whatsapp-web.js')),
    qrcodeTerminal: Boolean(require.resolve('qrcode-terminal')),
    playwright: Boolean(require.resolve('playwright')),
    checkpointDir: path.dirname(CONFIG.CHECKPOINT_FILE),
    outputFile: CONFIG.OUTPUT_FILE,
    reportsDir: CONFIG.REPORTS_DIR,
    artifactsDir: CONFIG.ARTIFACTS_DIR,
    chromePath: CHROME_EXECUTABLE,
    chromeExists: Boolean(CHROME_EXECUTABLE)
  };
  console.log(JSON.stringify(checks, null, 2));
  return checks;
}

module.exports = { LunaAgent, runAgent, diagnose, CONFIG };

if (require.main === module) {
  if (process.argv.includes('--diagnose')) {
    diagnose();
  } else if (process.argv.includes('--full-extract')) {
    runAgent({ once: true, schedule: false, fullExtract: true }).catch(e => {
      console.error('[KEEP-ALIVE] Erro:', e.message);
      console.log('[KEEP-ALIVE] Luna continua ativa. Pressione Ctrl+C para sair.');
    });
  } else {
    const agent = new LunaAgent();
    agent.init({ 
      once: process.argv.includes('--once'),
      fullExtract: process.argv.includes('--reset')
    }).catch((error) => {
      log.error(`Erro: ${error.message}`);
      console.log('[KEEP-ALIVE] Luna continua ativa. Pressione Ctrl+C para sair.');
    });
  }
}
