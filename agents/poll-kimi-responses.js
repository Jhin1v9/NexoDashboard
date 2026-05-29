const { chromium } = require('playwright');
const fs = require('fs');

const TARGETS = [
  { url: '19e6baf2', name: 'response-stream-parser', file: '/tmp/kimi-response-1.txt' },
  { url: '19e6bcb6', name: 'meta-executor-secure', file: '/tmp/kimi-response-2.txt' },
  { url: '19e6bcb9', name: 'luna-soul-refactored', file: '/tmp/kimi-response-3.txt' },
];

async function main() {
  let browser = null;
  let reconnectAttempts = 0;
  const MAX_RECONNECT = 999999; // [DONO ABSOLUTO] sem limite de reconexão
  
  async function connectBrowser() {
    try {
      const b = await chromium.connectOverCDP('http://127.0.0.1:9223');
      console.log('✅ Browser CDP conectado (porta 9223)');
      reconnectAttempts = 0;
      return b;
    } catch (e) {
      console.log('❌ Falha ao conectar CDP:', e.message);
      return null;
    }
  }
  
  async function refreshPages() {
    if (!browser) return;
    try {
      const contexts = browser.contexts();
      if (!contexts.length) return;
      const pages = contexts[0].pages().filter(p => p.url().includes('kimi.com/chat'));
      for (const s of states) {
        if (!s.done) {
          s.page = pages.find(p => p.url().includes(s.url));
        }
      }
    } catch (e) {
      console.log('❌ Erro ao refresh pages:', e.message);
    }
  }
  
  browser = await connectBrowser();
  if (!browser) {
    console.log('❌ Não foi possível conectar ao browser. Abortando.');
    return;
  }
  
  const contexts = browser.contexts();
  if (!contexts.length) {
    console.log('❌ Nenhum contexto encontrado no browser');
    return;
  }
  
  const pages = contexts[0].pages().filter(p => p.url().includes('kimi.com/chat'));
  
  const states = TARGETS.map(t => ({ ...t, lastLen: 0, stable: 0, done: false, page: pages.find(p => p.url().includes(t.url)) }));
  
  console.log('Polling Kimi responses... [DONO ABSOLUTO — sem limites]');
  
  while (states.some(s => !s.done)) {
    for (const s of states) {
      if (s.done) continue;
      
      // Reconectar página se necessário
      if (!s.page || s.page.isClosed?.()) {
        await refreshPages();
      }
      
      if (!s.page) {
        console.log(`⏳ ${s.name} — página não encontrada, tentando reconectar...`);
        continue;
      }
      
      try {
        const info = await s.page.evaluate(() => {
          const assistants = document.querySelectorAll('.segment-assistant');
          const last = assistants[assistants.length - 1];
          return {
            len: last ? (last.innerText || '').length : 0,
            text: last ? (last.innerText || '') : '',
            hasThinking: !!document.querySelector('.segment-thinking, .thinking, [class*="thinking"]'),
          };
        });
        
        if (info.len === s.lastLen && !info.hasThinking) {
          s.stable++;
        } else {
          s.stable = 0;
          s.lastLen = info.len;
        }
        
        if (s.stable >= 3) {
          fs.writeFileSync(s.file, info.text);
          console.log(`✅ ${s.name} DONE — ${info.len} chars saved to ${s.file}`);
          s.done = true;
        } else {
          console.log(`⏳ ${s.name} — ${info.len} chars (stable: ${s.stable})`);
        }
      } catch (e) {
        console.log(`❌ ${s.name} error:`, e.message);
        // Se erro de página fechada, tentar reconectar
        if (e.message.includes('closed') || e.message.includes('crashed')) {
          s.page = null;
          await refreshPages();
        }
      }
    }
    
    if (!states.some(s => !s.done)) break;
    
    // Verificar se browser ainda está vivo
    try {
      if (!browser.isConnected?.()) {
        throw new Error('Browser desconectado');
      }
    } catch (e) {
      console.log('🔄 Browser desconectado, reconectando...');
      reconnectAttempts++;
      if (reconnectAttempts > MAX_RECONNECT) {
        console.log('❌ Máximo de reconexões atingido (mas é 999999, então nunca)');
        break;
      }
      await new Promise(r => setTimeout(r, 5000));
      browser = await connectBrowser();
      if (browser) await refreshPages();
      continue;
    }
    
    await new Promise(r => setTimeout(r, 10000));
  }
  
  console.log('\nAll responses collected! [DONO ABSOLUTO]');
  // [DONO ABSOLUTO] NUNCA fechar o browser
  // await browser.close();
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
