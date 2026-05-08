const { Client, LocalAuth } = require('whatsapp-web.js');
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ============================================================
// CONFIGURACAO
// ============================================================
const CONFIG = {
  // Regras de seguranca
  ALLOWED_GROUP_FOR_SPEAKING: '🏆Production - 2026🙏',
  ALLOWED_GROUPS_FOR_READING: ['🏆Production - 2026🙏', 'Paulo (web)'],
  NEVER_RESPOND_DM: true,
  NEVER_RESPOND_UNAUTHORIZED: true,

  // IA Local
  OLLAMA_URL: 'http://localhost:11434/api/generate',
  OLLAMA_MODEL: 'qwen2.5-coder:0.5b',

  // Monitoramento
  CHECK_INTERVAL: 5 * 60 * 1000, // 5 minutos
  REPORT_TIME: '14:00',

  // Arquivos
  OUTPUT_FILE: path.join(__dirname, '../backend/data/whatsapp-agent-data.json'),
  BUFFER_FILE: path.join(__dirname, 'luna-buffer.json'),
  CHECKPOINT_FILE: path.join(__dirname, 'luna-checkpoint.json'),
  NEWS_FILE: path.join(__dirname, '../backend/data/nexo-news.json'),

  // Categorias do News Engine
  CATEGORIES: {
    TAREFA_REALIZADA: { icon: '✅', color: '#22c55e', label: 'Tarefa Realizada' },
    TAREFA_PENDENTE: { icon: '📋', color: '#f59e0b', label: 'Tarefa Pendente' },
    FEEDBACK_POSITIVO: { icon: '👍', color: '#3b82f6', label: 'Feedback Positivo' },
    FEEDBACK_NEGATIVO: { icon: '👎', color: '#ef4444', label: 'Feedback Negativo' },
    IDEIA_NOVA: { icon: '💡', color: '#8b5cf6', label: 'Ideia Nova' },
    DECISAO: { icon: '🎯', color: '#ec4899', label: 'Decisao' },
    LINK_IMPORTANTE: { icon: '🔗', color: '#06b6d4', label: 'Link Importante' },
    NOTICIA_GERAL: { icon: '📰', color: '#6b7280', label: 'Noticia' }
  }
};

// ============================================================
// UTILS
// ============================================================
function log(type, msg) {
  const colors = {
    info: '\x1b[36m', success: '\x1b[32m', warn: '\x1b[33m', 
    error: '\x1b[31m', scan: '\x1b[35m', ai: '\x1b[34m', 
    security: '\x1b[41m\x1b[37m', news: '\x1b[32m', reset: '\x1b[0m'
  };
  const timestamp = new Date().toISOString();
  console.log(`${colors[type] || ''}[${timestamp}] [${type.toUpperCase()}]${colors.reset} ${msg}`);
}

function readJSON(file, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function writeJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function hashMsg(msg) {
  return crypto.createHash('sha256').update(msg.id._serialized + msg.body).digest('hex').substring(0, 16);
}

function isAllowedChat(name) {
  if (!name) return false;
  const lower = name.toLowerCase();
  return CONFIG.ALLOWED_GROUPS_FOR_READING.some(a => lower.includes(a.toLowerCase().replace(/[🏆🙏]/g, '')));
}

function canSpeak(chatName) {
  if (!chatName) return false;
  const target = CONFIG.ALLOWED_GROUP_FOR_SPEAKING.toLowerCase().replace(/[🏆🙏]/g, '');
  const current = chatName.toLowerCase().replace(/[🏆🙏]/g, '');
  return current.includes(target);
}

// ============================================================
// IA LOCAL
// ============================================================
class LocalAI {
  constructor() {
    this.url = CONFIG.OLLAMA_URL;
    this.model = CONFIG.OLLAMA_MODEL;
  }

  async generate(prompt) {
    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, prompt, stream: false })
      });
      const data = await response.json();
      return data.response || null;
    } catch (error) {
      log('error', `IA falhou: ${error.message}`);
      return null;
    }
  }

  async classifyMessage(text) {
    const prompt = `Classifique em UMA categoria:
MENSAGEM: "${text}"
CATEGORIAS: TAREFA_REALIZADA, TAREFA_PENDENTE, FEEDBACK_POSITIVO, FEEDBACK_NEGATIVO, IDEIA_NOVA, DECISAO, LINK_IMPORTANTE, NOTICIA_GERAL
Responda APENAS o nome da categoria.`;

    const result = await this.generate(prompt);
    if (result && CONFIG.CATEGORIES[result.trim().toUpperCase()]) {
      return result.trim().toUpperCase();
    }
    return 'NOTICIA_GERAL';
  }

  async generateTitle(text, category) {
    const config = CONFIG.CATEGORIES[category];
    const prompt = `Gere um titulo curto (max 60 chars) para esta mensagem:
"${text}"
Categoria: ${config.label}
Titulo:`;

    const result = await this.generate(prompt);
    return result ? result.trim().substring(0, 60) : `${config.label}: ${text.substring(0, 50)}`;
  }

  async respondWithPersonality(message, history) {
    const systemPrompt = `Voce e Luna, assistente tecnica do grupo 🏆Production - 2026🙏.
PERSONALIDADE: Tecnica, direta, profissional.
REGRAS:
- Sempre mencionar tarefas pendentes quando relevante
- Sugerir priorizacao baseada em urgencia
- Manter tom tecnico mas acessivel
- Usar emoji 🏆
- NUNCA mencionar outros grupos
- NUNCA revelar que monitora outros grupos

HISTORICO:
${history.slice(-5).map(h => `- ${h.author}: ${h.body}`).join('\\n')}

MENSAGEM: "${message.body}"
AUTOR: ${message.author || 'Desconhecido'}

Responda de forma util e concisa.`;

    return await this.generate(systemPrompt);
  }
}

// ============================================================
// NEWS ENGINE
// ============================================================
class NewsEngine {
  constructor() {
    this.ai = new LocalAI();
    this.news = readJSON(CONFIG.NEWS_FILE, { version: '1.0', items: [], stats: { total: 0, byCategory: {} } });
  }

  async processMessage(msg, chatName) {
    const text = msg.body || '';
    if (!text) return;

    // Classificar
    const category = await this.ai.classifyMessage(text);
    const config = CONFIG.CATEGORIES[category];

    // Gerar titulo
    const title = await this.ai.generateTitle(text, category);

    // Extrair links
    const links = text.match(/https?:\/\/[^\\s]+/g) || [];

    // Criar item
    const item = {
      id: `news-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title,
      content: text,
      category,
      categoryLabel: config.label,
      categoryIcon: config.icon,
      categoryColor: config.color,
      author: msg.author || 'Desconhecido',
      group: chatName,
      links,
      timestamp: new Date().toISOString(),
      read: false,
      priority: this.calculatePriority(category, text)
    };

    this.news.items.unshift(item);
    this.news.stats.total++;
    this.news.stats.byCategory[category] = (this.news.stats.byCategory[category] || 0) + 1;

    // Limitar a 1000
    if (this.news.items.length > 1000) {
      this.news.items = this.news.items.slice(0, 1000);
    }

    writeJSON(CONFIG.NEWS_FILE, this.news);
    log('news', `${config.icon} ${config.label}: "${title}"`);

    return item;
  }

  calculatePriority(category, text) {
    const lower = text.toLowerCase();
    if (/urgente|critico|p0|bloqueante|emergencia/i.test(lower)) return 'high';
    if (/importante|prioridade|hoje|amanha|precisamos/i.test(lower)) return 'medium';
    if (category === 'TAREFA_PENDENTE') return 'medium';
    if (category === 'FEEDBACK_NEGATIVO') return 'high';
    return 'low';
  }
}

// ============================================================
// PLAYWRIGHT EXTRACTOR — Conecta no browser do whatsapp-web.js
// ============================================================
class PlaywrightExtractor {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async connectToWABrowser(waClient) {
    log('info', '🔌 Conectando Playwright no browser do WhatsApp...');

    // Aguardar browser do whatsapp-web.js ficar pronto
    let attempts = 0;
    while (!waClient.pupBrowser && attempts < 30) {
      await new Promise(r => setTimeout(r, 1000));
      attempts++;
    }

    if (!waClient.pupBrowser) {
      throw new Error('Browser do whatsapp-web.js nao disponivel');
    }

    // Conectar via CDP no browser existente
    const browserWSEndpoint = waClient.pupBrowser.wsEndpoint();
    log('info', `   WebSocket: ${browserWSEndpoint}`);

    this.browser = await chromium.connectOverCDP(browserWSEndpoint);
    const context = this.browser.contexts()[0];
    const pages = context.pages();

    // Encontrar pagina do WhatsApp
    this.page = pages.find(p => p.url().includes('web.whatsapp.com'));
    if (!this.page) {
      this.page = pages[0];
    }

    log('success', '✅ Playwright conectado ao browser do WhatsApp!');
    return true;
  }

  async scrollAndExtract(chatTitle) {
    log('scan', `⬆️ Rolando e extraindo: ${chatTitle}`);

    // Abrir chat
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

    // Rolar para cima
    let scrollCount = 0;
    let lastCount = 0;
    let stable = 0;

    while (scrollCount < 200 && stable < 5) {
      const currentCount = await this.page.evaluate(() => {
        return document.querySelectorAll('.message-in, .message-out').length;
      });

      if (currentCount === lastCount) {
        stable++;
      } else {
        stable = 0;
        lastCount = currentCount;
        if (currentCount % 50 === 0) log('info', `   📈 ${currentCount} mensagens...`);
      }

      await this.page.evaluate(() => {
        const container = document.querySelector('#main .copyable-area, [data-testid="conversation-panel-messages"]');
        if (container) container.scrollTo({ top: 0, behavior: 'instant' });
        window.scrollTo(0, 0);
        const scrollEvent = new WheelEvent('wheel', { deltaY: -1000, bubbles: true });
        document.dispatchEvent(scrollEvent);
      });

      await this.page.waitForTimeout(2000);
      scrollCount++;
    }

    log('success', `✅ ${lastCount} mensagens no DOM`);

    // Extrair
    const messages = await this.page.evaluate(() => {
      const msgs = document.querySelectorAll('.message-in, .message-out');
      return Array.from(msgs).map((msg, index) => {
        let textEl = null;
        const selectors = [
          '.selectable-text span',
          '.copyable-text span', 
          '[data-testid="msg-text"] span',
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
        const id = msg.getAttribute('data-id') || `msg-${index}-${Date.now()}`;

        return {
          id,
          body: textEl?.textContent?.trim() || '',
          author,
          fromMe: msg.classList.contains('message-out'),
          timestamp: timeEl?.textContent || ''
        };
      }).filter(m => m.body && !m.fromMe);
    });

    log('success', `✅ ${messages.length} mensagens extraidas`);
    return messages;
  }

  async disconnect() {
    if (this.browser) {
      await this.browser.disconnect();
      log('info', '🔌 Playwright desconectado');
    }
  }
}

// ============================================================
// LUNA ULTIMATE — Tudo em um
// ============================================================
class LunaUltimate {
  constructor() {
    this.waClient = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    this.ai = new LocalAI();
    this.news = new NewsEngine();
    this.extractor = new PlaywrightExtractor();
    this.checkpoint = readJSON(CONFIG.CHECKPOINT_FILE, { hashes: [], lastScan: null });
    this.buffer = readJSON(CONFIG.BUFFER_FILE, {
      newMessages: [], newTasks: [], newIdeas: [], newDecisions: [], newLinks: [], newMentions: [], lastBufferUpdate: null
    });

    this.setupEvents();
  }

  setupEvents() {
    this.waClient.on('qr', (qr) => {
      log('info', '📱 Escaneie o QR Code no celular');
    });

    this.waClient.on('ready', async () => {
      log('success', '🌙 LUNA ULTIMATE v8.0 pronto!');
      log('success', '✅ WhatsApp conectado');
      log('success', '✅ IA Local ativa');
      log('success', '✅ News Engine ativo');
      log('security', '🔒 REGRA: Só fala em 🏆Production - 2026🙏');

      await this.runFullScan();
      this.startScheduler();
    });

    this.waClient.on('message_create', async (msg) => {
      await this.handleMessage(msg);
    });
  }

  async handleMessage(msg) {
    if (msg.fromMe) return;

    const chat = await msg.getChat();
    const chatName = chat.name || 'Desconhecido';

    // Verificar DM
    if (!chat.isGroup) {
      log('security', `🚨 DM bloqueada de ${msg.author}`);
      return;
    }

    // Verificar se grupo autorizado
    if (!isAllowedChat(chatName)) return;

    const isProduction = canSpeak(chatName);

    // Processar para News Engine
    await this.news.processMessage(msg, chatName);

    // Processar para buffer
    this.processToBuffer(msg, chatName, isProduction);

    // Verificar mencao
    if (this.isMentioned(msg.body)) {
      if (isProduction) {
        await this.respondToMention(msg, chat);
      } else {
        log('security', `🚨 Mencao bloqueada em "${chatName}"`);
      }
    }
  }

  isMentioned(text) {
    if (!text) return false;
    return /@(?:KIMI|LUNA|KIMICLAW|NEXO|BOT|IA)/i.test(text);
  }

  async respondToMention(msg, chat) {
    log('ai', `🤖 Mencionada em 🏆 Production!`);

    const history = await this.getRecentMessages(chat, 10);
    const response = await this.ai.respondWithPersonality(msg, history);

    if (response) {
      await msg.reply(response);
      log('success', `✅ Resposta enviada`);
    }
  }

  async getRecentMessages(chat, limit = 10) {
    const messages = await chat.fetchMessages({ limit });
    return messages.filter(m => !m.fromMe).map(m => ({
      body: m.body,
      author: m.author || 'Desconhecido'
    }));
  }

  processToBuffer(msg, chatName, isProduction) {
    const text = msg.body || '';

    if (/tarefa|task|fazer|precisamos|implementar|bug|corrigir/i.test(text)) {
      this.buffer.newTasks.push({ text, author: msg.author, group: chatName, isProduction, time: new Date().toISOString() });
    }
    if (/ideia|sugestao|melhorar|feature|nova funcionalidade/i.test(text)) {
      this.buffer.newIdeas.push({ text, author: msg.author, group: chatName, isProduction, time: new Date().toISOString() });
    }
    if (/decidido|vamos|concordo|aprovar|ok|confirmado/i.test(text)) {
      this.buffer.newDecisions.push({ text, author: msg.author, group: chatName, isProduction, time: new Date().toISOString() });
    }
    if (/https?:\/\//i.test(text)) {
      this.buffer.newLinks.push({ text, url: text.match(/https?:\/\/[^\\s]+/)[0], group: chatName, isProduction, time: new Date().toISOString() });
    }
    if (this.isMentioned(text)) {
      this.buffer.newMentions.push({ text, author: msg.author, group: chatName, isProduction, time: new Date().toISOString() });
    }

    this.buffer.newMessages.push({
      id: msg.id._serialized,
      body: text,
      author: msg.author,
      group: chatName,
      isProduction,
      timestamp: new Date().toISOString()
    });

    this.buffer.lastBufferUpdate = new Date().toISOString();
    writeJSON(CONFIG.BUFFER_FILE, this.buffer);
  }

  async runFullScan() {
    log('scan', '=== SCAN COMPLETO COM PLAYWRIGHT ===');

    try {
      // Conectar Playwright no browser do whatsapp-web.js
      await this.extractor.connectToWABrowser(this.waClient);

      const chats = await this.waClient.getChats();
      let totalMessages = 0;

      for (const chat of chats) {
        if (!chat.isGroup) continue;

        const chatName = chat.name || 'Desconhecido';
        if (!isAllowedChat(chatName)) continue;

        const isProduction = canSpeak(chatName);
        const emoji = isProduction ? '🏆' : '👤';

        log('scan', `${emoji} ${chatName} ${isProduction ? '[LEITURA+FALA]' : '[LEITURA_SILENCIOSA]'}`);

        // Usar Playwright para rolar e extrair TUDO
        const messages = await this.extractor.scrollAndExtract(chatName);

        // Processar mensagens novas
        const newMessages = messages.filter(m => {
          const hash = crypto.createHash('sha256').update(m.id + m.body).digest('hex').substring(0, 16);
          return !this.checkpoint.hashes.includes(hash);
        });

        for (const m of newMessages) {
          // Simular objeto de mensagem para News Engine
          await this.news.processMessage({
            body: m.body,
            author: m.author
          }, chatName);

          const hash = crypto.createHash('sha256').update(m.id + m.body).digest('hex').substring(0, 16);
          this.checkpoint.hashes.push(hash);
        }

        totalMessages += newMessages.length;
        log('success', `   ✅ ${newMessages.length} novas mensagens`);
      }

      // Salvar checkpoint
      this.checkpoint.lastScan = new Date().toISOString();
      writeJSON(CONFIG.CHECKPOINT_FILE, this.checkpoint);

      // Salvar resultado final
      await this.saveResults();

      log('scan', `=== SCAN COMPLETO: ${totalMessages} mensagens ===`);

    } catch (error) {
      log('error', `❌ Erro no scan: ${error.message}`);
    } finally {
      await this.extractor.disconnect();
    }
  }

  async saveResults() {
    const now = new Date().toISOString();

    const result = {
      messages: this.buffer.newMessages,
      groups: CONFIG.ALLOWED_GROUPS_FOR_READING,
      lastUpdated: now,
      scanInfo: {
        totalScanned: this.buffer.newMessages.length,
        scannedAt: now,
        engine: 'luna-ultimate-v8'
      },
      stats: {
        total: this.buffer.newMessages.length,
        tasks: this.buffer.newTasks.length,
        ideas: this.buffer.newIdeas.length,
        decisions: this.buffer.newDecisions.length,
        links: this.buffer.newLinks.length,
        mentions: this.buffer.newMentions.length
      }
    };

    writeJSON(CONFIG.OUTPUT_FILE, result);
    log('success', `💾 Resultados salvos`);
  }

  startScheduler() {
    // Scan incremental a cada 5 minutos
    setInterval(async () => {
      log('scan', '⏰ Scan incremental agendado');
      await this.runFullScan();
    }, CONFIG.CHECK_INTERVAL);

    // Relatorio diario
    this.scheduleDailyReport();
  }

  scheduleDailyReport() {
    const now = new Date();
    const [hour, minute] = CONFIG.REPORT_TIME.split(':');
    const reportTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(hour), parseInt(minute));

    if (reportTime < now) {
      reportTime.setDate(reportTime.getDate() + 1);
    }

    const delay = reportTime - now;

    log('info', `📅 Proximo relatorio: ${reportTime.toLocaleString()}`);

    setTimeout(() => {
      this.sendDailyReport();
      setInterval(() => this.sendDailyReport(), 24 * 60 * 60 * 1000);
    }, delay);
  }

  async sendDailyReport() {
    log('info', '📊 Gerando relatorio diario...');

    const productionChat = await this.findProductionChat();
    if (!productionChat) {
      log('error', '❌ Grupo Production nao encontrado');
      return;
    }

    const report = `🌙 LUNA REPORT — Production
📊 ${this.buffer.newMessages.filter(m => m.isProduction).length} mensagens
📋 ${this.buffer.newTasks.filter(t => t.isProduction).length} tarefas
💡 ${this.buffer.newIdeas.filter(i => i.isProduction).length} ideias
🎯 ${this.buffer.newDecisions.filter(d => d.isProduction).length} decisoes
🔗 ${this.buffer.newLinks.filter(l => l.isProduction).length} links

TAREFAS PENDENTES:
${this.buffer.newTasks.filter(t => t.isProduction).map(t => `• ${t.text.substring(0, 80)}`).join('\\n') || 'Nenhuma'}

SUGESTAO: Priorizar tarefas P0 antes de novas features.`;

    await productionChat.sendMessage(report);
    log('success', '📤 Relatorio enviado no Production');

    // Limpar buffer
    this.buffer = {
      newMessages: [],
      newTasks: [], newIdeas: [], newDecisions: [], newLinks: [], newMentions: [],
      lastBufferUpdate: new Date().toISOString()
    };
    writeJSON(CONFIG.BUFFER_FILE, this.buffer);
  }

  async findProductionChat() {
    const chats = await this.waClient.getChats();
    return chats.find(c => c.isGroup && canSpeak(c.name));
  }

  initialize() {
    this.waClient.initialize();
  }
}

// ============================================================
// EXECUCAO
// ============================================================
const luna = new LunaUltimate();
luna.initialize();

process.on('SIGINT', async () => {
  log('info', '🛑 Encerrando...');
  await luna.extractor.disconnect();
  process.exit(0);
});
