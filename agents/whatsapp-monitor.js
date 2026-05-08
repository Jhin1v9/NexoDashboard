/**
 * NEXO WhatsApp Monitor
 * Conecta no Chrome PWA do WhatsApp via CDP
 * O Chrome PWA ja esta logado (PID 9920)
 */

const { chromium } = require('playwright');
const axios = require('axios');

const CONFIG = {
  groupName: '🏆Production - 2026🙏',
  apiUrl: 'http://127.0.0.1:3456/api/whatsapp',
};

function nowISO() { return new Date().toISOString(); }

async function sendToDashboard(msg) {
  try {
    await axios.post(CONFIG.apiUrl, msg, { timeout: 5000 });
    console.log('   [DASHBOARD] OK');
  } catch (e) {
    console.log('   [DASHBOARD] offline');
  }
}

function extractTasks(text) {
  const patterns = [
    /(?:fazer|faz|fazemos|precisamos|tem que|temos que|devemos|vamos)\s+(.+)/i,
    /(?:tarefa|task|todo|ação):?\s*(.+)/i,
    /(?:bug|erro|problema|issue):?\s*(.+)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

function detectMentions(text) {
  const m = [];
  if (/\b(abner|jhin)\b/i.test(text)) m.push('abner');
  if (/\b(nonoke|nono)\b/i.test(text)) m.push('nonoke');
  if (/\b(elias)\b/i.test(text)) m.push('elias');
  if (/\b(todos|equipe|time|galera)\b/i.test(text)) m.push('all');
  return m;
}

async function run() {
  console.log('NEXO WhatsApp Monitor');
  console.log('Buscando Chrome com WhatsApp Web...');

  // Tenta conectar no Chrome PWA (porta pode variar)
  // O Chrome PWA do WhatsApp geralmente usa uma porta aleatoria
  // Vamos tentar encontrar a porta correta

  const { execSync } = require('child_process');
  let cdpUrl = null;

  try {
    // Lista todos os processos Chrome e procura por remote-debugging
    const output = execSync('wmic process where "name=\'chrome.exe\'" get CommandLine /format:csv', { encoding: 'utf8' });
    const lines = output.split('\n').filter(l => l.includes('remote-debugging'));
    
    for (const line of lines) {
      const match = line.match(/--remote-debugging-port=(\d+)/);
      if (match) {
        const port = match[1];
        console.log(`Porta CDP encontrada: ${port}`);
        try {
          const resp = execSync(`curl -s http://127.0.0.1:${port}/json/version`, { encoding: 'utf8', timeout: 3000 });
          if (resp.includes('Chrome')) {
            cdpUrl = `http://127.0.0.1:${port}`;
            console.log(`CDP funcional: ${cdpUrl}`);
            break;
          }
        } catch {}
      }
    }
  } catch (e) {
    console.log('Nao consegui listar portas CDP:', e.message);
  }

  if (!cdpUrl) {
    console.log('');
    console.log('Nenhum Chrome com CDP encontrado.');
    console.log('O WhatsApp Web PWA esta rodando mas sem porta de debug.');
    console.log('');
    console.log('Solucoes:');
    console.log('1. Feche o Chrome PWA do WhatsApp');
    console.log('2. Abra o Chrome normal com: --remote-debugging-port=9222');
    console.log('3. Acesse web.whatsapp.com e escaneie o QR');
    console.log('4. Rode este script novamente');
    console.log('');
    console.log('OU use o arquivo BAT: start-chrome-cdp.bat');
    return;
  }

  // Conecta via CDP
  console.log(`Conectando em ${cdpUrl}...`);
  const browser = await chromium.connectOverCDP(cdpUrl);
  console.log('Conectado!');

  const contexts = browser.contexts();
  console.log(`Contextos: ${contexts.length}`);

  // Procura pagina do WhatsApp
  let page = null;
  for (const ctx of contexts) {
    for (const p of ctx.pages()) {
      if (p.url().includes('web.whatsapp.com')) {
        page = p;
        console.log('Pagina do WhatsApp encontrada!');
        break;
      }
    }
    if (page) break;
  }

  if (!page) {
    console.log('Nenhuma pagina do WhatsApp encontrada.');
    console.log('Paginas abertas:');
    for (const ctx of contexts) {
      for (const p of ctx.pages()) {
        console.log(`  - ${p.url().substring(0, 80)}`);
      }
    }
    await browser.close();
    return;
  }

  // Verifica se esta logado
  const isLogged = await page.locator('[data-testid="chat-list"]').count() > 0;
  if (!isLogged) {
    console.log('WhatsApp nao parece logado.');
    await browser.close();
    return;
  }

  console.log('WhatsApp logado!');
  console.log('');
  console.log('Monitorando mensagens... (Ctrl+C para parar)');
  console.log('-----------------------------------------------');

  // Tenta abrir o grupo
  try {
    await page.locator('[data-testid="chat-list-search"]').first().click({ timeout: 5000 });
    await page.keyboard.type(CONFIG.groupName);
    await page.waitForTimeout(2000);
    await page.locator(`text="${CONFIG.groupName}"`).first().click({ timeout: 10000 });
    console.log('Grupo aberto!');
  } catch {
    console.log('Nao consegui abrir o grupo. Verifique o nome.');
  }

  await page.waitForTimeout(2000);

  // Loop de monitoramento
  let lastTexts = new Set();

  const getMessages = async () => {
    const results = [];
    const containers = await page.locator('[data-testid="msg-container"]').all();
    for (const c of containers.slice(-15)) {
      try {
        const text = await c.locator('.selectable-text span').first().textContent({ timeout: 500 });
        if (text) results.push(text);
      } catch {}
    }
    return results;
  };

  // Inicializa
  const initial = await getMessages();
  initial.forEach(m => lastTexts.add(m));
  console.log(`${initial.length} mensagens iniciais.`);

  // Loop
  while (true) {
    await new Promise(r => setTimeout(r, 5000));
    
    const current = await getMessages();
    const newMsgs = current.filter(m => !lastTexts.has(m));
    
    for (const text of newMsgs) {
      lastTexts.add(text);
      if (text.length < 3) continue;

      const task = extractTasks(text);
      const mentions = detectMentions(text);

      console.log('');
      console.log(`[MSG] ${text.substring(0, 100)}`);
      if (task) console.log(`  [TASK] ${task}`);
      if (mentions.length) console.log(`  [MENTIONS] ${mentions.join(', ')}`);

      await sendToDashboard({
        text,
        from: 'whatsapp-web',
        time: nowISO(),
        group: CONFIG.groupName,
        task,
        mentions,
        source: 'whatsapp-monitor',
      });
    }
  }
}

run().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
