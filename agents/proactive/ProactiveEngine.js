// ============================================================
// PROACTIVE ENGINE v18.0 — A Luna Age Antes de Ser Perguntada
// Substitui templates por alertas baseados em dados reais + padrões.
// ============================================================

const { PatternDetector } = require('./PatternDetector');

class ProactiveEngine {
  constructor(dataAPI, knowledgeGraph, semanticMemory) {
    this.dataAPI = dataAPI;
    this.kg = knowledgeGraph;
    this.sm = semanticMemory;
    this.detector = new PatternDetector(dataAPI, semanticMemory);
    this.lastAlerts = new Map(); // Evita spam do mesmo alerta
  }

  /**
   * Gera alertas proativos inteligentes
   * Chamado pelo scheduler periodicamente
   */
  async generateAlerts() {
    const alerts = [];

    // 1. Anomalias detectadas pelo PatternDetector
    const anomalies = this.detector.detectAnomalies();
    for (const a of anomalies) {
      if (this._shouldAlert(a.type, a.entity || a.description)) {
        alerts.push(this._formatAnomalyAlert(a));
      }
    }

    // 2. Clientes sem comunicação (baseado em padrões)
    const patterns = this.detector.detectPatterns(30);
    for (const p of patterns) {
      if (p.type === 'response_time' && p.averageDays) {
        const entityMsgs = this._getEntityMessages(p.entity);
        if (entityMsgs.length > 0) {
          const lastMsg = entityMsgs[entityMsgs.length - 1];
          const daysSince = (Date.now() - new Date(lastMsg.timestamp).getTime()) / (24 * 60 * 60 * 1000);
          if (daysSince > p.averageDays * 2) {
            if (this._shouldAlert('slow_response', p.entity)) {
              alerts.push({
                priority: 'medium',
                message: `⏰ *${p.entity}* normalmente responde em ${p.averageDays.toFixed(1)} dias, mas já faz ${Math.floor(daysSince)} dias. Pode estar ocupado ou precisando de um follow-up.`,
                action: `Mandar mensagem para ${p.entity}`
              });
            }
          }
        }
      }
    }

    // 3. Tarefas P0/P1 críticas
    const p0 = this.dataAPI.queryTasks({ priority: 'P0' });
    const p1 = this.dataAPI.queryTasks({ priority: 'P1' });
    if (p0.length > 0 && this._shouldAlert('p0_tasks', 'daily')) {
      const p0Names = p0.slice(0, 2).map(t => t.title || t.body || 'tarefa').join(', ');
      const more = p0.length > 2 ? ` e mais ${p0.length - 2}` : '';
      alerts.push({
        priority: 'high',
        message: `Eita, tem ${p0.length} P0 no radar${p0Names ? `: ${p0Names}${more}` : ''}. Quer que eu priorizo alguma? 🔴`,
        action: 'Verificar tarefas P0'
      });
    }

    // 4. Projetos com milestones pendentes
    const projects = this.dataAPI.getProjectsRegistry();
    for (const [id, proj] of Object.entries(projects.projects || {})) {
      const pendingMilestones = (proj.milestones || []).filter(m => !m.done);
      const overdueMilestones = pendingMilestones.filter(m => m.date && new Date(m.date) < new Date());
      if (overdueMilestones.length > 0 && this._shouldAlert('overdue_milestone', id)) {
        const names = overdueMilestones.map(m => m.name).join(', ');
        alerts.push({
          priority: 'high',
          message: `⚠️ O projeto *${proj.name}* tá com ${overdueMilestones.length} milestone(s) atrasada(s): ${names}. Bora resolver?`,
          action: `Verificar projeto ${proj.name}`
        });
      }
    }

    // 5. Leads quentes sem follow-up
    const leads = this.dataAPI.getLeadPipeline();
    if (leads.hot.length > 0 && this._shouldAlert('hot_leads', 'daily')) {
      const leadNames = leads.hot.slice(0, 2).map(l => l.name || 'lead').join(', ');
      const more = leads.hot.length > 2 ? ` e mais ${leads.hot.length - 2}` : '';
      alerts.push({
        priority: 'medium',
        message: `🔥 ${leads.hot.length} lead(s) quente(s) no radar${leadNames ? ` (${leadNames}${more})` : ''}. Tô de olho, mas não deixa esfriar!`,
        action: 'Follow-up nos leads'
      });
    }

    // Ordenar por prioridade
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    alerts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return alerts.slice(0, 5); // Máximo 5 alertas por vez
  }

  /**
   * Gera resumo diário inteligente (substitui morning brief)
   */
  async generateDailyBrief() {
    const digest = this.dataAPI.getDailyDigest();
    const alerts = await this.generateAlerts();
    const now = new Date();
    const weekday = now.getDay();

    // Variações de abertura por dia
    const openings = {
      1: ['Bom dia! Semana nova, código novo. 💪', 'Opa, segunda! Bora começar com tudo? ☕'],
      5: ['Sextou! Mas ainda temos coisas pra fechar. Bora? 🎉', 'Bom dia! Sexta-feira, vamos fechar a semana bem? 💪'],
      0: ['Domingo? Trabalhando? Respeito máximo. 💙', 'E aí! Tudo tranquilo por aí? 🌙']
    };
    const defaultOpenings = [
      'Opa, bom dia! ☕',
      'Bom dia, chefes! 🌙',
      'E aí! Prontos pra hoje? 🚀'
    ];
    const dayOpenings = openings[weekday] || defaultOpenings;
    let msg = dayOpenings[Math.floor(Math.random() * dayOpenings.length)] + '\n\n';

    // Foco do dia — formato natural, não lista indentada
    if (digest.tasks.p0 > 0 || digest.tasks.p1 > 0 || digest.tasks.overdue > 0) {
      const parts = [];
      if (digest.tasks.p0 > 0) parts.push(`${digest.tasks.p0} P0`);
      if (digest.tasks.p1 > 0) parts.push(`${digest.tasks.p1} P1`);
      if (digest.tasks.overdue > 0) parts.push(`${digest.tasks.overdue} atrasada(s)`);
      msg += `Tô vendo ${parts.join(', ')} no radar hoje.\n`;
      if (digest.tasks.p0 > 0) {
        msg += `🔴 Isso parece urgente, né?\n`;
      }
      msg += '\n';
    }

    // Alertas proativos — formato conversacional
    if (alerts.length > 0) {
      for (const alert of alerts) {
        msg += `${alert.message}\n\n`;
      }
    }

    // Contexto financeiro — comentário natural
    const cashBox = this.dataAPI.getCashBox();
    const balance = cashBox.balance?.value || 0;
    const income = cashBox.monthlyIncome?.value || 0;
    const prevBalance = cashBox.previousBalance?.value || balance;
    const balanceDiff = balance - prevBalance;
    let financeComment = '';
    if (Math.abs(balanceDiff) > 500) {
      financeComment = balanceDiff > 0 ? ' (subiu bem! 📈)' : ' (cuidado aí! 📉)';
    }
    msg += `💰 Caixa: €${balance.toFixed(2)}${financeComment} | Receita do mês: €${income.toFixed(2)}\n\n`;

    // Sugestão contextual — tom de colega
    const patterns = this.detector.detectPatterns(7);
    const todayPattern = patterns.find(p => p.type === 'weekday_topic' && p.weekday === weekday);
    if (todayPattern) {
      msg += `💡 ${todayPattern.description}\n\n`;
    }

    // Fechamento natural
    const closings = [
      'Bora? 🚀',
      'O que manda? 🎯',
      'Tô aqui se precisarem. ☕'
    ];
    msg += closings[Math.floor(Math.random() * closings.length)];

    return msg;
  }

  /**
   * Gera resumo semanal (substitui weekly report)
   */
  async generateWeeklyReport() {
    const now = new Date();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const tasks = this.dataAPI.queryTasks({});
    const createdThisWeek = tasks.filter(t => t.createdAt && new Date(t.createdAt) >= weekStart);
    const completedThisWeek = tasks.filter(t => (t.status === 'concluido' || t.status === 'done') && t.updatedAt && new Date(t.updatedAt) >= weekStart);

    const cashBox = this.dataAPI.getCashBox();
    const history = cashBox.history || [];
    const weekTransactions = history.filter(h => h.date && new Date(h.date) >= weekStart);

    const leads = this.dataAPI.getLeadPipeline();

    // Micro-narrativa de abertura
    let msg = `Resumo da semana! 📊\n\n`;

    // Tarefas com contexto
    if (createdThisWeek.length > 0 || completedThisWeek.length > 0) {
      msg += `Essa semana foi movimentada: `;
      if (createdThisWeek.length > 0 && completedThisWeek.length > 0) {
        msg += `anotamos ${createdThisWeek.length} tarefa(s) e vocês finalizaram ${completedThisWeek.length}. Boa! 💪\n\n`;
      } else if (completedThisWeek.length > 0) {
        msg += `vocês finalizaram ${completedThisWeek.length} tarefa(s). Arrasaram! 🎉\n\n`;
      } else {
        msg += `anotamos ${createdThisWeek.length} tarefa(s) novas.\n\n`;
      }
    } else {
      msg += `Semana mais tranquila por aqui. Nada de novo no radar. ☕\n\n`;
    }

    // Destaques com contexto
    if (completedThisWeek.length > 0) {
      const names = completedThisWeek.slice(0, 3).map(t => t.title || t.body || 'tarefa');
      msg += `🏆 Destaques: ${names.join(', ')}\n\n`;
    }

    // Financeiro com comentário
    if (weekTransactions.length > 0) {
      msg += `💰 ${weekTransactions.length} movimentação(ões) na semana.\n\n`;
    }

    // Leads
    if (leads.hot.length > 0) {
      msg += `🔥 ${leads.hot.length} lead(s) quente(s) no pipeline. Tô de olho!\n\n`;
    }

    // Padrões detectados
    const patterns = this.detector.detectPatterns(7);
    if (patterns.length > 0) {
      const descs = patterns.slice(0, 3).map(p => p.description);
      msg += `🔍 Padrões que notei: ${descs.join('; ')}\n\n`;
    }

    // Fechamento com pergunta
    const closings = [
      'Semana que vem tem alguma entrega marcada que eu devo ficar de olho? 👀',
      'Bom descanso! Amanhã a gente começa de novo. 🌙',
      'Fechamos a semana bem. Alguma coisa pra semana que vem que eu já anoto? 📝'
    ];
    msg += closings[Math.floor(Math.random() * closings.length)];

    return msg;
  }

  _shouldAlert(alertType, identifier) {
    const key = `${alertType}:${identifier}`;
    const lastAlert = this.lastAlerts.get(key);
    const now = Date.now();

    // Cooldown: 4 horas para o mesmo alerta
    if (lastAlert && (now - lastAlert) < 4 * 60 * 60 * 1000) {
      return false;
    }

    this.lastAlerts.set(key, now);
    return true;
  }

  _formatAnomalyAlert(anomaly) {
    const emoji = anomaly.severity === 'high' ? '🔴' : anomaly.severity === 'medium' ? '🟠' : '🟡';
    const reactions = {
      high: ['Eita, isso não tá bom...', 'Hmm, tem algo sério aqui.', 'Atenção nesse!'],
      medium: ['Opa, notei uma coisa.', 'Hmm, isso aqui chamou atenção.', 'Olha só...'],
      low: ['Só avisando...', 'Dei uma olhada e vi isso.', 'Fica de olho nisso:']
    };
    const reaction = reactions[anomaly.severity] || reactions.medium;
    const prefix = reaction[Math.floor(Math.random() * reaction.length)];
    return {
      priority: anomaly.severity,
      message: `${emoji} ${prefix} ${anomaly.description}`,
      action: 'Verificar situação'
    };
  }

  _getEntityMessages(entity) {
    const history = this.dataAPI.getWhatsAppHistory();
    return (history.messages || []).filter(m =>
      (m.body || '').toLowerCase().includes(entity.toLowerCase())
    );
  }
}

module.exports = { ProactiveEngine };
