/**
 * Integração com Jira
 */

import type { BugReport, JiraConfig } from '../types';

/** Content do Jira ADF (Atlassian Document Format) */
interface JiraADFContent {
  type: string;
  text?: string;
  content?: JiraADFContent[];
}

/** Description do Jira ADF */
interface JiraADFDescription {
  type: 'doc';
  version: 1;
  content: JiraADFContent[];
}

/** Body para atualização de ticket */
interface JiraUpdateBody {
  fields: {
    summary?: string;
    description?: JiraADFDescription;
  };
}

export class JiraIntegration {
  private config: JiraConfig;

  constructor(config: JiraConfig) {
    this.config = config;
  }

  /** Cria um ticket no Jira */
  async createTicket(report: BugReport): Promise<{ key: string; url: string }> {
    const description = this.generateDescription(report);
    const summary = this.generateSummary(report);

    const response = await fetch(
      `${this.config.host}/rest/api/3/issue`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${this.getAuthToken()}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            project: {
              key: this.config.project,
            },
            summary,
            description: {
              type: 'doc',
              version: 1,
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: description,
                    },
                  ],
                },
              ],
            },
            issuetype: {
              name: 'Bug',
            },
            priority: {
              name: this.mapSeverityToPriority(report.severity),
            },
            labels: ['bug-detector'],
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Erro ao criar ticket: ${error.errorMessages?.join(', ')}`);
    }

    const data = await response.json();
    return {
      key: data.key,
      url: `${this.config.host}/browse/${data.key}`,
    };
  }

  /** Atualiza um ticket */
  async updateTicket(
    issueKey: string,
    updates: { summary?: string; description?: string; status?: string }
  ): Promise<void> {
    const body: JiraUpdateBody = { fields: {} };

    if (updates.summary) {
      body.fields.summary = updates.summary;
    }

    if (updates.description) {
      body.fields.description = {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: updates.description },
            ],
          },
        ],
      };
    }

    const response = await fetch(
      `${this.config.host}/rest/api/3/issue/${issueKey}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${this.getAuthToken()}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Erro ao atualizar ticket: ${error.errorMessages?.join(', ')}`);
    }
  }

  /** Adiciona comentário */
  async addComment(issueKey: string, comment: string): Promise<void> {
    const response = await fetch(
      `${this.config.host}/rest/api/3/issue/${issueKey}/comment`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${this.getAuthToken()}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          body: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [
                  { type: 'text', text: comment },
                ],
              },
            ],
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Erro ao adicionar comentário: ${error.errorMessages?.join(', ')}`);
    }
  }

  /** Anexa screenshot */
  async attachScreenshot(issueKey: string, screenshot: string, filename: string): Promise<void> {
    // Converte base64 para blob
    const response = await fetch(screenshot);
    const blob = await response.blob();

    const formData = new FormData();
    formData.append('file', blob, filename);

    const uploadResponse = await fetch(
      `${this.config.host}/rest/api/3/issue/${issueKey}/attachments`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${this.getAuthToken()}`,
          'X-Atlassian-Token': 'no-check',
        },
        body: formData,
      }
    );

    if (!uploadResponse.ok) {
      const error = await uploadResponse.json();
      throw new Error(`Erro ao anexar screenshot: ${error.errorMessages?.join(', ')}`);
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private getAuthToken(): string {
    return btoa(`${this.config.email}:${this.config.token}`);
  }

  private generateSummary(report: BugReport): string {
    const prefix = report.type === 'bug' ? '[BUG]' : report.type === 'improvement' ? '[IMPROVEMENT]' : '[QUESTION]';
    const maxLength = 100;
    let summary = `${prefix} ${report.description}`;
    
    if (summary.length > maxLength) {
      summary = summary.slice(0, maxLength - 3) + '...';
    }

    return summary;
  }

  private generateDescription(report: BugReport): string {
    const lines: string[] = [];

    lines.push('h2. Descrição');
    lines.push(report.description);
    lines.push('');

    if (report.expectedBehavior) {
      lines.push('h2. Comportamento Esperado');
      lines.push(report.expectedBehavior);
      lines.push('');
    }

    lines.push('h2. Informações Técnicas');
    lines.push(`*URL:* ${report.url}`);
    lines.push(`*Elemento:* ${report.element.selector}`);
    lines.push(`*Severidade:* ${report.severity}`);
    lines.push(`*Tipo:* ${report.type}`);
    lines.push(`*Data:* ${new Date(report.timestamp).toLocaleString()}`);
    lines.push('');

    if (report.aiAnalysis) {
      lines.push('h2. Análise com IA');
      lines.push(`*Categoria:* ${report.aiAnalysis.category}`);
      lines.push(`*Causa Raiz:* ${report.aiAnalysis.rootCause}`);
      lines.push('');
      lines.push('*Recomendações:*');
      report.aiAnalysis.recommendations?.forEach(rec => {
        lines.push(`- ${rec}`);
      });
      lines.push('');
    }

    lines.push('----');
    lines.push('Reportado via BugDetector Pro');

    return lines.join('\n');
  }

  private mapSeverityToPriority(severity: BugReport['severity']): string {
    const mapping: Record<string, string> = {
      critical: 'Highest',
      high: 'High',
      medium: 'Medium',
      low: 'Low',
    };
    return mapping[severity] || 'Medium';
  }
}

export default JiraIntegration;
