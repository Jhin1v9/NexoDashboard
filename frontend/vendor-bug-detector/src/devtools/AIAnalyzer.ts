/**
 * AIAnalyzer - Análise de bugs com IA (Gemini/DeepSeek)
 */

import type { AIAnalysis, BugReport, InspectedElement, ConsoleLog, NetworkRequest } from '../types';

/** Configuração do AIAnalyzer */
interface AIAnalyzerConfig {
  apiKey: string;
  provider: 'gemini' | 'deepseek' | 'openai' | 'kimi';
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/** Dados para análise */
interface AnalysisData {
  element: InspectedElement;
  description: string;
  expectedBehavior?: string;
  consoleLogs?: ConsoleLog[];
  networkRequests?: NetworkRequest[];
  screenshot?: string;
}

/** Classe para análise de bugs com IA */
export class AIAnalyzer {
  private config: AIAnalyzerConfig;

  constructor(config: AIAnalyzerConfig) {
    this.config = {
      model: config.model ?? this.getDefaultModel(config.provider),
      temperature: config.temperature ?? 0.2,
      maxTokens: config.maxTokens ?? 2048,
      ...config,
    };
  }

  /** Analisa um bug */
  async analyze(data: AnalysisData): Promise<AIAnalysis> {
    const prompt = this.buildPrompt(data);

    switch (this.config.provider) {
      case 'gemini':
        return this.analyzeWithGemini(prompt, data);
      case 'deepseek':
        return this.analyzeWithDeepSeek(prompt, data);
      case 'openai':
        return this.analyzeWithOpenAI(prompt, data);
      case 'kimi':
        return this.analyzeWithKimi(prompt, data);
      default:
        throw new Error(`Provider não suportado: ${this.config.provider}`);
    }
  }

  /** Analisa com Gemini */
  private async analyzeWithGemini(prompt: string, data: AnalysisData): Promise<AIAnalysis> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${this.config.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: this.config.temperature,
            maxOutputTokens: this.config.maxTokens,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    return this.parseResponse(text, 'gemini');
  }

  /** Analisa com DeepSeek */
  private async analyzeWithDeepSeek(prompt: string, data: AnalysisData): Promise<AIAnalysis> {
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
        max_tokens: this.config.maxTokens,
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content ?? '';

    return this.parseResponse(text, 'deepseek');
  }

  /** Analisa com OpenAI */
  private async analyzeWithOpenAI(prompt: string, data: AnalysisData): Promise<AIAnalysis> {
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
        max_tokens: this.config.maxTokens,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content ?? '';

    return this.parseResponse(text, 'openai');
  }

  /** Analisa com Kimi (Moonshot AI) */
  private async analyzeWithKimi(prompt: string, data: AnalysisData): Promise<AIAnalysis> {
    const response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      }),
    });

    if (!response.ok) {
      throw new Error(`Kimi API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content ?? '';

    return this.parseResponse(text, 'kimi');
  }

  /** Constrói o prompt para a IA */
  private buildPrompt(data: AnalysisData): string {
    const logs = data.consoleLogs?.slice(-20).map(l => `[${l.type.toUpperCase()}] ${l.message}`).join('\n') ?? 'Nenhum log';
    const network = data.networkRequests?.slice(-10).map(r => `${r.method} ${r.url} - ${r.status}${r.error ? ` (ERRO: ${r.error})` : ''}`).join('\n') ?? 'Nenhuma requisição';

    return `
Você é Aura, uma IA especialista em debugging React/TypeScript.
Analise este bug e gere um relatório técnico em Markdown.

## Contexto do Bug
- Componente: ${data.element.componentName ?? 'N/A'}
- Arquivo: ${data.element.filePath ?? 'N/A'}
- Elemento HTML: ${data.element.tag}
- Classes: ${data.element.className ?? 'N/A'}
- Dimensões: ${Math.round(data.element.rect.width)}x${Math.round(data.element.rect.height)}px
- Posição: x:${Math.round(data.element.rect.left)}, y:${Math.round(data.element.rect.top)}

## Descrição do Bug
${data.description}

## Comportamento Esperado
${data.expectedBehavior ?? 'Não informado'}

## Console Logs (últimos 20)
${logs}

## Network Requests (últimos 10)
${network}

## Tarefa
1. Identifique o problema provável
2. Sugira a causa raiz
3. Proponha solução em código TypeScript/React
4. Gere um prompt técnico para o desenvolvedor implementar

## Formato de Saída (JSON)
{
  "analysis": "Análise detalhada do problema...",
  "rootCause": "Causa raiz identificada...",
  "solution": "código TypeScript/React...",
  "promptDev": "Prompt técnico para Kimi Code...",
  "severity": "low|medium|high|critical",
  "confidence": 0.95
}
`;
  }

  /** Parse da resposta da IA */
  private parseResponse(text: string, provider: 'gemini' | 'deepseek' | 'openai' | 'kimi'): AIAnalysis {
    try {
      // Tentar extrair JSON da resposta
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          provider,
          analysis: parsed.analysis ?? 'Análise não disponível',
          rootCause: parsed.rootCause ?? 'Causa raiz não identificada',
          solution: parsed.solution ?? 'Solução não disponível',
          promptDev: parsed.promptDev ?? 'Prompt não gerado',
          severity: parsed.severity ?? 'medium',
          confidence: parsed.confidence ?? 0.5,
          generatedAt: new Date().toISOString(),
        };
      }
    } catch {
      // Fallback: retornar texto bruto como análise
    }

    return {
      provider,
      analysis: text,
      rootCause: 'Não identificada',
      solution: 'Não disponível',
      promptDev: 'Não gerado',
      severity: 'medium',
      confidence: 0.3,
      generatedAt: new Date().toISOString(),
    };
  }

  /** Retorna o modelo padrão para cada provider */
  private getDefaultModel(provider: string): string {
    switch (provider) {
      case 'gemini':
        return 'gemini-1.5-flash';
      case 'deepseek':
        return 'deepseek-chat';
      case 'openai':
        return 'gpt-4o-mini';
      case 'kimi':
        return 'moonshot-v1-8k';
      default:
        return 'gemini-1.5-flash';
    }
  }
}

export default AIAnalyzer;
