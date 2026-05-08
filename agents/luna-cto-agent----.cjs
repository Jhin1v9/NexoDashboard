// ============================================================
// LUNA v14.1 "OMNIA HYBRID" — v10.2 + whatsapp-web.js
// Mantém 100% personalidade original, engine novo e funcional
// ============================================================

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// ============================================================
// CONFIG (100% v10.2)
// ============================================================
const isAuthorizedChat = (name) => { const n = (name || '').trim(); return n.includes('Production') || n.includes('Paulo'); };

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
  MAX_SCROLLS: 30,
  CHECKPOINT_FILE: path.join(__dirname, '../backend/data/luna-checkpoint.json'),
  BUFFER_FILE: path.join(__dirname, '../backend/data/luna-buffer.json'),
  OUTPUT_FILE: path.join(__dirname, '../backend/data/whatsapp-agent-data.json'),
  REPORTS_DIR: path.join(__dirname, '../backend/data/reports'),
  ARTIFACTS_DIR: path.join(__dirname, '../ARTIFACTS'),
  DEBUG_DIR: path.join(__dirname, '../ARTIFACTS/debug')
};

[CONFIG.REPORTS_DIR, CONFIG.ARTIFACTS_DIR, CONFIG.DEBUG_DIR, SESSION_DATA_PATH].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// ============================================================
// LOGGER (v10.2)
// ============================================================
class Logger {
  constructor() {
    this.logFile = path.join(CONFIG.ARTIFACTS_DIR, 'luna-v14.log');
    this.events = [];
  }
  _h() { return new Date().toISOString(); }
  _w(n, msg) {
    const line = `[${n}] [${this._h()}] ${msg}`;
    console.log(line);
    fs.appendFileSync(this.logFile, line + '\n');
    this.events.push({ type: n, msg, time: this._h() });
    if (this.events.length > 100) this.events.shift();
  }
  info(m) { this._w('INFO', m); }
  success(m) { this._w('SUCCESS', m); }
  error(m) { this._w('ERROR', m); }
  warn(m) { this._w('WARN', m); }
  scan(m) { this._w('SCAN', m); }
  extraordinary(m) { console.log(`✨ ${m} ✨`); this._w('EXTRAORDINARY', m); }
  getEvents() { return this.events; }
}
const log = new Logger();

// ============================================================
// CHECKPOINT MANAGER (100% v10.2)
// ============================================================
class CheckpointManager {
  constructor() {
    this.checkpoint = this.load(CONFIG.CHECKPOINT_FILE, {
      lastScan: null,
      knownMessageHashes: [],
      processedCount: 0,
      silenceCount: 0,
      lastReport: null
    });
    this.buffer = this.load(CONFIG.BUFFER_FILE, {
      newMessages: [],
      newTasks: [],
      newIdeas: [],
      newDecisions: [],
      newLinks: [],
      newMentions: [],
      lastBufferUpdate: null
    });
  }

  load(file, def) {
    try {
      if (fs.existsSync(file)) {
        const d = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (typeof d.silenceCount !== 'number' || isNaN(d.silenceCount)) d.silenceCount = 0;
        return d;
      }
    } catch (e) { log.error(`Load: ${e.message}`); }
    return def;
  }

  save() {
    fs.writeFileSync(CONFIG.CHECKPOINT_FILE, JSON.stringify(this.checkpoint, null, 2));
    fs.writeFileSync(CONFIG.BUFFER_FILE, JSON.stringify(this.buffer, null, 2));
  }

  hashMessage(msg) {
    return `${msg.from || msg.author}:${(msg.body || msg.text || '').slice(0, 50)}:${msg.timestamp || msg.time}`;
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
}

// ============================================================
// INTELLIGENCE ANALYZER (100% v10.2)
// ============================================================
class IntelligenceAnalyzer {
  analyze(messages) {
    return {
      tasks: this.detectTasks(messages),
      ideas: this.detectIdeas(messages),
      decisions: this.detectDecisions(messages),
      links: this.extractLinks(messages),
      mentions: this.detectMentions(messages),
      commands: this.detectCommands(messages)
    };
  }

  detectTasks(m) {
    return m.filter(x => /tarefa|task|todo|fazer|faz|precisa|necessario|urgente|prazo|deadline|implementar|criar|build|deploy/i.test(x.body || x.text))
      .map(x => ({...x, priority: /urgente|critico|p0|imediato|agora|bloqueante/i.test(x.body || x.text)?'P0-CRITICO':/importante|p1|hoje|amanha/i.test(x.body || x.text)?'P1-ALTA':'P2-MEDIA', type:'task'}));
  }

  detectIdeas(m) { return m.filter(x => /ideia|sugestao|proposta|que tal|poderiamos|seria bom|e se/i.test(x.body || x.text)).map(x => ({...x, type:'idea'})); }
  detectDecisions(m) { return m.filter(x => /decidimos|vamos|ficou acordado|definido|aprovado|confirmado|bora/i.test(x.body || x.text)).map(x => ({...x, type:'decision'})); }
  extractLinks(m) { const r=/(https?:\/\/[^\s]+)/g,out=[]; m.forEach(x=>{const f=(x.body||x.text||'').match(r);if(f)f.forEach(u=>out.push({url:u.replace(/[.,;!?]$/,''),context:(x.body||x.text||'').slice(0,100),author:x.author||x.from||'Desconhecido',time:new Date((x.timestamp||Date.now())*1000).toISOString()}))}); return [...new Map(out.map(l=>[l.url,l])).values()]; }
  detectMentions(m) { return m.filter(x => /@kimi|@luna|@abner|@todos|@equipe|@equipo|@nexo/i.test(x.body || x.text)).map(x => ({...x, type:'mention'})); }
  detectCommands(m) { return m.filter(x => /^\/(createTask|updateFinance|sendReport|deploy|status)/i.test(x.body || x.text)).map(x => ({...x, type:'command', cmd: (x.body||x.text).split(' ')[0]})); }
  analyzeSentiment(m) { return { positive: m.filter(x=>/excelente|otimo|genial|perfeito|top|bom|👍|🎉|✅/i.test(x.body||x.text)).length, negative: m.filter(x=>/erro|bug|problema|fallo|malo|👎|❌/i.test(x.body||x.text)).length, urgent: m.filter(x=>/urgente|critico|p0|bloqueante/i.test(x.body||x.text)).length, total: m.length }; }
}

// ============================================================
// REPORT GENERATOR (100% v10.2 + HTML extra)
// ============================================================
class ReportGenerator {
  generate(data) {
    return { html: this._html(data), txt: this._txt(data), json: JSON.stringify(data, null, 2) };
  }

  _txt(d) {
    const { messages, analysis, sentiment } = d;
    return `🌙 *LUNA REPORT INTELIGENTE*
🕐 ${new Date().toLocaleString('es-ES')}

━━━━━━━━━━━━━━━━━━━━━━
📈 *RESUMEN*
• ${messages.length} mensajes
• ${analysis.tasks.length} tareas (${analysis.tasks.filter(t=>t.priority==='P0-CRITICO').length} urgentes)
• ${analysis.ideas.length} ideas
• ${analysis.decisions.length} decisiones
• ${analysis.links.length} links
• ${analysis.mentions.length} menciones

${sentiment?`📊 *SENTIMIENTO*
• 😊 Positivo: ${sentiment.positive}
• 😤 Negativo: ${sentiment.negative}
• ⚡ Urgente: ${sentiment.urgent}
`:''}

${analysis.links.length?`🔗 *LINKS*
${analysis.links.map(l=>`• ${l.url}`).join('\n')}
`:''}

${analysis.tasks.length?`📝 *TAREAS*
${analysis.tasks.map(t=>`• [${t.priority}] ${(t.body||t.text||'').slice(0,80)} (${t.author||t.from||'?'})`).join('\n')}
`:''}

━━━━━━━━━━━━━━━━━━━━━━
🤖 Luna v14.1 | NEXO Digital`;
  }

  _html(d) {
    const { messages, analysis, sentiment } = d;
    const t = new Date().toLocaleString('es-ES');
    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>LUNA v14.1 - ${t}</title><style>
body{font-family:'Segoe UI',sans-serif;background:linear-gradient(135deg,#0f172a,#1e1b4b);color:#e2e8f0;margin:0;padding:20px}
.container{max-width:1100px;margin:0 auto}
.header{background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:25px;border-radius:16px;margin-bottom:25px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:15px;margin-bottom:25px}
.stat-card{background:#1e293b;padding:20px;border-radius:12px;text-align:center}
.stat-number{font-size:2em;font-weight:bold;color:#6366f1}
.section{background:#1e293b;padding:20px;border-radius:12px;margin-bottom:15px}
.item{padding:10px;border-bottom:1px solid #334155;display:flex;gap:10px}
.p0{background:#ef4444;color:#fff;padding:3px 10px;border-radius:15px;font-size:.75em}
.p1{background:#f59e0b;color:#fff;padding:3px 10px;border-radius:15px;font-size:.75em}
.p2{background:#22c55e;color:#fff;padding:3px 10px;border-radius:15px;font-size:.75em}
.link-url{color:#60a5fa;text-decoration:none}
.meta{color:#64748b;font-size:.85em}
.footer{text-align:center;padding:20px;color:#64748b}
</style></head><body><div class="container">
<div class="header"><h1>🌙 LUNA v14.1 "OMNIA HYBRID"</h1><p>${t}</p></div>
<div class="stats">
<div class="stat-card"><div class="stat-number">${messages.length}</div><div>💬 Mensajes</div></div>
<div class="stat-card"><div class="stat-number">${analysis.tasks.length}</div><div>📝 Tareas</div></div>
<div class="stat-card"><div class="stat-number">${analysis.ideas.length}</div><div>💡 Ideas</div></div>
<div class="stat-card"><div class="stat-number">${analysis.decisions.length}</div><div>✅ Decisiones</div></div>
<div class="stat-card"><div class="stat-number">${analysis.links.length}</div><div>🔗 Links</div></div>
<div class="stat-card"><div class="stat-number">${analysis.mentions.length}</div><div>👤 Menciones</div></div>
</div>
${sentiment?`<div class="section"><h2>📊 Sentimiento</h2><p>😊 ${sentiment.positive} | 😤 ${sentiment.negative} | ⚡ ${sentiment.urgent}</p></div>`:''}
${analysis.links.length?`<div class="section"><h2>🔗 Links</h2>${analysis.links.map(l=>`<div class="item"><span>🔗</span><div><a href="${l.url}" class="link-url">${l.url}</a><div class="meta">${l.author}</div></div></div>`).join('')}</div>`:''}
${analysis.tasks.length?`<div class="section"><h2>📝 Tareas</h2>${analysis.tasks.map(t=>`<div class="item"><span class="${t.priority.toLowerCase().split('-')[0]}">${t.priority}</span><div><div>${(t.body||t.text||'').slice(0,120)}</div><div class="meta">${t.author||t.from||'?'}</div></div></div>`).join('')}</div>`:''}
<div class="footer">🤖 Luna v14.1 | NEXO Digital</div>
</div></body></html>`;
  }
}

// ============================================================
// MAIN AGENT — v10.2 + whatsapp-web.js
// ============================================================
class LunaAgent {
  constructor() {
    this.cp = new CheckpointManager();
    this.analyzer = new IntelligenceAnalyzer();
    this.reporter = new ReportGenerator();
    this.client = null;
    this.ready = false;
    this.lastReport = null;
    this.reportGroup = null;
    this.running = false;
  }

  async init(options = {}) {
    const { once = false, schedule = true } = options;
    log.extraordinary('=== LUNA v14.1 "OMNIA HYBRID" ===');
    log.info('100% v10.2 + whatsapp-web.js engine');

    this.client = new Client({
      authStrategy: new LocalAuth({ clientId: 'luna-main', dataPath: SESSION_DATA_PATH, rmMaxRetries: 1 }),
      puppeteer: {
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
      }
    });

    // QR Code
    this.client.on('qr', (qr) => {
      log.warn('QR Code! Escaneie:');
      qrcode.generate(qr, { small: true });
    });

    const readyPromise = new Promise((resolve, reject) => {
      // Ready
      this.client.on('ready', async () => {
        try {
          log.extraordinary('WhatsApp pronto!');
          this.ready = true;
          const result = await this.startMonitoring({ schedule: schedule && !once });
          if (once) { log.info('Modo once: mantendo sessão aberta (sem destroy).'); }
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });

    // Mensagens em tempo real (respostas automáticas)
    this.client.on('message', async (msg) => {
      if (msg.fromMe) return;

      const mentionBody = (msg.body || '').toLowerCase();
      if (/@luna|@kimi|@kimiclaw/.test(mentionBody)) {
        const hashes = (this.cp && this.cp.checkpoint && this.cp.checkpoint.knownMessageHashes) ? this.cp.checkpoint.knownMessageHashes.length : 0;
        const lastScan = (this.cp && this.cp.checkpoint && this.cp.checkpoint.lastScan) ? this.cp.checkpoint.lastScan : 'nunca';
        try {
          await msg.reply('🌙 Status: Online | Hashes: ' + hashes + ' | Último scan: ' + lastScan);
        } catch (err) {
          log.error('Falha ao responder mencao: ' + err.message);
        }
      }

      const body = (msg.body || '').toLowerCase();
      if (/@luna|@kimi|@abner|@todos|@equipe|@nexo/.test(body)) {
        log.info(`MENCAO de ${msg.pushname || msg.from}: ${(msg.body || "").slice(0, 80)}`);
        await msg.reply('Recebido. Vou agir nisso agora. Se quiser, use: /status, /tarefas, /relatorio');
      }
      if ((msg.body || '').startsWith('/')) await this.handleCommand(msg);
    });
    this.client.on('message_create', async (msg) => {
      if (msg.fromMe) return;

      const mentionBody = (msg.body || '').toLowerCase();
      if (/@luna|@kimi|@kimiclaw/.test(mentionBody)) {
        const hashes = (this.cp && this.cp.checkpoint && this.cp.checkpoint.knownMessageHashes) ? this.cp.checkpoint.knownMessageHashes.length : 0;
        const lastScan = (this.cp && this.cp.checkpoint && this.cp.checkpoint.lastScan) ? this.cp.checkpoint.lastScan : 'nunca';
        try {
          await msg.reply('🌙 Status: Online | Hashes: ' + hashes + ' | Último scan: ' + lastScan);
        } catch (err) {
          log.error('Falha ao responder mencao: ' + err.message);
        }
      }


      // Detecta menções
      if (/@luna|@kimi|@abner|@todos|@equipe|@nexo/i.test(msg.body)) {
        log.info(`MENCAO de ${msg.pushname || msg.from}: ${msg.body?.slice(0, 50)}`);
        await msg.reply('🌙 Oi! Sou a Luna. Vi que me mencionou!\n\nComandos:\n/status — Projetos\n/relatorio — Relatório\n/tarefas — Tarefas\n/ajuda — Ajuda');
      }

      // Comandos
      if (msg.body?.startsWith('/')) {
        await this.handleCommand(msg);
      }
    });

    this.client.on('auth_failure', (msg) => log.error(`Auth: ${msg}`));
    this.client.on('disconnected', (reason) => { log.warn(`Desconectado: ${reason}`); this.ready = false; });

    await this.client.initialize();
    return readyPromise;
  }

  async handleCommand(msg) {
    const cmd = msg.body.toLowerCase();

    if (cmd === '/status') {
      await msg.reply('📊 *STATUS NEXO*\n\n🟢 Santafe: 65%\n🟡 Sorveteria: 45%\n🟡 Superclim: 40%\n🔴 Mangá: 25%\n🔴 SpeakEasily: 10%\n\n🤖 Luna v14.1');
    }
    else if (cmd === '/relatorio') {
      await msg.reply('📊 Gerando...');
      await this.forceReport(msg.from);
    }
    else if (cmd === '/tarefas') {
      const tasks = this.cp.buffer.newTasks || [];
      const list = tasks.length > 0 ? tasks.map(t => `• [${t.priority}] ${(t.body||t.text||'').slice(0, 50)}`).join('\n') : 'Nenhuma tarefa pendente.';
      await msg.reply(`📝 *TAREFAS*\n\n${list}\n\n🤖 Luna v14.1`);
    }
    else if (cmd === '/ajuda') {
      await msg.reply('🌙 *AJUDA LUNA*\n\n/status — Projetos\n/relatorio — Relatório\n/tarefas — Tarefas\n/ajuda — Este menu\n\nMencione @Luna para falar!');
    }
    else if (cmd.startsWith('/createTask')) {
      await msg.reply('✅ Tarefa criada! (simulado)');
    }
    else if (cmd.startsWith('/updateFinance')) {
      await msg.reply('💰 Financeiro atualizado! (simulado)');
    }
    else if (cmd.startsWith('/sendReport')) {
      await msg.reply('📤 Enviando relatório...');
      await this.forceReport(msg.from);
    }
    else if (cmd.startsWith('/deploy')) {
      await msg.reply('🚀 Deploy iniciado! (simulado)');
    }
  }

  async startMonitoring(options = {}) {
    const { schedule = true } = options;
    log.info('Monitoramento iniciado');

    // Encontra grupo de relatórios
    const chats = await this.client.getChats();
    this.reportGroup = chats.find(c => c.isGroup && c.name?.toLowerCase().includes(CONFIG.REPORT_TO.toLowerCase()));

    if (this.reportGroup) {
      log.success(`Grupo de relatórios: ${this.reportGroup.name}`);
    } else {
      log.warn('Grupo de relatórios não encontrado!');
    }

    // Scan inicial
    const result = await this.runOnce();

    // Agenda scans
    if (schedule) {
      setInterval(() => this.runOnce(), CONFIG.SCAN_INTERVAL);
    }

    return result;
  }

  // ============================================================
  // SCAN (v10.2 — agora com whatsapp-web.js)
  // ============================================================
  async runOnce() {
    if (this.running) {
      log.warn('Ja rodando!');
      return { status: 'busy', hasNews: false };
    }
    this.running = true;

    try {
      log.scan('=== SCAN INICIADO ===');

      const allMessages = [];
      const chats = await this.client.getChats();

      for (const chat of chats) {
        if (!chat.isGroup) continue;  // Só grupos (v10.2)

        // PRIVACIDADE: processar SOMENTE chats autorizados
        const chatName = (chat.name || '').trim();
        if (!isAuthorizedChat(chatName)) {
          log.info(`IGNORADO chat não autorizado: ${chatName || 'sem-nome'}`);
          continue;
        }

        log.scan(`Escaneando: ${chat.name}`);

        // Pega mensagens (substitui scroll infinito)
        const messages = await chat.fetchMessages({ limit: 50 });

        if (!isAuthorizedChat(chat.name || '')) {
          continue;
        }

        for (const msg of messages) {
          if (msg.fromMe) continue;  // Ignora minhas mensagens (v10.2)

          if (this.cp.isNew(msg)) {
            allMessages.push(msg);
            this.cp.markProcessed(msg);
          }
        }
      }

      log.info(`Total: ${allMessages.length} mensagens novas`);

      if (allMessages.length > 0) {
        // Análise (v10.2)
        const analysis = this.analyzer.analyze(allMessages);
        const sentiment = this.analyzer.analyzeSentiment(allMessages);

        log.success(`Tarefas: ${analysis.tasks.length} | Ideias: ${analysis.ideas.length} | Links: ${analysis.links.length} | Mencoes: ${analysis.mentions.length}`);

        // Buffer (v10.2)
        this.cp.buffer.newMessages.push(...allMessages);
        this.cp.buffer.newTasks.push(...analysis.tasks);
        this.cp.buffer.newIdeas.push(...analysis.ideas);
        this.cp.buffer.newDecisions.push(...analysis.decisions);
        this.cp.buffer.newLinks.push(...analysis.links);
        this.cp.buffer.newMentions.push(...analysis.mentions);
        this.cp.buffer.lastBufferUpdate = new Date().toISOString();

        // Relatórios (v10.2)
        const report = this.reporter.generate({ messages: allMessages, analysis, sentiment, groups: CONFIG.GROUPS });
        const ts = Date.now();
        fs.writeFileSync(path.join(CONFIG.REPORTS_DIR, `report-${ts}.html`), report.html);
        fs.writeFileSync(path.join(CONFIG.REPORTS_DIR, `report-${ts}.txt`), report.txt);
        fs.writeFileSync(path.join(CONFIG.REPORTS_DIR, `report-${ts}.json`), report.json);

        // Notificação Ops (v10.2)
        await this.notifyOps({ messages: allMessages, analysis, sentiment });

        // Envia relatório? (v10.2: 30min)
        const now = Date.now();
        const shouldReport = !this.lastReport || (now - this.lastReport) >= CONFIG.REPORT_INTERVAL;

        if (shouldReport && this.reportGroup) {
          await this.sendReport(report.txt);
          this.lastReport = now;
          this.cp.checkpoint.lastReport = new Date().toISOString();
        }

        this.cp.checkpoint.silenceCount = 0;
        log.extraordinary('Scan completo!');

      } else {
        // Silêncio inteligente (v10.2)
        this.cp.checkpoint.silenceCount = (this.cp.checkpoint.silenceCount || 0) + 1;
        log.info(`Silêncio #${this.cp.checkpoint.silenceCount}`);

        if (this.cp.checkpoint.silenceCount === 1 && this.reportGroup) {
          await this.sendReport('🌙 *LUNA REPORT*\n\n🔇 Sin novedades en los últimos 30 minutos.\n\n🤖 Luna v14.1');
          this.lastReport = Date.now();
        }
      }

      this.cp.checkpoint.lastScan = new Date().toISOString();
      this.cp.save();

      // Output para dashboard (v10.2)
      fs.writeFileSync(CONFIG.OUTPUT_FILE, JSON.stringify({
        messages: allMessages,
        groups: CONFIG.GROUPS,
        lastUpdated: new Date().toISOString(),
        stats: {
          total: allMessages.length,
          tasks: allMessages.filter(m=>m.type==='task').length,
          ideas: allMessages.filter(m=>m.type==='idea').length,
          decisions: allMessages.filter(m=>m.type==='decision').length,
          links: allMessages.filter(m=>m.type==='link').length
        }
      }, null, 2));

      return {
        status: 'ok',
        hasNews: allMessages.length > 0,
        buffered: this.cp.buffer.newMessages.length,
        messages: allMessages.length
      };

    } catch (e) {
      log.error(`Run: ${e.message}`);
      return { status: 'error', hasNews: false, error: e.message };
    } finally {
      this.running = false;
    }
  }

  async sendReport(text) {
    if (!this.reportGroup) { log.error('Sem grupo de relatórios'); return false; }
    try {
      await this.reportGroup.sendMessage(text);
      log.success('Relatório enviado!');
      return true;
    } catch (e) { log.error(`Send: ${e.message}`); return false; }
  }

  async forceReport(to) {
    const report = this.reporter.generate({
      messages: this.cp.buffer.newMessages || [],
      analysis: {
        tasks: this.cp.buffer.newTasks || [],
        ideas: this.cp.buffer.newIdeas || [],
        decisions: this.cp.buffer.newDecisions || [],
        links: this.cp.buffer.newLinks || [],
        mentions: this.cp.buffer.newMentions || []
      },
      groups: CONFIG.GROUPS
    });

    try {
      const chat = await this.client.getChatById(to);
      await chat.sendMessage(report.txt);
      log.success('Relatório forçado enviado!');
    } catch (e) { log.error(`Force: ${e.message}`); }
  }

  async notifyOps(data) {
    try {
      const payload = {
        source: 'luna-whatsapp',
        timestamp: new Date().toISOString(),
        newMessages: data.messages.length,
        newTasks: data.analysis.tasks.length,
        newIdeas: data.analysis.ideas.length,
        newDecisions: data.analysis.decisions.length,
        newLinks: data.analysis.links.length,
        mentions: data.analysis.mentions.length,
        sentiment: data.sentiment,
        bufferSize: this.cp.buffer.newMessages.length
      };
      const fetch = (await import('node-fetch')).default;
      await fetch('http://localhost:3456/api/ops/changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {});
    } catch (e) { /* Silencioso */ }
  }
}

// ============================================================
// EXECUCAO / API
// ============================================================
async function runAgent(isReportTime = false) {
  const agent = new LunaAgent();
  const result = await agent.init({ once: true, schedule: false });
  return { ...result, isReportTime };
}

function diagnose() {
  const checks = {
    whatsappWebJs: Boolean(require.resolve('whatsapp-web.js')),
    qrcodeTerminal: Boolean(require.resolve('qrcode-terminal')),
    checkpointDir: path.dirname(CONFIG.CHECKPOINT_FILE),
    outputFile: CONFIG.OUTPUT_FILE,
    reportsDir: CONFIG.REPORTS_DIR,
    artifactsDir: CONFIG.ARTIFACTS_DIR,
    chromePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    chromeExists: fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  };
  console.log(JSON.stringify(checks, null, 2));
  return checks;
}

module.exports = { LunaAgent, runAgent, diagnose, CONFIG };

if (require.main === module) {
  if (process.argv.includes('--diagnose')) {
    diagnose();
  } else {
    const agent = new LunaAgent();
    agent.init({ once: process.argv.includes('--once') }).catch((error) => {
      log.error(`Fatal: ${error.message}`);
      process.exit(1);
    });
  }
}







