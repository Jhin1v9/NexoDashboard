// ============================================================
// LUNA v15.1 "VISION EXTRACTOR" — CORRIGIDO
// Sem erros de sintaxe, sem fechar shell, keep-alive ativo
// ============================================================

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { LunaBrain } = require('./LunaBrain_v16.js');
const { SmartClassifier, resolveAuthor } = require('./SmartClassifier_v16.js');

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

// =====================================================  ← (linha 21 original)
// CONFIGURAÇÃO v15.1
// =====================================================

const isAuthorizedChat = (name) => {
  const n = (name || '').trim().toLowerCase();
  return n.includes('production') || n.includes('paulo');
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
    { name: 'Production', type: 'internal' },
    { name: 'Paulo', type: 'client' }
  ],
  SCAN_INTERVAL: 10 * 60 * 1000,
  REPORT_INTERVAL: 30 * 60 * 1000,
  MAX_SILENCE_REPORTS: 1,
  MAX_SCROLLS: 50,
  CDP_PORT: 9222,
  CDP_TIMEOUT: 30000,
  SCROLL_WAIT: 300,
  SCROLL_STABLE_TIME: 5000,

  CHECKPOINT_FILE: path.join(__dirname, '../backend/data/luna-checkpoint.json'),
  BUFFER_FILE: path.join(__dirname, '../backend/data/luna-buffer.json'),
  OUTPUT_FILE: path.join(__dirname, '../backend/data/whatsapp-agent-data.json'),
  FULL_EXTRACT_FILE: path.join(__dirname, '../backend/data/full-extract.json'),
  NEWS_FILE: path.join(__dirname, '../backend/data/nexo-news.json'),
  REPORTS_DIR: path.join(__dirname, '../backend/data/reports'),
  ARTIFACTS_DIR: path.join(__dirname, '../ARTIFACTS'),
  DEBUG_DIR: path.join(__dirname, '../ARTIFACTS/debug')
};

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
      lastBufferUpdate: null
    });
  }

  load(file, def) {
    try {
      if (fs.existsSync(file)) {
        const d = JSON.parse(fs.readFileSync(file, 'utf8'));
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
            const preText = el.getAttribute('data-pre-plain-text');
            if (preText) {
              const match = preText.match(/\[(.*?)\]/);
              if (match) author = match[1];
            }
            const timeEl = el.querySelector('[data-testid="msg-meta"], .msg-time');
            const time = timeEl ? timeEl.innerText : '';
            const id = el.getAttribute('data-id') || (text + author + time).slice(0, 50);
            if (text || id) msgs.push({ id, author, text, time });
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
          const preText = el.getAttribute('data-pre-plain-text');
          if (preText) {
            const match = preText.match(/\[(.*?)\]/);
            if (match) author = match[1];
          }
          const timeEl = el.querySelector('[data-testid="msg-meta"], .msg-time');
          const time = timeEl ? timeEl.innerText : '';
          const id = el.getAttribute('data-id') || (text + author + time).slice(0, 50);
          if (text || id) msgs.push({ id, author, text, time });
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
      model: 'gemma2:2b',
      host: 'http://localhost:11434'
    });
    this.linkAnalyzer = new LinkAnalyzer();
    this.extractor = new PlaywrightExtractor();
    this.client = null;
    this.ready = false;
    this.lastReport = null;
    this.reportGroup = null;
    this.running = false;
    this.fullExtractRunning = false;
  }

  async init(options = {}) {
    const { once = false, schedule = true, fullExtract = false } = options;
    log.extraordinary('=== LUNA v15.1 "VISION EXTRACTOR" ===');
    log.info('whatsapp-web.js + Playwright CDP hibrido');

    this.client = new Client({
      authStrategy: new LocalAuth({ clientId: 'luna-main', dataPath: SESSION_DATA_PATH, rmMaxRetries: 1 }),
      puppeteer: {
        headless: false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          `--remote-debugging-port=${CONFIG.CDP_PORT}`
        ],
        executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'
      }
    });

    this.client.on('qr', (qr) => {
      log.warn('QR Code! Escaneie:');
      qrcode.generate(qr, { small: true });
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

          const result = await this.startMonitoring({ schedule: schedule && !once });
          if (once) { log.info('Modo once: mantendo sessao aberta.'); }
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });

        this.client.on('message_create', async (msg) => {
      
      if (msg.fromMe && !msg.body.startsWith('/')) return;

      const body = (msg.body || '').toLowerCase();
      const isMention = /@luna|@kimi|@kimiclaw/.test(body);

      if (isMention) {
        log.info(`MENCAO de ${msg.pushname || msg.from}: ${(msg.body || '').slice(0, 80)}`);
        await this.handleMention(msg);
      }

      if (body.startsWith('/')) {
        await this.handleCommand(msg);
      }
    });

    this.client.on('auth_failure', (msg) => log.error(`Auth: ${msg}`));
    this.client.on('disconnected', (reason) => { log.warn(`Desconectado: ${reason}`); this.ready = false; });

    await this.client.initialize();
    return readyPromise;
  }

  async handleMention(msg) {
    const body = msg.body || '';
    const lowerBody = body.toLowerCase();

    let response = '';
    const buffer = this.cp.buffer;
    const pendingTasks = buffer.newTasks?.length || 0;
    const newLinks = buffer.newLinks?.length || 0;
    const newIdeas = buffer.newIdeas?.length || 0;

    if (/status|projeto|andamento|fase|como ta|como esta/.test(lowerBody)) {
      response = `📊 *STATUS ATUAL*\n\n`;
      response += `📝 Tarefas pendentes: ${pendingTasks}\n`;
      response += `💡 Ideias novas: ${newIdeas}\n`;
      response += `🔗 Links novos: ${newLinks}\n\n`;

      if (pendingTasks > 0) {
        const topTask = buffer.newTasks[0];
        response += `⚡ Prioridade: ${(topTask.body || topTask.text || '').slice(0, 60)}...\n\n`;
      }

      response += `Quer que eu gere um relatorio completo? Use /relatorio`;
    }
    else if (/cliente|santafe|paulo|superclim|sorveteria/.test(lowerBody)) {
      const clientMentions = buffer.newMessages?.filter(m => 
        /santafe|paulo|superclim|sorveteria/.test((m.body || m.text || '').toLowerCase())
      ) || [];

      response = `👤 *CLIENTES*\n\n`;
      response += `Mencionados recentemente: ${clientMentions.length}x\n\n`;

      if (clientMentions.length === 0) {
        response += `Nenhum cliente mencionado recentemente. Alguma noticia?`;
      } else {
        response += `Ultima mencao: ${(clientMentions[clientMentions.length - 1].body || '').slice(0, 80)}...`;
      }
    }
    else if (/dinheiro|pagamento|fatura|caixa|financeiro|pago|nao pagou/.test(lowerBody)) {
      const financeMsgs = buffer.newMessages?.filter(m =>
        /pagou|fatura|caixa|dinheiro|custo|preco/.test((m.body || m.text || '').toLowerCase())
      ) || [];

      response = `💰 *FINANCAS*\n\n`;
      if (financeMsgs.length > 0) {
        response += `Encontrei ${financeMsgs.length} mencao(oes) financeira(s).\n`;
        response += `Ultima: ${(financeMsgs[financeMsgs.length - 1].body || '').slice(0, 80)}...\n\n`;
      } else {
        response += `Nenhuma atualizacao financeira recente.\n`;
        response += `O caixa esta atualizado? Tem alguma fatura pendente?\n\n`;
      }
      response += `Use /relatorio para ver detalhes.`;
    }
    else {
      response = `🌙 Oi! Vi que me mencionou.\n\n`;
      response += `Atualmente no dashboard:\n`;
      response += `• ${pendingTasks} tarefas pendentes\n`;
      response += `• ${newIdeas} ideias para explorar\n`;
      response += `• ${newLinks} links para revisar\n\n`;
      response += `O que voce precisa? Posso:\n`;
      response += `/status — Projetos\n`;
      response += `/relatorio — Relatorio completo\n`;
      response += `/tarefas — Ver tarefas\n`;
      response += `Ou me pergunte sobre clientes, financas, ou links!`;
    }

    try {
      await msg.reply(response);
      log.success('Resposta inteligente enviada!');
    } catch (err) {
      log.error(`Falha ao responder: ${err.message}`);
    }
  }

  async handleCommand(msg) {
    const cmd = msg.body.toLowerCase();

    if (cmd === '/status') {
      const buffer = this.cp.buffer;
      await msg.reply(`📊 *STATUS NEXO*\n\n🟢 Projetos ativos: ${buffer.newTasks?.length || 0}\n💡 Ideias: ${buffer.newIdeas?.length || 0}\n🔗 Links: ${buffer.newLinks?.length || 0}\n📰 News: ${buffer.newNews?.length || 0}\n🎣 Leads: ${buffer.newLeads?.length || 0}\n\n🤖 Luna v15.1`);
    }
    else if (cmd === '/relatorio') {
      await msg.reply('📊 Gerando relatorio inteligente...');
      await this.forceReport(msg.from);
    }
    else if (cmd === '/tarefas') {
      const tasks = this.cp.buffer.newTasks || [];
      const list = tasks.length > 0 ? tasks.slice(0, 5).map(t => `• [${t.priority || 'P2'}] ${(t.body || t.text || '').slice(0, 50)}`).join('\n') : 'Nenhuma tarefa pendente.';
      await msg.reply(`📝 *TAREFAS*\n\n${list}\n\n🤖 Luna v15.1`);
    }
    else if (cmd === '/extrair') {
      await msg.reply('🔄 Iniciando extracao completa...');
      await this.runFullExtract();
      await msg.reply('✅ Extracao completa finalizada!');
    }
    else if (cmd === '/ajuda') {
      await msg.reply('🌙 *AJUDA LUNA v15.1*\n\n/status — Projetos\n/relatorio — Relatorio\n/tarefas — Tarefas\n/extrair — Extrair tudo\n/ajuda — Este menu\n\nMencione @Luna para falar! Posso responder sobre clientes, financas, links e status.');
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
      this.cp.markFullExtractDone();
      this.cp.save();

      log.extraordinary('=== EXTRACAO COMPLETA FINALIZADA ===');

    } catch (e) {
      log.error(`Erro na extracao completa: ${e.message}`);
    } finally {
      await this.extractor.disconnect();
      this.fullExtractRunning = false;
    }
  }

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
    for (const item of classified) {
      const c = item.classification;

      switch (c.category) {
        case 'tarefaRealizada':
        case 'tarefaPendente':
          this.cp.buffer.newTasks.push({
            body: item.text,
            author: item.author,
            priority: c.priority,
            time: item.timestamp
          });
          break;
        case 'ideiaNova':
          this.cp.buffer.newIdeas.push({ body: item.text, author: item.author, time: item.timestamp });
          break;
        case 'decisao':
          this.cp.buffer.newDecisions.push({ body: item.text, author: item.author, time: item.timestamp });
          break;
        case 'link':
          this.cp.buffer.newLinks.push({ url: c.urls[0], context: item.text, author: item.author, time: item.timestamp });
          break;
        case 'lead':
          this.cp.buffer.newLeads.push({ name: c.possibleNewClient, context: item.text, author: item.author, time: item.timestamp });
          break;
        case 'noticia':
        default:
          this.cp.buffer.newNews.push({ body: item.text, author: item.author, time: item.timestamp, chat: item.chatName });
          break;
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
    }

    return { status: 'monitoring' };
  }

  async sendScheduledReport() {
    const buffer = this.cp.buffer;
    const hasNews = buffer.newMessages?.length > 0 || 
                   buffer.newTasks?.length > 0 || 
                   buffer.newIdeas?.length > 0 ||
                   buffer.newLinks?.length > 0 ||
                   buffer.newLeads?.length > 0;

    if (!hasNews) {
      this.cp.checkpoint.silenceCount = (this.cp.checkpoint.silenceCount || 0) + 1;

      if (this.cp.checkpoint.silenceCount === 1 && this.reportGroup) {
        await this.reportGroup.sendMessage(`🌙 *LUNA REPORT*\n\n🔇 Sem novidades nos ultimos 30 minutos.\n\n🤖 Luna v15.1`);
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
    report += `• ${buffer.newNews?.length || 0} noticias\n\n`;

    report += `❓ *O QUE NAO VI:*\n`;
    const clientMentions = buffer.newMessages?.filter(m => /santafe|paulo|superclim/.test((m.body || '').toLowerCase())) || [];
    if (clientMentions.length === 0) {
      report += `• Nenhuma mencao a clientes principais. E o Santafe? Alguma noticia?\n`;
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

    report += `🤖 Luna v15.1 | ${new Date().toLocaleString('pt-BR')}`;

    if (this.reportGroup) {
      await this.reportGroup.sendMessage(report);
      log.success('Relatorio inteligente enviado!');
    }

    this.cp.buffer.newMessages = [];
    this.cp.buffer.newTasks = [];
    this.cp.buffer.newIdeas = [];
    this.cp.buffer.newLinks = [];
    this.cp.buffer.newDecisions = [];
    this.cp.buffer.newMentions = [];
    this.cp.buffer.newNews = [];
    this.cp.buffer.newLeads = [];
    this.cp.checkpoint.silenceCount = 0;
    this.cp.checkpoint.lastReport = new Date().toISOString();
    this.cp.save();
  }

  async forceReport(to) {
    await this.sendScheduledReport();
  }

  async notifyOps(data) {
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
    chromePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    chromeExists: fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')
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
