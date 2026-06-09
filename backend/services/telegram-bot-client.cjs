const TelegramBot = require('node-telegram-bot-api');

let botInstance = null;

module.exports = function getTelegramBot(token) {
  if (botInstance) return botInstance;
  if (!token) throw new Error('[TelegramBotClient] token is required');

  botInstance = new TelegramBot(token, { polling: true });

  botInstance.on('polling_error', (err) => {
    console.error('[TG] Polling error:', err.message);
    if (err.message?.includes('409 Conflict')) {
      console.error('[TG] 409 Conflict detectado. Outra instância está rodando. Parando polling local (servidor continua rodando).');
      try { botInstance.stopPolling(); } catch (_) {}
      // v10.3-fix: NUNCA chamar process.exit(1) aqui — isso mata o luna-server inteiro
      // e causa loop infinito de reinicialização pelo PM2. O chat da Luna não depende do Telegram.
    }
  });

  botInstance.on('error', (err) => {
    console.error('[TG] Bot error:', err.message);
  });

  console.log('[TelegramBotClient] Singleton inicializado com polling');
  return botInstance;
};
