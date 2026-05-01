/**
 * NEXO WhatsApp Checkpoint Agent v4
 * 
 * Arquitetura de Context Compaction com Checkpoints:
 * - Checkpoint 0: Estado inicial (mensagens já vistas)
 * - Checkpoint N: A cada 30 min, gera relatório compactado
 * - Só processa NOVAS mensagens desde o último checkpoint
 * - Nunca re-processa mensagens antigas
 * 
 * Referências:
 * - OpenAI Agents SDK: Context Engineering for Personalization
 * - LangGraph: MemorySaver + Checkpointing
 * - JetBrains Research: Observation Masking vs LLM Summarization
 */

const { chromium } = require('playwright');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────────

const CONFIG = {
  groupName: '🏆Production - 2026🙏',
  apiUrl: 'http://127.0.0.1:3456/api/whatsapp',
  checkpointIntervalMin: 30,      // Gera relatório a cada 30 min
  checkpointFile: path.join(__dirname, '..', 'data', 'whatsapp-checkpoints.json'),
  cdpEndpoint: 'http://127.0.0.1:9222',
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
    } catch (e) {
      console.log('   [Checkpoint] Arquivo corrompido, criando novo.');
    }
    return {
      version: 1,
      lastCheckpoint: null,
      lastCheckpointTime: null,
      seenMessageIds: [],           // IDs de mensagens JÁ processadas
      compactedReports: [],         // Relatórios compactados históricos
      currentSession: {
        startTime: new Date().toISOString(),
        messagesSinceCheckpoint: [],
      }
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
      // Limita histórico para evitar crescimento infinito
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
    return diffMin >= CONFIG.checkpointIntervalMin;
  }

  generateCheckpoint() {
    const messages = this.checkpoints.currentSession.messagesSinceCheckpoint;
    if (messages.length === 0) {
      console.log('   [Checkpoint] Nenhuma mensagem nova desde o último checkpoint.');
      this.checkpoints.lastCheckpointTime = new Date().toISOString();
      this.save();
      return null;
    }

    // Compactação: extrai apenas o essencial
    const checkpoint = {
      id: `cp-${Date.now()}`,
      timestamp: new Date().toISOString(),
      messageCount: messages.length,
      // Compaction: agrupa por tipo
      summary: this.compactMessages(messages),
      // Mantém as últimas 10 mensagens em full (para contexto recente)
      recentMessages: messages.slice(-10).map(m => ({
        text: m.text?.substring(0, 200),
        from: m.from,
        time: m.time,
        task: m.task,
        mentions: m.mentions,
      })),
      // Estatísticas
      stats: {
        totalMessages: messages.length,
        tasksDetected: messages.filter(m => m.task).length,
        mentionsCount: messages.reduce((acc, m) => acc + (m.mentions?.length || 0), 0),
        uniqueSenders: [...new Set(messages.map(m => m.from))].length,
      }
    };

    this.checkpoints.compactedReports.push(checkpoint);
    
    // Limita relatórios compactados (mantém últimos 50)
    if (this.checkpoints.compactedReports.length > 50) {
      this.checkpoints.compactedReports = this.checkpoints.compactedReports.slice(-30);
    }

    // Reseta sessão atual
    this.checkpoints.currentSession.messagesSinceCheckpoint = [];
    this.checkpoints.lastCheckpoint = checkpoint.id;
    this.checkpoints.lastCheckpointTime = checkpoint.timestamp;
    this.save();

    return checkpoint;
  }

  compactMessages(messages) {
    // Agrupa mensagens por categoria
    const categories = {
      tasks: [],
      mentions: [],
      decisions: [],
      updates: [],
      other: [],
    };

    for (const msg of messages) {
      if (msg.task) {
        categories.tasks.push({ text: msg.task, from: msg.from, time: msg.time });
      } else if (msg.mentions?.length > 0) {
        categories.mentions.push({ text: msg.text?.substring(0, 100), mentions: msg.mentions, from: msg.from });
      } else if (/\b(ok|feito|pronto|done|approved|aprovado)\b/i.test(msg.text)) {
        categories.decisions.push({ text: msg.text?.substring(0, 100), from: msg.from, time: msg.time });
      } else if (/\b(update|atualização|status|progresso)\b/i.test(msg.text)) {
        categories.updates.push({ text: msg.text?.substring(0, 100), from: msg.from, time: msg.time });
      } else {
        categories.other.push({ text: msg.text?.substring(0, 80), from: msg.from });
      }
    }

    return categories;
  }

  getContextForAgent() {
    // Retorna contexto compactado para o agente
    // Inclui: último checkpoint + mensagens desde então
    const lastCp = this.checkpoints.compactedReports.slice(-1)[0];
    const recent = this.checkpoints.currentSession.messagesSinceCheckpoint.slice(-20);
    
    return {
      lastCheckpoint: lastCp ? {
        id: lastCp.id,
        timestamp: lastCp.timestamp,
        summary: lastCp.summary,
        stats: lastCp.stats,
      } : null,
      messagesSinceCheckpoint: recent.map(m => ({
        text: m.text?.substring(0, 150),
        from: m.from,
        task: m.task,
        mentions: m.mentions,
      })),
      totalSeenMessages: this.checkpoints.seenMessageIds.length,
    };
  }
}

// ── Message Extractors ────────────────────────────────────────────────────

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
  // Gera ID único baseado no conteúdo (não no timestamp de recebimento)
  const normalized = `${sender}:${text?.substring(0, 100)}:${time?.substring(0, 16)}`;
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `msg-${Math.abs(hash).toString(36)}`;
}

// ── Dashboard API ─────────────────────────────────────────────────────────

async function sendToDashboard(msg) {
  try {
    await axios.post(CONFIG.apiUrl, msg, { timeout: 5000 });
    return true;
  } catch (e) {
    return false;
  }
}

async function sendCheckpointReport(checkpoint) {
  try {
    await axios.post(CONFIG.apiUrl, {
      type: 'checkpoint-report',
      ...checkpoint,
      source: 'whatsapp-checkpoint-agent',
    }, { timeout: 5000 });
    console.log('   [Checkpoint] Relatório enviado para dashboard!');
    return true;
  } catch (e) {
    console.log('   [Checkpoint] Falha ao enviar relatório:', e.message);
    return false;
  }
}

// ── WhatsApp Web Connector ────────────────────────────────────────────────

async function connectWhatsApp() {
  console.log('[WhatsApp] Conectando via CDP...');
  
  const browser = await chromium.connectOverCDP(CONFIG.cdpEndpoint);
  const contexts = browser.contexts();
  
  let page = null;
  for (const ctx of contexts) {
    for (const p of ctx.pages()) {
      if (p.url().includes('web.whatsapp.com')) {
        page = p;
        break;
      }
    }
    if (page) break;
  }

  if (!page) {
    throw new Error('Pagina do WhatsApp Web nao encontrada no CDP. Abra o Chrome com WhatsApp Web logado.');
  }

  // Verifica se está logado
  const isLogged = await page.locator('[data-testid="chat-list"]').count() > 0;
  if (!isLogged) {
    throw new Error('WhatsApp Web nao esta logado. Escanee o QR code primeiro.');
  }

  console.log('[WhatsApp] Conectado!');
  return { browser, page };
}

async function openGroup(page, groupName) {
  console.log(`[WhatsApp] Procurando grupo: ${groupName}`);
  
  try {
    // Tenta múltiplas estratégias para encontrar o grupo
    
    // Estratégia 1: Pesquisa direta
    try {
      const searchBox = page.locator('[data-testid="chat-list-search"]').or(
        page.locator('div[contenteditable="true"][data-tab="3"]')
      );
      await searchBox.first().click({ timeout: 3000 });
      await page.keyboard.type(groupName);
      await page.waitForTimeout(2000);
      
      // Tenta clicar no resultado
      const result = page.locator(`text="${groupName}"`).first();
      await result.click({ timeout: 5000 });
      await page.waitForTimeout(2000);
      console.log('[WhatsApp] Grupo aberto via pesquisa!');
      return true;
    } catch {}
    
    // Estratégia 2: Procura na lista de chats visível
    console.log('[WhatsApp] Pesquisa falhou. Procurando na lista...');
    const chats = await page.locator('[data-testid="chat-list-item"]').all();
    for (const chat of chats) {
      const text = await chat.textContent().catch(() => '');
      if (text.includes('Production') || text.includes('2026')) {
        await chat.click();
        await page.waitForTimeout(2000);
        console.log('[WhatsApp] Grupo encontrado na lista!');
        return true;
      }
    }
    
    // Estratégia 3: Usa JavaScript para procurar e clicar no grupo
    console.log('[WhatsApp] Tentando via JavaScript...');
    try {
      const found = await page.evaluate((groupName) => {
        // Procura por elementos que contenham o texto do grupo
        const allElements = document.querySelectorAll('*');
        for (const el of allElements) {
          if (el.textContent && (el.textContent.includes('Production') || el.textContent.includes('2026'))) {
            // Tenta clicar no elemento pai que seja clicável
            let clickable = el;
            while (clickable && !clickable.click) {
              clickable = clickable.parentElement;
            }
            if (clickable) {
              clickable.click();
              return true;
            }
          }
        }
        return false;
      }, groupName);
      
      if (found) {
        await page.waitForTimeout(2000);
        console.log('[WhatsApp] Grupo aberto via JavaScript!');
        return true;
      }
    } catch {}
    
    console.log('[WhatsApp] Grupo não encontrado. Monitorando chat atual.');
    return false;
  } catch (e) {
    console.log('[WhatsApp] Erro:', e.message);
    return false;
  }
}

async function getMessages(page) {
  const results = [];
  const containers = await page.locator('[data-testid="msg-container"]').all();
  
  for (const container of containers.slice(-30)) { // últimas 30 mensagens
    try {
      // Extrai texto
      const textEl = container.locator('.selectable-text span').first();
      const text = await textEl.textContent({ timeout: 500 });
      
      if (!text || text.length < 2) continue;
      
      // Extrai hora
      const timeEl = container.locator('[data-testid="msg-meta"] span').first();
      const time = await timeEl.textContent({ timeout: 500 }).catch(() => '');
      
      // Extrai sender (para mensagens de grupo)
      let sender = 'unknown';
      try {
        const senderEl = container.locator('span[dir="auto"]').first();
        sender = await senderEl.textContent({ timeout: 500 });
      } catch {}
      
      results.push({ text, time, sender });
    } catch {}
  }
  
  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────

async function run() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  NEXO WhatsApp Checkpoint Agent v4');
  console.log('  Context Compaction + Checkpoints a cada 30min');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  // Inicializa checkpoint manager
  const cp = new CheckpointManager(CONFIG.checkpointFile);
  console.log(`[Checkpoint] ${cp.checkpoints.seenMessageIds.length} mensagens já vistas.`);
  console.log(`[Checkpoint] ${cp.checkpoints.compactedReports.length} relatórios históricos.`);
  if (cp.checkpoints.lastCheckpointTime) {
    const last = new Date(cp.checkpoints.lastCheckpointTime);
    console.log(`[Checkpoint] Último: ${last.toLocaleString('pt-BR')}`);
  }
  console.log('');

  // Conecta no WhatsApp
  let browser, page;
  try {
    const conn = await connectWhatsApp();
    browser = conn.browser;
    page = conn.page;
  } catch (e) {
    console.error('❌', e.message);
    console.log('');
    console.log('Para usar este agente:');
    console.log('1. Abra o Chrome com: --remote-debugging-port=9222');
    console.log('2. Acesse web.whatsapp.com e escaneie o QR code');
    console.log('3. Entre no grupo "🏆Production - 2026🙏"');
    console.log('4. Rode este script novamente');
    process.exit(1);
  }

  // Abre o grupo
  await openGroup(page, CONFIG.groupName);

  console.log('');
  console.log('👁️  Monitorando mensagens...');
  console.log('   - Só processa NOVAS mensagens');
  console.log('   - Checkpoint a cada 30 minutos');
  console.log('   - Ctrl+C para parar');
  console.log('───────────────────────────────────────────────────────');

  // Loop principal
  let cycleCount = 0;
  
  while (true) {
    cycleCount++;
    
    // Coleta mensagens
    const messages = await getMessages(page);
    let newCount = 0;
    
    for (const msg of messages) {
      const msgId = generateMessageId(msg.text, msg.time, msg.sender);
      
      // Só processa se NUNCA viu antes
      if (cp.isMessageSeen(msgId)) continue;
      
      cp.markMessageSeen(msgId);
      newCount++;
      
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
      
      // Adiciona à sessão atual
      cp.addToCurrentSession(enrichedMsg);
      
      // Envia para dashboard em tempo real
      await sendToDashboard(enrichedMsg);
      
      // Log
      console.log('');
      console.log(`💬 [${msg.time}] ${msg.sender}: ${msg.text.substring(0, 100)}`);
      if (task) console.log(`   🎯 Tarefa: ${task}`);
      if (mentions.length) console.log(`   👥 Menções: ${mentions.join(', ')}`);
    }

    if (newCount > 0) {
      console.log(`   [+${newCount} novas | total vistas: ${cp.checkpoints.seenMessageIds.length}]`);
    }

    // Verifica se é hora de gerar checkpoint
    if (cp.shouldGenerateCheckpoint()) {
      console.log('');
      console.log('📊 Gerando checkpoint...');
      const report = cp.generateCheckpoint();
      if (report) {
        console.log(`   ✓ Checkpoint ${report.id}`);
        console.log(`   📈 ${report.messageCount} mensagens | ${report.stats.tasksDetected} tarefas | ${report.stats.mentionsCount} menções`);
        await sendCheckpointReport(report);
      }
    }

    // Aguarda próximo ciclo
    await new Promise(r => setTimeout(r, 5000));
  }
}

// ── Entrypoint ────────────────────────────────────────────────────────────

if (require.main === module) {
  run().catch(err => {
    console.error('❌ Erro fatal:', err.message);
    process.exit(1);
  });
}

module.exports = { CheckpointManager, extractTasks, detectMentions };
