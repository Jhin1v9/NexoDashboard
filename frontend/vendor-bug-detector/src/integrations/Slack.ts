/**
 * Integração com Slack
 */

import type { BugReport, SlackConfig } from '../types';

/** Field do Slack attachment */
interface SlackField {
  title: string;
  value: string;
  short: boolean;
}

/** Action do Slack attachment */
interface SlackAction {
  type: string;
  text: string;
  url: string;
  style?: string;
}

/** Attachment do Slack */
interface SlackAttachment {
  color: string;
  fields: SlackField[];
  footer: string;
  ts: number;
  actions?: SlackAction[];
}

/** Payload do Slack webhook */
interface SlackPayload {
  text: string;
  channel?: string;
  attachments: SlackAttachment[];
}

export class SlackIntegration {
  private config: SlackConfig;

  constructor(config: SlackConfig) {
    this.config = config;
  }

  /** Envia notificação de bug */
  async notify(report: BugReport, channel?: string): Promise<void> {
    const payload = this.generatePayload(report, channel);

    const response = await fetch(this.config.webhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Erro ao enviar notificação: ${response.statusText}`);
    }
  }

  /** Envia notificação simples */
  async sendMessage(text: string, channel?: string): Promise<void> {
    const payload: { text: string; channel?: string } = { text };
    
    if (channel || this.config.channel) {
      payload.channel = channel || this.config.channel;
    }

    const response = await fetch(this.config.webhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Erro ao enviar mensagem: ${response.statusText}`);
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private generatePayload(report: BugReport, channel?: string): SlackPayload {
    const color = this.getSeverityColor(report.severity);
    const emoji = this.getTypeEmoji(report.type);

    const fields: SlackField[] = [
      {
        title: 'Descrição',
        value: report.description.slice(0, 300),
        short: false,
      },
      {
        title: 'Severidade',
        value: report.severity.toUpperCase(),
        short: true,
      },
      {
        title: 'Elemento',
        value: `\`${report.element.selector}\``,
        short: true,
      },
      {
        title: 'URL',
        value: report.url,
        short: false,
      },
    ];

    // Adiciona análise IA se disponível
    if (report.aiAnalysis) {
      fields.push({
        title: 'Causa Raiz (IA)',
        value: report.aiAnalysis.rootCause.slice(0, 300),
        short: false,
      });
    }

    // Adiciona screenshot se disponível
    if (report.screenshot) {
      fields.push({
        title: 'Screenshot',
        value: 'Disponível no relatório completo',
        short: false,
      });
    }

    const payload: SlackPayload = {
      text: `${emoji} Novo bug reportado`,
      attachments: [
        {
          color,
          fields,
          footer: 'BugDetector Pro',
          ts: Math.floor(new Date(report.timestamp).getTime() / 1000),
          actions: [
            {
              type: 'button',
              text: 'Ver Detalhes',
              url: report.url,
              style: 'primary',
            },
          ],
        },
      ],
    };

    if (channel || this.config.channel) {
      payload.channel = channel || this.config.channel;
    }

    return payload;
  }

  private getSeverityColor(severity: BugReport['severity']): string {
    const colors: Record<string, string> = {
      critical: '#dc2626',
      high: '#ea580c',
      medium: '#ca8a04',
      low: '#16a34a',
    };
    return colors[severity] || '#6b7280';
  }

  private getTypeEmoji(type: BugReport['type']): string {
    const emojis: Record<string, string> = {
      bug: '🐛',
      improvement: '💡',
      question: '❓',
    };
    return emojis[type] || '📝';
  }
}

export default SlackIntegration;
