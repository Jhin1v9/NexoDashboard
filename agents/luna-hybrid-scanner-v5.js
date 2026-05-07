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
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
  ],
  CHROME_PROFILE: process.env.LOCALAPPDATA + '\\Google\\Chrome\\User Data',
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
// CHROME SESSION MANAGER v2 — Copia tudo com robocopy
// ============================================================
class ChromeSessionManager {
  constructor() {
    this.chromePath = null;
    this.chromeProcess = null;
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

  // Copiar perfil usando robocopy (mais confiavel)
  async copyProfileRobocopy() {
    log('info', '📂 Copiando perfil do Chrome (robocopy)...');

    // Limpar pasta anterior
    if (fs.existsSync(CONFIG.AUTOMATION_PROFILE)) {
      try {
        fs.rmSync(CONFIG.AUTOMATION_PROFILE, { recursive: true, force: true });
      } catch {}
    }

    return new Promise((resolve, reject) => {
      const robocopy = spawn('robocopy', [
        CONFIG.CHROME_PROFILE,
        CONFIG.AUTOMATION_PROFILE,
        '/E', '/COPY:DAT', '/R:3', '/W:1', '/XD', 'Cache', 'Code Cache', 'GPUCache', 'Service Worker'
      ], { windowsHide: true });

      robocopy.on('close', (code) => {
        if (code === 0 || code === 1) {
          log('success', `✅ Perfil copiado para: ${CONFIG.AUTOMATION_PROFILE}`);
          resolve(true);
        } else {
          log('warn', `⚠️  Robocopy retornou codigo ${code}, tentando metodo alternativo...`);
          resolve(false);
        }
      });

      robocopy.on('error', () => {
        log('warn', '⚠️  Robocopy nao disponivel, tentando copia manual...');
        resolve(false);
      });
    });
  }

  // Copia manual como fallback
  async copyProfileManual() {
    log('info', '📂 Copiando perfil (metodo manual)...');

    const copyRecursive = (src, dest) => {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }

      const entries = fs.readdirSync(src, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        // Pular pastas de cache
        if (['Cache', 'Code Cache', 'GPUCache', 'Service Worker', 'IndexedDB'].includes(entry.name)) {
          continue;
        }

        if (entry.isDirectory()) {
          copyRecursive(srcPath, destPath);
        } else {
          try {
            fs.copyFileSync(srcPath, destPath);
          } catch (err) {
            // Ignorar arquivos em uso
          }
        }
      }
    };

    try {
      copyRecursive(CONFIG.CHROME_PROFILE, CONFIG.AUTOMATION_PROFILE);
      log('success', `✅ Perfil copiado`);
      return true;
    } catch (err) {
      log('error', `❌ Erro na copia: ${err.message}`);
      return false;
    }
  }

  async launchChromeWithSession() {
    log('info', '🔌 Iniciando Chrome com sessao...');

    // Verificar se CDP ja esta ativo
    const cdpActive = await this.isCDPActive();
    if (cdpActive) {
      log('success', '✅ Chrome CDP ja ativo');
      return true;
    }

    if (!this.findChrome()) return false;

    // Copiar perfil
    let copied = await this.copyProfileRobocopy();
    if (!copied) {
      copied = await this.copyProfileManual();
    }

    // Fechar Chrome
    log('info', '🔒 Fechando Chrome...');
    try {
      exec('taskkill /F /IM chrome.exe', () => {});
      await new Promise(r => setTimeout(r, 4000));
    } catch {}

    // Lançar Chrome
    const args = [
      `--remote-debugging-port=${CONFIG.CDP_PORT}`,
      `--user-data-dir=${CONFIG.AUTOMATION_PROFILE}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      'https://web.whatsapp.com'
    ];

    log('info', '🚀 Lançando Chrome...');
    this.chromeProcess = spawn(this.chromePath, args, {
      detached: true,
      windowsHide: false
    });

    log('info', `   Chrome PID: ${this.chromeProcess.pid}`);

    // Aguardar CDP
    let attempts = 0;
    while (attempts < 30) {
      await new Promise(r => setTimeout(r, 1000));
      const active = await this.isCDPActive();
      if (active) {
        log('success', '✅ Chrome CDP ativo!');
        return true;
      }
      attempts++;
      process.stdout.write('.');
    }

    log('error', '❌ CDP nao respondeu');
    return false;
  }
}

// ============================================================
// PLAYWRIGHT SCANNER v2 — Espera WhatsApp carregar
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
    }

    log('success', '✅ Conectado ao Chrome');
    return true;
  }

  async waitForWhatsAppReady() {
    log('info', '⏳ Aguardando WhatsApp carregar...');

    // Esperar ate 60 segundos pelo WhatsApp
    let attempts = 0;
    while (attempts < 60) {
      try {
        // Verificar se esta na tela de QR ou ja logado
        const qrCode = await this.page.$('[data-testid="qr-code"]');
        const chatList = await this.page.$('[data-testid="cell-frame-container"]');
        const loading = await this.page.$('[data-testid="loading"]');

        if (chatList) {
          log('success', '✅ WhatsApp logado!');
          return true;
        }

        if (qrCode) {
          log('warn', '⚠️  QR Code detectado! Escaneie com seu WhatsApp:');
          log('info', '   Abra WhatsApp no celular → Ajustes → WhatsApp Web → Escanear');
          // Esperar usuario escanear
          await new Promise(r => setTimeout(r, 5000));
          continue;
        }

        if (loading) {
          log('info', '   Carregando...');
        }

      } catch (err) {
        // Pagina ainda carregando
      }

      await new Promise(r => setTimeout(r, 1000));
      attempts++;
      if (attempts % 10 === 0) process.stdout.write('.');
    }

    log('error', '❌ WhatsApp nao carregou em 60 segundos');
    return false;
  }

  async getChatList() {
    log('scan', '📱 Buscando chats...');

    // Esperar lista de chats aparecer
    await this.page.waitForSelector('[data-testid="cell-frame-container"]', { 
      timeout: 30000,
      state: 'visible'
    });

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
        log('info', `   📈 ${currentCount} mensagens...`);
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

      if (scrollCount % 10 === 0) process.stdout.write(` [${scrollCount}]`);
    }

    console.log('');
    log('success', `✅ Topo alcancado! ${lastMessageCount} mensagens`);
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
      log('info', '🔌 Desconectado');
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
      log('info', '🌙 LUNA HYBRID SCANNER v5.0');
      log('info', 'Robocopy + Espera WhatsApp carregar');
      log('info', '═══════════════════════════════════════════');

      // PASSO 1: Lançar Chrome
      const chromeReady = await this.chromeManager.launchChromeWithSession();
      if (!chromeReady) {
        log('error', '❌ Chrome nao iniciou');
        return;
      }

      // PASSO 2: Conectar Playwright
      await this.extractor.connect();

      // PASSO 3: Esperar WhatsApp (com QR code handling)
      const whatsappReady = await this.extractor.waitForWhatsAppReady();
      if (!whatsappReady) {
        log('error', '❌ WhatsApp nao ficou pronto');
        log('info', '💡 Dica: Escaneie o QR no celular e execute novamente');
        return;
      }

      // PASSO 4: Listar e processar chats
      const chats = await this.extractor.getChatList();
      const allowedChats = chats.filter(c => isAllowedChat(c.title));

      log('info', `🎯 ${allowedChats.length} chats autorizados`);

      if (allowedChats.length === 0) {
        log('warn', '⚠️ Nenhum chat autorizado!');
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
      log('info', '💡 Chrome mantido aberto');
    }
  }

  async saveResults() {
    log('info', '💾 Salvando...');
    const now = new Date().toISOString();

    const result = {
      messages: this.allMessages,
      groups: CONFIG.ALLOWED_CHATS,
      lastUpdated: now,
      scanInfo: {
        isFirstScan: this.isFirstScan,
        totalScanned: this.allMessages.length,
        scannedAt: now,
        engine: 'luna-hybrid-v5'
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
