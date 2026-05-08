/**
 * NEXO WhatsApp Agent v3
 * Conecta via CDP no Chrome já aberto (perfil abnergabriel1313)
 */

const { chromium } = require('playwright');
const axios = require('axios');

const CONFIG = {
  groupName: '🏆Production - 2026🙏',
  apiUrl: 'http://127.0.0.1:3456/api/whatsapp',
  cdpEndpoint: 'http://127.0.0.1:9222',
};

function nowISO() { return new Date().toISOString(); }

async function sendToDashboard(msg) {
  try {
    await axios.post(CONFIG.apiUrl, msg);
    console.log('   📤 Dashboard:', msg.text?.substring(0, 50));
  } catch (e) {
    console.log('   ⚠️  Dashboard offline:', e.message);
  }
}

function extractTasks(text) {
  const patterns = [
    /(fazer|faz|fazemos|precisamos|tem que|temos que|devemos|vamos)\s+(.+)/i,
    /(tarefa|task|todo|ação):?\s*(.+)/i,
    /(bug|erro|problema|issue):?\s*(.+)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[2] ? m[2].trim() : m[0];
  }
  return null;
}

function detectMentions(text) {
  const m = [];
  if (/\b(abner|jhin)\b/i.test(text)) m.push('abner');
  if (/\b(nonoke|nono)\b/i.test(text)) m.push('nonoke');
  if (/\b(elias)\b/i.test(text)) m.push('elias');
  if (/\b(todos|equipe|time)\b/i.test(text)) m.push('all');
  return m;
}

async function run() {
  console.log('📱 NEXO WhatsApp Agent v3 (CDP)');
  console.log('   Conectando em:', CONFIG.cdpEndpoint);
  console.log('   Grupo:', CONFIG.groupName);
  console.log('');

  let browser;
  try {
    browser = await chromium.connectOverCDP(CONFIG.cdpEndpoint);
    console.log('✅ Conectado ao Chrome via CDP!');
  } catch (e) {
    console.error('❌ Não consegui conectar no Chrome CDP.');
    console.error('   Certifique-se de que o Chrome está aberto com:');
    console.error('   --remote-debugging-port=9222');
    console.error('');
    console.error('   Erro:', e.message);
    process.exit(1);
  }

  const contexts = browser.contexts();
  if (contexts.length === 0) {
    console.error('❌ Nenhum contexto encontrado.');
    await browser.close();
    process.exit(1);
  }

  const context = contexts[0];
  const pages = context.pages();
  console.log('   Contextos:', contexts.length, '| Páginas:', pages.length);

  // Procura página do WhatsApp
  let page = pages.find(p => p.url().includes('web.whatsapp.com'));
  
  if (!page) {
    console.log('🌐 Abrindo web.whatsapp.com...');
    page = await context.newPage();
    await page.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
  } else {
    console.log('✅ WhatsApp já aberto!');
  }

  // Verifica se está logado
  const isLoggedIn = await page.locator('[data-testid="chat-list"]').count() > 0;
  if (!isLoggedIn) {
    console.log('⚠️  WhatsApp não parece logado. Aguardando...');
    await page.waitForSelector('[data-testid="chat-list"]', { timeout: 60000 });
  }
  console.log('✅ WhatsApp pronto!');

  // Procura o grupo
  console.log('');
  console.log('🔍 Procurando grupo:', CONFIG.groupName);
  
  // Clica na pesquisa
  const searchBox = page.locator('[data-testid="chat-list-search"]').or(
    page.locator('div[contenteditable="true"][data-tab="3"]')
  );
  
  try {
    await searchBox.first().click({ timeout: 5000 });
    await page.keyboard.type(CONFIG.groupName);
    await page.waitForTimeout(2000);
  } catch {
    console.log('   ⚠️  Search box não encontrado, tentando lista direta...');
  }

  // Tenta encontrar o grupo pelo texto
  const groupSelector = `text="${CONFIG.groupName}"`;
  const groupLink = page.locator(groupSelector).first();
  
  try {
    await groupLink.click({ timeout: 10000 });
    console.log('✅ Grupo aberto!');
  } catch {
    console.log('⚠️  Grupo não encontrado via search. Listando chats visíveis...');
    const chats = await page.locator('[data-testid="chat-list-item"]').all();
    for (let i = 0; i < Math.min(chats.length, 10); i++) {
      const title = await chats[i].textContent().catch(() => '???');
      console.log('   -', title?.substring(0, 50));
    }
    console.log('');
    console.log('❌ Não consegui abrir o grupo. Verifique o nome exato.');
    await browser.close();
    return;
  }

  await page.waitForTimeout(2000);

  // ── Monitoramento ──────────────────────────────────────────────────────
  console.log('');
  console.log('👁️  Monitorando... (Ctrl+C para parar)');
  console.log('────────────────────────────────────────');

  let lastTexts = new Set();
  
  const getLatestMessages = async () => {
    const containers = await page.locator('[data-testid="msg-container"]').all();
    const results = [];
    for (const container of containers.slice(-15)) {
      try {
        const textEl = container.locator('.selectable-text span').first();
        const text = await textEl.textContent({ timeout: 500 }).catch(() => null);
        if (text) {
          // Tenta pegar o nome do sender
          const senderEl = container.locator('[data-testid="msg-meta"]').first();
          const meta = await senderEl.textContent({ timeout: 500 }).catch(() => '');
          results.push({ text, meta, full: text + meta });
        }
      } catch {}
    }
    return results;
  };

  // Inicializa
  const initial = await getLatestMessages();
  initial.forEach(m => lastTexts.add(m.full));
  console.log(`   ${initial.length} mensagens carregadas.`);

  // Loop
  while (true) {
    await page.waitForTimeout(5000);
    
    const current = await getLatestMessages();
    const newMsgs = current.filter(m => !lastTexts.has(m.full));
    
    for (const msg of newMsgs) {
      lastTexts.add(msg.full);
      
      const task = extractTasks(msg.text);
      const mentions = detectMentions(msg.text);
      
      console.log('');
      console.log(`💬 ${msg.text.substring(0, 100)}`);
      if (task) console.log('   🎯 Tarefa:', task);
      if (mentions.length) console.log('   👥 Menções:', mentions.join(', '));

      await sendToDashboard({
        text: msg.text,
        from: 'whatsapp-group',
        time: nowISO(),
        group: CONFIG.groupName,
        task,
        mentions,
        source: 'whatsapp-agent',
      });
    }
  }
}

if (require.main === module) {
  run().catch(err => {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  });
}

module.exports = { extractTasks, detectMentions };
