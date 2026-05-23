/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Notification Service — NEXO Dashboard PRO
 * Orquestra notificações: Email (primário) → Discord (fallback)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

const { sendLeadNotification, isConfigured: emailConfigured } = require('./email.service');
const { sendWebhookMessage } = require('./discord-notifier');

/**
 * Notifica a equipe NEXO sobre um novo lead
 * 1. Tenta enviar email (SMTP)
 * 2. Se falhar, notifica no Discord (webhook)
 * 3. Sempre retorna status para o caller
 */
async function notifyNewLead(lead) {
  const results = {
    email: null,
    discord: null
  };

  // 1. Tentar email
  if (emailConfigured) {
    try {
      results.email = await sendLeadNotification(lead);
    } catch (err) {
      results.email = { success: false, error: err.message };
    }
  }

  // 2. Fallback Discord (sempre tenta, independente do email)
  try {
    const discordMessage = {
      content: null,
      embeds: [{
        title: '🎯 Novo Lead — Demo Request',
        description: `**${lead.displayName}** solicitou uma demo personalizada.`,
        color: 0x00f0ff,
        fields: [
          { name: '📧 Email', value: lead.email || 'N/A', inline: true },
          { name: '🏢 Empresa', value: lead.companyName || 'N/A', inline: true },
          { name: '👥 Equipe', value: lead.companySize || 'N/A', inline: true },
          { name: '📱 Telefone', value: lead.phone || 'N/A', inline: true },
          { name: '📝 Mensagem', value: lead.notes ? lead.notes.substring(0, 500) : 'Nenhuma', inline: false }
        ],
        footer: {
          text: `NEXO Dashboard • ${new Date().toLocaleString('pt-BR')}`
        }
      }]
    };

    // Envia via discord-notifier (webhook já configurado no server.js)
    const discordRes = await sendWebhookMessage(discordMessage);
    results.discord = { success: discordRes.sent, status: discordRes.status, error: discordRes.error };
  } catch (err) {
    results.discord = { success: false, error: err.message };
  }

  // Log resumo
  const emailOk = results.email?.success;
  const discordOk = results.discord?.success;
  if (emailOk || discordOk) {
    console.log('[NotificationService] Lead notificado:', { email: emailOk, discord: discordOk });
  } else {
    console.warn('[NotificationService] Nenhuma notificação entregue:', results);
  }

  return results;
}

module.exports = {
  notifyNewLead
};
