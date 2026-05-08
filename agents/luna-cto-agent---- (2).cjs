// ============================================================
// LUNA v15.1 "VISION EXTRACTOR" — CORRIGIDO
// Sem erros de sintaxe, sem fechar shell, keep-alive ativo
// ============================================================

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Playwright importado no topo (não dinamicamente)
let chromium = null;
try {
  chromium = require('playwright').chromium;
} catch (e) {
  console.error('❌ Playwright não instalado! Execute: npm install playwright');
  console.error(e.message);
}

// ============================================================
// CONFIGURAÇÃO v15.1
// ============================================================
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
  SCROLL_WAIT: 2000,
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
        await this.browser.disconnect();
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

    log.playwright('Iniciando scroll infinito ate o topo...');
    let scrollCount = 0;
    let lastHeight = 0;
    let stableCount = 0;

    while (scrollCount < CONFIG.MAX_SCROLLS) {
      const currentScroll = await this.page.evaluate(() => {
        const chat = document.querySelector('[data-testid="conversation-panel-messages"]');
        return chat ? chat.scrollHeight : 0;
      });

      if (currentScroll === lastHeight) {
        stableCount++;
        if (stableCount >= 3) {
          log.success(`Fim do historico detectado apos ${scrollCount} scrolls`);
          break;
        }
      } else {
        stableCount = 0;
        lastHeight = currentScroll;
      }

      await this.page.evaluate(() => {
        const chat = document.querySelector('[data-testid="conversation-panel-messages"]');
        if (chat) chat.scrollTop = 0;
      });

      await this.page.keyboard.press('PageUp');

      scrollCount++;
      log.playwright(`Scroll ${scrollCount}/${CONFIG.MAX_SCROLLS} — altura: ${currentScroll}`);

      await this.page.waitForTimeout(CONFIG.SCROLL_WAIT);
    }

    return scrollCount;
  }

  async extractMessages() {
    if (!this.page) return [];

    log.extract('Extraindo mensagens do DOM...');

    const messages = await this.page.evaluate(() => {
      const msgs = [];
      const elements = document.querySelectorAll('[data-testid="msg-container"]');

      elements.forEach(el => {
        try {
          const authorEl = el.querySelector('[data-testid="msg-meta"] span') || 
                          el.querySelector('.copyable-text[data-pre-plain-text]');
          let author = 'Desconhecido';
          if (authorEl) {
            const preText = authorEl.getAttribute('data-pre-plain-text');
            if (preText) {
              const match = preText.match(/\[(.*?)\]/);
              if (match) author = match[1];
            }
          }

          const textEl = el.querySelector('.selectable-text.copyable-text');
          const text = textEl ? textEl.innerText : '';

          const timeEl = el.querySelector('[data-testid="msg-meta"]');
          const time = timeEl ? timeEl.innerText : '';

          const hasImage = el.querySelector('[data-testid="image-x-generic"]') !== null;
          const hasLink = /https?:\/\//.test(text);
          const type = hasImage ? 'image' : hasLink ? 'link' : 'text';

          const id = el.getAttribute('data-id') || Math.random().toString(36).substr(2, 9);

          msgs.push({ id, author, text, time, type });
        } catch (e) { /* ignora elementos quebrados */ }
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

// ============================================================
// CLASSIFICADOR INTELIGENTE v15.1
// ============================================================
class SmartClassifier {
  constructor() {
    this.knownClients = ['santafe', 'santa fe', 'paulo', 'sorveteria', 'superclim', 'nexo'];

    this.patterns = {
      tarefaRealizada: /\b(subi|fiz|pronto|terminado|deploy|enviei|mandei|atualizei|corrigir|fix|resolvido|concluido|done|finished|complete)\b/i,
      tarefaPendente: /\b(precisamos|falta|urgente|fazer|implementar|criar|build|desenvolver|corrigir|arrumar|consertar|pendente|todo|falta fazer)\b/i,
      feedbackPositivo: /\b(bonito|gostei|show|top|perfeito|excelente|otimo|genial|massa|legal|bom|boa|incrivel|fantastico)\b/i,
      feedbackNegativo: /\b(ruim|nao gostei|errado|bug|problema|falha|quebrado|lento|travando)\b/i,
      ideiaNova: /\b(que tal|e se|poderiamos|sugestao|ideia|proposta|seria bom|interessante|que acha|o que acha|podemos|vamos fazer)\b/i,
      decisao: /\b(vamos|decidimos|ficou acordado|aprovado|confirmado|bora|vai ser|sera|definido|ok|okay|fechado|combinado)\b/i,
      financeiro: /\b(pagou|nao pagou|fatura|caixa|dinheiro|custo|preco|valor|orcamento|pressupuesto|budget|invoice|receita|despesa)\b/i,
      lead: /\b(orcamento|proposta|preco|pressupuesto|custo|interessado|queria|gostaria|preciso de|necessito|contato|fale com|ligar para)\b/i
    };
  }

  classify(msg) {
    const text = (msg.text || msg.body || '').toLowerCase();
    const author = (msg.author || msg.from || '').toLowerCase();

    const urls = text.match(/(https?:\/\/[^\s]+)/g) || [];
    const mentionedClient = this.knownClients.find(c => text.includes(c));
    const hasLeadWords = this.patterns.lead.test(text);
    const possibleNewClient = hasLeadWords && !mentionedClient ? this.extractName(text) : null;

    const scores = {
      tarefaRealizada: this.patterns.tarefaRealizada.test(text) ? 2 : 0,
      tarefaPendente: this.patterns.tarefaPendente.test(text) ? 2 : 0,
      feedbackPositivo: this.patterns.feedbackPositivo.test(text) ? 2 : 0,
      feedbackNegativo: this.patterns.feedbackNegativo.test(text) ? 2 : 0,
      ideiaNova: this.patterns.ideiaNova.test(text) ? 2 : 0,
      decisao: this.patterns.decisao.test(text) ? 2 : 0,
      financeiro: this.patterns.financeiro.test(text) ? 2 : 0,
      link: urls.length > 0 ? 2 : 0,
      cliente: mentionedClient ? 1 : 0,
      lead: possibleNewClient ? 3 : 0
    };

    const entries = Object.entries(scores).filter(([k, v]) => v > 0);
    entries.sort((a, b) => b[1] - a[1]);

    const primaryCategory = entries.length > 0 ? entries[0][0] : 'noticia';

    const labels = {
      tarefaRealizada: { icon: '✅', label: 'Tarefa Realizada', priority: 'medium' },
      tarefaPendente: { icon: '📋', label: 'Tarefa Pendente', priority: 'high' },
      feedbackPositivo: { icon: '👍', label: 'Feedback Positivo', priority: 'low' },
      feedbackNegativo: { icon: '👎', label: 'Feedback Negativo', priority: 'high' },
      ideiaNova: { icon: '💡', label: 'Ideia Nova', priority: 'medium' },
      decisao: { icon: '🎯', label: 'Decisao', priority: 'medium' },
      financeiro: { icon: '💰', label: 'Financeiro', priority: 'high' },
      link: { icon: '🔗', label: 'Link Importante', priority: 'medium' },
      cliente: { icon: '👤', label: 'Mencao Cliente', priority: 'medium' },
      lead: { icon: '🎣', label: 'Possivel Cliente', priority: 'high' },
      noticia: { icon: '📰', label: 'Noticia', priority: 'low' }
    };

    const labelInfo = labels[primaryCategory] || labels.noticia;

    return {
      category: primaryCategory,
      icon: labelInfo.icon,
      label: labelInfo.label,
      priority: labelInfo.priority,
      scores,
      urls,
      mentionedClient,
      possibleNewClient,
      text: text.slice(0, 200),
      author: msg.author || msg.from || 'Desconhecido',
      timestamp: msg.time || msg.timestamp || new Date().toISOString()
    };
  }

  extractName(text) {
    const match = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:orcamento|proposta|preco|pressupuesto|interessado)/i);
    return match ? match[1] : null;
  }
}

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
    this.classifier = new SmartClassifier();
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
        executablePath: 'C:\Program Files\Google\Chrome\Application\chrome.exe'
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
      if (msg.fromMe) return;

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
            const classified = this.classifier.classify(msg);
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
        const classified = newMessages.map(m => ({
          ...m,
          classification: this.classifier.classify(m)
        }));

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
    chromePath: 'C:\Program Files\Google\Chrome\Application\chrome.exe',
    chromeExists: fs.existsSync('C:\Program Files\Google\Chrome\Application\chrome.exe')
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
