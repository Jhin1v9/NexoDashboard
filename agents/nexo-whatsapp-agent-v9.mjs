/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * NEXO WhatsApp Agent v9.0 — CHECKPOINT INTELIGENTE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * NOVO v9.0:
 * 1. Checkpoint System — compara mensagens salvas vs novas, só processa diferença
 * 2. Só envia relatório quando há NOVIDADES (mensagens novas, tarefas novas, etc)
 * 3. Monitora chat pessoal do Abner (685093192) para ordens/comandos
 * 4. Notificações push via WhatsApp quando há mudanças no site/agente
 * 5. Evita retrabalho — não processa mensagens já vistas
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
    {
      name: '🏆Production - 2026🙏',
      short: 'Production',
      aliases: ['Production 2026', 'Production - 2026', 'Production 2026🙏'],
      type: 'internal'
    },
    {
      name: 'Paulo (web)',
      short: 'Paulo',
      aliases: ['Paulo web', 'Paulo (web)'],
      type: 'client'
    }
  ],
  
  // Chat pessoal do Abner — verificar ordens/comandos
  ABNER_CHAT: { name: 'Abner', number: '34685093192', type: 'command' },
  
  // Destino do relatório
  REPORT_DESTINATIONS: [
    { name: 'Abner', number: '34685093192', type: 'primary' }
  ],
  
  // Arquivos
  CHECKPOINT_FILE: path.join(__dirname, '..', 'backend', 'data', 'whatsapp-checkpoint.json'),
  OUTPUT_FILE: path.join(__dirname, '..', 'backend', 'data', 'whatsapp-agent-data.json'),
  REPORTS_DIR: path.join(__dirname, '..', 'backend', 'data', 'reports'),
  OPS_STATE_FILE: path.join(__dirname, '..', 'backend', 'data', 'ops-state.json'),
  
  // Limites
  MAX_SCROLLS: 30,
  SCROLL_DELAY: 800,
};

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITÁRIOS
// ═══════════════════════════════════════════════════════════════════════════════

function nowISO() { return new Date().toISOString(); }
function nowBR() { return new Date().toLocaleString('pt-BR', { timeZone: 'Europe/Madrid' }); }

function hashMessage(msg) {
  // Hash baseado em sender + texto + hora (aproximada)
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
    version: '9.0',
    lastRun: null,
    groups: {},
    totalMessagesSeen: 0,
    knownMessageHashes: []
  });
}

function saveCheckpoint(checkpoint) {
  writeJSON(CONFIG.CHECKPOINT_FILE, checkpoint);
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
// CONEXÃO COM WHATSAPP WEB VIA CDP
// ═══════════════════════════════════════════════════════════════════════════════

async function connectWhatsApp() {
  console.log('[CDP] Conectando ao Chrome na porta 9223...');
  
  let browser;
  try {
    browser = await chromium.connectOverCDP(CONFIG.CDP_URL);
  } catch (e) {
    console.log('[CDP] ❌ Chrome não está rodando. Inicie com: start-chrome-cdp.bat');
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
    console.log('[CDP] WhatsApp Web não encontrado. Abrindo...');
    const context = browser.contexts()[0] || await browser.newContext();
    waPage = await context.newPage();
    await waPage.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waPage.waitForTimeout(5000);
  } else {
    console.log('[CDP] ✅ Sessão WhatsApp existente encontrada. Reutilizando WhatsApp Web aberto.');
  }
  
  // Verifica se está logado
  const isLogged = await waPage.locator('[data-testid="chat-list"]').count() > 0;
  if (!isLogged) {
    const hasCanvas = await waPage.locator('canvas').count() > 0;
    if (hasCanvas) {
      console.log('[CDP] ⚠️  QR Code detectado. Escaneie com o celular!');
      const qrPath = path.join(__dirname, '..', 'public', 'whatsapp-qr-code.png');
      ensureDir(path.dirname(qrPath));
      await waPage.screenshot({ path: qrPath, fullPage: false });
      throw new Error('WHATSAPP_NEEDS_LOGIN');
    } else {
      throw new Error('WhatsApp Web não está logado');
    }
  }
  
  console.log('[CDP] ✅ WhatsApp Web conectado e logado!');
  return { browser, page: waPage };
}

function normalizeSearchText(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\p{Extended_Pictographic}/gu, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildGroupSearchTerms(groupConfig) {
  const terms = new Set();
  if (groupConfig.name) terms.add(normalizeSearchText(groupConfig.name));
  if (groupConfig.short) terms.add(normalizeSearchText(groupConfig.short));
  if (groupConfig.aliases) {
    groupConfig.aliases.forEach(alias => terms.add(normalizeSearchText(alias)));
  }
  if (groupConfig.name) terms.add(normalizeSearchText(groupConfig.name.replace(/[^a-z0-9]/gi, ' ')));
  if (groupConfig.short) terms.add(normalizeSearchText(groupConfig.short.replace(/[^a-z0-9]/gi, ' ')));
  return [...terms].filter(Boolean);
}

function getWhatsAppSearchSelectors() {
  return [
    '[data-testid="chat-list-search"]',
    'div[contenteditable="true"][data-tab="3"]',
    'div[contenteditable="true"][role="textbox"]',
    'input[placeholder*="Search"]',
    'input[placeholder*="Pesquisar"]',
    'input[aria-label*="Search"]',
    'input[aria-label*="Pesquisar"]'
  ];
}

async function findWhatsAppSearchInput(page) {
  const selectors = getWhatsAppSearchSelectors();
  for (const selector of selectors) {
    const input = await page.$(selector);
    if (input) return input;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXTRAÇÃO DE MENSAGENS COM SCROLL INFINITO
// ═══════════════════════════════════════════════════════════════════════════════

async function openGroup(page, groupConfig) {
  const { name, short } = groupConfig;
  const terms = buildGroupSearchTerms(groupConfig);
  const searchTerm = short || name;
  console.log(`\n[Grupo] Procurando: ${name} | termos: ${terms.join(', ')}`);
  
  try {
    const found = await page.evaluate((terms) => {
      const normalize = (value) => {
        return (value || '')
          .toLowerCase()
          .normalize('NFKD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\p{Extended_Pictographic}/gu, ' ')
          .replace(/[^a-z0-9\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      };
      const items = document.querySelectorAll('[data-testid="chat-list-item"], [role="row"], [role="option"], div[role="button"]');
      for (const item of items) {
        const text = normalize(item.textContent || '');
        if (!text) continue;
        for (const term of terms) {
          if (term && text.includes(term)) {
            item.click();
            return true;
          }
        }
      }
      return false;
    }, terms);
    
    if (found) {
      await page.waitForTimeout(2000);
      console.log(`[Grupo] ✅ Aberto: ${name}`);
      return true;
    }
  } catch (e) {
    console.log(`[Grupo] Erro na busca inicial do grupo: ${e.message}`);
  }

  try {
    const searchInput = await findWhatsAppSearchInput(page);
    if (searchInput) {
      await searchInput.click({ timeout: 3000 }).catch(() => {});
      await searchInput.focus();
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Control');
      await page.keyboard.press('Backspace');
      await page.waitForTimeout(200);
      await page.keyboard.type(searchTerm, { delay: 50 });
      await page.waitForTimeout(2000);

      const clicked = await page.evaluate((terms) => {
        const normalize = (value) => {
          return (value || '')
            .toLowerCase()
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\p{Extended_Pictographic}/gu, ' ')
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        };
        const items = document.querySelectorAll('[data-testid="chat-list-item"], [role="row"], [role="option"], div[role="button"]');
        for (const item of items) {
          const text = normalize(item.textContent || '');
          if (!text) continue;
          for (const term of terms) {
            if (term && text.includes(term)) {
              item.click();
              return true;
            }
          }
        }
        return false;
      }, terms);
      if (clicked) {
        await page.waitForTimeout(2000);
        console.log(`[Grupo] ✅ Aberto via busca: ${name}`);
        return true;
      }
    } else {
      console.log('[Grupo] ⚠️  Search input do WhatsApp não encontrado.');
    }
  } catch (e) {
    console.log(`[Grupo] Erro na busca avançada: ${e.message}`);
  }

  console.log(`[Grupo] ❌ Não encontrado: ${name}`);
  return false;
}

async function extractMessages(page, groupName) {
  const messages = [];
  const seenHashes = new Set();
  let scrollCount = 0;
  let lastHeight = 0;
  let stableCount = 0;
  
  console.log(`[Extrair] Iniciando scroll infinito em: ${groupName}`);
  
  // Rola para o final primeiro
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
          // Extrai texto
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
          
          // Extrai hora
          let time = '';
          const timeEl = container.querySelector('span[data-testid="msg-meta"] span[dir="auto"]');
          if (timeEl) time = timeEl.textContent.trim();
          
          // Extrai sender
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
    
    // Deduplica no batch atual
    let newCount = 0;
    for (const msg of batch) {
      const hash = `${msg.sender}:${msg.text.substring(0, 50)}:${msg.time}`;
      if (!seenHashes.has(hash)) {
        seenHashes.add(hash);
        messages.push({ ...msg, group: groupName });
        newCount++;
      }
    }
    
    // Scroll
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
      process.stdout.write(`\r[Extrair] Scroll ${scrollCount}: ${messages.length} mensagens únicas`);
    }
    await page.waitForTimeout(CONFIG.SCROLL_DELAY);
  }
  
  console.log(`\n[Extrair] ✅ ${messages.length} mensagens extraídas (${scrollCount} scrolls)`);
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
  /(?:urgente|urgente|asap|ya|ahora)\s*[.:]?\s*(.{3,200})/i,
];

const IDEA_PATTERNS = [
  /(?:ideia|idea|sugestão|sugerencia|propuesta|podríamos|podemos)\s*[.:]?\s*(.{3,300})/i,
  /(?:que tal|e se|y si|what if|how about)\s+(.{3,300})/i,
];

const DECISION_PATTERNS = [
  /\b(ok|feito|pronto|done|approved|aprovado|confirmado|confirmado|listo|vale|perfecto|genial)\b/i,
  /\b(vamos com|vamos con|let['']?s go|go ahead|proceder|procede)\b/i,
];

const URGENCY_PATTERNS = [
  { pattern: /\b(urgente|urgent|asap|ya|ahora|hoy|hoje|imediato|inmediatamente)\b/i, level: 'high' },
  { pattern: /\b(amanh[ãa]|mañana|próxima semana|esta semana)\b/i, level: 'medium' },
];

const PROJECT_KEYWORDS = {
  'Santafe': ['santafe', 'paulo', 'construcciones', 'obra', 'construcción'],
  'Sorveteria Tropicale': ['sorveteria', 'tropicale', 'juan', 'heladería', 'ice cream'],
  'Superclim': ['superclim', 'limpieza', 'tapicería', 'elias', 'tapicerias'],
  'Mangá Stop': ['mangá', 'manga stop', 'anime', 'loja'],
  'SpeakEasily': ['speakeasily', 'speak easily', 'idiomas', 'language'],
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
      ideas.push({
        text: match[1].trim(),
        project: detectProject(text),
      });
    }
  }
  return ideas;
}

function isDecision(text) {
  return DECISION_PATTERNS.some(p => p.test(text));
}

function detectUrgency(text) {
  for (const { pattern, level } of URGENCY_PATTERNS) {
    if (pattern.test(text)) return level;
  }
  return 'low';
}

function detectMentions(text) {
  const m = [];
  const lower = text.toLowerCase();
  if (/\b(abner|jhin|685093192)\b/i.test(lower)) m.push('Abner');
  if (/\b(nonoke|nono|enoque)\b/i.test(lower)) m.push('Nonoke/Enoque');
  if (/\b(elias)\b/i.test(lower)) m.push('Elias');
  if (/\b(juan|tropicale)\b/i.test(lower)) m.push('Juan');
  if (/\b(paulo|santafe)\b/i.test(lower)) m.push('Paulo');
  if (/\b(todos|equipe|time|galera|todos|equipo)\b/i.test(lower)) m.push('Todos');
  return m;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GERAÇÃO DE RELATÓRIO
// ═══════════════════════════════════════════════════════════════════════════════

function generateReportText(data, isDelta = false) {
  const { stats, newMessages, tasks, ideas, decisions, groupName } = data;
  
  let text = `📊 *NEXO Report — ${nowBR()}*\n`;
  text += `${'='.repeat(40)}\n\n`;
  
  if (isDelta) {
    text += `✅ *NOVIDADES DETECTADAS*\n\n`;
    text += `📨 ${newMessages.length} mensagens novas\n`;
    text += `📋 ${tasks.length} tarefas novas\n`;
    text += `💡 ${ideas.length} ideias novas\n`;
    text += `✓ ${decisions.length} decisões novas\n\n`;
  } else {
    text += `📊 *Resumo Geral*\n`;
    text += `Total: ${stats.totalMessages} msgs | ${stats.totalTasks} tarefas | ${stats.totalIdeas} ideias\n\n`;
  }
  
  if (newMessages.length > 0) {
    text += `📨 *Mensagens Novas:*\n`;
    newMessages.slice(0, 10).forEach(m => {
      const shortText = m.text.length > 80 ? m.text.substring(0, 80) + '...' : m.text;
      text += `  • [${m.sender}] ${shortText}\n`;
    });
    if (newMessages.length > 10) text += `  ... e mais ${newMessages.length - 10}\n`;
    text += '\n';
  }
  
  if (tasks.length > 0) {
    text += `📋 *Tarefas:*\n`;
    tasks.forEach(t => {
      const icon = t.priority === 'high' ? '🔴' : '🟡';
      text += `  ${icon} ${t.text.substring(0, 100)}\n`;
    });
    text += '\n';
  }
  
  if (ideas.length > 0) {
    text += `💡 *Ideias:*\n`;
    ideas.forEach(i => {
      text += `  • ${i.text.substring(0, 100)}\n`;
    });
    text += '\n';
  }
  
  text += `— NEXO Digital 🤖`;
  return text;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENVIO VIA WHATSAPP
// ═══════════════════════════════════════════════════════════════════════════════

async function sendReportViaWhatsApp(page, reportText, destination) {
  console.log(`\n[WhatsApp] Enviando para: ${destination.name} (${destination.number})`);
  
  try {
    const chatUrl = `https://web.whatsapp.com/send?phone=${destination.number}`;
    await page.goto(chatUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);
    
    // Procura input de mensagem
    const inputSelectors = [
      'div[contenteditable="true"][data-tab="1"]',
      'div[contenteditable="true"][data-tab="3"]',
      '[data-testid="conversation-compose-box-input"]',
      'div[contenteditable="true"]'
    ];
    
    let input = null;
    for (const sel of inputSelectors) {
      input = page.locator(sel).first();
      if (await input.count() > 0) break;
    }
    
    if (!input || await input.count() === 0) {
      console.log('[WhatsApp] ❌ Input não encontrado');
      return false;
    }
    
    await input.fill(reportText);
    await page.waitForTimeout(500);
    
    // Envia
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    
    console.log(`[WhatsApp] ✅ Enviado para ${destination.name}!`);
    return true;
  } catch (e) {
    console.log(`[WhatsApp] ❌ Erro: ${e.message}`);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICAÇÃO PUSH PARA CENTRO DE OPERAÇÕES
// ═══════════════════════════════════════════════════════════════════════════════

async function notifyOps(message, type = 'whatsapp') {
  try {
    await fetch('http://127.0.0.1:3456/api/ops/changes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        message,
        timestamp: nowISO()
      })
    });
  } catch {}
}

async function sendPushNotification(title, body) {
  try {
    await fetch('http://127.0.0.1:3456/api/notifications/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body })
    });
  } catch {}
}

// ═══════════════════════════════════════════════════════════════════════════════
// FUNÇÃO PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export async function runAgent() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  NEXO WhatsApp Agent v9.0 — CHECKPOINT INTELIGENTE                  ║');
  console.log('║  Só processa mensagens NOVAS. Evita retrabalho.                     ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log('');
  
  // Carrega checkpoint
  const checkpoint = loadCheckpoint();
  console.log(`[Checkpoint] Última execução: ${checkpoint.lastRun || 'Nunca'}`);
  console.log(`[Checkpoint] Mensagens conhecidas: ${checkpoint.knownMessageHashes?.length || 0}`);
  
  let browser, page;
  
  try {
    // 1. Conecta ao WhatsApp
    const conn = await connectWhatsApp();
    browser = conn.browser;
    page = conn.page;
    
    // 2. Verifica chat pessoal do Abner para ordens
    console.log('\n[Comandos] Verificando chat pessoal do Abner...');
    // TODO: Implementar leitura de comandos do chat pessoal
    
    // 3. Processa cada grupo
    const diagnostics = {
      expectedGroups: CONFIG.GROUPS.map(g => g.name),
      openedGroups: [],
      missingGroups: []
    };

    const allMessages = [];
    const allNewMessages = [];
    const allTasks = [];
    const allIdeas = [];
    const allDecisions = [];
    
    for (const groupConfig of CONFIG.GROUPS) {
      const opened = await openGroup(page, groupConfig);
      if (!opened) {
        diagnostics.missingGroups.push(groupConfig.name);
        continue;
      }
      diagnostics.openedGroups.push(groupConfig.name);
      
      const messages = await extractMessages(page, groupConfig.name);
      allMessages.push(...messages);
      
      // Compara com checkpoint — só processa NOVAS
      const { newMessages, newHashes } = getNewMessagesOnly(messages, checkpoint);
      
      if (newMessages.length > 0) {
        console.log(`[Checkpoint] ${newMessages.length} mensagens NOVAS detectadas!`);
        
        // Adiciona hashes ao checkpoint
        checkpoint.knownMessageHashes.push(...newHashes);
        
        // Analisa apenas as NOVAS mensagens
        for (const msg of newMessages) {
          const tasks = extractTasks(msg.text);
          const ideas = extractIdeas(msg.text);
          const isDec = isDecision(msg.text);
          
          allNewMessages.push(msg);
          allTasks.push(...tasks.map(t => ({ ...t, sender: msg.sender, group: groupConfig.name })));
          allIdeas.push(...ideas.map(i => ({ ...i, sender: msg.sender, group: groupConfig.name })));
          if (isDec) allDecisions.push({ text: msg.text, sender: msg.sender, group: groupConfig.name });
        }
      } else {
        console.log(`[Checkpoint] Nenhuma mensagem nova neste grupo.`);
      }
    }
    
    // 4. Atualiza checkpoint
    checkpoint.lastRun = nowISO();
    checkpoint.totalMessagesSeen = checkpoint.knownMessageHashes.length;
    saveCheckpoint(checkpoint);

    console.log('\n[Diagnóstico] Grupos esperados:', diagnostics.expectedGroups.join(', '));
    console.log('[Diagnóstico] Grupos abertos:', diagnostics.openedGroups.join(', ') || 'nenhum');
    console.log('[Diagnóstico] Grupos não encontrados:', diagnostics.missingGroups.join(', ') || 'nenhum');
    
    // 5. Só gera relatório se houver NOVIDADES
    const hasNews = allNewMessages.length > 0 || allTasks.length > 0 || allIdeas.length > 0 || allDecisions.length > 0;
    
    if (!hasNews) {
      console.log('\n[Relatório] ℹ️  Nenhuma novidade detectada. Relatório NÃO enviado.');
      console.log('            Próxima verificação em 30 minutos.');
      
      // Notifica ops que não há novidades
      await notifyOps(`WhatsApp Agent: Nenhuma novidade. ${allMessages.length} mensagens já processadas.`, 'whatsapp');
      
      return { status: 'no_news', totalMessages: allMessages.length };
    }
    
    // 6. Prepara dados do relatório
    const reportData = {
      stats: {
        totalMessages: allMessages.length,
        newMessages: allNewMessages.length,
        totalTasks: allTasks.length,
        totalIdeas: allIdeas.length,
        totalDecisions: allDecisions.length,
      },
      newMessages: allNewMessages,
      tasks: allTasks,
      ideas: allIdeas,
      decisions: allDecisions,
    };
    
    // 7. Gera relatório de DELTA (só novidades)
    const reportText = generateReportText(reportData, true);
    
    // 8. Salva dados
    const dashboardData = {
      version: '9.0',
      updatedAt: nowISO(),
      reportTime: nowBR(),
      stats: reportData.stats,
      messages: allNewMessages.slice(0, 50),
      recentMessages: allNewMessages.slice(0, 20),
      tasks: { high: allTasks.filter(t => t.priority === 'high'), medium: allTasks.filter(t => t.priority === 'medium'), all: allTasks },
      ideas: allIdeas,
      decisions: allDecisions,
      hasNews: true,
    };
    writeJSON(CONFIG.OUTPUT_FILE, dashboardData);
    
    // 9. Envia relatório via WhatsApp
    console.log('\n[WhatsApp] Preparando envio do relatório...');
    let anySent = false;
    
    for (const dest of CONFIG.REPORT_DESTINATIONS) {
      const sent = await sendReportViaWhatsApp(page, reportText, dest);
      if (sent) anySent = true;
    }
    
    // 10. Notifica Centro de Operações
    await notifyOps(
      `WhatsApp Agent: ${allNewMessages.length} mensagens novas, ${allTasks.length} tarefas, ${allIdeas.length} ideias detectadas`,
      'whatsapp'
    );
    
    // 11. Push notification
    await sendPushNotification(
      'NEXO WhatsApp — Novidades!',
      `${allNewMessages.length} mensagens novas, ${allTasks.length} tarefas detectadas`
    );
    
    // 12. Resumo
    console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ AGENTE CONCLUÍDO — NOVIDADES DETECTADAS!                        ║');
    console.log(`║  📨 ${allNewMessages.length} mensagens novas | ${allTasks.length} tarefas | ${allIdeas.length} ideias          ║`);
    console.log(`║  📤 Enviado: ${anySent ? 'SIM ✅' : 'NÃO ❌'}                                          ║`);
    console.log('╚══════════════════════════════════════════════════════════════════════╝');
    
    return { status: 'success', newMessages: allNewMessages.length, tasks: allTasks.length };
    
  } catch (e) {
    if (e.message === 'WHATSAPP_NEEDS_LOGIN') {
      console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
      console.log('║  ⚠️  WHATSAPP PRECISA DE LOGIN                                      ║');
      console.log('╚══════════════════════════════════════════════════════════════════════╝');
      process.exitCode = 2;
      return;
    } else {
      console.error('\n❌ ERRO:', e.message);
      process.exitCode = 1;
    }
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

// Se executado diretamente
const modulePath = decodeURIComponent(import.meta.url.replace('file:///', '').replace(/\//g, '\\'));
const scriptPath = process.argv[1];
const isMainModule = !scriptPath || modulePath.toLowerCase() === scriptPath.toLowerCase();
if (isMainModule) {
  runAgent().then(() => process.exit(process.exitCode || 0)).catch(() => process.exit(1));
}
