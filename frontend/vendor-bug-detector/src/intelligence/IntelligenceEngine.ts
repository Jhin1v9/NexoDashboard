/**
 * Motor de Inteligência Artificial
 * Integração com Gemini/OpenAI para análise de bugs
 */

import type { 
  BugReport, 
  AIAnalysis, 
  AIConfig, 
  AIEnhancedReport,
  PersonalityAnalysis, 
  PersonalityType,
} from '../types';

import { RateLimiter } from '../utils/RateLimiter';

const BRAIN_REWRITE_CONTEXT = `
Sistema .BRAIN ativo para reescrita de reports:
- Testing Engineer: transformar relato bruto em bug report reproduzível, com comportamento atual, esperado, evidências e risco.
- TypeScript Master: destacar contratos, null safety, tipos, estados e possíveis pontos de runtime quando houver indício técnico.
- UI/UX Engineer: explicar impacto visual/interativo, acessibilidade, feedback ao usuário e consistência da interface.
- DX Engineer: entregar instruções claras para o desenvolvedor corrigir sem ambiguidade.
Prioridade: clareza, precisão técnica, Markdown limpo e ação concreta.
`;

/** Resposta do chat */
interface ChatResponse {
  content: string;
  type: 'text' | 'code' | 'analysis';
  metadata?: {
    analysis?: PersonalityAnalysis;
    processing?: boolean;
  };
}

/** Classe IntelligenceEngine */
export class IntelligenceEngine {
  private config: Required<AIConfig>;
  private isProcessing = false;
  private rateLimiter: RateLimiter;

  constructor(config: Required<AIConfig>) {
    this.config = config;
    // Rate limiting: máximo 10 requisições por minuto
    this.rateLimiter = new RateLimiter({
      maxRequests: 10,
      windowMs: 60 * 1000, // 1 minuto
    });
  }

  /** Analisa um report completo com rate limiting */
  async analyze(report: BugReport): Promise<AIAnalysis> {
    if (this.config.provider === 'none') {
      throw new Error('Provedor de IA não configurado');
    }

    // Aguarda slot disponível (rate limiting)
    await this.rateLimiter.waitForSlot();

    this.isProcessing = true;

    try {
      // Análises das 8 personalidades
      const personalities: PersonalityType[] = [
        'architect', 'uiux', 'performance', 'typescript', 
        'react', 'css', 'testing', 'dx'
      ];

      // Executa análises sequencialmente para respeitar rate limits
      const analysesResults: (PersonalityAnalysis | null)[] = [];
      for (const personality of personalities) {
        try {
          const result = await this.analyzeWithPersonality(report, personality);
          analysesResults.push(result);
        } catch (error) {
          console.error(`Erro na análise ${personality}:`, error);
          analysesResults.push(this.createFallbackAnalysis(personality, ''));
        }
      }
      
      const analyses = analysesResults.filter((a): a is PersonalityAnalysis => a !== null);

      // Consolida resultado
      const consolidated = await this.consolidateAnalyses(report, analyses);

      return consolidated;
    } finally {
      this.isProcessing = false;
    }
  }

  /** Chat interativo */
  async chat(message: string, report: BugReport): Promise<ChatResponse> {
    if (this.config.provider === 'none') {
      return {
        content: 'Análise de IA não configurada. Configure uma API key para usar esta funcionalidade.',
        type: 'text',
      };
    }

    const prompt = this.buildChatPrompt(message, report);
    const response = await this.callAI(prompt);

    return {
      content: response,
      type: 'text',
    };
  }

  /** Reescreve o comentário bruto e devolve Markdown técnico corrigido */
  async enhanceReportComment(context: {
    description: string;
    expectedBehavior?: string;
    element: {
      tag: string;
      selector: string;
      xpath: string;
      className: string;
      computedStyles: Record<string, string>;
    };
    pageUrl: string;
    pageTitle: string;
    screenshotBase64?: string;
  }): Promise<AIEnhancedReport> {
    if (this.config.provider === 'none') {
      throw new Error('Provedor de IA não configurado');
    }

    await this.rateLimiter.waitForSlot();
    const prompt = this.buildEnhanceReportPrompt(context);
    const response = await this.callAI(prompt);
    return this.parseEnhancedReport(response, context);
  }

  /** Verifica se está processando */
  isAnalyzing(): boolean {
    return this.isProcessing;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async analyzeWithPersonality(
    report: BugReport, 
    personality: PersonalityType
  ): Promise<PersonalityAnalysis> {
    const prompt = this.buildPersonalityPrompt(report, personality);
    const response = await this.callAI(prompt);

    try {
      return JSON.parse(response);
    } catch {
      // Fallback se não retornar JSON válido
      return this.createFallbackAnalysis(personality, response);
    }
  }

  private async consolidateAnalyses(
    report: BugReport,
    analyses: PersonalityAnalysis[]
  ): Promise<AIAnalysis> {
    const prompt = this.buildConsolidationPrompt(report, analyses);
    const response = await this.callAI(prompt);

    try {
      const parsed = JSON.parse(response) as Partial<AIAnalysis>;
      if (!parsed.rootCause || !parsed.severity || typeof parsed.confidence !== 'number') {
        return this.createFallbackConsolidation(report, analyses);
      }

      return {
        provider: this.config.provider === 'none' ? 'gemini' : this.config.provider,
        severity: parsed.severity,
        rootCause: parsed.rootCause,
        category: parsed.category,
        technicalDescription: parsed.technicalDescription,
        analysis: parsed.analysis,
        solution: parsed.solution,
        promptDev: parsed.promptDev,
        recommendations: parsed.recommendations ?? [],
        codeFix: parsed.codeFix,
        personalityAnalyses: parsed.personalityAnalyses ?? analyses,
        confidence: parsed.confidence,
        processingTime: parsed.processingTime,
        generatedAt: parsed.generatedAt ?? new Date().toISOString(),
      };
    } catch {
      // Fallback
      return this.createFallbackConsolidation(report, analyses);
    }
  }

  private async callAI(prompt: string): Promise<string> {
    if (this.config.provider === 'gemini') {
      return this.callGemini(prompt);
    } else if (this.config.provider === 'openai') {
      return this.callOpenAI(prompt);
    } else if (this.config.provider === 'deepseek') {
      return this.callDeepSeek(prompt);
    } else if (this.config.provider === 'kimi') {
      return this.callKimi(prompt);
    }
    throw new Error('Provedor não suportado');
  }

  private async callGemini(prompt: string): Promise<string> {
    // Registra requisição para rate limiting
    this.rateLimiter.recordRequest();
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${this.config.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }],
          }],
          generationConfig: {
            temperature: this.config.temperature,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Erro na API Gemini: ${await this.readAPIError(response)}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  private async callOpenAI(prompt: string): Promise<string> {
    // Registra requisição para rate limiting
    this.rateLimiter.recordRequest();
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: this.config.temperature,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      throw new Error(`Erro na API OpenAI: ${await this.readAPIError(response)}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  private async callDeepSeek(prompt: string): Promise<string> {
    this.rateLimiter.recordRequest();
    
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: this.config.temperature,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      throw new Error(`Erro na API DeepSeek: ${await this.readAPIError(response)}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  private async callKimi(prompt: string): Promise<string> {
    this.rateLimiter.recordRequest();
    const baseURL = (this.config.baseURL || 'https://api.kimi.com/coding/v1').replace(/\/$/, '');
    
    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: this.config.temperature,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      throw new Error(`Erro na API Kimi: ${await this.readAPIError(response)}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  private async readAPIError(response: Response): Promise<string> {
    try {
      const data = await response.clone().json() as { error?: { message?: string }; message?: string };
      return data.error?.message || data.message || response.statusText || `HTTP ${response.status}`;
    } catch {
      try {
        const text = await response.clone().text();
        return text || response.statusText || `HTTP ${response.status}`;
      } catch {
        return response.statusText || `HTTP ${response.status}`;
      }
    }
  }

  // ============================================================================
  // PROMPTS
  // ============================================================================

  private buildPersonalityPrompt(report: BugReport, personality: PersonalityType): string {
    const personalityPrompts: Record<PersonalityType, string> = {
      architect: `Você é um Arquiteto de Software sênior. Analise o seguinte bug do ponto de vista arquitetural:
- Estrutura do código
- Design patterns
- Separation of concerns
- Acoplamento e coesão

Retorne um JSON com:
{
  "personality": "architect",
  "name": "Arquiteto",
  "icon": "🏗️",
  "color": "#3B82F6",
  "insights": ["insight 1", "insight 2"],
  "issues": ["problema 1", "problema 2"],
  "recommendations": ["recomendação 1", "recomendação 2"],
  "confidence": 85
}`,

      uiux: `Você é um especialista em UI/UX. Analise o bug do ponto de vista de experiência do usuário:
- Acessibilidade (a11y)
- Design e consistência visual
- Feedback ao usuário
- Interações e micro-interações

Retorne um JSON similar ao anterior com personality: "uiux", name: "UI/UX Expert", icon: "🎨"`,

      performance: `Você é um Engenheiro de Performance. Analise o bug considerando:
- Renderização e repaint
- Memory leaks
- Bundle size
- Lazy loading oportunidades

Retorne JSON com personality: "performance", name: "Performance Engineer", icon: "⚡"`,

      typescript: `Você é um mestre em TypeScript. Analise:
- Type safety
- Uso de any
- Generics e inferência
- Interfaces e tipos

Retorne JSON com personality: "typescript", name: "TypeScript Master", icon: "📘"`,

      react: `Você é especialista em React. Analise:
- Hooks e lifecycle
- State management
- Re-renders desnecessários
- Patterns e anti-patterns

Retorne JSON com personality: "react", name: "React Specialist", icon: "⚛️"`,

      css: `Você é expert em CSS/Tailwind. Analise:
- Especificidade CSS
- Responsividade
- Tailwind best practices
- Performance de estilos

Retorne JSON com personality: "css", name: "CSS/Tailwind Expert", icon: "🎨"`,

      testing: `Você é engenheiro de QA. Analise:
- Testability do código
- Edge cases
- Cobertura de testes
- Estratégia de testing

Retorne JSON com personality: "testing", name: "Testing Engineer", icon: "🧪"`,

      dx: `Você foca em Developer Experience. Analise:
- Documentação
- Legibilidade
- Tooling
- Onboarding

Retorne JSON com personality: "dx", name: "DX Engineer", icon: "🛠️"`,
    };

    return `${personalityPrompts[personality]}

BUG REPORT:
- Descrição: ${report.description}
- Elemento: ${report.element.tag} (${report.element.selector})
- Tipo: ${report.type}
- Severidade: ${report.severity}
- URL: ${report.url}

Contexto adicional:
- Classes: ${report.element.className}
- Estilos computados: ${JSON.stringify(report.element.computedStyles, null, 2)}`;
  }

  private buildConsolidationPrompt(_report: BugReport, analyses: PersonalityAnalysis[]): string {
    return `Consolide as seguintes análises de especialistas em um diagnóstico único:

ANÁLISES:
${JSON.stringify(analyses, null, 2)}

Retorne um JSON com:
{
  "category": "ui_visual" | "functional" | "performance" | "accessibility" | "type_error" | "logic_error" | "state_management" | "api_integration",
  "severity": "low" | "medium" | "high" | "critical",
  "rootCause": "causa raiz em 1-2 frases",
  "technicalDescription": "descrição técnica detalhada",
  "recommendations": ["rec 1", "rec 2", "rec 3"],
  "codeFix": {
    "linguagem": "typescript",
    "codigoAtual": "código problemático",
    "codigoCorrigido": "código corrigido",
    "explicacao": "explicação da correção"
  },
  "confidence": 85
}`;
  }

  private buildChatPrompt(message: string, report: BugReport): string {
    return `Você é um assistente de debug. O usuário está reportando um bug:

BUG:
- Descrição: ${report.description}
- Elemento: ${report.element.tag}
- URL: ${report.url}

MENSAGEM DO USUÁRIO:
${message}

Responda de forma concisa e técnica, ajudando a identificar e corrigir o problema.`;
  }

  private buildEnhanceReportPrompt(context: {
    description: string;
    expectedBehavior?: string;
    element: {
      tag: string;
      selector: string;
      xpath: string;
      className: string;
      computedStyles: Record<string, string>;
    };
    pageUrl: string;
    pageTitle: string;
    screenshotBase64?: string;
  }): string {
    return `Você é a IA interna do BugDetector Pro, usando o sistema .BRAIN como guia de raciocínio.

${BRAIN_REWRITE_CONTEXT}

Tarefa: reescrever o comentário bruto do usuário e devolver um report técnico corrigido em português do Brasil.

Retorne APENAS um JSON válido neste formato:
{
  "title": "título curto e técnico",
  "description": "descrição reescrita, objetiva e detalhada",
  "severity": "low" | "medium" | "high" | "critical",
  "markdown": "relatório completo em Markdown"
}

O Markdown deve incluir:
- título
- resumo
- passos ou contexto para reproduzir
- comportamento atual
- comportamento esperado
- localização exata: URL, página, tag, seletor CSS e XPath
- estilos computados relevantes em tabela
- hipótese técnica
- instruções objetivas para o desenvolvedor corrigir

CONTEXTO:
URL: ${context.pageUrl}
Página: ${context.pageTitle}
Elemento: <${context.element.tag}>
Seletor CSS: ${context.element.selector}
XPath: ${context.element.xpath}
Classes: ${context.element.className || '(sem classes)'}
Comentário original: ${context.description}
Comportamento esperado informado: ${context.expectedBehavior || '(não informado)'}
Screenshot anexado: ${context.screenshotBase64 ? 'sim' : 'não'}
Estilos computados:
${JSON.stringify(context.element.computedStyles, null, 2)}`;
  }

  // ============================================================================
  // FALLBACKS
  // ============================================================================

  private parseEnhancedReport(rawResponse: string, context: {
    description: string;
    expectedBehavior?: string;
    element: { tag: string; selector: string; xpath: string; className: string; computedStyles: Record<string, string> };
    pageUrl: string;
    pageTitle: string;
  }): AIEnhancedReport {
    try {
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawResponse) as Partial<AIEnhancedReport>;
      const severity = ['low', 'medium', 'high', 'critical'].includes(String(parsed.severity))
        ? parsed.severity as AIEnhancedReport['severity']
        : 'medium';

      return {
        title: String(parsed.title || 'Bug reportado'),
        description: String(parsed.description || context.description),
        severity,
        markdown: String(parsed.markdown || this.createEnhancedMarkdownFallback(context, String(parsed.description || context.description), severity)),
      };
    } catch {
      return {
        title: 'Bug reportado',
        description: rawResponse || context.description,
        severity: 'medium',
        markdown: this.createEnhancedMarkdownFallback(context, rawResponse || context.description, 'medium'),
      };
    }
  }

  private createEnhancedMarkdownFallback(
    context: {
      description: string;
      expectedBehavior?: string;
      element: { tag: string; selector: string; xpath: string; className: string; computedStyles: Record<string, string> };
      pageUrl: string;
      pageTitle: string;
    },
    description: string,
    severity: AIEnhancedReport['severity']
  ): string {
    const styles = Object.entries(context.element.computedStyles)
      .map(([key, value]) => `| ${key} | ${value || 'n/a'} |`)
      .join('\n');

    return `# Bug reportado

## Resumo
${description}

## Severidade
${severity}

## Comportamento esperado
${context.expectedBehavior || 'Não informado.'}

## Localização
| Campo | Valor |
| --- | --- |
| URL | ${context.pageUrl} |
| Página | ${context.pageTitle} |
| Elemento | <${context.element.tag}> |
| Seletor CSS | \`${context.element.selector}\` |
| XPath | \`${context.element.xpath}\` |
| Classes | ${context.element.className || 'n/a'} |

## Estilos computados
| Propriedade | Valor |
| --- | --- |
${styles}

## Orientação para correção
Validar o componente no seletor informado, reproduzir o comportamento descrito e ajustar a implementação preservando o comportamento esperado.`;
  }

  private createFallbackAnalysis(personality: PersonalityType, _rawResponse: string): PersonalityAnalysis {
    const defaults: Record<PersonalityType, PersonalityAnalysis> = {
      architect: {
        personality: 'architect',
        name: 'Arquiteto',
        icon: '🏗️',
        color: '#3B82F6',
        insights: ['Análise estrutural do componente'],
        issues: ['Verificar estrutura do código'],
        recommendations: ['Revisar padrões arquiteturais'],
        confidence: 50,
      },
      uiux: {
        personality: 'uiux',
        name: 'UI/UX Expert',
        icon: '🎨',
        color: '#EC4899',
        insights: ['Análise de experiência do usuário'],
        issues: ['Verificar acessibilidade'],
        recommendations: ['Melhorar feedback visual'],
        confidence: 50,
      },
      performance: {
        personality: 'performance',
        name: 'Performance Engineer',
        icon: '⚡',
        color: '#F59E0B',
        insights: ['Análise de performance'],
        issues: ['Verificar otimizações'],
        recommendations: ['Otimizar renderização'],
        confidence: 50,
      },
      typescript: {
        personality: 'typescript',
        name: 'TypeScript Master',
        icon: '📘',
        color: '#3178C6',
        insights: ['Análise de tipagem'],
        issues: ['Verificar type safety'],
        recommendations: ['Melhorar tipagem'],
        confidence: 50,
      },
      react: {
        personality: 'react',
        name: 'React Specialist',
        icon: '⚛️',
        color: '#61DAFB',
        insights: ['Análise de React patterns'],
        issues: ['Verificar hooks'],
        recommendations: ['Otimizar componentes'],
        confidence: 50,
      },
      css: {
        personality: 'css',
        name: 'CSS/Tailwind Expert',
        icon: '🎨',
        color: '#06B6D4',
        insights: ['Análise de estilos'],
        issues: ['Verificar CSS'],
        recommendations: ['Otimizar estilos'],
        confidence: 50,
      },
      testing: {
        personality: 'testing',
        name: 'Testing Engineer',
        icon: '🧪',
        color: '#10B981',
        insights: ['Análise de testes'],
        issues: ['Verificar cobertura'],
        recommendations: ['Adicionar testes'],
        confidence: 50,
      },
      dx: {
        personality: 'dx',
        name: 'DX Engineer',
        icon: '🛠️',
        color: '#8B5CF6',
        insights: ['Análise de DX'],
        issues: ['Verificar documentação'],
        recommendations: ['Melhorar docs'],
        confidence: 50,
      },
    };

    return defaults[personality];
  }

  private createFallbackConsolidation(report: BugReport, analyses: PersonalityAnalysis[]): AIAnalysis {
    return {
      provider: 'gemini',
      category: 'other',
      severity: report.severity,
      rootCause: 'Não foi possível determinar a causa raiz automaticamente',
      technicalDescription: report.description,
      recommendations: analyses.flatMap(a => a.recommendations).slice(0, 5),
      personalityAnalyses: analyses,
      confidence: 30,
      processingTime: 0,
      generatedAt: new Date().toISOString(),
    };
  }
}

export default IntelligenceEngine;
