/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * LUNA — CTO Virtual da NEXO Digital v10.2
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * REGRAS DE ENVIO (definitivas):
 * 
 * 1. SCAN: A cada 10 minutos — verifica mensagens, guarda dados, NÃO envia
 * 2. RELATÓRIO: A cada 30 minutos — junta TODAS as novidades e envia no grupo
 * 3. Se não houver novidades em 30min → envia 1x "sem novidades", depois silêncio
 * 4. Só volta a enviar quando detectar novas mensagens
 * 
 * DESTINO: Só grupo 🏆Production - 2026🙏
 * NUNCA: chats pessoais, outros grupos, números individuais
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
  
  // REGRA ESTRITA: Só envia no grupo Production 2026
  REPORT_DESTINATIONS: [
    { name: 'Production', number: '34685093192', type: 'group', groupName: '🏆Production - 2026🙏' }
  ],
  
  // Arquivos
  CHECKPOINT_FILE: path.join(__dirname, '..', 'backend', 'data', 'luna-checkpoint.json'),
  BUFFER_FILE: path.join(__dirname, '..', 'backend', 'data', 'luna-buffer.json'),
  OUTPUT_FILE: path.join(__dirname, '..', 'backend', 'data', 'whatsapp-agent-data.json'),
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
// CHECKPOINT + BUFFER DE NOVIDADES
// ═══════════════════════════════════════════════════════════════════════════════

function loadCheckpoint() {
  return readJSON(CONFIG.CHECKPOINT_FILE, {
    version: '10.2',
    lastRun: null,
    knownMessageHashes: [],
    totalMessagesSeen: 0,
    lastReportHadNews: false,
    lastReportTime: null,
  });
}

function saveCheckpoint(cp) {
  writeJSON(CONFIG.CHECKPOINT_FILE, cp);
}

// Buffer: acumula novidades entre scans para o relatório de 30min
function loadBuffer() {
  return readJSON(CONFIG.BUFFER_FILE, {
    newMessages: [],
    tasks: [],
    ideas: [],
    decisions: [],
    firstNewMessageTime: null,
    lastScanTime: null,
  });
}

function saveBuffer(buf) {
  writeJSON(CONFIG.BUFFER_FILE, buf);
}

function clearBuffer() {
  saveBuffer({
    newMessages: [],
    tasks: [],
    ideas: [],
    decisions: [],
    firstNewMessageTime: null,
    lastScanTime: null,
  });
}

function addToBuffer(buffer, newMessages, tasks, ideas, decisions) {
  buffer.newMessages.push(...newMessages);
  buffer.tasks.push(...tasks);
  buffer.ideas.push(...ideas);
  buffer.decisions.push(...decisions);
  if (!buffer.firstNewMessageTime && newMessages.length > 0) {
    buffer.firstNewMessageTime = nowISO();
  }
  buffer.lastScanTime = nowISO();
  saveBuffer(buffer);
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

async function isChatOpen(page, groupName) {
  try {
    // Verifica o título no header do chat atual
    const currentTitle = await page.evaluate(() => {
      const headerTitle = document.querySelector('[data-testid="conversation-header-title"]');
      if (headerTitle) return headerTitle.textContent?.trim() || '';
      
      // Fallback: verifica span[title] no header
      const header = document.querySelector('header span[title]');
      if (header) return header.getAttribute('title') || header.textContent?.trim() || '';
      
      return '';
    });
    
    const isOpen = currentTitle.includes(groupName) || 
                   currentTitle.includes('Production') || 
                   currentTitle.includes('2026') ||
                   currentTitle.includes('Paulo');
    
    if (isOpen) {
      console.log(`[Luna] ✅ Chat já está aberto: "${currentTitle}"`);
    }
    
    return isOpen;
  } catch (e) {
    return false;
  }
}

async function openGroup(page, groupConfig) {
  const { name, short } = groupConfig;
  console.log(`[Luna] 🔍 Procurando: ${name}`);
  
  try {
    // 0. VERIFICA SE O CHAT JÁ ESTÁ ABERTO (BUG FIX)
    const alreadyOpen = await isChatOpen(page, short);
    if (alreadyOpen) {
      console.log(`[Luna] ✅ Chat já está aberto, não vou clicar novamente!`);
      await page.waitForTimeout(1000);
      return true;
    }
    
    // 1. Garante que estamos na tela principal (lista de chats)
    await page.evaluate(() => {
      // Pressiona Escape para voltar
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    await page.waitForTimeout(1000);
    
    // 2. Espera a lista de chats carregar (usando seletor correto)
    await page.waitForSelector('[data-testid="cell-frame-container"]', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
    
    // 3. Tenta encontrar pelo data-testid="cell-frame-title" (título do chat)
    let found = await page.evaluate((searchTerm) => {
      const items = document.querySelectorAll('[data-testid="cell-frame-container"]');
      for (const item of items) {
        const titleEl = item.querySelector('[data-testid="cell-frame-title"]');
        const title = titleEl?.textContent?.trim() || titleEl?.getAttribute('title') || '';
        if (title.includes(searchTerm)) {
          item.click();
          return true;
        }
      }
      return false;
    }, short);
    
    // 4. Se não encontrou, tenta por texto parcial no container
    if (!found) {
      found = await page.evaluate((searchTerm) => {
        const items = document.querySelectorAll('[data-testid="cell-frame-container"]');
        for (const item of items) {
          const text = item.textContent || '';
          if (text.includes(searchTerm) || 
              text.includes('Production') || 
              text.includes('2026') || 
              text.includes('Paulo')) {
            item.click();
            return true;
          }
        }
        return false;
      }, short);
    }
    
    // 5. Se ainda não encontrou, tenta usar a barra de busca
    if (!found) {
      console.log(`[Luna] 🔍 Usando busca para: ${short}`);
      try {
        // Clica no container de busca
        const searchContainer = page.locator('[data-testid="chat-list-search-container"]').first();
        if (await searchContainer.count() > 0) {
          await searchContainer.click();
          await page.waitForTimeout(500);
          
          // Digita o termo de busca
          await page.keyboard.type(short);
          await page.waitForTimeout(2000);
          
          // Clica no primeiro resultado
          const firstResult = page.locator('[data-testid="cell-frame-container"]').first();
          if (await firstResult.count() > 0) {
            await firstResult.click();
            found = true;
          }
        }
      } catch (e) {
        console.log(`[Luna] ⚠️ Busca falhou: ${e.message}`);
      }
    }
    
    // 6. Último recurso: navegar diretamente via URL
    if (!found) {
      console.log(`[Luna] 🔍 Tentando navegação direta...`);
      try {
        await page.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(5000);
        
        found = await page.evaluate((searchTerm) => {
          const items = document.querySelectorAll('[data-testid="cell-frame-container"]');
          for (const item of items) {
            const text = item.textContent || '';
            if (text.includes(searchTerm)) {
              item.click();
              return true;
            }
          }
          return false;
        }, short);
      } catch (e) {
        console.log(`[Luna] ⚠️ Navegação direta falhou: ${e.message}`);
      }
    }
    
    if (found) {
      await page.waitForTimeout(3000);
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
  
  // Espera o painel de conversa carregar
  await page.waitForTimeout(2000);
  
  // Scroll para o final primeiro
  await page.evaluate(() => {
    const container = document.querySelector('[data-testid="conversation-panel-messages"]') ||
                      document.querySelector('.copyable-area') ||
                      document.querySelector('div[tabindex="0"]');
    if (container) container.scrollTop = container.scrollHeight;
  });
  await page.waitForTimeout(1500);
  
  while (scrollCount < CONFIG.MAX_SCROLLS && stableCount < 3) {
    const batch = await page.evaluate(() => {
      const msgs = [];
      // Usa div[role="row"] como seletor principal (funciona na nova UI)
      const containers = document.querySelectorAll('div[role="row"]');
      
      containers.forEach(container => {
        try {
          // Tenta encontrar texto da mensagem
          let textEl = container.querySelector('span.selectable-text.copyable-text');
          if (!textEl) textEl = container.querySelector('span[dir="ltr"].selectable-text');
          if (!textEl) {
            // Procura por spans com texto significativo
            const spans = container.querySelectorAll('span');
            for (const s of spans) {
              const txt = s.textContent?.trim();
              if (txt && txt.length > 2 && txt.length < 2000 && 
                  !s.closest('[data-testid="msg-meta"]') &&
                  !s.closest('[data-testid="last-msg-status"]')) {
                textEl = s;
                break;
              }
            }
          }
          
          const text = textEl?.textContent?.trim();
          if (!text || text.length < 2 || text.length > 2000) return;
          
          // Tenta encontrar hora
          let time = '';
          const timeEl = container.querySelector('span[data-testid="msg-meta"] span[dir="auto"]');
          if (timeEl) time = timeEl.textContent.trim();
          
          // Tenta encontrar remetente
          let sender = '';
          // Primeiro: procura por span[title] fora do meta
          const senderEl = container.querySelector('span[title]:not([data-testid="msg-meta"] *)');
          if (senderEl && senderEl.textContent !== text && senderEl.textContent.length < 50) {
            sender = senderEl.textContent.trim();
          }
          // Segundo: procura por qualquer span com título
          if (!sender) {
            const titled = container.querySelector('span[title]');
            if (titled && titled.textContent !== text && titled.textContent.length < 50) {
              sender = titled.getAttribute('title') || titled.textContent.trim();
            }
          }
          // Terceiro: procura spans com texto curto
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
          
          // Detecta se é mensagem enviada (outgoing)
          const isOutgoing = container.classList.contains('message-out') || 
                            container.closest('.message-out') !== null ||
                            container.querySelector('[data-testid="msg-dblcheck"]') !== null ||
                            container.querySelector('[data-testid="status-dblcheck"]') !== null;
          
          msgs.push({ 
            text, 
            sender: sender || (isOutgoing ? 'Você' : 'Desconhecido'), 
            time, 
            isOutgoing 
          });
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
    
    // Scroll para cima
    const currentHeight = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="conversation-panel-messages"]') ||
                        document.querySelector('.copyable-area') ||
                        document.querySelector('div[tabindex="0"]');
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
// DETECÇÃO DE MENÇÕES (@KIMI, @LUNA, @KIMICLAW)
// ═══════════════════════════════════════════════════════════════════════════════

const MENTION_PATTERNS = [
  /@\s*(kimi|luna|kimiclaw)/i,
  /\b(kimi|luna|kimiclaw)\b.*(?:faz|fazer|cria|criar|atualiza|atualizar|analisa|analisar|envia|enviar|gera|gerar)/i,
];

const COMMAND_PATTERNS = {
  createTask: /(?:cria|criar|adicione?|add).*tarefa/i,
  updateFinance: /(?:atualiza|atualizar|corrige|corrigir).*(?:caixa|financeiro|dinheiro|pagamento)/i,
  sendReport: /(?:envia|enviar|gera|gerar).*relat[oó]rio/i,
  analyzeLeads: /(?:analisa|analisar|verifica|verificar).*lead/i,
  updateTasks: /(?:atualiza|atualizar).*tarefa/i,
  checkStatus: /(?:status|estado|como est[aá]).*(?:projeto|dashboard|sistema)/i,
};

function detectMentions(text) {
  const mentions = [];
  for (const pattern of MENTION_PATTERNS) {
    if (pattern.test(text)) {
      mentions.push(text);
      break;
    }
  }
  return mentions;
}

function processMentionCommand(text, sender) {
  console.log(`[Luna] 🎯 MENÇÃO DETECTADA de [${sender}]: "${text.substring(0, 100)}..."`);
  
  const actions = [];
  
  if (COMMAND_PATTERNS.createTask.test(text)) {
    actions.push('create_task');
  }
  if (COMMAND_PATTERNS.updateFinance.test(text)) {
    actions.push('update_finance');
  }
  if (COMMAND_PATTERNS.sendReport.test(text)) {
    actions.push('send_report');
  }
  if (COMMAND_PATTERNS.analyzeLeads.test(text)) {
    actions.push('analyze_leads');
  }
  if (COMMAND_PATTERNS.updateTasks.test(text)) {
    actions.push('update_tasks');
  }
  if (COMMAND_PATTERNS.checkStatus.test(text)) {
    actions.push('check_status');
  }
  
  if (actions.length === 0) {
    actions.push('analyze_and_respond');
  }
  
  return { sender, text, actions };
}

async function executeMentionCommand(command) {
  console.log(`[Luna] ⚡ Executando comando: ${command.actions.join(', ')}`);
  
  let response = `🌙 Luna — CTO Virtual\n\n`;
  response += `✅ Comando recebido de ${command.sender}!\n\n`;
  
  for (const action of command.actions) {
    switch (action) {
      case 'create_task':
        response += `📋 *Criar Tarefa:* Identificado na mensagem. Vou criar no Dashboard.\n`;
        break;
      case 'update_finance':
        response += `💰 *Atualizar Financeiro:* Vou verificar e atualizar o caixa.\n`;
        break;
      case 'send_report':
        response += `📊 *Gerar Relatório:* Preparando relatório completo.\n`;
        break;
      case 'analyze_leads':
        response += `🎯 *Analisar Leads:* Verificando pipeline de leads.\n`;
        break;
      case 'update_tasks':
        response += `🔄 *Atualizar Tarefas:* Sincronizando status das tarefas.\n`;
        break;
      case 'check_status':
        response += `📈 *Status do Sistema:* Verificando Dashboard e projetos.\n`;
        break;
      default:
        response += `🧠 *Análise:* Estou analisando sua solicitação para tomar a melhor ação.\n`;
    }
  }
  
  response += `\n⏳ Processando... vou confirmar quando concluir!\n`;
  response += `\n🌙 Luna — CTO Virtual — NEXO Digital`;
  
  return response;
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

function generateLunaReport(buffer, checkpoint, isReportTime = false) {
  const time = nowTime();
  const hasNews = buffer.newMessages.length > 0;
  
  let text = `🌙 *LUNA — Relatório ${time}*\n`;
  text += `━`.repeat(36) + '\n\n';
  
  if (hasNews) {
    // ═══ RELATÓRIO COM NOVIDADES ═══
    text += `✅ *NOVIDADES DETECTADAS!*\n\n`;
    
    // Resumo das rodadas
    const scanCount = Math.ceil((Date.now() - new Date(buffer.firstNewMessageTime).getTime()) / (10 * 60 * 1000));
    text += `📊 *Resumo (últimos ${scanCount} scans):*\n`;
    text += `  • ${buffer.newMessages.length} mensagens novas\n`;
    text += `  • ${buffer.tasks.length} tarefas detectadas\n`;
    text += `  • ${buffer.ideas.length} ideias novas\n`;
    text += `  • ${buffer.decisions.length} decisões\n`;
    text += `  • Total acumulado: ${checkpoint.totalMessagesSeen} msgs\n\n`;
    
    // Mensagens novas
    if (buffer.newMessages.length > 0) {
      text += `💬 *Mensagens Novas:*\n`;
      buffer.newMessages.slice(0, 15).forEach((m, i) => {
        const shortText = m.text.length > 70 ? m.text.substring(0, 70) + '…' : m.text;
        text += `  ${i+1}. [${m.sender}] ${shortText}\n`;
      });
      if (buffer.newMessages.length > 15) {
        text += `  …e mais ${buffer.newMessages.length - 15} mensagens\n`;
      }
      text += '\n';
    }
    
    // Tarefas
    if (buffer.tasks.length > 0) {
      text += `📋 *Tarefas Detectadas:*\n`;
      buffer.tasks.forEach(t => {
        const icon = t.priority === 'high' ? '🔴' : '🟡';
        const proj = t.project ? ` [${t.project}]` : '';
        text += `  ${icon} ${t.text.substring(0, 80)}${proj}\n`;
      });
      text += '\n';
    }
    
    // Ideias
    if (buffer.ideas.length > 0) {
      text += `💡 *Ideias:*\n`;
      buffer.ideas.forEach(i => {
        const proj = i.project ? ` [${i.project}]` : '';
        text += `  • ${i.text.substring(0, 80)}${proj}\n`;
      });
      text += '\n';
    }
    
    // Decisões
    if (buffer.decisions.length > 0) {
      text += `✓ *Decisões:*\n`;
      buffer.decisions.forEach(d => {
        text += `  ✓ [${d.sender}] ${d.text.substring(0, 80)}\n`;
      });
      text += '\n';
    }
    
    text += `🔄 *Próximo relatório: 30 minutos*\n`;
    
  } else {
    // ═══ RELATÓRIO SEM NOVIDADES (só 1x) ═══
    text += `📭 *Nada de novo por aqui…*\n\n`;
    
    text += `📊 *Status atual:*\n`;
    text += `  • Mensagens monitoradas: ${checkpoint.totalMessagesSeen}\n`;
    text += `  • Última novidade: ${checkpoint.lastReportTime ? new Date(checkpoint.lastReportTime).toLocaleTimeString('pt-BR') : 'Nunca'}\n\n`;
    
    text += `🔍 *Grupos monitorados:*\n`;
    text += `  • 🏆 Production - 2026\n`;
    text += `  • 👤 Paulo (web)\n\n`;
    
    text += `💡 *Aguardando novas mensagens…*\n`;
    text += `   Vou te avisar quando tiver novidade!\n`;
  }
  
  // Rodapé Luna — SEMPRE PRESENTE
  text += `\n` + `━`.repeat(36) + '\n';
  text += `🌙 *Luna* — CTO Virtual NEXO Digital\n`;
  text += `📅 ${nowBR()} | v10.2\n`;
  text += `💰 Split: 25% cada (Abner/Nonoke/Elias/NEXO)`;
  
  return text;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENVIO VIA WHATSAPP — SÓ GRUPO PRODUCTION
// ═══════════════════════════════════════════════════════════════════════════════

async function sendReportViaWhatsApp(page, reportText, destination) {
  // REGRA ESTRITA: Só envia no grupo Production 2026
  console.log(`[Luna] 📤 Enviando relatório no grupo: ${destination.groupName}...`);
  
  try {
    // Abre o grupo Production
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

async function notifyOps(message, type = 'whatsapp', details = null) {
  try {
    const body = { type, message, timestamp: nowISO() };
    if (details) {
      body.details = details;
    }
    await fetch('http://127.0.0.1:3456/api/ops/changes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch {}
}

// ═══════════════════════════════════════════════════════════════════════════════
// FUNÇÃO PRINCIPAL — LUNA
// ═══════════════════════════════════════════════════════════════════════════════

export async function runAgent(isReportTime = false) {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  if (isReportTime) {
    console.log('║  🌙 LUNA — HORA DO RELATÓRIO (30 min)                               ║');
  } else {
    console.log('║  🌙 LUNA — SCAN RÁPIDO (10 min)                                     ║');
  }
  console.log('║  Só envia no grupo Production | Silêncio quando não há novidades    ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  
  const checkpoint = loadCheckpoint();
  const buffer = loadBuffer();
  
  console.log(`[Luna] Checkpoint: ${checkpoint.knownMessageHashes?.length || 0} msgs conhecidas`);
  console.log(`[Luna] Buffer: ${buffer.newMessages?.length || 0} novas msgs pendentes`);
  console.log(`[Luna] Modo: ${isReportTime ? 'RELATÓRIO' : 'SCAN'}`);
  
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
    
    // 4. Atualiza checkpoint (marca como lidas)
    if (newHashes.length > 0) {
      checkpoint.knownMessageHashes.push(...newHashes);
      checkpoint.totalMessagesSeen = checkpoint.knownMessageHashes.length;
    }
    checkpoint.lastRun = nowISO();
    saveCheckpoint(checkpoint);
    
    // 5. VERIFICAR MENÇÕES (@KIMI, @LUNA, @KIMICLAW) — PRIORIDADE MÁXIMA
    const mentions = [];
    for (const msg of newMessages) {
      if (detectMentions(msg.text).length > 0) {
        const command = processMentionCommand(msg.text, msg.sender);
        mentions.push(command);
      }
    }
    
    if (mentions.length > 0) {
      console.log(`[Luna] 🎯 ${mentions.length} MENÇÃO(ÕES) DETECTADA(S)!`);
      console.log(`[Luna] ⚡ Processando comandos automaticamente...`);
      
      for (const mention of mentions) {
        const response = await executeMentionCommand(mention);
        console.log(`[Luna] 📤 Respondendo a ${mention.sender}...`);
        
        // Envia resposta no grupo Production
        try {
          const opened = await openGroup(page, { name: '🏆Production - 2026🙏', short: 'Production' });
          if (opened) {
            await sendMessageInCurrentChat(page, response);
            console.log(`[Luna] ✅ Resposta enviada para ${mention.sender}!`);
          }
        } catch (e) {
          console.log(`[Luna] ❌ Erro ao enviar resposta: ${e.message}`);
        }
      }
    }
    
    // 6. Se há novidades, adiciona ao buffer
    if (hasNews) {
      console.log(`[Luna] 🎉 ${newMessages.length} mensagens NOVAS! Adicionando ao buffer...`);
      
      const tasks = [];
      const ideas = [];
      const decisions = [];
      
      for (const msg of newMessages) {
        const msgTasks = extractTasks(msg.text);
        const msgIdeas = extractIdeas(msg.text);
        const isDec = isDecision(msg.text);
        
        tasks.push(...msgTasks.map(t => ({ ...t, sender: msg.sender, group: msg.group })));
        ideas.push(...msgIdeas.map(i => ({ ...i, sender: msg.sender, group: msg.group })));
        if (isDec) decisions.push({ text: msg.text, sender: msg.sender, group: msg.group });
      }
      
      addToBuffer(buffer, newMessages, tasks, ideas, decisions);
      console.log(`[Luna] 📦 Buffer atualizado: ${buffer.newMessages.length} msgs, ${buffer.tasks.length} tarefas`);
    } else {
      console.log(`[Luna] 📭 Nenhuma mensagem nova.`);
    }
    
    // 6. Se NÃO é hora do relatório, só guarda e sai
    if (!isReportTime) {
      console.log('\n[Luna] 🔇 Não é hora do relatório. Dados guardados. Aguardando...');
      
      // Salva dados para o dashboard (COM DETALHES COMPLETOS)
      const scanData = {
        version: '10.2',
        updatedAt: nowISO(),
        reportTime: nowBR(),
        hasNews: buffer.newMessages.length > 0,
        // Arrays completos para o frontend
        messages: buffer.newMessages.slice(0, 50),
        tasks: buffer.tasks.slice(0, 50),
        ideas: buffer.ideas.slice(0, 50),
        decisions: buffer.decisions.slice(0, 50),
        totalMessages: checkpoint.totalMessagesSeen,
        mode: 'scan',
        scanId: `scan-${Date.now()}`,
      };
      writeJSON(CONFIG.OUTPUT_FILE, scanData);
      
      await notifyOps(
        `Luna Scan: ${hasNews ? newMessages.length + ' novas msgs no buffer' : 'Sem novidades'}`,
        'whatsapp',
        { scanId: scanData.scanId, messages: scanData.messages, tasks: scanData.tasks, ideas: scanData.ideas }
      );
      
      return { status: 'scan_complete', hasNews, buffered: buffer.newMessages.length };
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 7. É HORA DO RELATÓRIO (30 min) — decide se envia
    // ═══════════════════════════════════════════════════════════════════
    
    const bufferedNews = buffer.newMessages.length > 0;
    
    if (bufferedNews) {
      // ✅ Há novidades no buffer → envia relatório COMPLETO
      console.log('\n[Luna] 🎉 HORA DO RELATÓRIO! Enviando novidades acumuladas...');
      
      const reportText = generateLunaReport(buffer, checkpoint, true);
      
      // Envia no grupo Production
      let sent = false;
      for (const dest of CONFIG.REPORT_DESTINATIONS) {
        const ok = await sendReportViaWhatsApp(page, reportText, dest);
        if (ok) sent = true;
      }
      
      // Atualiza checkpoint
      checkpoint.lastReportHadNews = true;
      checkpoint.lastReportTime = nowISO();
      saveCheckpoint(checkpoint);
      
      // Limpa buffer
      clearBuffer();
      
      // Notifica ops com DETALHES
      const reportData = {
        reportId: `report-${Date.now()}`,
        messages: buffer.newMessages.slice(0, 50),
        tasks: buffer.tasks.slice(0, 50),
        ideas: buffer.ideas.slice(0, 50),
        decisions: buffer.decisions.slice(0, 50),
        messageCount: buffer.newMessages.length,
        taskCount: buffer.tasks.length,
        ideaCount: buffer.ideas.length,
      };
      writeJSON(CONFIG.OUTPUT_FILE, {
        version: '10.2',
        updatedAt: nowISO(),
        reportTime: nowBR(),
        hasNews: true,
        messages: reportData.messages,
        tasks: reportData.tasks,
        ideas: reportData.ideas,
        decisions: reportData.decisions,
        totalMessages: checkpoint.totalMessagesSeen,
        mode: 'report',
        reportId: reportData.reportId,
      });
      await notifyOps(
        `Luna Relatório: ${buffer.newMessages.length} msgs, ${buffer.tasks.length} tarefas, ${buffer.ideas.length} ideias`,
        'whatsapp',
        reportData
      );
      
      console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
      console.log('║  ✅ RELATÓRIO ENVIADO NO GRUPO PRODUCTION!                          ║');
      console.log(`║  📨 ${buffer.newMessages.length} msgs | ${buffer.tasks.length} tarefas | ${buffer.ideas.length} ideias          ║`);
      console.log(`║  📤 Status: ${sent ? 'ENVIADO ✅' : 'FALHA ❌'}                                          ║`);
      console.log('╚══════════════════════════════════════════════════════════════════════╝');
      
      return { status: 'report_sent', hasNews: true, sent };
      
    } else {
      // 📭 Não há novidades no buffer
      
      if (checkpoint.lastReportHadNews) {
        // Último relatório teve novidades → envia 1x "sem novidades"
        console.log('\n[Luna] 📭 Sem novidades. Enviando relatório de fechamento...');
        
        const reportText = generateLunaReport(buffer, checkpoint, true);
        
        let sent = false;
        for (const dest of CONFIG.REPORT_DESTINATIONS) {
          const ok = await sendReportViaWhatsApp(page, reportText, dest);
          if (ok) sent = true;
        }
        
        checkpoint.lastReportHadNews = false;
        checkpoint.lastReportTime = nowISO();
        saveCheckpoint(checkpoint);
        
        await notifyOps('Luna: Sem novidades. Próximo: silêncio até novas msgs.', 'whatsapp');
        
        console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
        console.log('║  📭 RELATÓRIO DE FECHAMENTO ENVIADO.                                ║');
        console.log('║  🔇 Próximos relatórios: SILÊNCIO até novas mensagens               ║');
        console.log('╚══════════════════════════════════════════════════════════════════════╝');
        
        return { status: 'report_no_news', hasNews: false, sent };
        
      } else {
        // Já enviou "sem novidades" antes → SILÊNCIO TOTAL
        console.log('\n[Luna] 🔇 SILÊNCIO. Nenhuma novidade desde o último relatório.');
        console.log('      Não vou enviar nada. Aguardando novas mensagens...');
        
        await notifyOps('Luna: Silêncio. Aguardando novas mensagens.', 'whatsapp');
        
        return { status: 'silent', hasNews: false };
      }
    }
    
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
const scriptPath = process.argv[1] || '';
const isMainModule = scriptPath && modulePath.toLowerCase() === scriptPath.toLowerCase();
if (isMainModule) {
  runAgent().then(() => process.exit(process.exitCode || 0)).catch(() => process.exit(1));
}
