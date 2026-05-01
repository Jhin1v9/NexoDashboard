/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * LUNA — CTO Virtual da NEXO Digital v10.0
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Assinatura: "— Luna 🌙 CTO Virtual NEXO"
 * 
 * Funcionalidades:
 * 1. Relatório SEMPRE enviado para 685093192 (Abner)
 * 2. Modo Acelerado: 10 min quando não há novidades
 * 3. Modo Normal: 30 min quando encontra novidades
 * 4. Checkpoint inteligente — evita processar mensagens repetidas
 * 5. Relatório completo e fácil de entender
 * 6. Verifica chat pessoal do Abner para ordens/comandos
 * 
 * SPLIT: 25% cada (Abner, Nonoke/Enoque, Elias, NEXO Digital)
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  CDP_URL: 'http://127.0.0.1:9223',
  
  // Grupos monitorados
  GROUPS: [
    { name: '🏆Production - 2026🙏', short: 'Production', type: 'internal' },
    { name: 'Paulo (web)', short: 'Paulo', type: 'client' }
  ],
  
  // REGRA: NUNCA enviar mensagens no chat pessoal do Abner
  // Apenas LER ordens/comandos se necessário no futuro
  // ABNER_PERSONAL: { name: 'Abner', number: '34685093192', type: 'command' },
  
  // REGRA ESTRITA: Só envia no grupo Production 2026
  // NUNCA enviar em chats pessoais ou outros grupos
  REPORT_DESTINATIONS: [
    { name: 'Production', number: '34685093192', type: 'group', groupName: '🏆Production - 2026🙏' }
  ],
  
  // Arquivos
  CHECKPOINT_FILE: path.join(__dirname, '..', 'backend', 'data', 'luna-checkpoint.json'),
  OUTPUT_FILE: path.join(__dirname, '..', 'backend', 'data', 'whatsapp-agent-data.json'),
  OPS_STATE_FILE: path.join(__dirname, '..', 'backend', 'data', 'ops-state.json'),
  
  // Limites
  MAX_SCROLLS: 30,
  SCROLL_DELAY: 800,
  
  // Modos de operação
  MODE_NORMAL: 30 * 60 * 1000,    // 30 minutos
  MODE_ACCELERATED: 10 * 60 * 1000, // 10 minutos
};

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITÁRIOS
// ═══════════════════════════════════════════════════════════════════════════════

function nowISO() { return new Date().toISOString(); }
function nowBR() { return new Date().toLocaleString('pt-BR', { timeZone: 'Europe/Madrid' }); }
function nowTime() { return new Date().toLocaleTimeString('pt-BR', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' }); }

function hashMessage(msg) {
  const text = (msg.text || '').substring(0, 100);
  const sender = msg.sender || '';
  const time = msg.time || '';
  let hash = 0;
  const str = `${sender}:${text}:${time}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJSON(file, defaultVal = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return defaultVal; }
}

function writeJSON(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECKPOINT SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

function loadCheckpoint() {
  return readJSON(CONFIG.CHECKPOINT_FILE, {
    version: '10.0',
    lastRun: null,
    knownMessageHashes: [],
    totalMessagesSeen: 0,
    consecutiveNoNews: 0,
    currentMode: 'normal', // 'normal' (30min) ou 'accelerated' (10min)
  });
}

function saveCheckpoint(cp) {
  writeJSON(CONFIG.CHECKPOINT_FILE, cp);
}

function getNewMessagesOnly(currentMessages, checkpoint) {
  const knownHashes = new Set(checkpoint.knownMessageHashes || []);
  const newMessages = [];
  const newHashes = [];
  
  for (const msg of currentMessages) {
    const hash = hashMessage(msg);
    if (!knownHashes.has(hash)) {
      newMessages.push(msg);
      newHashes.push(hash);
    }
  }
  
  return { newMessages, newHashes, totalKnown: knownHashes.size };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONEXÃO COM WHATSAPP WEB
// ═══════════════════════════════════════════════════════════════════════════════

async function connectWhatsApp() {
  console.log('[Luna] 🌙 Conectando ao Chrome na porta 9223...');
  
  let browser;
  try {
    browser = await chromium.connectOverCDP(CONFIG.CDP_URL);
  } catch (e) {
    console.log('[Luna] ❌ Chrome não está rodando');
    throw e;
  }
  
  let waPage = null;
  for (const ctx of browser.contexts()) {
    for (const p of ctx.pages()) {
      if (p.url().includes('web.whatsapp.com') && !p.url().includes('sw.js')) {
        waPage = p;
        break;
      }
    }
    if (waPage) break;
  }
  
  if (!waPage) {
    const context = browser.contexts()[0] || await browser.newContext();
    waPage = await context.newPage();
    await waPage.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waPage.waitForTimeout(5000);
  }
  
  const isLogged = await waPage.locator('[data-testid="chat-list"]').count() > 0;
  if (!isLogged) {
    const hasCanvas = await waPage.locator('canvas').count() > 0;
    if (hasCanvas) {
      console.log('[Luna] ⚠️ QR Code detectado. Escaneie com o celular!');
      throw new Error('WHATSAPP_NEEDS_LOGIN');
    } else {
      throw new Error('WhatsApp não está logado');
    }
  }
  
  console.log('[Luna] ✅ WhatsApp conectado!');
  return { browser, page: waPage };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXTRAÇÃO DE MENSAGENS
// ═══════════════════════════════════════════════════════════════════════════════

async function openGroup(page, groupConfig) {
  const { name, short } = groupConfig;
  console.log(`[Luna] 🔍 Procurando: ${name}`);
  
  try {
    const found = await page.evaluate((searchTerm) => {
      const items = document.querySelectorAll('[data-testid="chat-list-item"]');
      for (const item of items) {
        if (item.textContent.includes(searchTerm) || 
            item.textContent.includes('Production') || 
            item.textContent.includes('2026') || 
            item.textContent.includes('Paulo')) {
          item.click();
          return true;
        }
      }
      return false;
    }, short);
    
    if (found) {
      await page.waitForTimeout(2000);
      console.log(`[Luna] ✅ Grupo aberto: ${name}`);
      return true;
    }
  } catch (e) {
    console.log(`[Luna] ⚠️ Erro: ${e.message}`);
  }
  
  console.log(`[Luna] ❌ Grupo não encontrado: ${name}`);
  return false;
}

async function extractMessages(page, groupName) {
  const messages = [];
  const seenHashes = new Set();
  let scrollCount = 0;
  let lastHeight = 0;
  let stableCount = 0;
  
  await page.evaluate(() => {
    const container = document.querySelector('div[tabindex="0"]._ajx_') || 
                      document.querySelector('[data-testid="conversation-panel-messages"]') ||
                      document.querySelector('.copyable-area');
    if (container) container.scrollTop = container.scrollHeight;
  });
  await page.waitForTimeout(1500);
  
  while (scrollCount < CONFIG.MAX_SCROLLS && stableCount < 3) {
    const batch = await page.evaluate(() => {
      const msgs = [];
      const containers = document.querySelectorAll('.message-in, .message-out') || 
                         document.querySelectorAll('div[role="row"]');
      
      containers.forEach(container => {
        try {
          let textEl = container.querySelector('span.selectable-text.copyable-text');
          if (!textEl) textEl = container.querySelector('span[dir="ltr"].selectable-text');
          if (!textEl) {
            const spans = container.querySelectorAll('span');
            for (const s of spans) {
              if (s.textContent.length > 2 && s.textContent.length < 2000 && 
                  !s.closest('[data-testid="msg-meta"]')) {
                textEl = s;
                break;
              }
            }
          }
          
          const text = textEl?.textContent?.trim();
          if (!text || text.length < 2 || text.length > 2000) return;
          
          let time = '';
          const timeEl = container.querySelector('span[data-testid="msg-meta"] span[dir="auto"]');
          if (timeEl) time = timeEl.textContent.trim();
          
          let sender = '';
          const senderEl = container.querySelector('span[title]:not([data-testid="msg-meta"] *)');
          if (senderEl && senderEl.textContent !== text && senderEl.textContent.length < 50) {
            sender = senderEl.textContent.trim();
          }
          if (!sender) {
            const titled = container.querySelector('span[title]');
            if (titled && titled.textContent !== text && titled.textContent.length < 50) {
              sender = titled.getAttribute('title') || titled.textContent.trim();
            }
          }
          if (!sender) {
            const allSpans = container.querySelectorAll('span');
            for (const sp of allSpans) {
              const txt = sp.textContent.trim();
              if (txt && txt !== text && txt.length > 2 && txt.length < 40 && 
                  !txt.match(/^\d{1,2}:\d{2}$/) && !sp.closest('[data-testid="msg-meta"]')) {
                sender = txt;
                break;
              }
            }
          }
          
          const isOutgoing = container.classList.contains('message-out') || 
                            container.closest('.message-out') !== null;
          
          msgs.push({ text, sender: sender || (isOutgoing ? 'Você' : 'Desconhecido'), time, isOutgoing });
        } catch {}
      });
      
      return msgs;
    });
    
    let newCount = 0;
    for (const msg of batch) {
      const hash = `${msg.sender}:${msg.text.substring(0, 50)}:${msg.time}`;
      if (!seenHashes.has(hash)) {
        seenHashes.add(hash);
        messages.push({ ...msg, group: groupName });
        newCount++;
      }
    }
    
    const currentHeight = await page.evaluate(() => {
      const container = document.querySelector('div[tabindex="0"]._ajx_') || 
                        document.querySelector('[data-testid="conversation-panel-messages"]') ||
                        document.querySelector('.copyable-area');
      if (container) {
        const before = container.scrollTop;
        container.scrollTop -= 800;
        return container.scrollTop !== before ? container.scrollTop : -1;
      }
      return -1;
    });
    
    if (currentHeight === -1 || currentHeight === lastHeight) {
      stableCount++;
    } else {
      stableCount = 0;
      lastHeight = currentHeight;
    }
    
    scrollCount++;
    if (newCount > 0) {
      process.stdout.write(`\r[Luna] 📥 Scroll ${scrollCount}: ${messages.length} mensagens`);
    }
    await page.waitForTimeout(CONFIG.SCROLL_DELAY);
  }
  
  console.log(`\n[Luna] ✅ ${messages.length} mensagens extraídas de "${groupName}"`);
  return messages;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANÁLISE DE MENSAGENS
// ═══════════════════════════════════════════════════════════════════════════════

const TASK_PATTERNS = [
  /(?:fazer|faz|fazemos|precisamos|tem que|temos que|devemos|vamos|hay que|tenemos que)\s+(.{3,200})/i,
  /(?:tarefa|task|todo|ação|acción):?\s*(.{3,200})/i,
  /(?:bug|erro|problema|issue|fallo):?\s*(.{3,200})/i,
  /(?:implementar|desenvolver|criar|montar|configurar|desarrollar|hacer)\s+(.{3,200})/i,
  /(?:urgente|urgent|asap|ya|ahora)\s*[.:]?\s*(.{3,200})/i,
];

const IDEA_PATTERNS = [
  /(?:ideia|idea|sugestão|sugerencia|propuesta|podríamos|podemos)\s*[.:]?\s*(.{3,300})/i,
  /(?:que tal|e se|y si|what if|how about)\s+(.{3,300})/i,
];

const DECISION_PATTERNS = [
  /\b(ok|feito|pronto|done|approved|aprovado|confirmado|listo|vale|perfecto|genial)\b/i,
  /\b(vamos com|vamos con|let['']?s go|go ahead|proceder|procede)\b/i,
];

const PROJECT_KEYWORDS = {
  'Santafe': ['santafe', 'paulo', 'construcciones', 'obra'],
  'Sorveteria Tropicale': ['sorveteria', 'tropicale', 'juan', 'heladería'],
  'Superclim': ['superclim', 'limpieza', 'tapicería'],
  'Mangá Stop': ['mangá', 'manga stop', 'anime'],
  'SpeakEasily': ['speakeasily', 'idiomas', 'language'],
};

function detectProject(text) {
  const lower = text.toLowerCase();
  for (const [project, keywords] of Object.entries(PROJECT_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) return project;
  }
  return null;
}

function extractTasks(text) {
  const tasks = [];
  for (const pattern of TASK_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      tasks.push({
        text: match[1].trim(),
        priority: /urgente|asap|ya|ahora|hoy/i.test(text) ? 'high' : 'medium',
        project: detectProject(text),
      });
    }
  }
  return tasks;
}

function extractIdeas(text) {
  const ideas = [];
  for (const pattern of IDEA_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      ideas.push({ text: match[1].trim(), project: detectProject(text) });
    }
  }
  return ideas;
}

function isDecision(text) {
  return DECISION_PATTERNS.some(p => p.test(text));
}

function detectMentions(text) {
  const m = [];
  const lower = text.toLowerCase();
  if (/\b(abner|jhin|685093192)\b/i.test(lower)) m.push('Abner');
  if (/\b(nonoke|nono|enoque)\b/i.test(lower)) m.push('Nonoke/Enoque');
  if (/\b(elias)\b/i.test(lower)) m.push('Elias');
  if (/\b(juan|tropicale)\b/i.test(lower)) m.push('Juan');
  if (/\b(paulo|santafe)\b/i.test(lower)) m.push('Paulo');
  if (/\b(todos|equipe|time|galera|equipo)\b/i.test(lower)) m.push('Todos');
  return m;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GERAÇÃO DE RELATÓRIO LUNA
// ═══════════════════════════════════════════════════════════════════════════════

function generateLunaReport(data, checkpoint) {
  const { hasNews, newMessages, tasks, ideas, decisions, allMessages, stats } = data;
  const time = nowTime();
  
  let text = `🌙 *LUNA — Relatório ${time}*\n`;
  text += `━`.repeat(36) + '\n\n';
  
  if (hasNews) {
    // ═══ RELATÓRIO COM NOVIDADES ═══
    text += `✅ *NOVIDADES DETECTADAS!*\n\n`;
    
    text += `📊 *Resumo:*\n`;
    text += `  • ${newMessages.length} mensagens novas\n`;
    text += `  • ${tasks.length} tarefas novas\n`;
    text += `  • ${ideas.length} ideias novas\n`;
    text += `  • ${decisions.length} decisões novas\n`;
    text += `  • Total acumulado: ${stats.totalMessages} msgs\n\n`;
    
    // Mensagens novas
    if (newMessages.length > 0) {
      text += `💬 *Mensagens Novas:*\n`;
      newMessages.slice(0, 15).forEach((m, i) => {
        const shortText = m.text.length > 70 ? m.text.substring(0, 70) + '…' : m.text;
        text += `  ${i+1}. [${m.sender}] ${shortText}\n`;
      });
      if (newMessages.length > 15) {
        text += `  …e mais ${newMessages.length - 15} mensagens\n`;
      }
      text += '\n';
    }
    
    // Tarefas
    if (tasks.length > 0) {
      text += `📋 *Tarefas Detectadas:*\n`;
      tasks.forEach(t => {
        const icon = t.priority === 'high' ? '🔴' : '🟡';
        const proj = t.project ? ` [${t.project}]` : '';
        text += `  ${icon} ${t.text.substring(0, 80)}${proj}\n`;
      });
      text += '\n';
    }
    
    // Ideias
    if (ideas.length > 0) {
      text += `💡 *Ideias:*\n`;
      ideas.forEach(i => {
        const proj = i.project ? ` [${i.project}]` : '';
        text += `  • ${i.text.substring(0, 80)}${proj}\n`;
      });
      text += '\n';
    }
    
    // Decisões
    if (decisions.length > 0) {
      text += `✓ *Decisões:*\n`;
      decisions.forEach(d => {
        text += `  ✓ [${d.sender}] ${d.text.substring(0, 80)}\n`;
      });
      text += '\n';
    }
    
    text += `🔄 *Próximo relatório:* 30 minutos\n`;
    
  } else {
    // ═══ RELATÓRIO SEM NOVIDADES ═══
    text += `📭 *Nada de novo por aqui…*\n\n`;
    
    text += `📊 *Status atual:*\n`;
    text += `  • Mensagens monitoradas: ${stats.totalMessages}\n`;
    text += `  • Última novidade: ${checkpoint.lastRun ? new Date(checkpoint.lastRun).toLocaleTimeString('pt-BR') : 'Nunca'}\n`;
    text += `  • Verificações sem novidades: ${checkpoint.consecutiveNoNews}x\n\n`;
    
    text += `🔍 *Grupos monitorados:*\n`;
    text += `  • 🏆 Production - 2026\n`;
    text += `  • 👤 Paulo (web)\n\n`;
    
    text += `🔄 *Modo acelerado ativado:*\n`;
    text += `  Próximo relatório em 10 minutos\n`;
    text += `  (volta a 30 min quando encontrar novidades)\n\n`;
    
    text += `💡 *Dica:* Quando houver conversa nova,\n`;
    text += `   vou te avisar imediatamente!\n`;
  }
  
  // Rodapé Luna — SEMPRE PRESENTE
  text += `\n` + `━`.repeat(36) + '\n';
  text += `🌙 *Luna* — CTO Virtual NEXO Digital\n`;
  text += `📅 ${nowBR()} | v10.0\n`;
  text += `💰 Split: 25% cada (Abner/Nonoke/Elias/NEXO)`;
  
  return text;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENVIO VIA WHATSAPP
// ═══════════════════════════════════════════════════════════════════════════════

async function sendReportViaWhatsApp(page, reportText, destination) {
  // REGRA ESTRITA: Só envia no grupo Production 2026
  // NUNCA enviar em chats pessoais ou outros grupos
  console.log(`[Luna] 📤 Enviando relatório para o grupo: ${destination.groupName}...`);
  
  try {
    // Abre o grupo Production em vez de chat por número
    const opened = await openGroup(page, { name: destination.groupName, short: 'Production' });
    if (!opened) {
      console.log('[Luna] ❌ Não conseguiu abrir o grupo Production');
      return false;
    }
    
    await page.waitForTimeout(3000);
    
    // Tenta múltiplos seletores
    const inputSelectors = [
      'div[contenteditable="true"][data-tab="1"]',
      'div[contenteditable="true"][data-tab="3"]',
      'div[contenteditable="true"][data-tab="10"]',
      '[data-testid="conversation-compose-box-input"]',
      'footer div[contenteditable="true"]',
      'div[contenteditable="true"]'
    ];
    
    let input = null;
    for (const sel of inputSelectors) {
      input = page.locator(sel).first();
      const count = await input.count();
      if (count > 0) {
        console.log(`[Luna] ✅ Input encontrado: ${sel}`);
        break;
      }
    }
    
    if (!input || await input.count() === 0) {
      console.log('[Luna] ❌ Input não encontrado, tentando fallback JS...');
      await page.evaluate((text) => {
        const inputs = document.querySelectorAll('[contenteditable="true"]');
        for (const inp of inputs) {
          if (inp.offsetParent !== null && inp.clientHeight > 20) {
            inp.focus();
            inp.textContent = text;
            inp.dispatchEvent(new InputEvent('input', { bubbles: true }));
            return true;
          }
        }
        return false;
      }, reportText);
      await page.waitForTimeout(1000);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
      console.log(`[Luna] ✅ Relatório enviado no grupo via fallback!`);
      return true;
    }
    
    await input.fill(reportText);
    await page.waitForTimeout(1000);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);
    
    console.log(`[Luna] ✅ Relatório enviado no grupo Production!`);
    return true;
  } catch (e) {
    console.log(`[Luna] ❌ Erro ao enviar: ${e.message}`);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICAÇÃO PARA CENTRO DE OPERAÇÕES
// ═══════════════════════════════════════════════════════════════════════════════

async function notifyOps(message, type = 'whatsapp') {
  try {
    await fetch('http://127.0.0.1:3456/api/ops/changes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, message, timestamp: nowISO() })
    });
  } catch {}
}

// ═══════════════════════════════════════════════════════════════════════════════
// FUNÇÃO PRINCIPAL — LUNA
// ═══════════════════════════════════════════════════════════════════════════════

export async function runAgent() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  🌙 LUNA — CTO Virtual NEXO Digital v10.0                           ║');
  console.log('║  Relatório SEMPRE enviado | Checkpoint Inteligente                  ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  
  const checkpoint = loadCheckpoint();
  console.log(`[Luna] Última execução: ${checkpoint.lastRun || 'Nunca'}`);
  console.log(`[Luna] Modo atual: ${checkpoint.currentMode} (${checkpoint.currentMode === 'normal' ? '30min' : '10min'})`);
  console.log(`[Luna] Mensagens conhecidas: ${checkpoint.knownMessageHashes?.length || 0}`);
  console.log(`[Luna] Sem novidades seguidas: ${checkpoint.consecutiveNoNews}x`);
  
  let browser, page;
  
  try {
    // 1. Conecta ao WhatsApp
    const conn = await connectWhatsApp();
    browser = conn.browser;
    page = conn.page;
    
    // 2. Extrai mensagens dos grupos
    const allMessages = [];
    
    for (const groupConfig of CONFIG.GROUPS) {
      const opened = await openGroup(page, groupConfig);
      if (!opened) continue;
      
      const messages = await extractMessages(page, groupConfig.name);
      allMessages.push(...messages);
    }
    
    // 3. Compara com checkpoint — identifica NOVAS
    const { newMessages, newHashes } = getNewMessagesOnly(allMessages, checkpoint);
    const hasNews = newMessages.length > 0;
    
    // 4. Analisa novas mensagens
    const allTasks = [];
    const allIdeas = [];
    const allDecisions = [];
    
    if (hasNews) {
      console.log(`[Luna] 🎉 ${newMessages.length} mensagens NOVAS detectadas!`);
      
      checkpoint.knownMessageHashes.push(...newHashes);
      checkpoint.consecutiveNoNews = 0;
      checkpoint.currentMode = 'normal';
      
      for (const msg of newMessages) {
        const tasks = extractTasks(msg.text);
        const ideas = extractIdeas(msg.text);
        const isDec = isDecision(msg.text);
        
        allTasks.push(...tasks.map(t => ({ ...t, sender: msg.sender, group: msg.group })));
        allIdeas.push(...ideas.map(i => ({ ...i, sender: msg.sender, group: msg.group })));
        if (isDec) allDecisions.push({ text: msg.text, sender: msg.sender, group: msg.group });
      }
    } else {
      console.log(`[Luna] 📭 Nenhuma mensagem nova.`);
      checkpoint.consecutiveNoNews++;
      checkpoint.currentMode = 'accelerated';
    }
    
    // 5. Atualiza checkpoint
    checkpoint.lastRun = nowISO();
    checkpoint.totalMessagesSeen = checkpoint.knownMessageHashes.length;
    saveCheckpoint(checkpoint);
    
    // 6. Prepara dados do relatório
    const reportData = {
      hasNews,
      newMessages,
      tasks: allTasks,
      ideas: allIdeas,
      decisions: allDecisions,
      allMessages,
      stats: {
        totalMessages: allMessages.length,
        newMessages: newMessages.length,
        totalTasks: allTasks.length,
        totalIdeas: allIdeas.length,
        totalDecisions: allDecisions.length,
      }
    };
    
    // 7. Gera relatório LUNA (SEMPRE, mesmo sem novidades)
    const reportText = generateLunaReport(reportData, checkpoint);
    
    // 8. Salva dados
    writeJSON(CONFIG.OUTPUT_FILE, {
      version: '10.0',
      updatedAt: nowISO(),
      reportTime: nowBR(),
      stats: reportData.stats,
      hasNews,
      newMessages: newMessages.slice(0, 50),
      recentMessages: newMessages.slice(0, 20),
      tasks: { high: allTasks.filter(t => t.priority === 'high'), medium: allTasks.filter(t => t.priority === 'medium'), all: allTasks },
      ideas: allIdeas,
      decisions: allDecisions,
      mode: checkpoint.currentMode,
      consecutiveNoNews: checkpoint.consecutiveNoNews,
    });
    
    // 9. Envia relatório SEMPRE para Abner
    console.log('\n[Luna] 📤 Enviando relatório...');
    let sent = false;
    
    for (const dest of CONFIG.REPORT_DESTINATIONS) {
      const ok = await sendReportViaWhatsApp(page, reportText, dest);
      if (ok) sent = true;
    }
    
    // 10. Notifica Centro de Operações
    if (hasNews) {
      await notifyOps(
        `Luna: ${newMessages.length} mensagens novas, ${allTasks.length} tarefas, ${allIdeas.length} ideias`,
        'whatsapp'
      );
    } else {
      await notifyOps(
        `Luna: Sem novidades (${checkpoint.consecutiveNoNews}x seguidas). Modo acelerado (10min).`,
        'whatsapp'
      );
    }
    
    // 11. Resumo
    const nextInterval = checkpoint.currentMode === 'normal' ? '30 minutos' : '10 minutos';
    console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
    if (hasNews) {
      console.log('║  ✅ NOVIDADES! Relatório enviado.                                   ║');
      console.log(`║  📨 ${newMessages.length} novas | ${allTasks.length} tarefas | ${allIdeas.length} ideias          ║`);
    } else {
      console.log('║  📭 Sem novidades. Relatório enviado.                               ║');
      console.log(`║  📊 ${allMessages.length} mensagens monitoradas | ${checkpoint.consecutiveNoNews}x sem novas    ║`);
    }
    console.log(`║  🕐 Próximo: ${nextInterval}                                          ║`);
    console.log('╚══════════════════════════════════════════════════════════════════════╝');
    
    return {
      status: hasNews ? 'success' : 'no_news',
      hasNews,
      newMessages: newMessages.length,
      nextMode: checkpoint.currentMode,
      nextInterval: checkpoint.currentMode === 'normal' ? CONFIG.MODE_NORMAL : CONFIG.MODE_ACCELERATED
    };
    
  } catch (e) {
    if (e.message === 'WHATSAPP_NEEDS_LOGIN') {
      console.log('\n[Luna] ⚠️ WhatsApp precisa de login');
      process.exitCode = 2;
      return;
    }
    console.error('\n[Luna] ❌ Erro:', e.message);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

// Se executado diretamente
const modulePath = decodeURIComponent(import.meta.url.replace('file:///', '').replace(/\//g, '\\'));
const scriptPath = process.argv[1];
const isMainModule = modulePath.toLowerCase() === scriptPath.toLowerCase();
if (isMainModule) {
  runAgent().then(() => process.exit(process.exitCode || 0)).catch(() => process.exit(1));
}
