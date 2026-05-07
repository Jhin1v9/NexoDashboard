const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ============================================================
// CONFIGURACAO
// ============================================================
const CONFIG = {
  CDP_URL: 'http://127.0.0.1:9223',
  ALLOWED_CHATS: ['🏆Production - 2026🙏', 'Paulo (web)'],
  OUTPUT_FILE: path.join(__dirname, '../backend/data/whatsapp-agent-data.json'),
  BUFFER_FILE: path.join(__dirname, 'luna-buffer.json'),
  CHECKPOINT_FILE: path.join(__dirname, 'luna-checkpoint.json'),
  SCROLL_ATTEMPTS: 200,
  SCROLL_DELAY: 2000,
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
  console.log(`${colors[type] || ''}[${type.toUpperCase()}]${colors.reset} ${msg}`);
}

// ============================================================
// PLAYWRIGHT SCANNER — Rola pra cima e extrai TUDO
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
      throw new Error('WhatsApp Web nao encontrado no Chrome! Abra o WhatsApp Web primeiro.');
    }

    log('success', '✅ WhatsApp Web conectado via CDP');
    return true;
  }

  async getChatList() {
    log('scan', '📱 Buscando chats na sidebar...');
    await this.page.waitForSelector('[data-testid="cell-frame-container"]', { timeout: 10000 });

    const chats = await this.page.evaluate(() => {
      const items = document.querySelectorAll('[data-testid="cell-frame-container"]');
      return Array.from(items).map(item => {
        const titleEl = item.querySelector('span[title]');
        return {
          title: titleEl?.getAttribute('title') || titleEl?.textContent || '',
        };
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
        const itemTitle = t?.getAttribute('title') || t?.textContent || '';
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
    log('scan', '⬆️ Rolando para o topo (modo rigoroso)...');

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

      // Estrategia de scroll rigorosa: 3 metodos simultaneos
      await this.page.evaluate(() => {
        // Metodo 1: Scroll no container principal
        const container = document.querySelector('#main .copyable-area, [data-testid="conversation-panel-messages"]');
        if (container) {
          container.scrollTo({ top: 0, behavior: 'instant' });
        }

        // Metodo 2: Scroll na janela
        window.scrollTo(0, 0);

        // Metodo 3: Simular scroll wheel
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
    log('scan', '📖 Extraindo mensagens do DOM...');

    const messages = await this.page.evaluate(() => {
      const msgs = document.querySelectorAll('.message-in, .message-out');
      return Array.from(msgs).map((msg, index) => {
        // Texto — multiplos seletores para robustez
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

        // Autor
        let author = 'Desconhecido';
        const authorEl = msg.querySelector('[data-pre-plain-text]');
        if (authorEl) {
          const preText = authorEl.getAttribute('data-pre-plain-text') || '';
          const match = preText.match(/\]([^:]+):/);
          if (match) author = match[1].trim();
        }

        // Timestamp
        const timeEl = msg.querySelector('._ao3e, [data-testid="msg-meta"]');
        const timestamp = timeEl?.textContent || '';

        // ID
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
  }

  async run() {
    const startTime = Date.now();

    try {
      log('info', '═══════════════════════════════════════════');
      log('info', '🌙 LUNA HYBRID SCANNER v2.0');
      log('info', 'whatsapp-web.js + Playwright CDP');
      log('info', '═══════════════════════════════════════════');
      log('info', `Modo: ${this.isFirstScan ? '🆕 PRIMEIRA VEZ (ler TUDO)' : '📌 INCREMENTAL (so novas)'}`);
      log('info', `Grupos: ${CONFIG.ALLOWED_CHATS.join(', ')}`);

      // Conectar Playwright
      await this.extractor.connect();

      // Listar chats
      const chats = await this.extractor.getChatList();
      const allowedChats = chats.filter(c => isAllowedChat(c.title));

      log('info', `🎯 ${allowedChats.length} chats autorizados`);

      if (allowedChats.length === 0) {
        log('warn', '⚠️ Nenhum chat autorizado! Chats disponiveis:');
        chats.forEach(c => log('info', `  - ${c.title}`));
        return;
      }

      // Processar cada chat
      for (const chat of allowedChats) {
        log('info', `\n📂 ${chat.title}`);

        await this.extractor.openChat(chat.title);
        await this.extractor.scrollToTop();
        const rawMessages = await this.extractor.extractMessages();

        // Filtrar pelo checkpoint
        let newMessages = rawMessages;
        if (!this.isFirstScan) {
          newMessages = rawMessages.filter(m => {
            const h = hashMsg(m);
            return !this.processedHashes.has(h);
          });
          log('info', `📌 ${newMessages.length} novas (checkpoint ativo)`);
        } else {
          log('info', `🆕 ${rawMessages.length} mensagens (primeira vez)`);
        }

        this.allMessages.push(...newMessages);

        for (const m of newMessages) {
          this.processedHashes.add(hashMsg(m));
        }

        log('success', `✅ ${chat.title}: ${newMessages.length} mensagens`);
      }

      // Salvar resultados
      await this.saveResults();

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      log('info', '\n═══════════════════════════════════════════');
      log('success', `🎉 SCAN COMPLETO!`);
      log('success', `   📊 ${this.allMessages.length} mensagens totais`);
      log('success', `   ⏱️  ${duration}s`);
      log('info', '═══════════════════════════════════════════');

    } catch (error) {
      log('error', `❌ ERRO: ${error.message}`);
      console.error(error.stack);
    } finally {
      await this.extractor.disconnect();
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
        engine: 'luna-hybrid-v2'
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

    // Sincronizar buffer
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

    // Atualizar checkpoint
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

module.exports = { LunaHybridScanner, CONFIG };
