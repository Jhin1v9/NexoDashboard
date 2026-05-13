/**
 * Gerador de Relatórios
 * Gera relatórios em Markdown, JSON, HTML e PDF
 */

import type { BugReport, ExportOptions, ExportResult, AIAnalysis } from '../types';

/** Classe ReportGenerator */
export class ReportGenerator {
  /** Exporta um report */
  static export(report: BugReport, options: ExportOptions): ExportResult {
    switch (options.format) {
      case 'markdown':
        return this.exportToMarkdown(report, options);
      case 'json':
        return this.exportToJSON(report, options);
      case 'html':
        return this.exportToHTML(report, options);
      default:
        throw new Error(`Formato não suportado: ${options.format}`);
    }
  }

  /** Exporta múltiplos reports */
  static exportAll(reports: BugReport[], options: ExportOptions): ExportResult {
    if (options.format === 'markdown') {
      return this.exportAllToMarkdown(reports);
    } else if (options.format === 'json') {
      return this.exportAllToJSON(reports);
    }
    throw new Error(`Formato não suportado para múltiplos reports: ${options.format}`);
  }

  // ============================================================================
  // MARKDOWN
  // ============================================================================

  private static exportToMarkdown(report: BugReport, options: ExportOptions): ExportResult {
    const md = this.generateMarkdown(report, options);
    
    return {
      content: md,
      filename: `bug-report-${this.formatDate(report.timestamp)}.md`,
      mimeType: 'text/markdown',
    };
  }

  private static generateMarkdown(report: BugReport, options: ExportOptions): string {
    const lines: string[] = [];

    // Header
    lines.push(`# 🐛 Bug Report: ${this.escapeMarkdown(report.description.slice(0, 50))}`);
    lines.push('');

    // Metadados
    lines.push('## 📋 Informações Gerais');
    lines.push('');
    lines.push(`| Campo | Valor |`);
    lines.push(`|-------|-------|`);
    lines.push(`| **ID** | \`${report.id}\` |`);
    lines.push(`| **Data** | ${new Date(report.timestamp).toLocaleString('pt-BR')} |`);
    lines.push(`| **Tipo** | ${report.type} |`);
    lines.push(`| **Severidade** | ${this.getSeverityEmoji(report.severity)} ${report.severity} |`);
    lines.push(`| **Status** | ${report.status} |`);
    lines.push(`| **URL** | ${report.url} |`);
    lines.push('');

    // Contexto
    lines.push('## 🖥️ Contexto');
    lines.push('');
    lines.push(`- **Browser**: ${report.userAgent}`);
    lines.push(`- **Viewport**: ${report.viewport.width}x${report.viewport.height}`);
    lines.push(`- **Título da página**: ${report.pageTitle}`);
    lines.push('');

    // Elemento
    lines.push('## 🎯 Elemento Afetado');
    lines.push('');
    lines.push(`| Campo | Valor |`);
    lines.push(`|-------|-------|`);
    lines.push(`| **Tag** | \`${report.element.tag}\` |`);
    lines.push(`| **ID** | ${report.element.elementId || 'N/A'} |`);
    lines.push(`| **Classes** | \`${report.element.className || 'N/A'}\` |`);
    lines.push(`| **Seletor CSS** | \`${report.element.selector}\` |`);
    lines.push(`| **XPath** | \`${report.element.xpath}\` |`);
    lines.push(`| **Dimensões** | ${Math.round(report.element.rect.width)}x${Math.round(report.element.rect.height)}px |`);
    lines.push(`| **Posição** | (${Math.round(report.element.rect.x)}, ${Math.round(report.element.rect.y)}) |`);
    lines.push('');

    // Hierarquia
    if (report.element.parentChain.length > 0) {
      lines.push('### 🌳 Hierarquia');
      lines.push('```');
      let indent = '';
      report.element.parentChain.slice().reverse().forEach(parent => {
        lines.push(`${indent}${parent.tag}${parent.id ? `#${parent.id}` : ''}${parent.className ? `.${parent.className.split(' ').join('.')}` : ''}`);
        indent += '  ';
      });
      lines.push(`${indent}← **ELEMENTO ATUAL**`);
      lines.push('```');
      lines.push('');
    }

    // Descrição
    lines.push('## 📝 Descrição do Problema');
    lines.push('');
    lines.push(report.description);
    lines.push('');

    if (report.expectedBehavior) {
      lines.push('## ✅ Comportamento Esperado');
      lines.push('');
      lines.push(report.expectedBehavior);
      lines.push('');
    }

    if (report.markdownReport) {
      lines.push('## Markdown corrigido pela IA');
      lines.push('');
      lines.push(report.markdownReport);
      lines.push('');
    }

    // Screenshot
    if (options.includeScreenshot && report.screenshot) {
      lines.push('## 📸 Screenshot');
      lines.push('');
      lines.push(`![Screenshot](${report.screenshot})`);
      lines.push('');
    }

    // Análise IA
    if (options.includeAIAnalysis && report.aiAnalysis) {
      lines.push('## 🧠 Análise com IA');
      lines.push('');
      lines.push(this.generateAIMarkdown(report.aiAnalysis));
      lines.push('');
    }

    // Logs
    if (report.consoleLogs && report.consoleLogs.length > 0) {
      lines.push('## 📋 Console Logs');
      lines.push('');
      lines.push('```');
      const emojiMap: Record<string, string> = { log: '📝', warn: '⚠️', error: '❌', info: 'ℹ️' };
      report.consoleLogs.forEach(log => {
        const emoji = emojiMap[log.type] ?? '📝';
        lines.push(`${emoji} [${new Date(log.timestamp).toLocaleTimeString()}] ${log.message}`);
      });
      lines.push('```');
      lines.push('');
    }

    // Network
    if (report.networkRequests && report.networkRequests.length > 0) {
      lines.push('## 🌐 Requisições de Rede');
      lines.push('');
      lines.push(`| Método | URL | Status | Duração |`);
      lines.push(`|--------|-----|--------|----------|`);
      report.networkRequests.forEach(req => {
        lines.push(`| ${req.method} | ${req.url.slice(0, 50)}... | ${req.status} | ${req.duration.toFixed(0)}ms |`);
      });
      lines.push('');
    }

    // Footer
    lines.push('---');
    lines.push('');
    lines.push('*Gerado por [BugDetector Pro](https://github.com/auris-team/bug-detector)*');

    return lines.join('\n');
  }

  private static generateAIMarkdown(analysis: AIAnalysis): string {
    const lines: string[] = [];
    const category = analysis.category ?? 'other';
    const severity = analysis.severity ?? 'medium';
    const confidence = analysis.confidence ?? 0;
    const rootCause = analysis.rootCause || 'Nao disponivel';

    lines.push(`**Categoria**: ${category}`);
    lines.push(`**Severidade**: ${severity}`);
    lines.push(`**Confiança**: ${analysis.confidence}%`);
    lines.push('');

    lines.push('### Causa Raiz');
    lines.push(rootCause);
    lines.push('');

    lines.push('### Descrição Técnica');
    lines.push(analysis.technicalDescription ?? 'Não disponível');
    lines.push('');

    if (analysis.codeFix) {
      lines.push('### 💻 Correção Sugerida');
      lines.push('');
      lines.push(`**${analysis.codeFix.linguagem}**`);
      lines.push('');
      lines.push('**Antes:**');
      lines.push(`\`\`\`${analysis.codeFix.linguagem}`);
      lines.push(analysis.codeFix.codigoAtual);
      lines.push('```');
      lines.push('');
      lines.push('**Depois:**');
      lines.push(`\`\`\`${analysis.codeFix.linguagem}`);
      lines.push(analysis.codeFix.codigoCorrigido);
      lines.push('```');
      lines.push('');
      lines.push(`**Explicação:** ${analysis.codeFix.explicacao}`);
      lines.push('');
    }

    lines.push('### Recomendações');
    analysis.recommendations?.forEach(rec => {
      lines.push(`- ${rec}`);
    });
    lines.push('');

    // Análises das personalidades
    lines.push('### Análises dos Especialistas');
    lines.push('');
    analysis.personalityAnalyses?.forEach(p => {
      lines.push(`#### ${p.icon} ${p.name} (${p.confidence}%)`);
      lines.push('');
      if (p.insights.length > 0) {
        lines.push('**Insights:**');
        p.insights.forEach(i => lines.push(`- ${i}`));
        lines.push('');
      }
      if (p.issues.length > 0) {
        lines.push('**Issues:**');
        p.issues.forEach(i => lines.push(`- ${i}`));
        lines.push('');
      }
    });

    return lines.join('\n');
  }

  private static exportAllToMarkdown(reports: BugReport[]): ExportResult {
    const lines: string[] = [];
    
    lines.push('# 📊 Relatório Consolidado de Bugs');
    lines.push('');
    lines.push(`**Total de bugs:** ${reports.length}`);
    lines.push(`**Gerado em:** ${new Date().toLocaleString('pt-BR')}`);
    lines.push('');

    // Resumo
    const bySeverity = this.groupBy(reports, 'severity');
    lines.push('## 📈 Resumo por Severidade');
    lines.push('');
    Object.entries(bySeverity).forEach(([severity, items]) => {
      lines.push(`- ${this.getSeverityEmoji(severity)} **${severity}**: ${items.length}`);
    });
    lines.push('');

    // Lista
    lines.push('## 📋 Lista de Bugs');
    lines.push('');
    reports.forEach((report, index) => {
      lines.push(`${index + 1}. [${report.severity.toUpperCase()}] ${report.description.slice(0, 60)}...`);
      lines.push(`   - ID: \`${report.id}\``);
      lines.push(`   - Data: ${new Date(report.timestamp).toLocaleDateString()}`);
      lines.push(`   - URL: ${report.url}`);
      lines.push('');
    });

    return {
      content: lines.join('\n'),
      filename: `bug-reports-summary-${this.formatDate(Date.now())}.md`,
      mimeType: 'text/markdown',
    };
  }

  // ============================================================================
  // JSON
  // ============================================================================

  private static exportToJSON(report: BugReport, options: ExportOptions): ExportResult {
    const data = this.sanitizeForJSON(report, options);
    
    return {
      content: JSON.stringify(data, null, 2),
      filename: `bug-report-${this.formatDate(report.timestamp)}.json`,
      mimeType: 'application/json',
    };
  }

  private static exportAllToJSON(reports: BugReport[]): ExportResult {
    return {
      content: JSON.stringify(reports.map(r => this.sanitizeForJSON(r, { format: 'json' })), null, 2),
      filename: `bug-reports-${this.formatDate(Date.now())}.json`,
      mimeType: 'application/json',
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static sanitizeForJSON(report: BugReport, options: ExportOptions): Record<string, unknown> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { domElement, ...elementWithoutDom } = report.element as Record<string, any>;
    
    const data: Record<string, unknown> = {
      ...report,
      element: elementWithoutDom,
    };

    if (!options.includeScreenshot) {
      delete data.screenshot;
    }

    if (!options.includeAIAnalysis) {
      delete data.aiAnalysis;
    }

    return data;
  }

  // ============================================================================
  // HTML
  // ============================================================================

  private static exportToHTML(report: BugReport, options: ExportOptions): ExportResult {
    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bug Report - ${report.id}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
    h1 { color: #1f2937; }
    h2 { color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0; }
    th, td { border: 1px solid #e5e7eb; padding: 8px 12px; text-align: left; }
    th { background: #f9fafb; font-weight: 600; }
    code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
    pre { background: #1f2937; color: #f9fafb; padding: 16px; border-radius: 8px; overflow-x: auto; }
    .severity-critical { color: #dc2626; }
    .severity-high { color: #ea580c; }
    .severity-medium { color: #ca8a04; }
    .severity-low { color: #16a34a; }
  </style>
</head>
<body>
  ${this.markdownToHTML(this.generateMarkdown(report, options))}
</body>
</html>`;

    return {
      content: html,
      filename: `bug-report-${this.formatDate(report.timestamp)}.html`,
      mimeType: 'text/html',
    };
  }

  private static markdownToHTML(md: string): string {
    // Conversão básica Markdown → HTML
    return md
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/\*\*(.*)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*)\*/g, '<em>$1</em>')
      .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  // ============================================================================
  // UTILS
  // ============================================================================

  private static formatDate(timestamp: string | number): string {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private static escapeMarkdown(text: string): string {
    return text.replace(/[<>*_`\[\]]/g, '\\$&');
  }

  private static getSeverityEmoji(severity: string): string {
    const emojis: Record<string, string> = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢',
    };
    return emojis[severity.toLowerCase()] || '⚪';
  }

  private static groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce((acc, item) => {
      const group = String(item[key]);
      acc[group] = acc[group] || [];
      acc[group].push(item);
      return acc;
    }, {} as Record<string, T[]>);
  }

  /** Download do arquivo */
  static download(result: ExportResult): void {
    const blob = new Blob([result.content], { type: result.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export default ReportGenerator;
