/**
 * Serviço de Notificações Telegram para Votações
 * Envia mensagens no Telegram com botões inline quando sessões de votação são criadas/atualizadas
 *
 * Template suportado:
 * - voting: Sessão de votação criada/atualizada
 */

const fs = require('fs');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GROUP_CHAT_ID = process.env.TELEGRAM_GROUP_CHAT_ID || '';

let bot = null;
if (TOKEN) {
  bot = new TelegramBot(TOKEN, { polling: false });
} else {
  console.warn('[TelegramNotifier] TELEGRAM_BOT_TOKEN não configurado');
}

// Cache de usuários (com telegramId)
let usersCache = null;
let usersCacheTime = 0;
const USERS_CACHE_TTL = 30000; // 30s

function getUsers() {
  const now = Date.now();
  if (usersCache && now - usersCacheTime < USERS_CACHE_TTL) return usersCache;

  try {
    const usersFile = path.join(__dirname, '..', 'data', 'users.json');
    const data = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    usersCache = data.users || {};
    usersCacheTime = now;
    return usersCache;
  } catch (e) {
    console.error('[TelegramNotifier] Erro ao carregar users:', e.message);
    return {};
  }
}

/**
 * Resolve menções de usuários para IDs do Telegram
 * @param {string[]} mentions - Array de userIds (ex: ['nonoke', 'elias'])
 * @returns {string[]} Array de telegram mentions formatados (@username)
 */
function resolveMentions(mentions) {
  const users = getUsers();
  const resolved = [];
  for (const userId of mentions) {
    const user = users[userId];
    if (user?.telegramUsername) {
      resolved.push(`@${user.telegramUsername}`);
    } else {
      resolved.push(`@${user?.name || userId}`);
    }
  }
  return resolved;
}

/**
 * Envia notificação de votação para o Telegram (grupo + privado para CEOs)
 *
 * @param {Object} options
 * @param {string} options.type - Tipo: 'new' | 'vote' | 'approved' | 'rejected'
 * @param {Object} options.session - Dados da sessão de votação
 * @param {string} [options.voter] - Quem votou (para type='vote')
 * @param {string} [options.voteValue] - 'yes' | 'no' (para type='vote')
 * @param {string} [options.baseUrl] - URL base do dashboard
 */
async function sendVotingNotification({ type, session, voter, voteValue, baseUrl }) {
  if (!bot) {
    console.warn('[TelegramNotifier] Bot não inicializado');
    return { sent: false, reason: 'bot_not_initialized' };
  }

  const url = baseUrl || (process.env.NODE_ENV === 'production'
    ? 'https://nexodashboard.onrender.com'
    : 'http://localhost:3457');

  const users = getUsers();
  const creator = users[session.createdBy]?.name || session.createdBy;

  let text = '';
  let inlineKeyboard = null;

  if (type === 'new') {
    text = `🗳️ *Nova Sessão de Votação*\n\n` +
      `*Título:* ${escapeMarkdown(session.title)}\n` +
      `*Criada por:* ${escapeMarkdown(creator)}\n` +
      `*Quórum:* ${session.quorumRequired}/3 CEOs\n`;
    if (session.description) {
      text += `*Descrição:* ${escapeMarkdown(session.description.slice(0, 200))}\n`;
    }
    text += `\n[🔗 Abrir Dashboard](${url}/votacao)`;

    inlineKeyboard = {
      inline_keyboard: [[
        { text: '✅ Sim', callback_data: `vote:${session.id}:yes` },
        { text: '❌ Não', callback_data: `vote:${session.id}:no` }
      ]]
    };
  } else if (type === 'vote') {
    const voterName = users[voter]?.name || voter;
    const voteEmoji = voteValue === 'yes' ? '✅' : '❌';
    text = `🗳️ *Novo Voto*\n\n` +
      `*Sessão:* ${escapeMarkdown(session.title)}\n` +
      `*Votante:* ${escapeMarkdown(voterName)}\n` +
      `*Voto:* ${voteEmoji} ${voteValue === 'yes' ? 'Sim' : 'Não'}\n`;

    // Se ainda estiver aberta, mostrar botões para quem não votou
    if (session.status === 'open' || session.status === 'voting') {
      inlineKeyboard = {
        inline_keyboard: [[
          { text: '✅ Sim', callback_data: `vote:${session.id}:yes` },
          { text: '❌ Não', callback_data: `vote:${session.id}:no` }
        ]]
      };
    }
  } else if (type === 'approved') {
    text = `✅ *Votação APROVADA*\n\n` +
      `*Título:* ${escapeMarkdown(session.title)}\n` +
      `*Resultado:* Aprovada por unanimidade\n`;
    if (session.executionResult?.success) {
      text += `*Ação:* Executada automaticamente ✅\n`;
    }
    text += `\n[🔗 Ver no Dashboard](${url}/votacao)`;
  } else if (type === 'rejected') {
    text = `❌ *Votação REJEITADA*\n\n` +
      `*Título:* ${escapeMarkdown(session.title)}\n` +
      `*Resultado:* Vetada\n` +
      `\n[🔗 Ver no Dashboard](${url}/votacao)`;
  }

  const results = [];

  // Enviar para o grupo
  if (GROUP_CHAT_ID) {
    try {
      const msg = await bot.sendMessage(GROUP_CHAT_ID, text, {
        parse_mode: 'Markdown',
        reply_markup: inlineKeyboard,
        disable_web_page_preview: true
      });
      results.push({ chat: 'group', messageId: msg.message_id, sent: true });
    } catch (err) {
      console.error('[TelegramNotifier] Erro ao enviar para grupo:', err.message);
      results.push({ chat: 'group', sent: false, error: err.message });
    }
  }

  // Enviar DM para cada CEO que tem telegramId configurado
  for (const ceo of ['abner', 'nonoke', 'elias']) {
    const user = users[ceo];
    if (user?.telegramId) {
      try {
        const msg = await bot.sendMessage(user.telegramId, text, {
          parse_mode: 'Markdown',
          reply_markup: inlineKeyboard,
          disable_web_page_preview: true
        });
        results.push({ chat: 'dm', user: ceo, messageId: msg.message_id, sent: true });
      } catch (err) {
        console.error(`[TelegramNotifier] Erro ao enviar DM para ${ceo}:`, err.message);
        results.push({ chat: 'dm', user: ceo, sent: false, error: err.message });
      }
    }
  }

  return { sent: results.some(r => r.sent), results };
}

/**
 * Envia mensagem simples para o grupo
 */
async function sendSimpleMessage(text, options = {}) {
  if (!bot) {
    return { sent: false, reason: 'bot_not_initialized' };
  }
  if (!GROUP_CHAT_ID) {
    return { sent: false, reason: 'group_chat_id_not_set' };
  }
  try {
    const msg = await bot.sendMessage(GROUP_CHAT_ID, text, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      ...options
    });
    return { sent: true, messageId: msg.message_id };
  } catch (err) {
    console.error('[TelegramNotifier] Erro ao enviar mensagem:', err.message);
    return { sent: false, error: err.message };
  }
}

function escapeMarkdown(text) {
  if (!text) return '';
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

module.exports = {
  sendVotingNotification,
  sendSimpleMessage,
  resolveMentions,
  escapeMarkdown,
  bot
};
