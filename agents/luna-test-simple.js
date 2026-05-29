require('module').globalPaths.unshift('/home/jhin/NEXO_DASHBOARD_PRO/node_modules');
const { LunaSoul } = require('/home/jhin/NEXO_DASHBOARD_PRO/agents/luna-soul.cjs');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const TOKEN = fs.readFileSync('/home/jhin/.luna/.telegram_token', 'utf8').trim();
const CHAT_ID = '8037713238';
const bot = new TelegramBot(TOKEN, { polling: false });

async function send(text) {
  try { await bot.sendMessage(CHAT_ID, text.slice(0, 4000), { parse_mode: 'Markdown' }); }
  catch(e) { console.error('TG err:', e.message); }
}

async function run() {
  await send('🧠 *Teste v4.0 iniciado* — Mensagem curta, modo thinking');
  
  const luna = new LunaSoul({});
  await luna.init();
  await send('✅ Luna conectada ao Kimi');

  const msg = 'Cria um app React simples em ~/Documentos/luna-demo com Vite. O app deve mostrar "Olá Luna v4.0!" em uma tela bonita com Tailwind CSS.';
  
  try {
    const result = await luna.processMessage(msg, {
      sessionId: 'test-v4-' + Date.now(),
      userId: 'test-user',
      mode: 'thinking',
    });
    
    await send('✅ *Resultado:*\nModo: ' + (result.mode || 'N/A') + '\n```\n' + (result.response || 'vazio').slice(0, 500) + '\n```');
    
    // Check files
    const demoDir = '/home/jhin/Documentos/luna-demo';
    if (fs.existsSync(demoDir)) {
      const files = fs.readdirSync(demoDir);
      await send('📁 *Arquivos criados:* ' + files.join(', '));
    } else {
      await send('⚠️ Diretório não criado');
    }
  } catch(err) {
    await send('❌ *Erro:* ' + err.message);
  }
  
  await luna.disconnect();
}

run().catch(e => { console.error(e); send('❌ Fatal: ' + e.message); });
