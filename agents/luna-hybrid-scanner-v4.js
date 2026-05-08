const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const crypto = require('crypto');
const os = require('os');

// ============================================================
// CONFIGURACAO
// ============================================================
const CONFIG = {
  CDP_URL: 'http://127.0.0.1:9223',
  CDP_PORT: 9223,
  ALLOWED_CHATS: ['🏆Production - 2026🙏', 'Paulo (web)'],
  OUTPUT_FILE: path.join(__dirname, '../backend/data/whatsapp-agent-data.json'),
  BUFFER_FILE: path.join(__dirname, 'luna-buffer.json'),
  CHECKPOINT_FILE: path.join(__dirname, 'luna-checkpoint.json'),
  SCROLL_ATTEMPTS: 200,
  SCROLL_DELAY: 2000,
  CHROME_PATHS: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome SxS\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Chromium\\Application\\chrome.exe'
  ],
  // Perfil do Chrome onde o WhatsApp está logado
  CHROME_PROFILE: process.env.LOCALAPPDATA + '\\Google\\Chrome\\User Data',
  // Pasta temporária para o Chrome de automação (evita conflito com Chrome normal)
  AUTOMATION_PROFILE: path.join(os.tmpdir(), 'luna-chrome-profile')
};

// ============================================================
// UTILS
// ============================================================
function readJSON(file, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function writeJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function hashMsg(msg) {
  return crypto.createHash('sha256').update(msg.id + msg.body + msg.author).digest('hex').substring(0, 16);
}

function isAllowedChat(name) {
  if (!name) return false;
  const lower = name.toLowerCase();
  return CONFIG.ALLOWED_CHATS.some(a => lower.includes(a.toLowerCase().replace(/[🏆🙏]/g, '')));
}

function log(type, msg) {
  const colors = {
    info: '\x1b[36m', success: '\x1b[32m', warn: '\x1b[33m', 
    error: '\x1b[31m', scan: '\x1b[35m', reset: '\x1b[0m'
  };
  const timestamp = new Date().toISOString();
  console.log(`${colors[type] || ''}[${timestamp}] [${type.toUpperCase()}]${colors.reset} ${msg}`);
}

// ============================================================
// CHROME SESSION MANAGER — Reutiliza sessão logada
// ============================================================
class ChromeSessionManager {
  constructor() {
    this.chromePath = null;
    this.chromeProcess = null;
    this.userDataDir = null;
  }

  findChrome() {
    for (const chromePath of CONFIG.CHROME_PATHS) {
      if (fs.existsSync(chromePath)) {
        this.chromePath = chromePath;
        log('success', `✅ Chrome encontrado: ${chromePath}`);
        return true;
      }
    }
    log('error', '❌ Chrome nao encontrado!');
    return false;
  }

  async isCDPActive() {
    try {
      const http = require('http');
      return new Promise((resolve) => {
        const req = http.get(CONFIG.CDP_URL, (res) => {
          resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(2000, () => { req.abort(); resolve(false); });
      });
    } catch {
      return Promise.resolve(false);
    }
  }

  // Verificar se existe sessão do WhatsApp no perfil
  hasWhatsAppSession() {
    const whatsappStorage = path.join(CONFIG.CHROME_PROFILE, 'Default', 'Local Storage', 'leveldb');
    const hasStorage = fs.existsSync(whatsappStorage);

    const cookiesFile = path.join(CONFIG.CHROME_PROFILE, 'Default', 'Network', 'Cookies');
    const hasCookies = fs.existsSync(cookiesFile);

    log('info', `🔍 Perfil Chrome: ${CONFIG.CHROME_PROFILE}`);
    log('info', `   WhatsApp storage: ${hasStorage ? '✅' : '❌'}`);
    log('info', `   Cookies: ${hasCookies ? '✅' : '❌'}`);

    return hasStorage || hasCookies;
  }

  // Copiar perfil do Chrome para pasta de automação (evita conflito)
  async copyProfile() {
    log('info', '📂 Preparando perfil do Chrome...');

    // Criar pasta temporária
    if (!fs.existsSync(CONFIG.AUTOMATION_PROFILE)) {
      fs.mkdirSync(CONFIG.AUTOMATION_PROFILE, { recursive: true });
    }

    // Copiar apenas os arquivos necessários (cookies, local storage, session storage)
    const filesToCopy = [
      'Default/Cookies',
      'Default/Network/Cookies',
      'Default/Login Data',
      'Default/Preferences',
      'Default/Secure Preferences',
      'Default/Local Storage',
      'Default/Session Storage',
      'Default/Web Data',
      'Local State'
    ];

    for (const file of filesToCopy) {
      const src = path.join(CONFIG.CHROME_PROFILE, file);
      const dest = path.join(CONFIG.AUTOMATION_PROFILE, file);

      if (fs.existsSync(src)) {
        try {
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.copyFileSync(src, dest);
          log('info', `   ✅ Copiado: ${file}`);
        } catch (err) {
          log('warn', `   ⚠️  Erro ao copiar ${file}: ${err.message}`);
        }
      }
    }

    this.userDataDir = CONFIG.AUTOMATION_PROFILE;
    log('success', `✅ Perfil copiado para: ${this.userDataDir}`);
  }

  async launchChromeWithSession() {
    log('info', '🔌 Iniciando Chrome com sessao existente...');

    // Verificar se CDP ja esta ativo
    const cdpActive = await this.isCDPActive();
    if (cdpActive) {
      log('success', '✅ Chrome CDP ja esta ativo');
      return true;
    }

    // Encontrar Chrome
    if (!this.findChrome()) {
      return false;
    }

    // Verificar se tem sessao do WhatsApp
    const hasSession = this.hasWhatsAppSession();
    if (!hasSession) {
      log('warn', '⚠️  Nenhuma sessao do WhatsApp encontrada no Chrome');
      log('info', '💡 Abra o WhatsApp Web no Chrome e escaneie o QR primeiro');
    }

    // Copiar perfil
    await this.copyProfile();

    // Fechar Chrome existente (para evitar conflito de perfil)
    log('info', '🔒 Fechando Chrome existente...');
    try {
      exec('taskkill /F /IM chrome.exe', (error) => {
        if (!error) log('info', '   Chrome fechado');
      });
      await new Promise(r => setTimeout(r, 3000));
    } catch {}

    // Lançar Chrome com perfil copiado e CDP
    const args = [
      `--remote-debugging-port=${CONFIG.CDP_PORT}`,
      `--user-data-dir=${this.userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
      '--allow-running-insecure-content',
      '--disable-features=IsolateOrigins,site-per-process',
      'https://web.whatsapp.com'
    ];

    log('info', '🚀 Lançando Chrome...');
    this.chromeProcess = spawn(this.chromePath, args, {
      detached: true,
      windowsHide: false
    });

    log('info', `   Chrome iniciado (PID: ${this.chromeProcess.pid})`);

    // Aguardar CDP ficar disponível
    let attempts = 0;
    while (attempts < 30) {
      await new Promise(r => setTimeout(r, 1000));
      const active = await this.isCDPActive();
      if (active) {
        log('success', '✅ Chrome CDP ativo! WhatsApp deve estar logado.');
        return true;
      }
      attempts++;
      process.stdout.write('.');
    }

    log('error', '❌ CDP nao respondeu apos 30 segundos');
    return false;
  }

  stopChrome() {
    if (this.chromeProcess) {
      try {
        process.kill(this.chromeProcess.pid);
        log('info', '🔌 Chrome encerrado');
      } catch {}
    }
  }
}

// ============================================================
// PLAYWRIGHT SCANNER
// ============================================================
class PlaywrightExtractor {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async connect() {
    log('info', '🔌 Conectando no Chrome CDP...');
    this.browser = await chromium.connectOverCDP(CONFIG.CDP_URL);
    const context = this.browser.contexts()[0];
    const pages = context.pages();

    this.page = pages.find(p => p.url().includes('web.whatsapp.com'));
    if (!this.page) {
      this.page = pages[0];
      log('warn', '⚠️  WhatsApp Web nao encontrado, usando primeira aba');
    }

    log('success', '✅ Conectado ao Chrome');
    return true;
  }

  async getChatList() {
    log('scan', '📱 Buscando chats...');
    await this.page.waitForSelector('[data-testid="cell-frame-container"]', { timeout: 10000 });

    const chats = await this.page.evaluate(() => {
      const items = document.querySelectorAll('[data-testid="cell-frame-container"]');
      return Array.from(items).map(item => {
        const titleEl = item.querySelector('span[title]');
        return { title: titleEl?.getAttribute('title') || '' };
      }).filter(c => c.title);
    });

    log('info', `📊 ${chats.length} chats encontrados`);
    return chats;
  }

  async openChat(chatTitle) {
    log('scan', `🎯 Abrindo: ${chatTitle}`);

    await this.page.evaluate((title) => {
      const items = document.querySelectorAll('[data-testid="cell-frame-container"]');
      for (const item of items) {
        const t = item.querySelector('span[title]');
        const itemTitle = t?.getAttribute('title') || '';
        if (itemTitle.toLowerCase().includes(title.toLowerCase().replace(/[🏆🙏]/g, ''))) {
          item.scrollIntoView({ behavior: 'instant', block: 'center' });
          item.click();
          return true;
        }
      }
      return false;
    }, chatTitle);

    await this.page.waitForTimeout(3000);
    log('success', `✅ Chat aberto: ${chatTitle}`);
  }

  async scrollToTop() {
    log('scan', '⬆️ Rolando para o topo...');

    let scrollCount = 0;
    let lastMessageCount = 0;
    let stableCount = 0;

    while (scrollCount < CONFIG.SCROLL_ATTEMPTS && stableCount < 5) {
      const currentCount = await this.page.evaluate(() => {
        return document.querySelectorAll('.message-in, .message-out').length;
      });

      if (currentCount === lastMessageCount) {
        stableCount++;
      } else {
        stableCount = 0;
        lastMessageCount = currentCount;
        log('info', `   📈 ${currentCount} mensagens carregadas...`);
      }

      await this.page.evaluate(() => {
        const container = document.querySelector('#main .copyable-area, [data-testid="conversation-panel-messages"]');
        if (container) container.scrollTo({ top: 0, behavior: 'instant' });
        window.scrollTo(0, 0);
        const scrollEvent = new WheelEvent('wheel', { deltaY: -1000, bubbles: true });
        document.dispatchEvent(scrollEvent);
      });

      await this.page.waitForTimeout(CONFIG.SCROLL_DELAY);
      scrollCount++;

      if (scrollCount % 10 === 0) {
        process.stdout.write(` [${scrollCount}/${CONFIG.SCROLL_ATTEMPTS}]`);
      }
    }

    console.log('');
    log('success', `✅ Topo alcancado! ${lastMessageCount} mensagens no DOM`);
    return lastMessageCount;
  }

  async extractMessages() {
    log('scan', '📖 Extraindo mensagens...');

    const messages = await this.page.evaluate(() => {
      const msgs = document.querySelectorAll('.message-in, .message-out');
      return Array.from(msgs).map((msg, index) => {
        let textEl = null;
        const selectors = [
          '.selectable-text span',
          '.copyable-text span', 
          '[data-testid="msg-text"] span',
          '.message-text span',
          'span[dir="ltr"]'
        ];
        for (const sel of selectors) {
          textEl = msg.querySelector(sel);
          if (textEl && textEl.textContent.trim()) break;
        }

        let author = 'Desconhecido';
        const authorEl = msg.querySelector('[data-pre-plain-text]');
        if (authorEl) {
          const preText = authorEl.getAttribute('data-pre-plain-text') || '';
          const match = preText.match(/\]([^:]+):/);
          if (match) author = match[1].trim();
        }

        const timeEl = msg.querySelector('._ao3e, [data-testid="msg-meta"]');
        const timestamp = timeEl?.textContent || '';
        const id = msg.getAttribute('data-id') || `msg-${index}-${Date.now()}`;
        const fromMe = msg.classList.contains('message-out');

        return {
          id,
          body: textEl?.textContent?.trim() || '',
          author,
          fromMe,
          timestamp,
          type: fromMe ? 'me' : 'in'
        };
      }).filter(m => m.body && !m.fromMe);
    });

    log('success', `✅ ${messages.length} mensagens extraidas`);
    return messages;
  }

  async disconnect() {
    if (this.browser) {
      await this.browser.disconnect();
      log('info', '🔌 Desconectado do Chrome');
    }
  }
}

// ============================================================
// ENGINE PRINCIPAL
// ============================================================
class LunaHybridScanner {
  constructor() {
    this.checkpoint = readJSON(CONFIG.CHECKPOINT_FILE, { hashes: [], lastScan: null, version: '14.1' });
    this.isFirstScan = !this.checkpoint.lastScan || this.checkpoint.hashes.length === 0;
    this.allMessages = [];
    this.processedHashes = new Set(this.checkpoint.hashes || []);
    this.extractor = new PlaywrightExtractor();
    this.chromeManager = new ChromeSessionManager();
  }

  async run() {
    const startTime = Date.now();

    try {
      log('info', '═══════════════════════════════════════════');
      log('info', '🌙 LUNA HYBRID SCANNER v4.0');
      log('info', 'Reutiliza sessao do Chrome logado');
      log('info', '═══════════════════════════════════════════');
      log('info', `Modo: ${this.isFirstScan ? '🆕 PRIMEIRA VEZ (ler TUDO)' : '📌 INCREMENTAL (so novas)'}`);

      // PASSO 1: Lançar Chrome com sessao existente
      const chromeReady = await this.chromeManager.launchChromeWithSession();
      if (!chromeReady) {
        log('error', '❌ Nao foi possivel iniciar Chrome');
        return;
      }

      // PASSO 2: Conectar Playwright
      await this.extractor.connect();

      // PASSO 3: Listar e processar chats
      const chats = await this.extractor.getChatList();
      const allowedChats = chats.filter(c => isAllowedChat(c.title));

      log('info', `🎯 ${allowedChats.length} chats autorizados`);

      if (allowedChats.length === 0) {
        log('warn', '⚠️ Nenhum chat autorizado! Chats disponiveis:');
        chats.forEach(c => log('info', `  - ${c.title}`));
        return;
      }

      for (const chat of allowedChats) {
        log('info', `\n📂 ${chat.title}`);
        await this.extractor.openChat(chat.title);
        await this.extractor.scrollToTop();
        const rawMessages = await this.extractor.extractMessages();

        let newMessages = rawMessages;
        if (!this.isFirstScan) {
          newMessages = rawMessages.filter(m => {
            const h = hashMsg(m);
            return !this.processedHashes.has(h);
          });
          log('info', `📌 ${newMessages.length} novas`);
        } else {
          log('info', `🆕 ${rawMessages.length} mensagens (primeira vez)`);
        }

        this.allMessages.push(...newMessages);
        for (const m of newMessages) {
          this.processedHashes.add(hashMsg(m));
        }

        log('success', `✅ ${chat.title}: ${newMessages.length} mensagens`);
      }

      await this.saveResults();

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      log('info', '\n═══════════════════════════════════════════');
      log('success', `🎉 SCAN COMPLETO! ${this.allMessages.length} mensagens em ${duration}s`);
      log('info', '═══════════════════════════════════════════');

    } catch (error) {
      log('error', `❌ ERRO: ${error.message}`);
      console.error(error.stack);
    } finally {
      await this.extractor.disconnect();
      log('info', '💡 Chrome mantido aberto (sessao preservada)');
    }
  }

  async saveResults() {
    log('info', '💾 Salvando resultados...');
    const now = new Date().toISOString();

    const result = {
      messages: this.allMessages,
      groups: CONFIG.ALLOWED_CHATS,
      lastUpdated: now,
      scanInfo: {
        isFirstScan: this.isFirstScan,
        totalScanned: this.allMessages.length,
        scannedAt: now,
        engine: 'luna-hybrid-v4'
      },
      stats: {
        total: this.allMessages.length,
        tasks: this.allMessages.filter(m => /tarefa|task|fazer|precisamos|implementar|bug|corrigir/i.test(m.body)).length,
        ideas: this.allMessages.filter(m => /ideia|sugestao|melhorar|feature|nova funcionalidade/i.test(m.body)).length,
        decisions: this.allMessages.filter(m => /decidido|vamos|concordo|aprovar|ok|confirmado/i.test(m.body)).length,
        links: this.allMessages.filter(m => /https?:\/\//i.test(m.body)).length,
        mentions: this.allMessages.filter(m => /@(?:KIMI|LUNA|KIMICLAW|NEXO)/i.test(m.body)).length
      }
    };

    writeJSON(CONFIG.OUTPUT_FILE, result);
    log('success', `✅ Salvo em: ${CONFIG.OUTPUT_FILE}`);

    const buffer = {
      newMessages: this.allMessages,
      newTasks: [],
      newIdeas: [],
      newDecisions: [],
      newLinks: [],
      newMentions: [],
      lastBufferUpdate: now
    };
    writeJSON(CONFIG.BUFFER_FILE, buffer);
    log('success', `✅ Buffer sincronizado`);

    this.checkpoint.lastScan = now;
    this.checkpoint.hashes = Array.from(this.processedHashes);
    this.checkpoint.version = '14.1';
    writeJSON(CONFIG.CHECKPOINT_FILE, this.checkpoint);
    log('success', `✅ Checkpoint: ${this.processedHashes.size} hashes`);
  }
}

// ============================================================
// EXECUCAO
// ============================================================
if (require.main === module) {
  const scanner = new LunaHybridScanner();
  scanner.run().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { LunaHybridScanner, CONFIG, ChromeSessionManager };
