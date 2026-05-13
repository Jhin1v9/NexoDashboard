/**
 * Integração com GitHub Issues
 */

import type { BugReport, GitHubConfig } from '../types';

/** Item de issue do GitHub */
interface GitHubIssueItem {
  number: number;
  title: string;
  state: string;
}

/** Resposta da pesquisa do GitHub */
interface GitHubSearchResponse {
  items: GitHubIssueItem[];
}

export class GitHubIntegration {
  private config: GitHubConfig;

  constructor(config: GitHubConfig) {
    this.config = config;
  }

  /** Cria uma issue no GitHub */
  async createIssue(report: BugReport): Promise<{ number: number; url: string }> {
    const title = this.generateIssueTitle(report);
    const body = this.generateIssueBody(report);

    const response = await fetch(
      `https://api.github.com/repos/${this.config.repo}/issues`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          body,
          labels: this.config.labels || ['bug', 'bug-detector'],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Erro ao criar issue: ${error.message}`);
    }

    const data = await response.json();
    return {
      number: data.number,
      url: data.html_url,
    };
  }

  /** Atualiza uma issue existente */
  async updateIssue(
    issueNumber: number, 
    updates: { title?: string; body?: string; state?: 'open' | 'closed' }
  ): Promise<void> {
    const response = await fetch(
      `https://api.github.com/repos/${this.config.repo}/issues/${issueNumber}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Erro ao atualizar issue: ${error.message}`);
    }
  }

  /** Adiciona comentário a uma issue */
  async addComment(issueNumber: number, comment: string): Promise<void> {
    const response = await fetch(
      `https://api.github.com/repos/${this.config.repo}/issues/${issueNumber}/comments`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body: comment }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Erro ao adicionar comentário: ${error.message}`);
    }
  }

  /** Obtém status de uma issue */
  async getIssueStatus(issueNumber: number): Promise<{ state: string; url: string }> {
    const response = await fetch(
      `https://api.github.com/repos/${this.config.repo}/issues/${issueNumber}`,
      {
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Erro ao buscar issue: ${error.message}`);
    }

    const data = await response.json();
    return {
      state: data.state,
      url: data.html_url,
    };
  }

  /** Busca issues existentes */
  async searchIssues(query: string): Promise<Array<{ number: number; title: string; state: string }>> {
    const response = await fetch(
      `https://api.github.com/search/issues?q=${encodeURIComponent(query)}+repo:${this.config.repo}`,
      {
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Erro ao buscar issues: ${error.message}`);
    }

    const data = (await response.json()) as GitHubSearchResponse;
    return data.items.map((item) => ({
      number: item.number,
      title: item.title,
      state: item.state,
    }));
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private generateIssueTitle(report: BugReport): string {
    const prefix = report.type === 'bug' ? '🐛' : report.type === 'improvement' ? '💡' : '❓';
    const maxLength = 80;
    let title = `${prefix} ${report.description}`;
    
    if (title.length > maxLength) {
      title = title.slice(0, maxLength - 3) + '...';
    }

    return title;
  }

  private generateIssueBody(report: BugReport): string {
    const lines: string[] = [];

    lines.push('## 📝 Descrição');
    lines.push(report.description);
    lines.push('');

    if (report.expectedBehavior) {
      lines.push('## ✅ Comportamento Esperado');
      lines.push(report.expectedBehavior);
      lines.push('');
    }

    lines.push('## 📋 Informações');
    lines.push('');
    lines.push(`| Campo | Valor |`);
    lines.push(`|-------|-------|`);
    lines.push(`| **URL** | ${report.url} |`);
    lines.push(`| **Elemento** | \`${report.element.selector}\` |`);
    lines.push(`| **Severidade** | ${report.severity} |`);
    lines.push(`| **Tipo** | ${report.type} |`);
    lines.push(`| **Data** | ${new Date(report.timestamp).toLocaleString()} |`);
    lines.push('');

    if (report.aiAnalysis) {
      lines.push('## 🧠 Análise com IA');
      lines.push('');
      lines.push(`**Categoria:** ${report.aiAnalysis.category}`);
      lines.push(`**Causa Raiz:** ${report.aiAnalysis.rootCause}`);
      lines.push('');
      lines.push('### Recomendações');
      report.aiAnalysis.recommendations?.forEach(rec => {
        lines.push(`- ${rec}`);
      });
      lines.push('');
    }

    if (report.screenshot) {
      lines.push('## 📸 Screenshot');
      lines.push(`![Screenshot](${report.screenshot})`);
      lines.push('');
    }

    lines.push('---');
    lines.push('*Reportado via [BugDetector Pro](https://github.com/auris-team/bug-detector)*');

    return lines.join('\n');
  }
}

export default GitHubIntegration;
