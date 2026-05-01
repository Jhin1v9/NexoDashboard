/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * NEXO WhatsApp Agent v8.0 — RELATÓRIO INTELIGENTE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Funcionalidades:
 * 1. Conecta ao Chrome CDP e garante que WhatsApp Web está aberto
 * 2. Extrai mensagens dos grupos monitorados com scroll infinito
 * 3. Analisa contexto: tarefas, ideias, decisões, links, menções
 * 4. Gera relatório HTML interativo com Tailwind CSS
 * 5. Envia relatório via WhatsApp Web para o número configurado
 * 6. Salva histórico de relatórios no dashboard
 * 
 * CLIENTES: Juan (Sorveteria Tropicale), Paulo (Santafe Construcciones)
 * PROJETOS INTERNOS: Superclim (Elias), Mangá Stop, SpeakEasily
 * 
 * Agendamento: Task Scheduler a cada 30 minutos
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  // CDP do perfil Luna (WhatsApp Web logado)
  CDP_URL: 'http://127.0.0.1:9223',
  
  // Grupos monitorados
  GROUPS: [
    { name: '🏆Production - 2026🙏', short: 'Production', type: 'internal' },
    { name: 'Paulo (web)', short: 'Paulo', type: 'client' }
  ],
  
  // Destino do relatório via WhatsApp (número para enviar)
  REPORT_DESTINATIONS: [
    { name: 'Abner', number: '34685093192', type: 'primary' }
  ],
  
  // Arquivos
  OUTPUT_FILE: path.join(__dirname, '..', 'backend', 'data', 'whatsapp-agent-data.json'),
  REPORTS_DIR: path.join(__dirname, '..', 'backend', 'data', 'reports'),
  REPORT_HISTORY_FILE: path.join(__dirname, '..', 'backend', 'data', 'report-history.json'),
  
  // Limites
  MAX_SCROLLS: 30,
  SCROLL_DELAY: 800,
  MESSAGES_PER_GROUP: 100,
  
  // API do dashboard
  DASHBOARD_API: 'http://127.0.0.1:3456',
};

// ═══════════════════════════════════════════════════════════════════════════════
// SELETORES DO WHATSAPP WEB (atualizados 2026)
// ═══════════════════════════════════════════════════════════════════════════════

const SELECTORS = {
  // Chat list
  chatList: '[data-testid="chat-list"]',
  chatListSearch: '[data-testid="chat-list-search"]',
  chatListSearchInput: 'div[contenteditable="true"][data-tab="3"]',
  chatListItem: '[data-testid="chat-list-item"]',
  chatTitle: 'span[dir="auto"][title]',
  
  // Mensagens
  messageIn: '.message-in, .message-out',
  messageContainer: '[data-testid="msg-container"]',
  msgRow: 'div[role="row"]',
  text: 'span.selectable-text.copyable-text',
  textFallback: 'span[dir="ltr"].selectable-text',
  copyable: '.copyable-text',
  timestamp: 'span[data-testid="msg-meta"] span[dir="auto"]',
  sender: 'span[dir="auto"]',
  
  // Input de mensagem
  textInput: 'div[contenteditable="true"][data-tab="1"]',
  sendButton: '[data-testid="send"]',
  
  // QR Code (WhatsApp renderiza em canvas)
  qrCode: 'canvas',
  qrCodeContainer: '[data-testid="qr-code"]',
  loginPrompt: 'text=Escanea para iniciar sesión',
};

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITÁRIOS
// ═══════════════════════════════════════════════════════════════════════════════

function nowISO() { return new Date().toISOString(); }
function nowBR() { return new Date().toLocaleString('pt-BR', { timeZone: 'Europe/Madrid' }); }
function todayBR() { return new Date().toLocaleDateString('pt-BR', { timeZone: 'Europe/Madrid' }); }

function hashText(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
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
// LINK PREVIEW (extrai metadados de URLs)
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchLinkPreview(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: 5000, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const title = data.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || '';
        const desc = data.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i)?.[1]?.trim() ||
                     data.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["'][^>]*>/i)?.[1]?.trim() || '';
        const image = data.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["'][^>]*>/i)?.[1]?.trim() || '';
        resolve({ url, title: title || url, description: desc, image, valid: true });
      });
    });
    req.on('error', () => resolve({ url, title: url, description: '', image: '', valid: false }));
    req.on('timeout', () => { req.destroy(); resolve({ url, title: url, description: '', image: '', valid: false }); });
  });
}

async function extractLinks(text) {
  const urlRegex = /(https?:\/\/[^\s<>"{}|\^`\[\]]+)/gi;
  const urls = text.match(urlRegex) || [];
  const previews = [];
  for (const url of urls.slice(0, 3)) {
    previews.push(await fetchLinkPreview(url));
  }
  return previews;
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
  if (/\b(nonoke|nono)\b/i.test(lower)) m.push('Nonoke');
  if (/\b(elias)\b/i.test(lower)) m.push('Elias');
  if (/\b(enoque|superclim)\b/i.test(lower)) m.push('Enoque');
  if (/\b(juan|tropicale)\b/i.test(lower)) m.push('Juan');
  if (/\b(paulo|santafe)\b/i.test(lower)) m.push('Paulo');
  if (/\b(todos|equipe|time|galera|todos|equipo)\b/i.test(lower)) m.push('Todos');
  return m;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONEXÃO COM WHATSAPP WEB VIA CDP
// ═══════════════════════════════════════════════════════════════════════════════

async function connectWhatsApp() {
  console.log('[CDP] Conectando ao Chrome na porta 9222...');
  
  let browser;
  try {
    browser = await chromium.connectOverCDP(CONFIG.CDP_URL);
  } catch (e) {
    console.log('[CDP] ❌ Chrome não está rodando. Inicie com: start-chrome-cdp.bat');
    throw e;
  }
  
  // Procura página do WhatsApp
  let waPage = null;
  for (const ctx of browser.contexts()) {
    for (const p of ctx.pages()) {
      if (p.url().includes('web.whatsapp.com')) {
        waPage = p;
        break;
      }
    }
    if (waPage) break;
  }
  
  // Se não achou, navega para o WhatsApp Web
  if (!waPage) {
    console.log('[CDP] WhatsApp Web não encontrado. Abrindo...');
    const context = browser.contexts()[0] || await browser.newContext();
    waPage = await context.newPage();
    await waPage.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waPage.waitForTimeout(5000);
  }
  
  // Verifica se está logado
  const isLogged = await waPage.locator(SELECTORS.chatList).count() > 0;
  if (!isLogged) {
    // Verifica se tem QR code (canvas ou container)
    const hasCanvas = await waPage.locator('canvas').count() > 0;
    const hasLoginText = await waPage.locator('text=/scan|escan|qr|iniciar/i').count() > 0;
    const hasQR = hasCanvas || hasLoginText;
    
    if (hasQR) {
      console.log('[CDP] ⚠️  QR Code detectado. Escaneie com o celular!');
      
      // Salva screenshot do QR code para o dashboard
      const qrPath = path.join(__dirname, '..', 'public', 'whatsapp-qr-code.png');
      ensureDir(path.dirname(qrPath));
      await waPage.screenshot({ path: qrPath, fullPage: false });
      console.log(`[CDP]    QR Code salvo em: ${qrPath}`);
      
      // Atualiza status do agente
      writeJSON(CONFIG.OUTPUT_FILE, {
        lastRun: nowISO(),
        status: 'needs_login',
        message: 'WhatsApp Web precisa de login. Escaneie o QR code no celular.',
        qrCodePath: '/whatsapp-qr-code.png',
        groups: [],
        messagesExtracted: 0,
        nextRetry: new Date(Date.now() + 5 * 60 * 1000).toISOString()
      });
      
      throw new Error('WHATSAPP_NEEDS_LOGIN');
    } else {
      throw new Error('WhatsApp Web não está logado e não há QR code visível');
    }
  }
  
  console.log('[CDP] ✅ WhatsApp Web conectado e logado!');
  return { browser, page: waPage };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXTRAÇÃO DE MENSAGENS COM SCROLL INFINITO
// ═══════════════════════════════════════════════════════════════════════════════

async function openGroup(page, groupConfig) {
  const { name, short } = groupConfig;
  console.log(`\n[Grupo] Procurando: ${name}`);
  
  // Estratégia 1: Pesquisa direta
  try {
    // Clica na caixa de pesquisa
    const searchBox = page.locator(SELECTORS.chatListSearch).or(
      page.locator(SELECTORS.chatListSearchInput)
    ).first();
    
    await searchBox.click({ timeout: 5000 });
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Delete');
    await page.keyboard.type(short);
    await page.waitForTimeout(2500);
    
    // Tenta clicar no resultado
    const results = await page.locator(SELECTORS.chatListItem).all();
    for (const item of results) {
      const text = await item.textContent().catch(() => '');
      if (text.includes(short) || text.includes(name.replace(/[^\w\s]/g, ''))) {
        await item.click();
        await page.waitForTimeout(2000);
        console.log(`[Grupo] ✅ Aberto via pesquisa: ${name}`);
        return true;
      }
    }
  } catch (e) {
    console.log(`[Grupo] Pesquisa falhou: ${e.message}`);
  }
  
  // Estratégia 2: Procura na lista visível
  try {
    const items = await page.locator(SELECTORS.chatListItem).all();
    for (const item of items) {
      const text = await item.textContent().catch(() => '');
      if (text.includes(short) || text.includes('Production') || text.includes('2026') || text.includes('Paulo')) {
        await item.click();
        await page.waitForTimeout(2000);
        console.log(`[Grupo] ✅ Aberto via lista: ${name}`);
        return true;
      }
    }
  } catch (e) {
    console.log(`[Grupo] Lista falhou: ${e.message}`);
  }
  
  // Estratégia 3: JavaScript injection
  try {
    const found = await page.evaluate((searchTerm) => {
      const items = document.querySelectorAll('[data-testid="chat-list-item"]');
      for (const item of items) {
        if (item.textContent.includes(searchTerm)) {
          item.click();
          return true;
        }
      }
      // Tenta procurar em qualquer elemento
      const all = document.querySelectorAll('*');
      for (const el of all) {
        if (el.textContent && el.textContent.includes(searchTerm) && el.click) {
          el.click();
          return true;
        }
      }
      return false;
    }, short);
    
    if (found) {
      await page.waitForTimeout(2000);
      console.log(`[Grupo] ✅ Aberto via JS: ${name}`);
      return true;
    }
  } catch (e) {
    console.log(`[Grupo] JS falhou: ${e.message}`);
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
    // Extrai mensagens visíveis via page.evaluate
    const batch = await page.evaluate((cfg) => {
      const msgs = [];
      const containers = document.querySelectorAll(cfg.messageSelector) || 
                         document.querySelectorAll(cfg.msgRow);
      
      containers.forEach(container => {
        try {
          // Tenta extrair texto
          let textEl = container.querySelector(cfg.textSelector);
          if (!textEl) textEl = container.querySelector(cfg.textFallback);
          if (!textEl) {
            // Tenta encontrar qualquer span com texto substancial
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
          const timeEl = container.querySelector(cfg.timestampSelector);
          if (timeEl) time = timeEl.textContent.trim();
          
          // Extrai sender (para mensagens de grupo)
          let sender = '';
          const senderEl = container.querySelector(cfg.senderSelector);
          if (senderEl && senderEl.textContent !== text) {
            sender = senderEl.textContent.trim();
          }
          
          // Detecta se é mensagem enviada por mim
          const isOutgoing = container.classList.contains('message-out') || 
                            container.closest('.message-out') !== null;
          
          // Gera ID único
          const id = `${sender}:${text.substring(0, 50)}:${time}`;
          
          msgs.push({ text, sender: sender || (isOutgoing ? 'Você' : 'Desconhecido'), time, isOutgoing, id });
        } catch {}
      });
      
      return msgs;
    }, {
      messageSelector: SELECTORS.messageIn,
      msgRow: SELECTORS.msgRow,
      textSelector: SELECTORS.text,
      textFallback: SELECTORS.textFallback,
      timestampSelector: SELECTORS.timestamp,
      senderSelector: SELECTORS.sender,
    });
    
    // Deduplica
    let newCount = 0;
    for (const msg of batch) {
      const hash = hashText(msg.id);
      if (!seenHashes.has(hash)) {
        seenHashes.add(hash);
        messages.push(msg);
        newCount++;
      }
    }
    
    // Scroll para cima (mensagens antigas)
    const currentHeight = await page.evaluate(() => {
      const container = document.querySelector('div[tabindex="0"]._ajx_') || 
                        document.querySelector('[data-testid="conversation-panel-messages"]') ||
                        document.querySelector('.copyable-area') ||
                        document.querySelector('#main .copyable-area');
      if (container) {
        container.scrollTop -= 800;
        return container.scrollHeight;
      }
      return document.body.scrollHeight;
    });
    
    if (currentHeight === lastHeight && newCount === 0) {
      stableCount++;
    } else {
      stableCount = 0;
    }
    lastHeight = currentHeight;
    scrollCount++;
    
    await page.waitForTimeout(CONFIG.SCROLL_DELAY);
  }
  
  console.log(`[Extrair] ✅ ${messages.length} mensagens únicas extraídas (${scrollCount} scrolls)`);
  return messages.reverse(); // Ordem cronológica
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANÁLISE E GERAÇÃO DE DADOS
// ═══════════════════════════════════════════════════════════════════════════════

async function analyzeMessages(messages, groupConfig) {
  const allTasks = [];
  const allIdeas = [];
  const allDecisions = [];
  const allLinks = [];
  const participants = new Set();
  const projectMentions = {};
  
  for (const msg of messages) {
    participants.add(msg.sender);
    
    // Tarefas
    const tasks = extractTasks(msg.text);
    for (const t of tasks) {
      allTasks.push({ ...t, sender: msg.sender, time: msg.time, group: groupConfig.short });
    }
    
    // Ideias
    const ideas = extractIdeas(msg.text);
    for (const i of ideas) {
      allIdeas.push({ ...i, sender: msg.sender, time: msg.time, group: groupConfig.short });
    }
    
    // Decisões
    if (isDecision(msg.text)) {
      allDecisions.push({ text: msg.text, sender: msg.sender, time: msg.time, group: groupConfig.short });
    }
    
    // Links
    const links = await extractLinks(msg.text);
    for (const link of links) {
      allLinks.push({ ...link, sender: msg.sender, time: msg.time, group: groupConfig.short });
    }
    
    // Projetos mencionados
    const project = detectProject(msg.text);
    if (project) {
      projectMentions[project] = (projectMentions[project] || 0) + 1;
    }
  }
  
  return {
    tasks: allTasks,
    ideas: allIdeas,
    decisions: allDecisions,
    links: allLinks,
    participants: Array.from(participants),
    projectMentions,
    messageCount: messages.length,
  };
}

function generateDashboardData(allGroupsData) {
  const allMessages = allGroupsData.flatMap(g => g.messages.map(m => ({ ...m, group: g.config.short })));
  const allTasks = allGroupsData.flatMap(g => g.analysis.tasks);
  const allIdeas = allGroupsData.flatMap(g => g.analysis.ideas);
  const allDecisions = allGroupsData.flatMap(g => g.analysis.decisions);
  const allLinks = allGroupsData.flatMap(g => g.analysis.links);
  
  const allParticipants = [...new Set(allGroupsData.flatMap(g => g.analysis.participants))];
  
  // Timeline por dia
  const timeline = {};
  for (const msg of allMessages) {
    const day = msg.time || 'Sem hora';
    if (!timeline[day]) timeline[day] = [];
    timeline[day].push(msg);
  }
  
  // Progresso dos projetos (baseado em menções e tarefas)
  const projectProgress = [
    { 
      name: 'Santafe (Paulo)', 
      status: 'Contrato fechado, aguardando pagamento', 
      progress: 65, 
      health: 'good',
      type: 'client',
      client: 'Paulo Santafe Construcciones'
    },
    { 
      name: 'Sorveteria Tropicale (Juan)', 
      status: 'Em desenvolvimento ativo', 
      progress: 45, 
      health: 'good',
      type: 'client',
      client: 'Juan Sorveteria Tropicale'
    },
    { 
      name: 'Superclim (Elias)', 
      status: 'Docs em aprovação', 
      progress: 40, 
      health: 'warning',
      type: 'internal',
      owner: 'Elias'
    },
    { 
      name: 'Mangá Stop', 
      status: 'Em desenvolvimento', 
      progress: 25, 
      health: 'good',
      type: 'internal',
      owner: 'NEXO Team'
    },
    { 
      name: 'SpeakEasily', 
      status: 'Planejamento inicial', 
      progress: 10, 
      health: 'neutral',
      type: 'internal',
      owner: 'NEXO Team'
    },
  ];
  
  // Atualiza progresso baseado em atividade recente
  for (const proj of projectProgress) {
    const mentions = allMessages.filter(m => {
      const keywords = PROJECT_KEYWORDS[proj.name] || [];
      return keywords.some(k => m.text.toLowerCase().includes(k));
    }).length;
    
    const projTasks = allTasks.filter(t => t.project === proj.name).length;
    const projIdeas = allIdeas.filter(i => i.project === proj.name).length;
    
    // Aumenta progresso baseado em atividade (máx +5% por ciclo)
    const activityBoost = Math.min((mentions + projTasks + projIdeas) * 2, 5);
    proj.progress = Math.min(proj.progress + activityBoost, 100);
    
    // Atualiza status baseado em decisões
    const projDecisions = allDecisions.filter(d => {
      const keywords = PROJECT_KEYWORDS[proj.name] || [];
      return keywords.some(k => d.text.toLowerCase().includes(k));
    });
    if (projDecisions.length > 0) {
      proj.status = 'Atualizado recentemente';
    }
  }
  
  return {
    version: '8.0',
    updatedAt: nowISO(),
    reportTime: nowBR(),
    stats: {
      totalMessages: allMessages.length,
      totalTasks: allTasks.length,
      highPriorityTasks: allTasks.filter(t => t.priority === 'high').length,
      totalIdeas: allIdeas.length,
      totalDecisions: allDecisions.length,
      totalLinks: allLinks.length,
      activeGroups: allGroupsData.length,
      participants: allParticipants,
    },
    tasks: {
      high: allTasks.filter(t => t.priority === 'high'),
      medium: allTasks.filter(t => t.priority === 'medium'),
      all: allTasks,
    },
    ideas: allIdeas,
    decisions: allDecisions,
    links: allLinks,
    recentMessages: allMessages.slice(-20),
    timeline,
    projectProgress,
    groups: allGroupsData.map(g => ({
      name: g.config.name,
      short: g.config.short,
      type: g.config.type,
      messageCount: g.messages.length,
      taskCount: g.analysis.tasks.length,
      ideaCount: g.analysis.ideas.length,
      participants: g.analysis.participants,
      urgency: g.analysis.tasks.some(t => t.priority === 'high') ? 'high' : 'normal',
    })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// GERAÇÃO DE RELATÓRIO HTML
// ═══════════════════════════════════════════════════════════════════════════════

function generateReportHTML(data) {
  const { stats, tasks, ideas, decisions, links, recentMessages, projectProgress, groups, reportTime } = data;
  
  const highTasks = tasks.high || [];
  const allTasks = tasks.all || [];
  const allIdeas = ideas || [];
  const allDecisions = decisions || [];
  const allLinks = links || [];
  
  // Cores do tema NEXO
  const colors = {
    primary: '#6366f1',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6',
    dark: '#0f172a',
    card: '#1e293b',
    border: '#334155',
    text: '#f1f5f9',
    muted: '#94a3b8',
  };
  
  // Timeline HTML
  const timelineHTML = Object.entries(data.timeline || {})
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 5)
    .map(([day, msgs]) => `
      <div style="margin-bottom: 16px;">
        <div style="font-size: 12px; font-weight: 600; color: ${colors.muted}; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
          ${day}
        </div>
        ${msgs.slice(-3).map(m => `
          <div style="padding: 8px 12px; background: ${colors.card}; border-radius: 8px; margin-bottom: 4px; border-left: 3px solid ${colors.primary};">
            <div style="font-size: 11px; color: ${colors.muted}; margin-bottom: 2px;">
              ${m.sender} • ${m.group}
            </div>
            <div style="font-size: 13px; color: ${colors.text}; line-height: 1.4;">
              ${m.text.substring(0, 120)}${m.text.length > 120 ? '...' : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `).join('');
  
  // Links com preview
  const linksHTML = allLinks.slice(0, 5).map(link => `
    <a href="${link.url}" target="_blank" style="display: block; padding: 12px; background: ${colors.card}; border-radius: 8px; margin-bottom: 8px; text-decoration: none; border: 1px solid ${colors.border}; transition: border-color 0.2s;">
      <div style="font-size: 13px; font-weight: 600; color: ${colors.primary}; margin-bottom: 4px;">
        🔗 ${link.title || link.url}
      </div>
      ${link.description ? `<div style="font-size: 11px; color: ${colors.muted}; line-height: 1.4;">${link.description.substring(0, 100)}</div>` : ''}
      <div style="font-size: 10px; color: ${colors.muted}; margin-top: 4px;">
        Enviado por ${link.sender} • ${link.group}
      </div>
    </a>
  `).join('');
  
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>📊 NEXO Report — ${todayBR()}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            nexo: { bg: '#0f172a', card: '#1e293b', border: '#334155', text: '#f1f5f9', muted: '#94a3b8', primary: '#6366f1', success: '#22c55e', warning: '#f59e0b', danger: '#ef4444', info: '#3b82f6' }
          }
        }
      }
    }
  </script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    body { font-family: 'Inter', sans-serif; background: #0f172a; color: #f1f5f9; }
    .glass-card { background: rgba(30, 41, 59, 0.8); backdrop-filter: blur(12px); border: 1px solid rgba(51, 65, 85, 0.5); }
    .animate-pulse-slow { animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .7; } }
    .progress-bar { transition: width 1s ease-out; }
    .message-bubble { animation: slideIn 0.3s ease-out; }
    @keyframes slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .tab-active { border-bottom: 2px solid #6366f1; color: #6366f1; }
    .tab-inactive { color: #94a3b8; }
    .tab-inactive:hover { color: #f1f5f9; }
  </style>
</head>
<body class="min-h-screen">
  <div class="max-w-5xl mx-auto p-4 md:p-8">
    
    <!-- HEADER -->
    <header class="mb-8">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-nexo-primary flex items-center justify-center text-white font-bold text-lg">N</div>
          <div>
            <h1 class="text-xl font-bold">NEXO Intelligence Report</h1>
            <p class="text-sm text-nexo-muted">${reportTime}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-nexo-success animate-pulse-slow"></span>
          <span class="text-xs text-nexo-muted">Agente v8.0 Ativo</span>
        </div>
      </div>
      
      <!-- STATS CARDS -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="glass-card rounded-xl p-4">
          <div class="text-2xl font-bold text-nexo-success">${stats.totalMessages}</div>
          <div class="text-xs text-nexo-muted">Mensagens</div>
        </div>
        <div class="glass-card rounded-xl p-4">
          <div class="text-2xl font-bold text-nexo-warning">${stats.totalTasks}</div>
          <div class="text-xs text-nexo-muted">Tarefas</div>
          ${stats.highPriorityTasks > 0 ? `<div class="text-[10px] text-nexo-danger mt-1">${stats.highPriorityTasks} urgentes</div>` : ''}
        </div>
        <div class="glass-card rounded-xl p-4">
          <div class="text-2xl font-bold text-nexo-info">${stats.totalIdeas}</div>
          <div class="text-xs text-nexo-muted">Ideias</div>
        </div>
        <div class="glass-card rounded-xl p-4">
          <div class="text-2xl font-bold text-nexo-primary">${stats.participants.length}</div>
          <div class="text-xs text-nexo-muted">Participantes</div>
        </div>
      </div>
    </header>
    
    <!-- TABS -->
    <div class="flex gap-1 mb-6 border-b border-nexo-border pb-1 overflow-x-auto">
      <button onclick="showTab('overview')" id="tab-overview" class="tab-active px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors">Visão Geral</button>
      <button onclick="showTab('projects')" id="tab-projects" class="tab-inactive px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors">Projetos</button>
      <button onclick="showTab('tasks')" id="tab-tasks" class="tab-inactive px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors">Tarefas (${allTasks.length})</button>
      <button onclick="showTab('messages')" id="tab-messages" class="tab-inactive px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors">Mensagens</button>
      <button onclick="showTab('links')" id="tab-links" class="tab-inactive px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors">Links</button>
    </div>
    
    <!-- TAB: OVERVIEW -->
    <div id="content-overview" class="space-y-6">
      
      <!-- Grupos Monitorados -->
      <section class="glass-card rounded-xl p-5">
        <h2 class="text-sm font-semibold mb-4 flex items-center gap-2">
          <span>💬</span> Grupos Monitorados
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          ${groups.map(g => `
            <div class="bg-nexo-bg rounded-lg p-4 border border-nexo-border">
              <div class="flex items-center justify-between mb-3">
                <span class="font-medium text-sm">${g.name}</span>
                <span class="text-[10px] px-2 py-0.5 rounded-full ${g.type === 'client' ? 'bg-nexo-success/20 text-nexo-success' : 'bg-nexo-info/20 text-nexo-info'}">
                  ${g.type === 'client' ? '👤 Cliente' : '⚙️ Interno'}
                </span>
              </div>
              <div class="grid grid-cols-3 gap-2 text-center">
                <div class="bg-nexo-card rounded-lg p-2">
                  <div class="text-lg font-bold text-nexo-primary">${g.messageCount}</div>
                  <div class="text-[10px] text-nexo-muted">Msgs</div>
                </div>
                <div class="bg-nexo-card rounded-lg p-2">
                  <div class="text-lg font-bold text-nexo-warning">${g.taskCount}</div>
                  <div class="text-[10px] text-nexo-muted">Tarefas</div>
                </div>
                <div class="bg-nexo-card rounded-lg p-2">
                  <div class="text-lg font-bold text-nexo-success">${g.participants.length}</div>
                  <div class="text-[10px] text-nexo-muted">Membros</div>
                </div>
              </div>
              <div class="flex flex-wrap gap-1 mt-3">
                ${g.participants.map(p => `<span class="text-[10px] px-2 py-0.5 bg-nexo-card rounded-full text-nexo-muted">${p}</span>`).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </section>
      
      <!-- Tarefas Urgentes -->
      ${highTasks.length > 0 ? `
        <section class="glass-card rounded-xl p-5">
          <h2 class="text-sm font-semibold mb-4 flex items-center gap-2 text-nexo-danger">
            <span>🔥</span> Tarefas Urgentes
          </h2>
          <div class="space-y-2">
            ${highTasks.slice(0, 5).map(t => `
              <div class="bg-nexo-bg rounded-lg p-3 border-l-3 border-nexo-danger" style="border-left: 3px solid ${colors.danger};">
                <div class="text-sm font-medium">${t.text}</div>
                <div class="flex items-center gap-3 mt-1 text-[11px] text-nexo-muted">
                  <span>👤 ${t.sender}</span>
                  <span>💬 ${t.group}</span>
                  <span>🕐 ${t.time}</span>
                  ${t.project ? `<span class="text-nexo-primary">📁 ${t.project}</span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </section>
      ` : ''}
      
      <!-- Timeline -->
      <section class="glass-card rounded-xl p-5">
        <h2 class="text-sm font-semibold mb-4 flex items-center gap-2">
          <span>📅</span> Timeline Recente
        </h2>
        <div>${timelineHTML}</div>
      </section>
    </div>
    
    <!-- TAB: PROJECTS -->
    <div id="content-projects" class="space-y-4 hidden">
      <div class="glass-card rounded-xl p-5">
        <h2 class="text-sm font-semibold mb-4">Progresso dos Projetos</h2>
        <div class="space-y-4">
          ${projectProgress.map(p => `
            <div class="bg-nexo-bg rounded-lg p-4">
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium">${p.name}</span>
                  <span class="text-[10px] px-2 py-0.5 rounded-full ${p.type === 'client' ? 'bg-nexo-success/20 text-nexo-success' : 'bg-nexo-info/20 text-nexo-info'}">
                    ${p.type === 'client' ? 'Cliente' : 'Interno'}
                  </span>
                </div>
                <span class="text-sm font-bold" style="color: ${p.health === 'good' ? colors.success : p.health === 'warning' ? colors.warning : colors.info}">${p.progress}%</span>
              </div>
              <div class="w-full h-2.5 bg-nexo-card rounded-full overflow-hidden">
                <div class="h-full rounded-full progress-bar" style="width: ${p.progress}%; background-color: ${p.health === 'good' ? colors.success : p.health === 'warning' ? colors.warning : colors.info}"></div>
              </div>
              <p class="text-xs text-nexo-muted mt-2">${p.status}</p>
            </div>
          `).join('')}
        </div>
        <div class="mt-4 pt-4 border-t border-nexo-border">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">Média Geral</span>
            <span class="text-xl font-bold text-nexo-primary">${Math.round(projectProgress.reduce((a, p) => a + p.progress, 0) / projectProgress.length)}%</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- TAB: TASKS -->
    <div id="content-tasks" class="space-y-3 hidden">
      ${allTasks.length > 0 ? `
        <div class="flex items-center justify-between mb-4">
          <span class="text-sm text-nexo-muted">${allTasks.filter(t => t.priority === 'high').length} urgentes / ${allTasks.length} total</span>
        </div>
        ${allTasks.map(t => `
          <div class="glass-card rounded-lg p-4 message-bubble">
            <div class="flex items-start gap-3">
              <div class="w-2 h-2 mt-1.5 rounded-full flex-shrink-0" style="background-color: ${t.priority === 'high' ? colors.danger : colors.warning}"></div>
              <div class="flex-1">
                <p class="text-sm font-medium">${t.text}</p>
                <div class="flex items-center gap-3 mt-2 text-[11px] text-nexo-muted">
                  <span class="px-2 py-0.5 rounded-full ${t.priority === 'high' ? 'bg-nexo-danger/20 text-nexo-danger' : 'bg-nexo-warning/20 text-nexo-warning'}">
                    ${t.priority === 'high' ? '🔥 Alta' : '⚡ Média'}
                  </span>
                  <span>👤 ${t.sender}</span>
                  <span>💬 ${t.group}</span>
                  ${t.project ? `<span class="text-nexo-primary">📁 ${t.project}</span>` : ''}
                </div>
              </div>
            </div>
          </div>
        `).join('')}
      ` : `
        <div class="text-center text-nexo-muted py-12">
          <div class="text-4xl mb-4">✅</div>
          <p>Nenhuma tarefa encontrada neste período</p>
        </div>
      `}
    </div>
    
    <!-- TAB: MESSAGES -->
    <div id="content-messages" class="space-y-3 hidden">
      ${recentMessages.map(m => `
        <div class="glass-card rounded-lg p-4 message-bubble flex gap-3">
          <div class="w-8 h-8 rounded-full bg-nexo-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-nexo-primary">
            ${m.sender?.[0]?.toUpperCase() || '?'}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs font-medium">${m.sender}</span>
              <span class="text-[10px] text-nexo-muted">${m.time}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-nexo-card text-nexo-muted">${m.group}</span>
            </div>
            <p class="text-sm text-nexo-text/90">${m.text}</p>
          </div>
        </div>
      `).join('')}
    </div>
    
    <!-- TAB: LINKS -->
    <div id="content-links" class="space-y-3 hidden">
      ${allLinks.length > 0 ? linksHTML : `
        <div class="text-center text-nexo-muted py-12">
          <div class="text-4xl mb-4">🔗</div>
          <p>Nenhum link encontrado neste período</p>
        </div>
      `}
    </div>
    
    <!-- FOOTER -->
    <footer class="mt-8 pt-4 border-t border-nexo-border text-center text-xs text-nexo-muted">
      <p>📊 NEXO Digital Intelligence — Relatório gerado automaticamente a cada 30 min</p>
      <p class="mt-1">Clientes: Juan (Sorveteria Tropicale) • Paulo (Santafe Construcciones)</p>
    </footer>
  </div>
  
  <script>
    function showTab(tabId) {
      // Hide all content
      document.querySelectorAll('[id^="content-"]').forEach(el => el.classList.add('hidden'));
      document.getElementById('content-' + tabId).classList.remove('hidden');
      
      // Update tab styles
      document.querySelectorAll('[id^="tab-"]').forEach(el => {
        el.classList.remove('tab-active');
        el.classList.add('tab-inactive');
      });
      document.getElementById('tab-' + tabId).classList.remove('tab-inactive');
      document.getElementById('tab-' + tabId).classList.add('tab-active');
    }
  </script>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENVIO DE RELATÓRIO VIA WHATSAPP
// ═══════════════════════════════════════════════════════════════════════════════

async function sendReportViaWhatsApp(page, reportText, destination) {
  console.log(`\n[WhatsApp] Enviando relatório para: ${destination.name} (${destination.number})`);
  
  try {
    // Abre conversa com o número
    const chatUrl = `https://web.whatsapp.com/send?phone=${destination.number}`;
    await page.goto(chatUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);
    
    // Aguarda o chat carregar
    await page.waitForSelector(SELECTORS.textInput, { timeout: 30000 });
    
    // Digita a mensagem
    const input = page.locator(SELECTORS.textInput).first();
    await input.click();
    
    // Envia em partes se for muito longo
    const maxLength = 1000;
    const parts = [];
    for (let i = 0; i < reportText.length; i += maxLength) {
      parts.push(reportText.slice(i, i + maxLength));
    }
    
    for (const part of parts) {
      await input.fill(part);
      await page.waitForTimeout(500);
      
      // Clica no botão de enviar
      const sendBtn = page.locator(SELECTORS.sendButton).first();
      await sendBtn.click({ timeout: 5000 });
      await page.waitForTimeout(1500);
    }
    
    console.log(`[WhatsApp] ✅ Relatório enviado para ${destination.name}!`);
    return true;
  } catch (e) {
    console.log(`[WhatsApp] ❌ Falha ao enviar: ${e.message}`);
    return false;
  }
}

// Gera texto do relatório para envio no WhatsApp
function generateReportText(data) {
  const { stats, tasks, projectProgress, groups, reportTime } = data;
  const highTasks = tasks.high || [];
  const allTasks = tasks.all || [];
  
  let text = `📊 *NEXO RELATÓRIO INTELIGENTE*\n`;
  text += `🕐 ${reportTime}\n`;
  text += `━`.repeat(30) + `\n\n`;
  
  // Stats
  text += `📈 *RESUMO*\n`;
  text += `• ${stats.totalMessages} mensagens\n`;
  text += `• ${stats.totalTasks} tarefas (${stats.highPriorityTasks} urgentes)\n`;
  text += `• ${stats.totalIdeas} ideias\n`;
  text += `• ${stats.totalDecisions} decisões\n`;
  text += `• ${stats.participants.length} participantes\n\n`;
  
  // Grupos
  text += `💬 *GRUPOS*\n`;
  for (const g of groups) {
    text += `• ${g.short}: ${g.messageCount} msgs, ${g.taskCount} tarefas\n`;
  }
  text += `\n`;
  
  // Tarefas urgentes
  if (highTasks.length > 0) {
    text += `🔥 *TAREFAS URGENTES*\n`;
    for (const t of highTasks.slice(0, 5)) {
      text += `• ${t.text}\n`;
      text += `  👤 ${t.sender} | 💬 ${t.group}\n`;
    }
    text += `\n`;
  }
  
  // Projetos
  text += `📁 *PROJETOS*\n`;
  for (const p of projectProgress) {
    const type = p.type === 'client' ? '👤' : '⚙️';
    text += `${type} ${p.name}: ${p.progress}% — ${p.status}\n`;
  }
  text += `\n`;
  
  // Links
  if (data.links && data.links.length > 0) {
    text += `🔗 *LINKS*\n`;
    for (const l of data.links.slice(0, 5)) {
      text += `• ${l.title || l.url}\n`;
    }
    text += `\n`;
  }
  
  text += `━`.repeat(30) + `\n`;
  text += `🤖 Gerado automaticamente pelo NEXO Agent v8.0`;
  
  return text;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HISTÓRICO DE RELATÓRIOS
// ═══════════════════════════════════════════════════════════════════════════════

function saveReportToHistory(reportData, htmlContent, textContent) {
  ensureDir(CONFIG.REPORTS_DIR);
  
  const reportId = `report-${Date.now()}`;
  const dateStr = new Date().toISOString().slice(0, 10);
  const htmlFile = path.join(CONFIG.REPORTS_DIR, `${reportId}.html`);
  const txtFile = path.join(CONFIG.REPORTS_DIR, `${reportId}.txt`);
  
  // Salva arquivos
  fs.writeFileSync(htmlFile, htmlContent, 'utf8');
  fs.writeFileSync(txtFile, textContent, 'utf8');
  
  // Atualiza histórico
  const history = readJSON(CONFIG.REPORT_HISTORY_FILE, { reports: [] });
  history.reports.push({
    id: reportId,
    date: dateStr,
    time: nowBR(),
    timestamp: nowISO(),
    stats: reportData.stats,
    htmlFile: htmlFile,
    textFile: txtFile,
    groups: reportData.groups.map(g => g.short),
    sent: false,
  });
  
  // Mantém apenas últimos 100 relatórios
  if (history.reports.length > 100) {
    history.reports = history.reports.slice(-100);
  }
  
  writeJSON(CONFIG.REPORT_HISTORY_FILE, history);
  
  return { reportId, htmlFile, txtFile };
}

function markReportAsSent(reportId) {
  const history = readJSON(CONFIG.REPORT_HISTORY_FILE, { reports: [] });
  const report = history.reports.find(r => r.id === reportId);
  if (report) {
    report.sent = true;
    report.sentAt = nowISO();
    writeJSON(CONFIG.REPORT_HISTORY_FILE, history);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FUNÇÃO PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export async function runAgent() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  NEXO WhatsApp Agent v8.0 — RELATÓRIO INTELIGENTE                   ║');
  console.log('║  Clientes: Juan (Sorveteria) • Paulo (Santafe)                      ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log('');
  
  let browser, page;
  
  try {
    // 1. Conecta ao WhatsApp
    const conn = await connectWhatsApp();
    browser = conn.browser;
    page = conn.page;
    
    // 2. Processa cada grupo
    const allGroupsData = [];
    
    for (const groupConfig of CONFIG.GROUPS) {
      const opened = await openGroup(page, groupConfig);
      if (!opened) {
        console.log(`[Pular] Grupo não encontrado: ${groupConfig.name}`);
        continue;
      }
      
      // Extrai mensagens
      const messages = await extractMessages(page, groupConfig.name);
      
      // Analisa
      const analysis = await analyzeMessages(messages, groupConfig);
      
      allGroupsData.push({
        config: groupConfig,
        messages,
        analysis,
      });
      
      await page.waitForTimeout(2000);
    }
    
    if (allGroupsData.length === 0) {
      console.log('\n❌ Nenhum grupo processado. Verifique se o WhatsApp está logado.');
      return;
    }
    
    // 3. Gera dados do dashboard
    const dashboardData = generateDashboardData(allGroupsData);
    
    // 4. Salva dados do agente
    writeJSON(CONFIG.OUTPUT_FILE, dashboardData);
    console.log(`\n[Salvar] Dados salvos em: ${CONFIG.OUTPUT_FILE}`);
    
    // 5. Gera relatório HTML
    const reportHTML = generateReportHTML(dashboardData);
    const reportText = generateReportText(dashboardData);
    
    // 6. Salva no histórico
    const { reportId, htmlFile, txtFile } = saveReportToHistory(dashboardData, reportHTML, reportText);
    console.log(`[Relatório] HTML: ${htmlFile}`);
    console.log(`[Relatório] TXT: ${txtFile}`);
    
    // 7. Envia relatório via WhatsApp
    console.log('\n[WhatsApp] Preparando envio do relatório...');
    let anySent = false;
    
    for (const dest of CONFIG.REPORT_DESTINATIONS) {
      const sent = await sendReportViaWhatsApp(page, reportText, dest);
      if (sent) {
        anySent = true;
        markReportAsSent(reportId);
      }
    }
    
    // 8. Resumo
    console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ AGENTE CONCLUÍDO COM SUCESSO                                    ║');
    console.log(`║  📊 ${dashboardData.stats.totalMessages} mensagens | ${dashboardData.stats.totalTasks} tarefas | ${dashboardData.stats.totalIdeas} ideias          ║`);
    console.log(`║  📁 Relatório: ${reportId}                    ║`);
    console.log(`║  📤 Enviado: ${anySent ? 'SIM ✅' : 'NÃO ❌'}                                          ║`);
    console.log('╚══════════════════════════════════════════════════════════════════════╝');
    
  } catch (e) {
    if (e.message === 'WHATSAPP_NEEDS_LOGIN') {
      console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
      console.log('║  ⚠️  WHATSAPP PRECISA DE LOGIN                                      ║');
      console.log('║                                                                     ║');
      console.log('║  1. Abra o WhatsApp no celular                                      ║');
      console.log('║  2. Toque em "Dispositivos vinculados" → "Vincular um dispositivo"  ║');
      console.log('║  3. Escaneie o QR code salvo em:                                    ║');
      console.log('║     public/whatsapp-qr-code.png                                     ║');
      console.log('║                                                                     ║');
      console.log('║  O agente tentará novamente em 5 minutos.                           ║');
      console.log('╚══════════════════════════════════════════════════════════════════════╝');
      process.exitCode = 2; // Código especial para "precisa de login"
      return; // Importante: retorna para não cair no catch abaixo
    } else {
      console.error('\n❌ ERRO FATAL:', e.message);
      console.error(e.stack);
      process.exitCode = 1;
    }
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

// Se executado diretamente (compatível com Windows/Linux/Mac)
const modulePath = decodeURIComponent(import.meta.url.replace('file:///', '').replace(/\//g, '\\'));
const scriptPath = process.argv[1];
const isMainModule = modulePath.toLowerCase() === scriptPath.toLowerCase();
if (isMainModule) {
  runAgent().then(() => process.exit(process.exitCode || 0)).catch(() => process.exit(1));
}
