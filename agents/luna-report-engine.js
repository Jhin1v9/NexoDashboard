/**
 * LUNA REPORT ENGINE v14.1 — Sistema de Relatórios Inteligentes
 * Baseado em melhores práticas de WhatsApp Business Analytics [^14^]
 * e AI Agent Monitoring [^5^][^6^]
 */

const fs = require('fs');
const path = require('path');

class LunaReportEngine {
    constructor(config = {}) {
        this.config = {
            maxMessageLength: 4000,
            reportInterval: 30, // minutos
            sentimentThreshold: 0.3,
            ...config
        };
    }

    /**
     * Gera relatório completo a partir do buffer
     */
    generateReport(buffer, checkpoint, options = {}) {
        const now = new Date();
        const periodStart = options.periodStart || new Date(now - 30 * 60 * 1000); // últimos 30 min

        const messages = buffer.messages || [];
        const tasks = buffer.tasks || [];
        const ideas = buffer.ideas || [];
        const decisions = buffer.decisions || [];
        const links = buffer.links || [];
        const mentions = buffer.mentions || [];
        const sentiment = buffer.sentiment || { positive: 0, negative: 0, urgent: 0 };

        // Categorizar tarefas por prioridade
        const tasksByPriority = this._categorizeTasks(tasks);

        // Analisar menções
        const mentionStats = this._analyzeMentions(mentions);

        // Gerar insights
        const insights = this._generateInsights(messages, tasks, sentiment);

        return {
            // Formato WhatsApp (texto formatado)
            whatsapp: this._formatWhatsApp({
                timestamp: now,
                periodStart,
                messageCount: messages.length,
                tasks: tasksByPriority,
                ideas: ideas.length,
                decisions: decisions.length,
                links: links.length,
                mentions: mentionStats,
                sentiment,
                insights
            }),

            // Formato Dashboard (JSON estruturado)
            dashboard: {
                id: `report-${Date.now()}`,
                timestamp: now.toISOString(),
                period: {
                    start: periodStart.toISOString(),
                    end: now.toISOString(),
                    duration: '30min'
                },
                summary: {
                    messagesProcessed: messages.length,
                    newTasks: tasks.length,
                    newIdeas: ideas.length,
                    newDecisions: decisions.length,
                    linksFound: links.length,
                    mentionsHandled: mentionStats.responded,
                    mentionsPending: mentionStats.pending
                },
                tasks: tasksByPriority,
                sentiment: {
                    ...sentiment,
                    dominant: this._getDominantSentiment(sentiment)
                },
                mentions: mentionStats,
                links: links.map(l => ({
                    url: l.url,
                    source: l.source,
                    timestamp: l.timestamp,
                    context: l.context || ''
                })),
                insights,
                nextScan: new Date(now + 10 * 60 * 1000).toISOString(),
                nextReport: new Date(now + 30 * 60 * 1000).toISOString()
            }
        };
    }

    /**
     * Formata relatório para WhatsApp
     */
    _formatWhatsApp(data) {
        const { timestamp, messageCount, tasks, ideas, decisions, links, mentions, sentiment, insights } = data;

        const lines = [
            `🌙 *LUNA REPORT INTELIGENTE*`,
            `📅 ${this._formatDate(timestamp)}`,
            ``,
            `*📊 RESUMO EXECUTIVO*`,
            `├─ 📨 Mensagens: ${messageCount}`,
            `├─ ✅ Tarefas: ${tasks.total} (${tasks.urgent} urgentes)`,
            `├─ 💡 Ideias: ${ideas}`,
            `├─ 📢 Menções: ${mentions.responded}/${mentions.total}`,
            `└─ 🔗 Links: ${links}`,
            ``,
            `*😊 SENTIMENTO*`,
            `├─ 😊 Positivo: ${sentiment.positive}`,
            `├─ 😟 Negativo: ${sentiment.negative}`,
            `└─ ⚡ Urgente: ${sentiment.urgent}`,
            ``,
        ];

        // Adicionar tarefas por prioridade
        if (tasks.total > 0) {
            lines.push(`*📋 TAREFAS*`);
            if (tasks.p0.length > 0) {
                lines.push(`🔴 *P0-Crítico:*`);
                tasks.p0.forEach(t => lines.push(`   • ${t.content.substring(0, 50)}${t.content.length > 50 ? '...' : ''}`));
            }
            if (tasks.p1.length > 0) {
                lines.push(`🟠 *P1-Alta:*`);
                tasks.p1.forEach(t => lines.push(`   • ${t.content.substring(0, 50)}${t.content.length > 50 ? '...' : ''}`));
            }
            if (tasks.p2.length > 0) {
                lines.push(`🟡 *P2-Média:*`);
                tasks.p2.forEach(t => lines.push(`   • ${t.content.substring(0, 50)}${t.content.length > 50 ? '...' : ''}`));
            }
            lines.push('');
        }

        // Adicionar menções
        if (mentions.total > 0) {
            lines.push(`*📢 MENÇÕES*`);
            lines.push(`├─ @KIMI: ${mentions.kimi || 0}`);
            lines.push(`├─ @LUNA: ${mentions.luna || 0}`);
            lines.push(`├─ @KIMICLAW: ${mentions.kimiclaw || 0}`);
            lines.push(`└─ @TODOS: ${mentions.todos || 0}`);
            lines.push('');
        }

        // Adicionar insights
        if (insights.length > 0) {
            lines.push(`*💡 INSIGHTS*`);
            insights.slice(0, 3).forEach(i => {
                lines.push(`• ${i.type === 'alert' ? '⚠️' : '💡'} ${i.message}`);
            });
            lines.push('');
        }

        // Footer
        lines.push(`⏭️ *Próximo scan:* ${this._formatTime(new Date(timestamp.getTime() + 10 * 60 * 1000))}`);
        lines.push(`📊 *Próximo relatório:* ${this._formatTime(new Date(timestamp.getTime() + 30 * 60 * 1000))}`);
        lines.push(`🤖 *Luna v14.1 | NEXO Digital*`);

        return lines.join('\n');
    }

    /**
     * Categoriza tarefas por prioridade
     */
    _categorizeTasks(tasks) {
        const p0 = tasks.filter(t => t.priority === 'P0' || t.urgent);
        const p1 = tasks.filter(t => t.priority === 'P1');
        const p2 = tasks.filter(t => t.priority === 'P2' || !t.priority);
        const p3 = tasks.filter(t => t.priority === 'P3');

        return {
            total: tasks.length,
            urgent: p0.length,
            p0,
            p1,
            p2,
            p3
        };
    }

    /**
     * Analisa menções
     */
    _analyzeMentions(mentions) {
        const stats = {
            total: mentions.length,
            responded: mentions.filter(m => m.responded).length,
            pending: mentions.filter(m => !m.responded).length,
            kimi: mentions.filter(m => m.mention === '@KIMI').length,
            luna: mentions.filter(m => m.mention === '@LUNA').length,
            kimiclaw: mentions.filter(m => m.mention === '@KIMICLAW').length,
            todos: mentions.filter(m => m.mention === '@TODOS').length
        };
        return stats;
    }

    /**
     * Gera insights automáticos
     */
    _generateInsights(messages, tasks, sentiment) {
        const insights = [];

        // Alerta de volume
        if (messages.length > 50) {
            insights.push({
                type: 'info',
                message: `Alto volume de mensagens: ${messages.length} em 30min`
            });
        }

        // Alerta de sentimento negativo
        if (sentiment.negative > sentiment.positive) {
            insights.push({
                type: 'alert',
                message: 'Sentimento predominante negativo — atenção necessária'
            });
        }

        // Alerta de tarefas urgentes
        const urgentTasks = tasks.filter(t => t.priority === 'P0' || t.urgent);
        if (urgentTasks.length > 0) {
            insights.push({
                type: 'alert',
                message: `${urgentTasks.length} tarefa(s) P0 requerem ação imediata`
            });
        }

        // Alerta de menções pendentes
        const pendingMentions = messages.filter(m => m.hasMention && !m.responded);
        if (pendingMentions.length > 0) {
            insights.push({
                type: 'alert',
                message: `${pendingMentions.length} menção(ões) aguardando resposta`
            });
        }

        return insights;
    }

    /**
     * Determina sentimento dominante
     */
    _getDominantSentiment(sentiment) {
        const { positive, negative, urgent } = sentiment;
        if (urgent > positive && urgent > negative) return 'urgente';
        if (negative > positive) return 'negativo';
        if (positive > negative) return 'positivo';
        return 'neutro';
    }

    /**
     * Formata data para WhatsApp
     */
    _formatDate(date) {
        return date.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * Formata hora
     */
    _formatTime(date) {
        return date.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

module.exports = LunaReportEngine;
