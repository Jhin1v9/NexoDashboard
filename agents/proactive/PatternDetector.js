// ============================================================
// PATTERN DETECTOR v18.0 — A Luna Enxerga Padrões
// Analisa histórico para detectar comportamentos repetidos e anomalias.
// ============================================================

class PatternDetector {
  constructor(dataAPI, semanticMemory) {
    this.dataAPI = dataAPI;
    this.sm = semanticMemory;
  }

  /**
   * Detecta padrões no histórico de mensagens
   */
  detectPatterns(days = 30) {
    const history = this.dataAPI.getWhatsAppHistory();
    const messages = (history.messages || []).filter(m => {
      const age = Date.now() - new Date(m.timestamp || 0).getTime();
      return age < days * 24 * 60 * 60 * 1000;
    });

    const patterns = [];

    // Padrão 1: CEO sempre pergunta sobre X no dia Y da semana
    const weekdayQueries = this._detectWeekdayPatterns(messages);
    patterns.push(...weekdayQueries);

    // Padrão 2: Cliente sempre responde em até N dias
    const responseTimes = this._detectResponseTimePatterns(messages);
    patterns.push(...responseTimes);

    // Padrão 3: Projeto sempre atrasa na fase X
    const projectDelays = this._detectProjectDelayPatterns(messages);
    patterns.push(...projectDelays);

    // Padrão 4: Horário de pico de atividade por CEO
    const peakHours = this._detectPeakHours(messages);
    patterns.push(...peakHours);

    return patterns;
  }

  _detectWeekdayPatterns(messages) {
    const patterns = [];
    const authors = [...new Set(messages.map(m => m.pushname || m.author))].filter(Boolean);

    for (const author of authors) {
      const authorMsgs = messages.filter(m => (m.pushname || m.author) === author);
      const byWeekday = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };

      for (const m of authorMsgs) {
        const day = new Date(m.timestamp).getDay();
        byWeekday[day].push(m);
      }

      for (let day = 0; day < 7; day++) {
        const dayMsgs = byWeekday[day];
        if (dayMsgs.length >= 3) {
          // Verificar se há tópicos recorrentes neste dia
          const topics = this._extractTopics(dayMsgs);
          for (const [topic, count] of Object.entries(topics)) {
            if (count >= 2) {
              const dayName = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][day];
              patterns.push({
                type: 'weekday_topic',
                description: `${author} frequentemente fala sobre "${topic}" às ${dayName}s`,
                confidence: count / dayMsgs.length,
                author,
                weekday: day,
                topic
              });
            }
          }
        }
      }
    }

    return patterns;
  }

  _detectResponseTimePatterns(messages) {
    const patterns = [];
    const clients = ['paulo', 'juan'];

    for (const client of clients) {
      const clientMsgs = messages.filter(m => (m.body || '').toLowerCase().includes(client));
      if (clientMsgs.length < 3) continue;

      // Agrupar por thread (mensagens consecutivas do mesmo autor)
      const responseTimes = [];
      for (let i = 1; i < clientMsgs.length; i++) {
        const prev = clientMsgs[i - 1];
        const curr = clientMsgs[i];
        const timeDiff = new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime();
        const daysDiff = timeDiff / (24 * 60 * 60 * 1000);
        if (daysDiff > 0 && daysDiff < 14) {
          responseTimes.push(daysDiff);
        }
      }

      if (responseTimes.length > 0) {
        const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        patterns.push({
          type: 'response_time',
          description: `${client} normalmente responde em ${avg.toFixed(1)} dias`,
          confidence: 0.7,
          entity: client,
          averageDays: avg
        });
      }
    }

    return patterns;
  }

  _detectProjectDelayPatterns(messages) {
    const patterns = [];
    const projects = this.dataAPI.getProjectsRegistry();

    for (const [id, proj] of Object.entries(projects.projects || {})) {
      const projMsgs = messages.filter(m =>
        (m.body || '').toLowerCase().includes(proj.codename?.toLowerCase()) ||
        (m.body || '').toLowerCase().includes(proj.name?.toLowerCase())
      );

      // Procurar menções a atrasos
      const delayMsgs = projMsgs.filter(m => /atras|delay|late|n[ãa]o (foi|fez|terminou)/i.test(m.body || ''));
      if (delayMsgs.length >= 2) {
        patterns.push({
          type: 'project_delay',
          description: `${proj.name} tem histórico de atrasos (${delayMsgs.length} menções)`,
          confidence: Math.min(0.9, delayMsgs.length / 10),
          project: id,
          delayCount: delayMsgs.length
        });
      }
    }

    return patterns;
  }

  _detectPeakHours(messages) {
    const patterns = [];
    const authors = [...new Set(messages.map(m => m.pushname || m.author))].filter(Boolean);

    for (const author of authors) {
      const authorMsgs = messages.filter(m => (m.pushname || m.author) === author);
      const hours = {};
      for (const m of authorMsgs) {
        const h = new Date(m.timestamp).getHours();
        hours[h] = (hours[h] || 0) + 1;
      }

      const peakHour = Object.entries(hours).sort((a, b) => b[1] - a[1])[0];
      if (peakHour && peakHour[1] >= 5) {
        patterns.push({
          type: 'peak_hour',
          description: `${author} é mais ativo às ${peakHour[0]}h`,
          confidence: 0.6,
          author,
          hour: parseInt(peakHour[0]),
          messageCount: peakHour[1]
        });
      }
    }

    return patterns;
  }

  _extractTopics(messages) {
    const topics = {};
    const keywords = ['financeiro', 'tarefa', 'projeto', 'cliente', 'lead', 'reunião', 'bug', 'deploy'];

    for (const m of messages) {
      const body = (m.body || '').toLowerCase();
      for (const kw of keywords) {
        if (body.includes(kw)) {
          topics[kw] = (topics[kw] || 0) + 1;
        }
      }
    }

    return topics;
  }

  /**
   * Detecta anomalias no comportamento atual
   */
  detectAnomalies() {
    const anomalies = [];
    const history = this.dataAPI.getWhatsAppHistory();
    const messages = history.messages || [];

    // Anomalia 1: Cliente sem resposta além do padrão
    const clients = ['paulo', 'juan'];
    for (const client of clients) {
      const clientMsgs = messages.filter(m => (m.body || '').toLowerCase().includes(client));
      if (clientMsgs.length > 0) {
        const lastMsg = clientMsgs[clientMsgs.length - 1];
        const daysSince = (Date.now() - new Date(lastMsg.timestamp).getTime()) / (24 * 60 * 60 * 1000);

        // Se passou mais de 5 dias desde última mensão do cliente
        if (daysSince > 5) {
          anomalies.push({
            type: 'silent_client',
            severity: daysSince > 10 ? 'high' : 'medium',
            description: `${client} sem menções há ${Math.floor(daysSince)} dias`,
            entity: client,
            daysSince: Math.floor(daysSince)
          });
        }
      }
    }

    // Anomalia 2: Tarefas P0/P1 sem movimento
    const tasks = this.dataAPI.queryTasks({});
    const staleTasks = tasks.filter(t => {
      if (t.priority !== 'P0' && t.priority !== 'P1') return false;
      const lastUpdate = t.updatedAt || t.createdAt || t.dueDate;
      if (!lastUpdate) return false;
      const daysStale = (Date.now() - new Date(lastUpdate).getTime()) / (24 * 60 * 60 * 1000);
      return daysStale > 3;
    });

    if (staleTasks.length > 0) {
      anomalies.push({
        type: 'stale_tasks',
        severity: 'high',
        description: `${staleTasks.length} tarefa(s) P0/P1 sem movimento há +3 dias`,
        count: staleTasks.length,
        tasks: staleTasks
      });
    }

    return anomalies;
  }
}

module.exports = { PatternDetector };
