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
      alerts.push({
        priority: 'high',
        message: `🔴 *${p0.length} tarefa(s) P0* precisa(m) de atenção urgente.`,
        action: 'Verificar tarefas P0'
      });
    }

    // 4. Projetos com milestones pendentes
    const projects = this.dataAPI.getProjectsRegistry();
    for (const [id, proj] of Object.entries(projects.projects || {})) {
      const pendingMilestones = (proj.milestones || []).filter(m => !m.done);
      const overdueMilestones = pendingMilestones.filter(m => m.date && new Date(m.date) < new Date());
      if (overdueMilestones.length > 0 && this._shouldAlert('overdue_milestone', id)) {
        alerts.push({
          priority: 'high',
          message: `⚠️ *${proj.name}* tem ${overdueMilestones.length} milestone(s) atrasada(s): ${overdueMilestones.map(m => m.name).join(', ')}`,
          action: `Verificar projeto ${proj.name}`
        });
      }
    }

    // 5. Leads quentes sem follow-up
    const leads = this.dataAPI.getLeadPipeline();
    if (leads.hot.length > 0 && this._shouldAlert('hot_leads', 'daily')) {
      alerts.push({
        priority: 'medium',
        message: `🔥 *${leads.hot.length} lead(s) quente(s)* no pipeline. Não deixe esfriar!`,
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

    let msg = `🌙 *Bom dia, chefes!*\n\n`;

    // Foco do dia
    if (digest.tasks.p0 > 0 || digest.tasks.p1 > 0) {
      msg += `🎯 *Foco do Dia:*\n`;
      if (digest.tasks.p0 > 0) msg += `   🔴 ${digest.tasks.p0} P0\n`;
      if (digest.tasks.p1 > 0) msg += `   🟠 ${digest.tasks.p1} P1\n`;
      if (digest.tasks.overdue > 0) msg += `   ⏰ ${digest.tasks.overdue} atrasada(s)\n`;
      msg += `\n`;
    }

    // Alertas proativos
    if (alerts.length > 0) {
      msg += `⚠️ *Alertas:*\n`;
      for (const alert of alerts) {
        const emoji = alert.priority === 'high' ? '🔴' : alert.priority === 'medium' ? '🟠' : '🟡';
        msg += `${emoji} ${alert.message}\n\n`;
      }
    }

    // Contexto financeiro
    const cashBox = this.dataAPI.getCashBox();
    const balance = cashBox.balance?.value || 0;
    const income = cashBox.monthlyIncome?.value || 0;
    msg += `💰 *Financeiro:* Saldo €${balance.toFixed(2)} | Receita mensal €${income.toFixed(2)}\n\n`;

    // Sugestão contextual
    const patterns = this.detector.detectPatterns(7);
    const todayPattern = patterns.find(p => p.type === 'weekday_topic' && p.weekday === new Date().getDay());
    if (todayPattern) {
      msg += `💡 *Sugestão:* Hoje é ${todayPattern.description.toLowerCase()}.\n\n`;
    }

    msg += `_Luna v18.0 | ${new Date().toLocaleDateString('pt-BR')}_`;

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

    let msg = `📊 *Relatório Semanal NEXO*\n`;
    msg += `_${weekStart.toLocaleDateString('pt-BR')} — ${now.toLocaleDateString('pt-BR')}_\n\n`;

    msg += `📝 *Tarefas:*\n`;
    msg += `   Criadas: ${createdThisWeek.length}\n`;
    msg += `   Concluídas: ${completedThisWeek.length}\n\n`;

    msg += `💰 *Movimentações:* ${weekTransactions.length}\n\n`;

    msg += `🎣 *Leads:* ${leads.total} total | ${leads.hot.length} quente(s)\n\n`;

    // Destaques da semana
    if (completedThisWeek.length > 0) {
      msg += `🏆 *Concluído esta semana:*\n`;
      msg += completedThisWeek.slice(0, 3).map(t => `   ✅ ${t.title || t.body || 'Tarefa'}`).join('\n');
      msg += '\n\n';
    }

    // Padrões detectados
    const patterns = this.detector.detectPatterns(7);
    if (patterns.length > 0) {
      msg += `🔍 *Padrões detectados:*\n`;
      msg += patterns.slice(0, 3).map(p => `   • ${p.description}`).join('\n');
      msg += '\n\n';
    }

    msg += `_Luna v18.0 | Análise Inteligente_`;

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
    return {
      priority: anomaly.severity,
      message: `${emoji} ${anomaly.description}`,
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
