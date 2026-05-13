/**
 * Classe principal do BugDetector
 * Orquestra todos os componentes do sistema
 */

import type {
  BugDetectorConfig,
  InspectedElement,
  BugReport,
  BugStats,
  CreateReportData,
  ExportOptions,
  ExportResult,
  ChatSession,
  ChatMessage,
  AIAnalysis,
  AIEnhancedReport,
} from '../types';

import { Config } from './Config';
import { Inspector } from './Inspector';
import { StorageManager } from '../storage/StorageManager';
import { CaptureManager } from '../capture/CaptureManager';
import { IntelligenceEngine } from '../intelligence/IntelligenceEngine';
import { ReportGenerator } from '../intelligence/ReportGenerator';
import { UIManager } from '../ui/UIManager';
import { SessionReplayEngine } from '../replay/SessionReplayEngine';
import { CloudAPI } from '../integrations/CloudAPI';
import { AutoErrorDetector } from '../devtools/AutoErrorDetector';
import { PrivacyMasking } from '../utils/PrivacyMasking';
import { RageClickDetector } from '../utils/RageClickDetector';
import { VideoRecorder } from '../capture/VideoRecorder';
// UUID nativo - sem dependência externa

/** Classe principal BugDetector */
export class BugDetector {
  private config: Config;
  private inspector: Inspector;
  private storage: StorageManager;
  private capture: CaptureManager;
  private intelligence: IntelligenceEngine;
  private ui: UIManager | null = null;
  private isActive = false;
  private currentElement: InspectedElement | null = null;
  private reports: BugReport[] = [];
  private reportsReady: Promise<void>;
  private chatSessions: Map<string, ChatSession> = new Map();
  private sessionReplay: SessionReplayEngine;
  private cloudAPI: CloudAPI | null = null;
  private autoErrorDetector: AutoErrorDetector;
  private privacyMasking: PrivacyMasking;
  private rageClickDetector: RageClickDetector;
  private videoRecorder: VideoRecorder;

  /** Event callbacks */
  private onActivate?: () => void;
  private onDeactivate?: () => void;
  private onElementSelected?: (element: InspectedElement) => void;
  private onReportCreated?: (report: BugReport) => void;

  constructor(config: BugDetectorConfig = {}) {
    this.config = new Config(config);
    this.inspector = new Inspector();
    this.storage = new StorageManager(this.config.getPersistMethod());
    this.capture = new CaptureManager(this.config.getCapture());
    this.intelligence = new IntelligenceEngine(this.config.getAI());
    this.sessionReplay = new SessionReplayEngine();

    // Setup auto error detection
    const autoErrorConfig = this.config.get().autoError;
    this.autoErrorDetector = new AutoErrorDetector(autoErrorConfig);
    this.autoErrorDetector.onError((err) => this.handleAutoError(err));

    // Setup privacy masking
    const privacyConfig = this.config.get().privacy;
    this.privacyMasking = new PrivacyMasking(privacyConfig);

    // Setup rage click detection
    const rageConfig = this.config.get().rageClick;
    this.rageClickDetector = new RageClickDetector(rageConfig);

    // Setup video recorder
    const videoConfig = this.config.get().video;
    this.videoRecorder = new VideoRecorder(videoConfig);
    this.videoRecorder.onRecordingComplete((rec) => this.handleVideoRecording(rec));

    // Setup cloud integration
    const cloudConfig = this.config.getIntegrations().cloud;
    if (cloudConfig) {
      this.cloudAPI = new CloudAPI(cloudConfig);
    }

    // Setup callbacks
    const callbacks = this.config.get().callbacks;
    this.onActivate = callbacks?.onActivate;
    this.onDeactivate = callbacks?.onDeactivate;
    this.onElementSelected = callbacks?.onElementSelected;
    this.onReportCreated = callbacks?.onReportCreated;

    // Inicializa UI se não for headless
    if (!this.config.isHeadless()) {
      this.ui = new UIManager({
        onActivate: () => this.activate(),
        onDeactivate: () => this.deactivate(),
        onElementInspect: (el) => { this.currentElement = el; },
        onCreateReport: (data) => this.createReport(data),
        onSendMessage: (sessionId, message) => this.processChatMessage(sessionId, message),
        onEnhanceReport: (data) => this.enhanceReportComment(data),
      }, this.config.get().zIndexBase, this.config.getBranding(), this.config.isGuestMode());
    }

    // Carrega reports existentes sem permitir que o load assíncrono apague reports novos.
    this.reportsReady = this.loadReports();
  }

  // ============================================================================
  // ACTIVATION
  // ============================================================================

  /** Ativa o BugDetector */
  activate(): void {
    if (this.isActive) return;

    this.isActive = true;

    // Inicia session replay
    this.sessionReplay.start();

    // Ativa detecção automática de erros
    this.autoErrorDetector.activate();

    // Ativa detecção de rage clicks
    this.rageClickDetector.activate();

    // Ativa captura de console/network
    this.capture.activate();

    // Ativa inspeção (apenas quando não em headless — React/Vue controlam a UI)
    if (!this.config.isHeadless()) {
      this.inspector.activate(
        (element) => this.handleElementSelect(element),
        (element) => this.handleElementHover(element)
      );
    }

    // Mostra UI
    this.ui?.show();

    // Callback
    this.onActivate?.();
  }

  /** Desativa o BugDetector */
  deactivate(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.currentElement = null;

    // Para session replay
    this.sessionReplay.stop();

    // Desativa detecção automática de erros
    this.autoErrorDetector.deactivate();

    // Desativa detecção de rage clicks
    this.rageClickDetector.deactivate();

    // Para gravação de vídeo se estiver rodando
    this.videoRecorder.stop();

    // Desativa inspeção (se estava ativa)
    if (!this.config.isHeadless()) {
      this.inspector.deactivate();
    }

    // Desativa captura de console/network
    this.capture.deactivate?.();

    // Esconde UI
    this.ui?.hide();

    // Callback
    this.onDeactivate?.();
  }

  /** Destrói o BugDetector e limpa todos os recursos */
  destroy(): void {
    this.deactivate();
    this.capture.destroy();
    this.ui?.destroy();
    this.chatSessions.clear();
    this.onActivate = undefined;
    this.onDeactivate = undefined;
    this.onElementSelected = undefined;
    this.onReportCreated = undefined;
  }

  /** Alterna estado */
  toggle(): void {
    if (this.isActive) {
      this.deactivate();
    } else {
      this.activate();
    }
  }

  /** Verifica se está ativo */
  isActivated(): boolean {
    return this.isActive;
  }

  // ============================================================================
  // ELEMENT INSPECTION
  // ============================================================================

  /** Inspeciona elemento específico */
  inspectElement(element: Element | string): InspectedElement {
    let target: Element;

    if (typeof element === 'string') {
      try {
        target = document.querySelector(element)!;
      } catch {
        throw new Error(`Seletor CSS inválido: ${element}`);
      }
      if (!target) throw new Error(`Elemento não encontrado: ${element}`);
    } else {
      target = element;
    }

    const inspected = this.inspector.inspectElement(target);
    this.currentElement = inspected;
    return inspected;
  }

  /** Obtém elemento atual */
  getCurrentElement(): InspectedElement | null {
    return this.currentElement;
  }

  // ============================================================================
  // REPORTS
  // ============================================================================

  /** Cria novo report */
  async createReport(data: CreateReportData): Promise<BugReport> {
    await this.reportsReady;

    const element = data.element || this.currentElement;
    if (!element) {
      throw new Error('Nenhum elemento selecionado');
    }

    // Captura dados
    const captures = await this.capture.captureAll(element.domElement || undefined);

    // Cria report
    const report: BugReport = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      status: 'pending',
      url: window.location.href,
      pageTitle: document.title,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      element,
      screenshot: data.screenshot || captures.screenshot,
      video: data.video,
      sessionReplay: data.sessionReplay || this.sessionReplay.getSnapshot(),
      consoleLogs: captures.consoleLogs,
      networkRequests: captures.networkRequests,
      performanceMetrics: captures.performanceMetrics,
      description: data.description,
      type: data.type || 'bug',
      severity: data.severity || 'medium',
      expectedBehavior: data.expectedBehavior,
      markdownReport: data.markdownReport,
    };

    // Salva (sanitiza domElement para storage — agora opcional no tipo)
    this.reports.push(report);
    const { domElement: _domElement, ...elementWithoutDom } = report.element;
    await this.storage.save({ ...report, element: elementWithoutDom });

    // Envia para cloud se configurado
    if (this.cloudAPI) {
      try {
        await this.cloudAPI.sendReport(report);
      } catch (err) {
        console.error('Erro ao enviar report para cloud:', err);
      }
    }

    // Callback
    this.onReportCreated?.(report);

    // Inicia análise IA se configurado
    if (this.config.getAI().provider !== 'none') {
      this.analyzeReport(report.id);
    }

    return report;
  }

  /** Obtém todos os reports */
  getReports(): BugReport[] {
    return [...this.reports];
  }

  /** Obtém report por ID */
  getReport(id: string): BugReport | undefined {
    return this.reports.find(r => r.id === id);
  }

  /** Deleta report */
  async deleteReport(id: string): Promise<void> {
    await this.reportsReady;
    this.reports = this.reports.filter(r => r.id !== id);
    await this.storage.delete(id);
  }

  /** Atualiza report */
  async updateReport(id: string, updates: Partial<BugReport>): Promise<void> {
    await this.reportsReady;
    const index = this.reports.findIndex(r => r.id === id);
    if (index === -1) return;

    this.reports[index] = { ...this.reports[index], ...updates };
    await this.storage.update(id, updates);
  }

  /** Resolve report */
  async resolveReport(id: string): Promise<void> {
    await this.updateReport(id, { status: 'resolved' });
  }

  /** Obtém estatísticas */
  getStats(): BugStats {
    const total = this.reports.length;
    const pending = this.reports.filter(r => r.status === 'pending' || r.status === 'analyzing').length;
    const resolved = this.reports.filter(r => r.status === 'resolved' || r.status === 'rejected').length;

    const bySeverity: Record<BugReport['severity'], number> = {
      low: 0, medium: 0, high: 0, critical: 0,
    };
    const byType: Record<BugReport['type'], number> = {
      bug: 0, improvement: 0, question: 0,
    };

    this.reports.forEach(r => {
      bySeverity[r.severity]++;
      byType[r.type]++;
    });

    return { total, pending, resolved, bySeverity, byType };
  }

  // ============================================================================
  // AI ANALYSIS
  // ============================================================================

  /** Analisa report com IA */
  async analyzeReport(reportId: string): Promise<AIAnalysis | null> {
    await this.reportsReady;
    const report = this.getReport(reportId);
    if (!report) return null;

    // Atualiza status
    await this.updateReport(reportId, { status: 'analyzing' });

    try {
      const analysis = await this.intelligence.analyze(report);
      
      await this.updateReport(reportId, {
        status: 'pending',
        aiAnalysis: analysis,
      });

      return analysis;
    } catch (error) {
      console.error('Erro na análise:', error);
      await this.updateReport(reportId, { status: 'pending' });
      return null;
    }
  }

  /** Reescreve comentário bruto com IA e devolve Markdown técnico */
  async enhanceReportComment(data: {
    description: string;
    expectedBehavior?: string;
    element: InspectedElement;
    screenshotBase64?: string;
  }): Promise<AIEnhancedReport> {
    return this.intelligence.enhanceReportComment({
      description: data.description,
      expectedBehavior: data.expectedBehavior,
      element: {
        tag: data.element.tag,
        selector: data.element.selector,
        xpath: data.element.xpath,
        className: data.element.className,
        computedStyles: data.element.computedStyles,
      },
      pageUrl: window.location.href,
      pageTitle: document.title,
      screenshotBase64: data.screenshotBase64,
    });
  }

  // ============================================================================
  // CHAT
  // ============================================================================

  /** Inicia sessão de chat */
  startChatSession(reportId: string): ChatSession {
    const session: ChatSession = {
      id: crypto.randomUUID(),
      reportId,
      messages: [
        {
          id: crypto.randomUUID(),
          sender: 'ai',
          content: 'Olá! Descreva o bug que você encontrou e vou analisar com meus especialistas.',
          timestamp: new Date().toISOString(),
          type: 'text',
        },
      ],
      status: 'idle',
    };

    this.chatSessions.set(session.id, session);
    return session;
  }

  /** Processa mensagem do chat */
  async processChatMessage(sessionId: string, content: string): Promise<ChatMessage> {
    const session = this.chatSessions.get(sessionId);
    if (!session) throw new Error('Sessão não encontrada');

    // Adiciona mensagem do usuário
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sender: 'user',
      content,
      timestamp: new Date().toISOString(),
      type: 'text',
    };
    session.messages.push(userMessage);

    // Processa com IA
    session.status = 'analyzing';

    const report = this.getReport(session.reportId);
    if (!report) {
      throw new Error('Report não encontrado');
    }

    // Resposta da IA
    const aiResponse = await this.intelligence.chat(content, report);
    
    const aiMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sender: 'ai',
      content: aiResponse.content,
      timestamp: new Date().toISOString(),
      type: aiResponse.type,
      metadata: aiResponse.metadata,
    };

    session.messages.push(aiMessage);
    session.status = 'completed';

    return aiMessage;
  }

  /** Obtém sessão de chat */
  getChatSession(sessionId: string): ChatSession | undefined {
    return this.chatSessions.get(sessionId);
  }

  // ============================================================================
  // EXPORT
  // ============================================================================

  /** Exporta report */
  async exportReport(reportId: string, options: ExportOptions): Promise<ExportResult> {
    const report = this.getReport(reportId);
    if (!report) throw new Error('Report não encontrado');

    return ReportGenerator.export(report, options);
  }

  /** Exporta todos os reports */
  async exportAllReports(options: ExportOptions): Promise<ExportResult> {
    return ReportGenerator.exportAll(this.reports, options);
  }

  // ============================================================================
  // INTEGRATIONS
  // ============================================================================

  /** Cria issue no GitHub */
  async createGitHubIssue(reportId: string, repo?: string): Promise<void> {
    const { github } = this.config.getIntegrations();
    if (!github && !repo) {
      throw new Error('Configuração do GitHub não encontrada');
    }

    const report = this.getReport(reportId);
    if (!report) throw new Error('Report não encontrado');

    const { GitHubIntegration } = await import('../integrations/GitHub');
    const integration = new GitHubIntegration(github || { repo: repo!, token: '' });
    const result = await integration.createIssue(report);

    await this.updateReport(reportId, {
      githubIssueNumber: result.number,
      githubIssueUrl: result.url,
    });
  }

  /** Sincroniza status do GitHub de volta para o report */
  async syncGitHubStatus(reportId: string): Promise<void> {
    const { github } = this.config.getIntegrations();
    if (!github) {
      throw new Error('Configuração do GitHub não encontrada');
    }

    const report = this.getReport(reportId);
    if (!report) throw new Error('Report não encontrado');
    if (!report.githubIssueNumber) {
      throw new Error('Report não possui issue vinculada no GitHub');
    }

    const { GitHubIntegration } = await import('../integrations/GitHub');
    const integration = new GitHubIntegration(github);
    const status = await integration.getIssueStatus(report.githubIssueNumber);

    const newStatus = status.state === 'open' ? 'pending' : 'resolved';
    await this.updateReport(reportId, { status: newStatus });
  }

  /** Cria ticket no Jira */
  async createJiraTicket(reportId: string): Promise<void> {
    const { jira } = this.config.getIntegrations();
    if (!jira) {
      throw new Error('Configuração do Jira não encontrada');
    }

    const report = this.getReport(reportId);
    if (!report) throw new Error('Report não encontrado');

    const { JiraIntegration } = await import('../integrations/Jira');
    const integration = new JiraIntegration(jira);
    await integration.createTicket(report);
  }

  /** Notifica Slack */
  async notifySlack(reportId: string, channel?: string): Promise<void> {
    const { slack } = this.config.getIntegrations();
    if (!slack) {
      throw new Error('Configuração do Slack não encontrada');
    }

    const report = this.getReport(reportId);
    if (!report) throw new Error('Report não encontrado');

    const { SlackIntegration } = await import('../integrations/Slack');
    const integration = new SlackIntegration(slack);
    await integration.notify(report, channel);
  }

  // ============================================================================
  // NEW FEATURES ACCESSORS
  // ============================================================================

  /** Get auto error detector instance */
  getAutoErrorDetector(): AutoErrorDetector {
    return this.autoErrorDetector;
  }

  /** Get privacy masking instance */
  getPrivacyMasking(): PrivacyMasking {
    return this.privacyMasking;
  }

  /** Get rage click detector instance */
  getRageClickDetector(): RageClickDetector {
    return this.rageClickDetector;
  }

  /** Get video recorder instance */
  getVideoRecorder(): VideoRecorder {
    return this.videoRecorder;
  }

  /** Start video recording */
  async startVideoRecording(): Promise<boolean> {
    return this.videoRecorder.start();
  }

  /** Stop video recording */
  stopVideoRecording(): void {
    this.videoRecorder.stop();
  }

  /** Get frustration metrics from rage/dead click detection */
  getFrustrationMetrics() {
    return this.rageClickDetector.getMetrics();
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private handleAutoError(error: import('../devtools/AutoErrorDetector').CapturedError): void {
    if (!this.isActive) return;
    console.warn('[BugDetector] Auto-captured error:', error.message);

    const autoErrorConfig = this.config.get().autoError;
    if (!autoErrorConfig?.enabled) return;

    // Cria report automaticamente para erros críticos
    try {
      const report = this.createReport({
        description: `[Auto] ${error.type}: ${error.message}`,
        type: 'bug',
        severity: error.type === 'js-error' || error.type === 'unhandledrejection' ? 'high' : 'medium',
        expectedBehavior: 'Nenhum erro de JavaScript deve ocorrer',
      });
      // Não aguarda — fire and forget
      report.catch((err) => console.error('[BugDetector] Falha ao criar auto-report:', err));
    } catch (err) {
      console.error('[BugDetector] Falha ao criar auto-report:', err);
    }
  }

  private handleVideoRecording(recording: import('../capture/VideoRecorder').VideoRecording): void {
    console.log('[BugDetector] Video recording completed:', recording.durationMs, 'ms');
    // Attach to current report or store for later
  }

  private handleElementSelect(element: InspectedElement): void {
    this.currentElement = element;
    this.onElementSelected?.(element);
    // Desativa inspeção para liberar interação com a página/modal
    this.deactivate();
    this.ui?.showReportModal(element);
  }

  private handleElementHover(element: InspectedElement | null): void {
    this.ui?.updateElementTooltip(element);
  }

  private async loadReports(): Promise<void> {
    try {
      const storedReports = await this.storage.getAll();
      const merged = new Map<string, BugReport>();

      for (const report of storedReports) {
        merged.set(report.id, report);
      }

      for (const report of this.reports) {
        merged.set(report.id, report);
      }

      this.reports = Array.from(merged.values()).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (error) {
      console.error('Erro ao carregar reports:', error);
    }
  }
}

export default BugDetector;
