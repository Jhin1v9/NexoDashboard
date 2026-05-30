/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  SERVIÇO DE NOTIFICAÇÕES TELEGRAM — NEXO DIGITAL v2.0 PREMIUM           ║
 * ║  Design: Espetacular • Visual • Impactante • Profissional               ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Templates premium para votações com formatação Markdown avançada,
 * emojis estratégicos, separadores visuais e layout hierárquico.
 */

const fs = require('fs');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GROUP_CHAT_ID = process.env.TELEGRAM_GROUP_CHAT_ID || process.env.TELEGRAM_NOTIFICATION_CHAT_ID || '';

if (!GROUP_CHAT_ID) {
  console.warn('[TelegramNotifier] ⚠️ TELEGRAM_GROUP_CHAT_ID não configurado. Notificações de votação NÃO serão enviadas para o grupo. Configure no .env do backend.');
}

let bot = null;
if (TOKEN) {
  bot = new TelegramBot(TOKEN, { polling: false });
} else {
  console.warn('[TelegramNotifier] TELEGRAM_BOT_TOKEN não configurado');
}

// ═══════════════════════════════════════════════════════════════════════════
// CACHE DE USUÁRIOS
// ═══════════════════════════════════════════════════════════════════════════
let usersCache = null;
let usersCacheTime = 0;
const USERS_CACHE_TTL = 30000;

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

// ═══════════════════════════════════════════════════════════════════════════
// EMOJIS & ASSETS VISUAIS
// ═══════════════════════════════════════════════════════════════════════════
const E = {
  header:    '╔══════════════════════╗',
  footer:    '╚══════════════════════╝',
  divider:   '━━━━━━━━━━━━━━━━━━━━━━',
  dot:       '◉',
  arrow:     '▸',
  check:     '✅',
  cross:     '❌',
  ballot:    '🗳️',
  crown:     '👑',
  sparkles:  '✨',
  rocket:    '🚀',
  lock:      '🔒',
  unlock:    '🔓',
  chart:     '📊',
  link:      '🔗',
  clock:     '⏱️',
  fire:      '🔥',
  star:      '⭐',
  warning:   '⚠️',
  party:     '🎉',
  skull:     '💀',
  brain:     '🧠',
  gear:      '⚙️',
  target:    '🎯',
  megaphone: '📢',
  shield:    '🛡️',
  zap:       '⚡',
};

const STATUS_EMOJI = {
  open:    '🟢 ABERTA',
  voting:  '🔵 EM VOTAÇÃO',
  approved:'🟢 APROVADA',
  rejected:'🔴 REJEITADA',
  closed:  '⚪ ENCERRADA',
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS VISUAIS
// ═══════════════════════════════════════════════════════════════════════════

function progressBar(yes, no, total = 3) {
  const y = '█'.repeat(yes);
  const n = '░'.repeat(total - yes - no);
  const x = '▒'.repeat(no);
  return `${E.chart} ${y}${x}${n}  ${E.check} ${yes}  ${E.cross} ${no}  / ${total}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function box(title, content) {
  return `${E.header}\n${E.crown} *${escapeMarkdown(title)}*\n${E.footer}\n\n${content}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATES PREMIUM
// ═══════════════════════════════════════════════════════════════════════════

function buildNewVoting(session, creator, url) {
  const desc = session.description
    ? `\n${E.arrow} _${escapeMarkdown(session.description.slice(0, 300))}_\n`
    : '';

  const quorumVisual = `${E.target} *Quórum necessário:* ${session.quorumRequired}/3 CEOs ${E.star}\n`;

  return box(
    'NOVA SESSÃO DE VOTAÇÃO',
    `${E.ballot} *Título:* \`${escapeMarkdown(session.title)}\`\n` +
    `${E.brain} *Criada por:* ${escapeMarkdown(creator)}\n` +
    `${E.clock} *Data:* ${formatDate(session.createdAt)}\n` +
    `${STATUS_EMOJI[session.status] || session.status}\n` +
    `${quorumVisual}` +
    `${desc}\n` +
    `${E.divider}\n\n` +
    `${E.megaphone} *CEOs, por favor votem:*\n` +
    `${E.arrow} Ação será executada *automaticamente* após aprovação\n\n` +
    `${E.link} [▸ ABRIR DASHBOARD](${url}/votacao)`
  );
}

function buildVoteUpdate(session, voterName, voteValue, url) {
  const voteEmoji = voteValue === 'yes' ? `${E.check} SIM` : `${E.cross} NÃO`;
  const yesCount = Object.values(session.votes).filter(v => v?.vote === 'yes').length;
  const noCount = Object.values(session.votes).filter(v => v?.vote === 'no').length;

  const progress = progressBar(yesCount, noCount, 3);
  const quorumText = yesCount >= session.quorumRequired
    ? `\n${E.fire} *QUÓROM ALCANÇADO!* Aguardando encerramento...\n`
    : `\n${E.clock} *Faltam:* ${session.quorumRequired - yesCount} voto(s) para aprovação\n`;

  const buttons = (session.status === 'open' || session.status === 'voting')
    ? `\n${E.megaphone} *Ainda não votaram — participem!*` : '';

  return box(
    'NOVO VOTO REGISTRADO',
    `${E.ballot} *Sessão:* \`${escapeMarkdown(session.title)}\`\n\n` +
    `${E.zap} *Votante:* ${escapeMarkdown(voterName)}\n` +
    `${voteEmoji}\n\n` +
    `${E.divider}\n` +
    `${progress}\n` +
    `${quorumText}` +
    `${buttons}\n\n` +
    `${E.link} [▸ VER NO DASHBOARD](${url}/votacao)`
  );
}

function buildApproved(session, url) {
  const execText = session.executionResult?.success
    ? `\n${E.rocket} *Ação executada automaticamente com sucesso!*\n`
    : `\n${E.warning} *Ação pendente de execução manual*\n`;

  return box(
    'VOTAÇÃO APROVADA',
    `${E.party} *PARABÉNS!* A proposta foi aprovada pela diretoria.\n\n` +
    `${E.ballot} *Título:* \`${escapeMarkdown(session.title)}\`\n` +
    `${E.check} *Votos SIM:* ${Object.values(session.votes).filter(v => v?.vote === 'yes').length}/3\n` +
    `${E.cross} *Votos NÃO:* ${Object.values(session.votes).filter(v => v?.vote === 'no').length}/3\n` +
    `${E.clock} *Encerrada em:* ${formatDate(new Date().toISOString())}\n\n` +
    `${E.divider}\n` +
    `${execText}\n` +
    `${E.link} [▸ VER DETALHES](${url}/votacao)`
  );
}

function buildRejected(session, url) {
  return box(
    'VOTAÇÃO REJEITADA',
    `${E.skull} *PROPOSTA VETADA* pela diretoria.\n\n` +
    `${E.ballot} *Título:* \`${escapeMarkdown(session.title)}\`\n` +
    `${E.check} *Votos SIM:* ${Object.values(session.votes).filter(v => v?.vote === 'yes').length}/3\n` +
    `${E.cross} *Votos NÃO:* ${Object.values(session.votes).filter(v => v?.vote === 'no').length}/3\n` +
    `${E.clock} *Encerrada em:* ${formatDate(new Date().toISOString())}\n\n` +
    `${E.divider}\n\n` +
    `${E.shield} A ação *NÃO será executada*.\n\n` +
    `${E.link} [▸ VER DETALHES](${url}/votacao)`
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BOTÕES INLINE PREMIUM
// ═══════════════════════════════════════════════════════════════════════════

function votingButtons(sessionId, showButtons = true) {
  if (!showButtons) return null;
  return {
    inline_keyboard: [
      [
        { text: `${E.check} APROVAR`, callback_data: `vote:${sessionId}:yes` },
        { text: `${E.cross} REJEITAR`, callback_data: `vote:${sessionId}:no` }
      ],
      [
        { text: `${E.link} Abrir Dashboard`, url: `http://192.168.1.33:3456/votacao` }
      ]
    ]
  };
}

function resultButtons(sessionId, url) {
  return {
    inline_keyboard: [[
      { text: `${E.link} Ver no Dashboard`, url: `${url}/votacao` }
    ]]
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

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

  switch (type) {
    case 'new':
      text = buildNewVoting(session, creator, url);
      inlineKeyboard = votingButtons(session.id, true);
      break;

    case 'vote': {
      const voterName = users[voter]?.name || voter;
      text = buildVoteUpdate(session, voterName, voteValue, url);
      const stillOpen = session.status === 'open' || session.status === 'voting';
      inlineKeyboard = votingButtons(session.id, stillOpen);
      break;
    }

    case 'approved':
      text = buildApproved(session, url);
      inlineKeyboard = resultButtons(session.id, url);
      break;

    case 'rejected':
      text = buildRejected(session, url);
      inlineKeyboard = resultButtons(session.id, url);
      break;

    default:
      console.warn(`[TelegramNotifier] Tipo de notificação desconhecido: ${type}`);
      return { sent: false, reason: 'unknown_type' };
  }

  const results = [];

  // ── ENVIAR PARA O GRUPO ──
  if (GROUP_CHAT_ID) {
    try {
      const msg = await bot.sendMessage(GROUP_CHAT_ID, text, {
        parse_mode: 'Markdown',
        reply_markup: inlineKeyboard,
        disable_web_page_preview: true
      });
      results.push({ chat: 'group', messageId: msg.message_id, sent: true });
      console.log(`[TelegramNotifier] ✅ Notificação ${type} enviada para o grupo`);
    } catch (err) {
      console.error('[TelegramNotifier] Erro ao enviar para grupo:', err.message);
      results.push({ chat: 'group', sent: false, error: err.message });
    }
  }

  // ── ENVIAR DM PARA CEOs ──
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

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICAÇÃO DE TAREFA — PREMIUM RICH DATA
// ═══════════════════════════════════════════════════════════════════════════

const PRIORITY_CONFIG = {
  high:   { emoji: '🔴', label: 'ALTA' },
  medium: { emoji: '🟡', label: 'MÉDIA' },
  low:    { emoji: '🟢', label: 'BAIXA' },
  urgent: { emoji: '🔥', label: 'URGENTE' },
};

const STATUS_CONFIG_TASK = {
  pending:     { emoji: '⏳', label: 'PENDENTE' },
  in_progress: { emoji: '⚙️', label: 'EM ANDAMENTO' },
  completed:   { emoji: '✅', label: 'CONCLUÍDA' },
  blocked:     { emoji: '🚫', label: 'BLOQUEADA' },
  cancelled:   { emoji: '❌', label: 'CANCELADA' },
};

function buildTaskNotification(task) {
  const p = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const s = STATUS_CONFIG_TASK[task.status] || STATUS_CONFIG_TASK.pending;
  
  const title = escapeMarkdown(task.title || 'Sem título');
  const desc = task.description 
    ? escapeMarkdown(task.description.slice(0, 400)) 
    : '_Sem descrição_';
  const assignee = task.assignedTo 
    ? escapeMarkdown(task.assignedTo) 
    : 'Não atribuído';
  const createdBy = escapeMarkdown(task.addedBy || 'Sistema');
  const dueDate = task.dueDate 
    ? formatDate(task.dueDate) 
    : 'Sem prazo';
  
  let tagsText = '';
  if (task.tags && task.tags.length > 0) {
    tagsText = '\n🏷️ *Tags:* ' + task.tags.map(t => '`' + escapeMarkdown(t) + '`').join('  ');
  }
  
  const commentsCount = task.comments?.length || 0;
  const commentsText = commentsCount > 0 
    ? '💬 ' + commentsCount + ' comentário(s)' 
    : '💬 Sem comentários';

  return (
    '╔══════════════════════════════════╗\n' +
    '📋 *NOVA TAREFA CRIADA*\n' +
    '╚══════════════════════════════════╝\n\n' +
    '🎯 *' + title + '*\n\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
    p.emoji + ' *Prioridade:* ' + p.label + '\n' +
    s.emoji + ' *Status:* ' + s.label + '\n' +
    '👤 *Responsável:* ' + assignee + '\n' +
    '✍️ *Criada por:* ' + createdBy + '\n' +
    '📅 *Prazo:* ' + dueDate + '\n' +
    '🆔 *ID:* `' + task.id + '`\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
    '📝 *Descrição:*\n' +
    '_' + desc + '_\n' +
    tagsText + '\n\n' +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
    '📊 *Atividade:* ' + commentsText + '  |  🕐 Criada em ' + formatDate(task.createdAt) + '\n\n' +
    '🔗 [▸ ABRIR NO DASHBOARD](http://192.168.1.33:3456/tarefas)'
  );
}

async function sendTaskNotification(task) {
  if (!bot) {
    console.warn('[TelegramNotifier] Bot não inicializado');
    return { sent: false, reason: 'bot_not_initialized' };
  }
  if (!GROUP_CHAT_ID) {
    console.warn('[TelegramNotifier] GROUP_CHAT_ID não configurado');
    return { sent: false, reason: 'group_chat_id_not_set' };
  }
  
  try {
    const text = buildTaskNotification(task);
    const msg = await bot.sendMessage(GROUP_CHAT_ID, text, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Concluir', callback_data: 'task:' + task.id + ':complete' },
            { text: '👤 Assumir', callback_data: 'task:' + task.id + ':assign' }
          ],
          [
            { text: '🔗 Abrir Dashboard', url: 'http://192.168.1.33:3456/tarefas' }
          ]
        ]
      }
    });
    console.log('[TelegramNotifier] ✅ Notificação de tarefa enviada: ' + task.id);
    return { sent: true, messageId: msg.message_id };
  } catch (err) {
    console.error('[TelegramNotifier] Erro ao enviar notificação de tarefa:', err.message);
    return { sent: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MENSAGEM SIMPLES
// ═══════════════════════════════════════════════════════════════════════════

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

function escapeMarkdown(text) {
  if (!text) return '';
  return String(text).replace(/([_\*\[\]\(\)~`>#+\-=|{}.!])/g, '\\$1');
}

module.exports = {
  sendVotingNotification,
  sendTaskNotification,
  sendSimpleMessage,
  resolveMentions,
  escapeMarkdown,
  bot
};
