/**
 * NEXO WhatsApp Mapped Agent v5
 * Click fixo em coordenadas mapeadas do grupo
 * 
 * Coordenadas mapeadas (1366x641):
 * - Grupo "🏆Production - 2026🙏": X=200, Y=260 (centro do chat item)
 * - Atualizar se mudar resolução ou layout
 */

const { chromium } = require('playwright');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  groupName: '🏆Production - 2026🙏',
  apiUrl: 'http://127.0.0.1:3456/api/whatsapp',
  cdpEndpoint: 'http://127.0.0.1:9222',
  checkpointFile: path.join(__dirname, '..', 'data', 'whatsapp-checkpoints.json'),
  checkIntervalMs: 5000,
  // Coordenadas mapeadas do grupo na lista (ajustar se necessário)
  groupClick: { x: 200, y: 260 },
};

// ── Checkpoint System ─────────────────────────────────────────────────────

class CheckpointManager {
  constructor(filePath) {
    this.filePath = filePath;
    this.checkpoints = this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      }
    } catch {}
    return {
      version: 1,
      lastCheckpoint: null,
      lastCheckpointTime: null,
      seenMessageIds: [],
      compactedReports: [],
      currentSession: { startTime: new Date().toISOString(), messagesSinceCheckpoint: [] }
    };
  }

  save() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.checkpoints, null, 2));
  }

  isMessageSeen(msgId) {
    return this.checkpoints.seenMessageIds.includes(msgId);
  }

  markMessageSeen(msgId) {
    if (!this.checkpoints.seenMessageIds.includes(msgId)) {
      this.checkpoints.seenMessageIds.push(msgId);
      if (this.checkpoints.seenMessageIds.length > 5000) {
        this.checkpoints.seenMessageIds = this.checkpoints.seenMessageIds.slice(-3000);
      }
    }
  }

  addToCurrentSession(msg) {
    this.checkpoints.currentSession.messagesSinceCheckpoint.push({
      ...msg,
      receivedAt: new Date().toISOString(),
    });
  }

  shouldGenerateCheckpoint() {
    if (!this.checkpoints.lastCheckpointTime) return true;
    const last = new Date(this.checkpoints.lastCheckpointTime);
    const now = new Date();
    const diffMin = (now - last) / (1000 * 60);
    return diffMin >= 30;
  }

  generateCheckpoint() {
    const messages = this.checkpoints.currentSession.messagesSinceCheckpoint;
    if (messages.length === 0) {
      this.checkpoints.lastCheckpointTime = new Date().toISOString();
      this.save();
      return null;
    }

    const checkpoint = {
      id: `cp-${Date.now()}`,
      timestamp: new Date().toISOString(),
      messageCount: messages.length,
      summary: this.compactMessages(messages),
      recentMessages: messages.slice(-10).map(m => ({
        text: m.text?.substring(0, 200),
        from: m.from,
        time: m.time,
        task: m.task,
        mentions: m.mentions,
      })),
      stats: {
        totalMessages: messages.length,
        tasksDetected: messages.filter(m => m.task).length,
        mentionsCount: messages.reduce((acc, m) => acc + (m.mentions?.length || 0), 0),
        uniqueSenders: [...new Set(messages.map(m => m.from))].length,
      }
    };

    this.checkpoints.compactedReports.push(checkpoint);
    if (this.checkpoints.compactedReports.length > 50) {
      this.checkpoints.compactedReports = this.checkpoints.compactedReports.slice(-30);
    }

    this.checkpoints.currentSession.messagesSinceCheckpoint = [];
    this.checkpoints.lastCheckpoint = checkpoint.id;
    this.checkpoints.lastCheckpointTime = checkpoint.timestamp;
    this.save();

    return checkpoint;
  }

  compactMessages(messages) {
    const categories = { tasks: [], mentions: [], decisions: [], updates: [], other: [] };
    for (const msg of messages) {
      if (msg.task) categories.tasks.push({ text: msg.task, from: msg.from, time: msg.time });
      else if (msg.mentions?.length > 0) categories.mentions.push({ text: msg.text?.substring(0, 100), mentions: msg.mentions, from: msg.from });
      else if (/\b(ok|feito|pronto|done|approved|aprovado)\b/i.test(msg.text)) categories.decisions.push({ text: msg.text?.substring(0, 100), from: msg.from, time: msg.time });
      else if (/\b(update|atualização|status|progresso)\b/i.test(msg.text)) categories.updates.push({ text: msg.text?.substring(0, 100), from: msg.from, time: msg.time });
      else categories.other.push({ text: msg.text?.substring(0, 80), from: msg.from });
    }
    return categories;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function nowISO() { return new Date().toISOString(); }

async function sendToDashboard(msg) {
  try {
    await axios.post(CONFIG.apiUrl, msg, { timeout: 5000 });
    return true;
  } catch { return false; }
}

function extractTasks(text) {
  if (!text) return null;
  const patterns = [
    /(?:fazer|faz|fazemos|precisamos|tem que|temos que|devemos|vamos)\s+(.+)/i,
    /(?:tarefa|task|todo|ação):?\s*(.+)/i,
    /(?:bug|erro|problema|issue):?\s*(.+)/i,
    /(?:implementar|desenvolver|criar|montar|configurar)\s+(.+)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

function detectMentions(text) {
  if (!text) return [];
  const m = [];
  if (/\b(abner|jhin)\b/i.test(text)) m.push('abner');
  if (/\b(nonoke|nono)\b/i.test(text)) m.push('nonoke');
  if (/\b(elias)\b/i.test(text)) m.push('elias');
  if (/\b(todos|equipe|time|galera)\b/i.test(text)) m.push('all');
  return m;
}

function generateMessageId(text, time, sender) {
  const normalized = `${sender}:${text?.substring(0, 100)}:${time?.substring(0, 16)}`;
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `msg-${Math.abs(hash).toString(36)}`;
}

// ── Main ──────────────────────────────────────────────────────────────────

async function run() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  NEXO WhatsApp Mapped Agent v5');
  console.log('  Click fixo em coordenadas mapeadas');
  console.log('  Grupo: 🏆Production - 2026🙏');
  console.log('  Click: X=' + CONFIG.groupClick.x + ', Y=' + CONFIG.groupClick.y);
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  const cp = new CheckpointManager(CONFIG.checkpointFile);
  console.log(`[Checkpoint] ${cp.checkpoints.seenMessageIds.length} mensagens já vistas.`);
  console.log(`[Checkpoint] ${cp.checkpoints.compactedReports.length} relatórios históricos.`);
  console.log('');

  // Conecta no WhatsApp via CDP
  console.log('[WhatsApp] Conectando via CDP...');
  let browser, page;
  try {
    browser = await chromium.connectOverCDP(CONFIG.cdpEndpoint);
    const contexts = browser.contexts();
    for (const ctx of contexts) {
      for (const p of ctx.pages()) {
        if (p.url().includes('web.whatsapp.com')) {
          page = p;
          break;
        }
      }
      if (page) break;
    }
    if (!page) throw new Error('Pagina do WhatsApp nao encontrada');
    console.log('[WhatsApp] Conectado!');
  } catch (e) {
    console.error('❌', e.message);
    console.log('Abra o WhatsApp PWA com: start-abner-chrome.bat');
    process.exit(1);
  }

  // Verifica se está logado
  const isLogged = await page.locator('[data-testid="chat-list"]').count() > 0;
  if (!isLogged) {
    console.log('⚠️  WhatsApp nao logado. Escanee o QR code.');
    await browser.close();
    return;
  }
  console.log('[WhatsApp] Logado!');

  // Clica no grupo usando coordenadas mapeadas
  console.log(`[WhatsApp] Clicando no grupo em (${CONFIG.groupClick.x}, ${CONFIG.groupClick.y})...`);
  try {
    await page.mouse.click(CONFIG.groupClick.x, CONFIG.groupClick.y);
    console.log('[WhatsApp] Click realizado!');
    
    // Aguarda a página carregar as mensagens (pode demorar 3-5 segundos)
    console.log('[WhatsApp] Aguardando mensagens carregarem...');
    await page.waitForTimeout(5000);
    
    // Verifica se mensagens apareceram
    let msgCount = await page.locator('[data-testid="msg-container"]').count();
    let retries = 0;
    while (msgCount === 0 && retries < 5) {
      await page.waitForTimeout(2000);
      msgCount = await page.locator('[data-testid="msg-container"]').count();
      retries++;
      console.log(`   Tentativa ${retries}: ${msgCount} mensagens`);
    }
    
    if (msgCount > 0) {
      console.log(`[WhatsApp] Grupo aberto! ${msgCount} mensagens carregadas.`);
    } else {
      console.log('[WhatsApp] Aviso: Nenhuma mensagem encontrada após click.');
    }
  } catch (e) {
    console.log('[WhatsApp] Click falhou:', e.message);
  }

  console.log('');
  console.log('👁️  Monitorando mensagens... (Ctrl+C para parar)');
  console.log('───────────────────────────────────────────────────────');

  let lastTexts = new Set();

  const getMessages = async () => {
    const results = [];
    
    // Tenta múltiplos seletores (WhatsApp Web vs WhatsApp Business)
    let containers = [];
    
    // Seletor 1: WhatsApp Web padrão
    containers = await page.locator('[data-testid="msg-container"]').all();
    if (containers.length === 0) {
      // Seletor 2: Mensagens em div com role=row
      containers = await page.locator('div[role="row"]').all();
    }
    if (containers.length === 0) {
      // Seletor 3: Qualquer div com texto dentro do painel de mensagens
      const msgPanel = await page.locator('div[tabindex="0"]').nth(1).all();
      if (msgPanel.length > 0) {
        containers = await msgPanel[0].locator('div').all();
      }
    }
    
    console.log(`[Debug] ${containers.length} containers encontrados.`);
    
    for (const container of containers.slice(-30)) {
      try {
        // Tenta múltiplas formas de extrair texto
        let text = null;
        
        // Método 1: selectable-text
        try {
          text = await container.locator('.selectable-text span').first().textContent({ timeout: 300 });
        } catch {}
        
        // Método 2: Qualquer span com texto
        if (!text) {
          try {
            const spans = await container.locator('span').all();
            for (const span of spans) {
              const t = await span.textContent();
              if (t && t.length > 2 && t.length < 500) {
                text = t;
                break;
              }
            }
          } catch {}
        }
        
        if (!text || text.length < 2) continue;
        
        // Extrai hora
        let time = '';
        try {
          time = await container.locator('[data-testid="msg-meta"] span').first().textContent({ timeout: 300 });
        } catch {}
        
        // Extrai sender
        let sender = 'unknown';
        try {
          sender = await container.locator('span[dir="auto"]').first().textContent({ timeout: 300 });
        } catch {}
        
        results.push({ text, time, sender });
      } catch {}
    }
    return results;
  };

  // Inicializa
  const initial = await getMessages();
  console.log(`[Init] ${initial.length} mensagens encontradas na página.`);
  initial.forEach(m => {
    const id = generateMessageId(m.text, m.time, m.sender);
    lastTexts.add(id);
    cp.markMessageSeen(id);
    console.log(`[Init] Visto: ${m.sender}: ${m.text.substring(0, 50)}`);
  });
  console.log(`${initial.length} mensagens iniciais marcadas como vistas.`);

  // Loop
  while (true) {
    await new Promise(r => setTimeout(r, CONFIG.checkIntervalMs));

    const current = await getMessages();
    let newCount = 0;

    for (const msg of current) {
      const msgId = generateMessageId(msg.text, msg.time, msg.sender);
      if (lastTexts.has(msgId)) continue;

      lastTexts.add(msgId);
      cp.markMessageSeen(msgId);
      newCount++;

      if (msg.text.length < 3) continue;

      const task = extractTasks(msg.text);
      const mentions = detectMentions(msg.text);

      const enrichedMsg = {
        text: msg.text,
        from: msg.sender,
        time: msg.time,
        group: CONFIG.groupName,
        task,
        mentions,
        msgId,
      };

      cp.addToCurrentSession(enrichedMsg);
      await sendToDashboard(enrichedMsg);

      console.log('');
      console.log(`💬 [${msg.time}] ${msg.sender}: ${msg.text.substring(0, 100)}`);
      if (task) console.log(`   🎯 Tarefa: ${task}`);
      if (mentions.length) console.log(`   👥 Menções: ${mentions.join(', ')}`);
    }

    if (newCount > 0) {
      console.log(`   [+${newCount} novas | total vistas: ${cp.checkpoints.seenMessageIds.length}]`);
    }

    // Checkpoint a cada 30 min
    if (cp.shouldGenerateCheckpoint()) {
      console.log('');
      console.log('📊 Gerando checkpoint...');
      const report = cp.generateCheckpoint();
      if (report) {
        console.log(`   ✓ Checkpoint ${report.id}`);
        console.log(`   📈 ${report.messageCount} msgs | ${report.stats.tasksDetected} tarefas | ${report.stats.mentionsCount} menções`);
        await sendToDashboard({ type: 'checkpoint-report', ...report });
      }
    }
  }
}

if (require.main === module) {
  run().catch(err => {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  });
}

module.exports = { CheckpointManager, extractTasks, detectMentions };
