/**
 * SitePulse Bridge — Integração Bug Detector ↔ SitePulse AI Assistant
 *
 * Orquestra:
 * - Envio de reports ao BugDetector Cloud
 * - Análise de IA com Gemini (padrão) → Kimi (fallback)
 * - Formatação de contexto para o assistant-service.js do SitePulse
 */

import type { BugReport, AIAnalysis, CreateReportData } from '../types';
import { CloudAPI } from './CloudAPI';
import { IntelligenceEngine } from '../intelligence/IntelligenceEngine';

export interface SitePulseBridgeConfig {
  /** URL do BugDetector Cloud */
  cloudBaseURL: string;
  /** Chave da API Gemini (obrigatória) */
  geminiApiKey: string;
  /** Chave da API Kimi (fallback opcional) */
  kimiApiKey?: string;
  /** Modelo Gemini. Default: gemini-1.5-flash */
  geminiModel?: string;
  /** Modelo Kimi. Default: moonshot-v1-8k */
  kimiModel?: string;
}

export interface EnrichedBugReport extends BugReport {
  /** Análise de IA enriquecida */
  aiAnalysis?: AIAnalysis;
  /** Resumo operacional para o SitePulse Assistant */
  assistantBrief?: AssistantBrief;
}

export interface AssistantBrief {
  summary: string;
  rootCause: string;
  fixCode: string;
  fixLanguage: string;
  recommendations: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  issueCode: string;
  pageUrl: string;
  elementSelector: string;
}

export class SitePulseBridge {
  private cloud: CloudAPI;
  private geminiEngine: IntelligenceEngine;
  private kimiEngine?: IntelligenceEngine;
  private config: Required<Pick<SitePulseBridgeConfig, 'geminiModel' | 'kimiModel'>> & SitePulseBridgeConfig;

  constructor(config: SitePulseBridgeConfig) {
    this.config = {
      ...config,
      geminiModel: config.geminiModel ?? 'gemini-1.5-flash',
      kimiModel: config.kimiModel ?? 'kimi-for-coding',
    };

    this.cloud = new CloudAPI({ baseURL: config.cloudBaseURL });
    this.geminiEngine = new IntelligenceEngine({
      provider: 'gemini',
      apiKey: config.geminiApiKey,
      model: this.config.geminiModel,
      baseURL: '',
      temperature: 0.2,
      timeout: 30000,
    });

    if (config.kimiApiKey) {
      this.kimiEngine = new IntelligenceEngine({
        provider: 'kimi',
        apiKey: config.kimiApiKey,
        model: this.config.kimiModel,
        baseURL: 'https://api.kimi.com/coding/v1',
        temperature: 0.2,
        timeout: 30000,
      });
    }
  }

  /**
   * Envia um report para o Cloud e enriquece com análise de IA.
   * Gemini é o padrão; Kimi entra como fallback.
   */
  async submitAndAnalyze(report: BugReport): Promise<EnrichedBugReport> {
    // 1. Envia para o Cloud
    const cloudRes = await this.cloud.sendReport(report);
    if (!cloudRes.saved) {
      throw new Error('Falha ao persistir report no BugDetector Cloud');
    }

    // 2. Análise de IA
    const aiAnalysis = await this.analyzeWithFallback(report);

    // 3. Merge no report
    const enriched: EnrichedBugReport = {
      ...report,
      aiAnalysis,
      assistantBrief: this.buildAssistantBrief(report, aiAnalysis),
    };

    return enriched;
  }

  /**
   * Apenas analisa um report sem enviar ao Cloud.
   * Útil quando o SitePulse já tem o report localmente.
   */
  async analyzeLocal(report: BugReport): Promise<EnrichedBugReport> {
    const aiAnalysis = await this.analyzeWithFallback(report);
    return {
      ...report,
      aiAnalysis,
      assistantBrief: this.buildAssistantBrief(report, aiAnalysis),
    };
  }

  /**
   * Gera um contexto pronto para injetar no assistant-service.js do SitePulse.
   * O retorno pode ser anexado em `assistantContext.bugDetector`.
   */
  buildAssistantContext(enriched: EnrichedBugReport): {
    mode: 'bug_analyst';
    context: {
      reportId: string;
      description: string;
      url: string;
      elementSelector: string;
      severity: string;
      aiProvider: string;
      aiConfidence: number;
      rootCause: string;
      solution: string;
      recommendations: string[];
      fixCode: string;
      fixLanguage: string;
      consoleLogCount: number;
      networkRequestCount: number;
      hasScreenshot: boolean;
      hasVideo: boolean;
    };
  } {
    return {
      mode: 'bug_analyst',
      context: {
        reportId: enriched.id,
        description: enriched.description,
        url: enriched.url,
        elementSelector: enriched.element.selector,
        severity: enriched.severity,
        aiProvider: enriched.aiAnalysis?.provider ?? 'none',
        aiConfidence: enriched.aiAnalysis?.confidence ?? 0,
        rootCause: enriched.aiAnalysis?.rootCause ?? '',
        solution: enriched.aiAnalysis?.solution ?? '',
        recommendations: enriched.aiAnalysis?.recommendations ?? [],
        fixCode: enriched.aiAnalysis?.codeFix?.codigoCorrigido ?? '',
        fixLanguage: enriched.aiAnalysis?.codeFix?.linguagem ?? '',
        consoleLogCount: enriched.consoleLogs?.length ?? 0,
        networkRequestCount: enriched.networkRequests?.length ?? 0,
        hasScreenshot: !!enriched.screenshot,
        hasVideo: !!enriched.video,
      },
    };
  }

  // ============================================================================
  // PRIVATE
  // ============================================================================

  private async analyzeWithFallback(report: BugReport): Promise<AIAnalysis> {
    try {
      return await this.geminiEngine.analyze(report);
    } catch (err) {
      console.warn('[SitePulseBridge] Gemini falhou, tentando Kimi...', err);
      if (!this.kimiEngine) {
        throw new Error('Gemini falhou e nenhuma API key de Kimi foi configurada.');
      }
      return this.kimiEngine.analyze(report);
    }
  }

  private buildAssistantBrief(report: BugReport, ai: AIAnalysis): AssistantBrief {
    const codeFix = ai.codeFix;
    return {
      summary: `${report.type.toUpperCase()} — ${report.description}`,
      rootCause: ai.rootCause,
      fixCode: codeFix?.codigoCorrigido ?? ai.solution ?? '',
      fixLanguage: codeFix?.linguagem ?? 'typescript',
      recommendations: ai.recommendations ?? [],
      severity: ai.severity,
      confidence: ai.confidence,
      issueCode: this.inferIssueCode(report),
      pageUrl: report.url,
      elementSelector: report.element.selector,
    };
  }

  private inferIssueCode(report: BugReport): string {
    // Heurística simples para mapear tipo de bug em código de issue do SitePulse
    const typeMap: Record<string, string> = {
      bug: 'BD_BUG_DETECTED',
      improvement: 'BD_IMPROVEMENT',
      question: 'BD_QUESTION',
    };
    const base = typeMap[report.type] ?? 'BD_UNKNOWN';
    const cat = report.aiAnalysis?.category ?? 'general';
    return `${base}_${cat.toUpperCase()}`;
  }
}
