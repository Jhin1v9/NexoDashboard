/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Telegram Notification Service — NEXO Dashboard PRO
 * Envio de notificações push via bot @lunanexobot
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * • Bot separado com polling: false (apenas envio, não interfere no agente principal)
 * • Mensagens em MarkdownV2 com fallback para texto plano
 * • Templates bonitos para cada tipo de notificação
 * ═══════════════════════════════════════════════════════════════════════════
 */

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_NOTIFICATION_CHAT_ID;

let bot = null;
let botInitialized = false;

function getBot() {
  if (!botInitialized && TOKEN) {
    try {
      bot = new TelegramBot(TOKEN, { polling: false });
      botInitialized = true;
      console.log('[TelegramNotify] Bot inicializado (polling: false)');
    } catch (e) {
      console.error('[TelegramNotify] Falha ao inicializar bot:', e.message);
      bot = null;
    }
  }
  return bot;
}

function escapeMarkdown(text) {
  return String(text || '').replace(/[_*\[\]()~`>#+=|{}.!-]/g, '\\$&');
}

function unescapeMarkdown(text) {
  return String(text || '').replace(/\\([_*\[\]()~`>#+=|{}.!-])/g, '$1');
}

/** Envia mensagem com MarkdownV2, fallback para texto plano se der erro de parse */
async function safeSend(chatId, text, extra = {}) {
  const client = getBot();
  if (!client) {
    return { sent: false, reason: 'bot_not_initialized' };
  }
  if (!CHAT_ID) {
    return { sent: false, reason: 'chat_id_not_configured' };
  }

  try {
    const res = await client.sendMessage(chatId, text, { ...extra, parse_mode: 'MarkdownV2' });
    return { sent: true, messageId: res.message_id };
  } catch (e) {
    if (e.message && e.message.includes("can't parse entities")) {
      console.warn('[TelegramNotify] MarkdownV2 falhou, enviando sem formatação:', e.message);
      try {
        const safeExtra = { ...extra };
        delete safeExtra.parse_mode;
        const plain = unescapeMarkdown(text);
        const res = await client.sendMessage(chatId, plain, safeExtra);
        return { sent: true, messageId: res.message_id, fallback: true };
      } catch (e2) {
        return { sent: false, reason: 'send_failed', error: e2.message };
      }
    }
    return { sent: false, reason: 'send_failed', error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════

function formatLeadMessage(lead) {
  const lines = [
    '🎯 *Novo Lead — Demo Request*',
    '',
    `👤 *Nome:* ${escapeMarkdown(lead.displayName)}`,
    `📧 *Email:* ${escapeMarkdown(lead.email)}`,
  ];

  if (lead.companyName) {
    lines.push(`🏢 *Empresa:* ${escapeMarkdown(lead.companyName)}`);
  }
  if (lead.companySize) {
    lines.push(`👥 *Equipe:* ${escapeMarkdown(lead.companySize)}`);
  }
  if (lead.phone) {
    lines.push(`📱 *Telefone:* ${escapeMarkdown(lead.phone)}`);
  }
  if (lead.notes) {
    lines.push(`📝 *Mensagem:* ${escapeMarkdown(lead.notes.substring(0, 300))}`);
  }

  lines.push('');
  lines.push(`🕐 *Recebido:* ${escapeMarkdown(new Date().toLocaleString('pt-BR'))}`);
  lines.push(`🔗 *Dashboard:* [Abrir Leads](https://nexodashboard.onrender.com/dashboard/leads)`);

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

async function notifyNewLead(lead) {
  if (!TOKEN || !CHAT_ID) {
    return { sent: false, reason: 'not_configured', hint: 'Configure TELEGRAM_BOT_TOKEN e TELEGRAM_NOTIFICATION_CHAT_ID no .env' };
  }

  const text = formatLeadMessage(lead);
  return await safeSend(CHAT_ID, text, { disable_web_page_preview: true });
}

async function sendCustomMessage(text, options = {}) {
  if (!TOKEN || !CHAT_ID) {
    return { sent: false, reason: 'not_configured' };
  }
  return await safeSend(CHAT_ID, escapeMarkdown(text), options);
}

module.exports = {
  notifyNewLead,
  sendCustomMessage,
  isConfigured: !!TOKEN && !!CHAT_ID,
};
