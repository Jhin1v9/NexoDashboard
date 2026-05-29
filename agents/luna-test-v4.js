process.env.NODE_PATH = '/home/jhin/NEXO_DASHBOARD_PRO/node_modules';
require('module').Module._initPaths();

const { LunaSoul } = require('./luna-soul.cjs');
const { SessionManager } = require('./session-manager.cjs');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const TOKEN = fs.readFileSync('/home/jhin/.luna/.telegram_token', 'utf8').trim();
const CHAT_ID = '8037713238';
const bot = new TelegramBot(TOKEN, { polling: false });

async function send(text) {
  try { 
    await bot.sendMessage(CHAT_ID, text.slice(0, 4000), { parse_mode: 'Markdown' }); 
    console.log('[TG] Sent:', text.slice(0, 60));
  } catch(e) { 
    console.error('[TG] Error:', e.message); 
  }
}

async function run() {
  console.log('[TEST] Starting Luna v4.0 test...');
  await send('🚀 *Teste Luna v4.0 — Kernel Refatorado*\n\nIniciando com sessão limpa + modo instant...');

  const sessionManager = new SessionManager();
  const luna = new LunaSoul({});
  
  console.log('[TEST] Initializing Luna...');
  await luna.init();
  await send('✅ Luna inicializada. Bridge conectado.');

  const session = sessionManager.createSession({
    id: 'v4-test-' + Date.now(),
    title: 'Teste v4.0 React',
    mode: 'instant',
  });
  console.log('[TEST] Session created:', session.id);

  const msg = 'Cria um app React simples em ~/Documentos/luna-v4-demo. Use Vite + React 19. O app mostra "Olá Luna v4.0!" numa página com gradiente azul-roxo e uma animação de fade-in. Crie package.json, index.html, src/App.jsx e src/main.jsx.';

  await send('📨 *Mensagem enviada para Kimi:*\n```\n' + msg.slice(0, 200) + '...\n```');
  console.log('[TEST] Sending message...');

  try {
    const result = await luna.processMessage(msg, {
      sessionId: session.id,
      userId: 'v4-test',
      mode: 'instant',
    });

    console.log('[TEST] Result mode:', result.mode);
    await send('✅ *Resposta recebida!*\nModo: `' + (result.mode || '?') + '`\n\n```\n' + (result.response || 'sem resposta').slice(0, 600) + '\n```');

    const demoDir = '/home/jhin/Documentos/luna-v4-demo';
    if (fs.existsSync(demoDir)) {
      const allFiles = [];
      function walk(dir, prefix) {
        for (const f of fs.readdirSync(dir)) {
          const fp = dir + '/' + f;
          const st = fs.statSync(fp);
          if (st.isDirectory()) {
            allFiles.push(prefix + f + '/');
            walk(fp, prefix + '  ');
          } else {
            allFiles.push(prefix + f + ' (' + (st.size/1024).toFixed(1) + 'KB)');
          }
        }
      }
      walk(demoDir, '');
      await send('📁 *Arquivos criados:*\n```\n' + allFiles.join('\n').slice(0, 3900) + '\n```');
    } else {
      await send('⚠️ Diretório `~/Documentos/luna-v4-demo` não foi criado. A resposta da Kimi não continha ações de arquivo.');
    }
  } catch(err) {
    console.error('[TEST] Error:', err);
    await send('❌ *Erro:*\n```\n' + err.message + '\n```');
  }

  await luna.disconnect();
  console.log('[TEST] Done.');
}

run().catch(async (e) => {
  console.error('[TEST] Fatal:', e);
  await send('❌ *Erro fatal:* ' + e.message);
  process.exit(1);
});
