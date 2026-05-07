const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// ============================================================
// CONFIGURACAO — REGRAS ABSOLUTAS
// ============================================================
const CONFIG = {
  // REGRA 1: UNICO GRUPO PERMITIDO PARA FALA
  // NUNCA, EM HIPOTESE ALGUMA, falar em outros grupos
  ALLOWED_GROUP_FOR_SPEAKING: '🏆Production - 2026🙏',

  // REGRA 2: GRUPOS PERMITIDOS PARA LEITURA (monitoramento silencioso)
  // Pode LER, mas NUNCA RESPONDE ou ENVIA MENSAGENS
  ALLOWED_GROUPS_FOR_READING: ['🏆Production - 2026🙏', 'Paulo (web)'],

  // REGRA 3: NUNCA responder DMs (chat privado)
  NEVER_RESPOND_DM: true,

  // REGRA 4: NUNCA responder em grupos nao autorizados
  NEVER_RESPOND_UNAUTHORIZED: true,

  // IA Local (Ollama)
  OLLAMA_URL: 'http://localhost:11434/api/generate',
  OLLAMA_MODEL: 'qwen2.5-coder:0.5b',

  // Monitoramento
  CHECK_INTERVAL: 5 * 60 * 1000, // 5 minutos
  REPORT_TIME: '14:00',

  // Arquivos
  DATA_DIR: path.join(__dirname, '../backend/data'),
  CHECKPOINT_FILE: path.join(__dirname, 'luna-checkpoint.json'),
  BUFFER_FILE: path.join(__dirname, 'luna-buffer.json')
};

// ============================================================
// UTILS
// ============================================================
function log(type, msg) {
  const colors = {
    info: '\x1b[36m', success: '\x1b[32m', warn: '\x1b[33m', 
    error: '\x1b[31m', scan: '\x1b[35m', ai: '\x1b[34m', 
    security: '\x1b[41m\x1b[37m', reset: '\x1b[0m'
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

// ============================================================
// VALIDACAO DE SEGURANCA — REGRAS ABSOLUTAS
// ============================================================
class SecurityValidator {
  // REGRA ABSOLUTA 1: Verificar se pode FALAR neste grupo
  static canSpeak(chatName) {
    if (!chatName) return false;
    const target = CONFIG.ALLOWED_GROUP_FOR_SPEAKING.toLowerCase().replace(/[🏆🙏]/g, '');
    const current = chatName.toLowerCase().replace(/[🏆🙏]/g, '');
    return current.includes(target);
  }

  // REGRA ABSOLUTA 2: Verificar se pode LER este grupo
  static canRead(chatName) {
    if (!chatName) return false;
    const lower = chatName.toLowerCase();
    return CONFIG.ALLOWED_GROUPS_FOR_READING.some(g => 
      lower.includes(g.toLowerCase().replace(/[🏆🙏]/g, ''))
    );
  }

  // REGRA ABSOLUTA 3: Verificar se e DM (chat privado)
  static isDM(chat) {
    return !chat.isGroup;
  }

  // Log de violacao de seguranca
  static logViolation(action, chatName, reason) {
    log('security', `🚨 VIOLACAO BLOQUEADA: ${action} em "${chatName}" | Motivo: ${reason}`);
  }
}

// ============================================================
// IA LOCAL (Ollama)
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
        body: JSON.stringify({
          model: this.model,
          prompt: prompt,
          stream: false
        })
      });
      const data = await response.json();
      return data.response || 'Erro: resposta vazia';
    } catch (error) {
      log('error', `IA Local falhou: ${error.message}`);
      return null;
    }
  }
}

// ============================================================
// WHATSAPP CLIENT — COM REGRAS ABSOLUTAS
// ============================================================
class NexoMonitor {
  constructor() {
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    this.ai = new LocalAI();
    this.checkpoint = readJSON(CONFIG.CHECKPOINT_FILE, { 
      hashes: [], 
      lastScan: null,
      lastReport: null 
    });
    this.buffer = readJSON(CONFIG.BUFFER_FILE, {
      newMessages: [],
      newTasks: [],
      newIdeas: [],
      newDecisions: [],
      newLinks: [],
      newMentions: [],
      lastBufferUpdate: null
    });

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.client.on('qr', (qr) => {
      log('info', '📱 Escaneie o QR Code:');
      qrcode.generate(qr, { small: true });
    });

    this.client.on('ready', () => {
      log('success', '🌙 NEXO Auto-Monitor v3.1 pronto!');
      log('security', '🔒 REGRA ABSOLUTA: Só fala em 🏆Production - 2026🙏');
      this.startMonitoring();
    });

    this.client.on('message_create', async (msg) => {
      await this.handleMessage(msg);
    });
  }

  async handleMessage(msg) {
    // Ignorar mensagens proprias
    if (msg.fromMe) return;

    const chat = await msg.getChat();
    const chatName = chat.name || 'Desconhecido';

    // REGRA ABSOLUTA 3: NUNCA responder DM
    if (CONFIG.NEVER_RESPOND_DM && SecurityValidator.isDM(chat)) {
      SecurityValidator.logViolation('RESPONSE', chatName, 'DM bloqueado permanentemente');
      return;
    }

    // REGRA ABSOLUTA 2: Verificar se pode LER este grupo
    if (!SecurityValidator.canRead(chatName)) {
      // Silenciosamente ignorar — nao logar para nao poluir
      return;
    }

    // Processar mensagem para buffer (leitura silenciosa)
    this.processMessage(msg, chatName);

    // REGRA ABSOLUTA 1: Só responder no Production
    if (this.isMentioned(msg.body)) {
      if (SecurityValidator.canSpeak(chatName)) {
        // ✅ PERMITIDO: Responder no Production
        log('ai', `🤖 Mencionada em 🏆 Production! Gerando resposta...`);
        await this.respondToMention(msg, chat);
      } else {
        // 🚫 BLOQUEADO: Mencionado em grupo nao-autorizado
        SecurityValidator.logViolation('MENTION_RESPONSE', chatName, 
          'Só permitido responder em 🏆Production - 2026🙏');

        // Opcional: Notificar no Production que houve mencao em outro lugar
        await this.notifyProductionOfUnauthorizedMention(msg, chatName);
      }
    }
  }

  async respondToMention(msg, chat) {
    try {
      // Buscar historico recente do Production
      const history = await this.getRecentMessages(chat, 10);

      // Personalidade do Production: Tecnica e Direta
      const systemPrompt = `Voce e Luna, assistente tecnica do grupo 🏆Production - 2026🙏.

PERSONALIDADE: Tecnica, direta, profissional.
REGRAS:
- Sempre mencionar tarefas pendentes quando relevante
- Sugerir priorizacao baseada em urgencia
- Manter tom tecnico mas acessivel
- Usar emoji 🏆 para marcar conquistas
- NUNCA mencionar outros grupos ou chats
- NUNCA revelar que monitora outros grupos

HISTORICO RECENTE:
${history.map(h => `- ${h.author}: ${h.body}`).join('\n')}

MENSAGEM ATUAL: "${msg.body}"
AUTOR: ${msg.author || 'Desconhecido'}

Responda de forma util e concisa.`;

      const response = await this.ai.generate(systemPrompt);

      if (response) {
        await msg.reply(response);
        log('success', `✅ Resposta enviada em 🏆 Production`);
      }
    } catch (error) {
      log('error', `Erro ao responder: ${error.message}`);
    }
  }

  async notifyProductionOfUnauthorizedMention(msg, unauthorizedChatName) {
    // Opcional: Notificar no Production que alguem tentou mencionar em outro lugar
    // Isso ajuda a manter transparencia sem violar a regra
    try {
      const productionChat = await this.findProductionChat();
      if (productionChat) {
        const notifyMsg = `🏆 [SISTEMA] Tentativa de interacao em grupo nao-autorizado: "${unauthorizedChatName}"\n` +
                         `Mensagem: "${msg.body.substring(0, 100)}..."\n` +
                         `Acao: Silenciosamente ignorada (regra de privacidade).`;

        // Descomente a linha abaixo se quiser notificar:
        // await productionChat.sendMessage(notifyMsg);

        log('security', `📢 Notificacao silenciosa enviada ao Production`);
      }
    } catch (error) {
      // Silenciosamente falhar — nao quebrar o fluxo
    }
  }

  async findProductionChat() {
    const chats = await this.client.getChats();
    return chats.find(c => c.isGroup && SecurityValidator.canSpeak(c.name));
  }

  isMentioned(text) {
    if (!text) return false;
    return /@(?:KIMI|LUNA|KIMICLAW|NEXO|BOT|IA)/i.test(text);
  }

  async getRecentMessages(chat, limit = 10) {
    const messages = await chat.fetchMessages({ limit });
    return messages.filter(m => !m.fromMe).map(m => ({
      body: m.body,
      author: m.author || 'Desconhecido'
    }));
  }

  processMessage(msg, chatName) {
    const text = msg.body || '';
    const isProduction = SecurityValidator.canSpeak(chatName);

    // Categorizar
    if (/tarefa|task|fazer|precisamos|implementar|bug|corrigir/i.test(text)) {
      this.buffer.newTasks.push({ 
        text, 
        author: msg.author, 
        group: chatName,
        isProduction,
        time: new Date().toISOString() 
      });
    }
    if (/ideia|sugestao|melhorar|feature|nova funcionalidade/i.test(text)) {
      this.buffer.newIdeas.push({ 
        text, 
        author: msg.author,
        group: chatName,
        isProduction,
        time: new Date().toISOString() 
      });
    }
    if (/decidido|vamos|concordo|aprovar|ok|confirmado/i.test(text)) {
      this.buffer.newDecisions.push({ 
        text, 
        author: msg.author,
        group: chatName,
        isProduction,
        time: new Date().toISOString() 
      });
    }
    if (/https?:\/\//i.test(text)) {
      this.buffer.newLinks.push({ 
        text, 
        url: text.match(/https?:\/\/[^\s]+/)[0],
        group: chatName,
        isProduction,
        time: new Date().toISOString() 
      });
    }
    if (this.isMentioned(text)) {
      this.buffer.newMentions.push({ 
        text, 
        author: msg.author,
        group: chatName,
        isProduction,
        time: new Date().toISOString() 
      });
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

  async startMonitoring() {
    log('info', '🔍 Monitoramento iniciado');
    await this.runScan();
    setInterval(() => this.runScan(), CONFIG.CHECK_INTERVAL);
    this.scheduleDailyReport();
  }

  async runScan() {
    log('scan', '=== SCAN INICIADO ===');

    const chats = await this.client.getChats();
    let totalMessages = 0;

    for (const chat of chats) {
      if (!chat.isGroup) continue;

      const chatName = chat.name || 'Desconhecido';

      // Só processar grupos autorizados para leitura
      if (!SecurityValidator.canRead(chatName)) continue;

      const isProduction = SecurityValidator.canSpeak(chatName);
      const emoji = isProduction ? '🏆' : '👤';

      log('scan', `${emoji} ${chatName} ${isProduction ? '[LEITURA+FALA]' : '[LEITURA_SILENCIOSA]'}`);

      const messages = await chat.fetchMessages({ limit: 50 });
      const newMessages = messages.filter(m => {
        if (m.fromMe) return false;
        const hash = this.hashMessage(m);
        return !this.checkpoint.hashes.includes(hash);
      });

      for (const msg of newMessages) {
        this.processMessage(msg, chatName);
        this.checkpoint.hashes.push(this.hashMessage(msg));
      }

      totalMessages += newMessages.length;
      log('success', `   ✅ ${newMessages.length} novas mensagens`);
    }

    this.checkpoint.lastScan = new Date().toISOString();
    writeJSON(CONFIG.CHECKPOINT_FILE, this.checkpoint);

    log('scan', `=== SCAN COMPLETO: ${totalMessages} mensagens ===`);
  }

  hashMessage(msg) {
    return require('crypto').createHash('sha256').update(msg.id._serialized + msg.body).digest('hex').substring(0, 16);
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

    // REGRA ABSOLUTA: Só enviar relatorio no Production
    const productionChat = await this.findProductionChat();

    if (!productionChat) {
      log('error', '❌ Grupo Production nao encontrado! Relatorio cancelado.');
      return;
    }

    // Gerar relatorio com IA
    const productionMessages = this.buffer.newMessages.filter(m => m.isProduction);
    const otherMessages = this.buffer.newMessages.filter(m => !m.isProduction);

    const reportPrompt = `Gere um relatorio diario tecnico para 🏆Production.

DADOS DO PRODUCTION:
- ${productionMessages.length} mensagens
- ${this.buffer.newTasks.filter(t => t.isProduction).length} tarefas
- ${this.buffer.newIdeas.filter(i => i.isProduction).length} ideias
- ${this.buffer.newDecisions.filter(d => d.isProduction).length} decisoes

DADOS DE OUTROS GRUPOS (monitorados silenciosamente):
- ${otherMessages.length} mensagens em outros grupos
- ${this.buffer.newTasks.filter(t => !t.isProduction).length} tarefas externas

REGRAS:
- Focar no Production
- Mencionar tarefas pendentes
- Sugerir priorizacao
- NUNCA revelar detalhes de outros grupos
- Usar emoji 🏆

Formato: Titulo + resumo + acoes sugeridas.`;

    const report = await this.ai.generate(reportPrompt);

    if (report) {
      await productionChat.sendMessage(report);
      log('success', `📤 Relatorio enviado EXCLUSIVAMENTE em 🏆 Production`);
    }

    // Limpar buffer
    this.buffer = {
      newMessages: [],
      newTasks: [],
      newIdeas: [],
      newDecisions: [],
      newLinks: [],
      newMentions: [],
      lastBufferUpdate: new Date().toISOString()
    };
    writeJSON(CONFIG.BUFFER_FILE, this.buffer);
  }
}

// ============================================================
// EXECUCAO
// ============================================================
const monitor = new NexoMonitor();
monitor.client.initialize();

process.on('SIGINT', async () => {
  log('info', '🛑 Encerrando...');
  await monitor.client.destroy();
  process.exit(0);
});
