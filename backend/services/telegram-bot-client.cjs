const TelegramBot = require('node-telegram-bot-api');

let botInstance = null;

module.exports = function getTelegramBot(token) {
  if (botInstance) return botInstance;
  if (!token) throw new Error('[TelegramBotClient] token is required');

  botInstance = new TelegramBot(token, { polling: true });

  botInstance.on('polling_error', (err) => {
    console.error('[TG] Polling error:', err.message);
    if (err.message?.includes('409 Conflict')) {
      console.error('[TG] 409 Conflict detectado. Outra instância está rodando. Encerrando para evitar loop.');
      try { botInstance.stopPolling(); } catch (_) {}
      process.exit(1);
    }
  });

  botInstance.on('error', (err) => {
    console.error('[TG] Bot error:', err.message);
  });

  console.log('[TelegramBotClient] Singleton inicializado com polling');
  return botInstance;
};
