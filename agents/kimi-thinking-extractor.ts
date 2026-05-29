// ============================================================================
// KIMI THINKING EXTRACTOR v3.3 — Luna CLI Production Code
// ============================================================================
// Arquitetura completa para extração, limpeza e renderização do thinking
// do Kimi K2.6 via Playwright CDP.
//
// Autor: Luna CLI Team
// Baseado em análise DOM ao vivo do Kimi Web
// ============================================================================

// ============================================
// 1. CONSTANTES E SELETORES DOM
// ============================================

export const KIMI_SELECTORS = {
  // Container raiz do segmento do assistente (mensagem completa)
  SEGMENT_ASSISTANT: '.segment-assistant',

  // Hierarquia interna do segmento
  SEGMENT_CONTAINER: '.segment-container',
  CONTAINER_BLOCK: '.container-block',
  BLOCK_ITEM: '.block-item',

  // === THINKING ===
  // Container que envolve o thinking (tem .thinking-container)
  THINKING_CONTAINER: '.toolcall-container.thinking-container',
  // Onde o texto do thinking realmente mora (tem .toolcall-content-text)
  THINKING_CONTENT: '.markdown-container.toolcall-content-text',

  // === RESPOSTA REAL ===
  // Container da resposta (NÃO tem .toolcall-content-text)
  RESPONSE_CONTENT: '.segment-content-box > .markdown-container',
  // Fallback: qualquer .markdown-container dentro de .segment-content-box 
  // que NÃO tenha .toolcall-content-text
  RESPONSE_CONTENT_FALLBACK: '.segment-content-box .markdown-container:not(.toolcall-content-text)',

  // === INDICADORES DE ESTADO ===
  // Spinner/loading durante thinking
  THINKING_SPINNER: '.thinking-container .loading-spinner, .thinking-container [class*="spinner"]',
  // Indicador de que o thinking terminou
  THINKING_COMPLETE_INDICATOR: '.thinking-container.thinking-complete, .thinking-container[data-complete="true"]',

  // === STREAMING ===
  // Cursor de digitação durante streaming
  STREAMING_CURSOR: '.cursor-blink, [class*="cursor"]',
} as const;

export const TEXT_PATTERNS = {
  // Tags [[response]] e variantes
  RESPONSE_TAG: /\[\[response\]\]|\[\[resposta\]\]|\[\[RESPONSE\]\]/gi,

  // Self-talk do sistema — padrões identificados
  SELF_TALK: [
    /O usuário está me tratando como\s+\w+\.{0,3}/gi,
    /O usuário quer que eu aja como\s+[^.]+/gi,
    /Estou sendo usado como\s+[^.]+/gi,
    /O sistema está me instruindo a[^.]+/gi,
    /Meu papel atual é\s+[^.]+/gi,
    /Contexto:\s*estou conversando com[^.]+/gi,
    /INSTRUÇÃO:\s*Você está conversando com[^.]+/gi,
    /Sempre se refira a mim como\s+[^.]+/gi,
  ],

  // Repetições
  REPETITION_PATTERNS: [
    /^(.+)\n\1\n\1(?:\n\1)*$/gm,
    /(\b\w+\b)(?:\s+\1){3,}/gi,
    /^(?:hmm|uhm|ah|oh|ok|okay|então|bom|bem)(?:\s*,?\s*\1){2,}/gi,
  ],

  // Delimitadores de thinking vs response interno
  THINKING_DELIMITERS: [
    /---+?\s*(?:resposta|response|final answer|resposta final)\s*---+?/i,
    /^(?:Aqui está (?:a )?resposta|Resposta final|Resposta):/im,
  ],
} as const;

export const POLLING_CONFIG = {
  INTERVAL_MS: 400,
  MAX_INTERVAL_MS: 2000,
  BACKOFF_MULTIPLIER: 1.5,
  STABLE_THRESHOLD_MS: 800,
  MAX_THINKING_DURATION_MS: 300_000,
} as const;

// ============================================
// 2. STATE MACHINE
// ============================================

export enum KimiState {
  IDLE = 'idle',
  THINKING = 'thinking',
  RESPONDING = 'responding',
  ERROR = 'error',
}

export interface StateTransition {
  from: KimiState;
  to: KimiState;
  timestamp: number;
  reason: string;
  data?: ExtractedContent;
}

export interface ExtractedContent {
  thinking: string;
  response: string;
  isComplete: boolean;
  hasThinking: boolean;
  hasResponse: boolean;
  lastUpdated: number;
  stabilityScore: number;
}

export class KimiStateMachine {
  private state: KimiState = KimiState.IDLE;
  private lastContent: ExtractedContent | null = null;
  private contentHistory: ExtractedContent[] = [];
  private transitionHistory: StateTransition[] = [];
  private stableTimer: number | null = null;
  private lastUpdateTime: number = 0;

  public onStateChange?: (transition: StateTransition) => void;
  public onThinkingUpdate?: (content: string, isComplete: boolean) => void;
  public onResponseUpdate?: (content: string, isComplete: boolean) => void;
  public onError?: (error: Error) => void;

  processSnapshot(snapshot: ExtractedContent): void {
    const now = Date.now();
    const previousState = this.state;

    const contentChanged = this.hasContentChanged(snapshot);
    const significantChange = this.isSignificantChange(snapshot);

    if (contentChanged) {
      this.lastUpdateTime = now;
      this.contentHistory.push(snapshot);
      if (this.contentHistory.length > 10) {
        this.contentHistory.shift();
      }
    }

    let newState = previousState;

    switch (previousState) {
      case KimiState.IDLE:
        if (snapshot.hasThinking && !snapshot.hasResponse) {
          newState = KimiState.THINKING;
        } else if (snapshot.hasResponse) {
          newState = KimiState.RESPONDING;
        }
        break;

      case KimiState.THINKING:
        if (!snapshot.hasThinking && snapshot.hasResponse) {
          newState = KimiState.RESPONDING;
        } else if (snapshot.hasThinking && snapshot.hasResponse) {
          if (snapshot.isComplete || snapshot.stabilityScore > 0.8) {
            newState = KimiState.RESPONDING;
          }
        } else if (!snapshot.hasThinking && !snapshot.hasResponse) {
          newState = this.detectErrorOrShortMessage(snapshot);
        }
        break;

      case KimiState.RESPONDING:
        if (!snapshot.hasResponse && !snapshot.hasThinking) {
          if (this.isStableFor(POLLING_CONFIG.STABLE_THRESHOLD_MS)) {
            newState = KimiState.IDLE;
          }
        } else if (snapshot.hasThinking && !snapshot.hasResponse) {
          newState = KimiState.THINKING;
        }
        break;

      case KimiState.ERROR:
        if (snapshot.hasThinking || snapshot.hasResponse) {
          newState = snapshot.hasResponse ? KimiState.RESPONDING : KimiState.THINKING;
        }
        break;
    }

    if (newState !== previousState) {
      this.executeTransition(previousState, newState, snapshot, 
        this.getTransitionReason(previousState, newState, snapshot));
    }

    if (previousState === KimiState.THINKING || newState === KimiState.THINKING) {
      this.onThinkingUpdate?.(snapshot.thinking, snapshot.isComplete);
    }
    if (previousState === KimiState.RESPONDING || newState === KimiState.RESPONDING) {
      this.onResponseUpdate?.(snapshot.response, snapshot.isComplete);
    }

    this.lastContent = snapshot;
  }

  private hasContentChanged(current: ExtractedContent): boolean {
    if (!this.lastContent) return true;
    const thinkingChanged = current.thinking !== this.lastContent.thinking;
    const responseChanged = current.response !== this.lastContent.response;
    const completenessChanged = current.isComplete !== this.lastContent.isComplete;
    return thinkingChanged || responseChanged || completenessChanged;
  }

  private isSignificantChange(current: ExtractedContent): boolean {
    if (!this.lastContent) return true;
    const thinkingDelta = Math.abs(current.thinking.length - this.lastContent.thinking.length);
    const responseDelta = Math.abs(current.response.length - this.lastContent.response.length);
    return thinkingDelta > 5 || responseDelta > 5;
  }

  private isStableFor(thresholdMs: number): boolean {
    return (Date.now() - this.lastUpdateTime) > thresholdMs;
  }

  private detectErrorOrShortMessage(snapshot: ExtractedContent): KimiState {
    if (this.contentHistory.length > 0 && 
        this.lastContent && 
        (this.lastContent.thinking.length > 20 || this.lastContent.response.length > 20)) {
      return KimiState.IDLE;
    }
    return KimiState.ERROR;
  }

  private getTransitionReason(from: KimiState, to: KimiState, snapshot: ExtractedContent): string {
    const reasons: Record<string, string> = {
      [`${KimiState.IDLE}->${KimiState.THINKING}`]: 'Thinking detectado no DOM',
      [`${KimiState.IDLE}->${KimiState.RESPONDING}`]: 'Resposta apareceu sem thinking visível',
      [`${KimiState.THINKING}->${KimiState.RESPONDING}`]: 
        snapshot.hasResponse 
          ? 'Resposta iniciada, thinking completo' 
          : 'Thinking removido do DOM, resposta presente',
      [`${KimiState.THINKING}->${KimiState.ERROR}`]: 'Conteúdo desapareceu inesperadamente',
      [`${KimiState.RESPONDING}->${KimiState.IDLE}`]: 'Resposta completa e estável',
      [`${KimiState.ERROR}->${KimiState.THINKING}`]: 'Recuperação: thinking detectado',
      [`${KimiState.ERROR}->${KimiState.RESPONDING}`]: 'Recuperação: resposta detectada',
    };
    return reasons[`${from}->${to}`] || `Transição ${from} → ${to}`;
  }

  private executeTransition(from: KimiState, to: KimiState, data: ExtractedContent, reason: string): void {
    const transition: StateTransition = {
      from,
      to,
      timestamp: Date.now(),
      reason,
      data: { ...data },
    };

    this.transitionHistory.push(transition);
    this.state = to;

    if (this.stableTimer) {
      clearTimeout(this.stableTimer);
      this.stableTimer = null;
    }

    this.onStateChange?.(transition);

    if (to === KimiState.RESPONDING) {
      this.stableTimer = window.setTimeout(() => {
        if (this.state === KimiState.RESPONDING && this.isStableFor(POLLING_CONFIG.STABLE_THRESHOLD_MS)) {
          this.executeTransition(KimiState.RESPONDING, KimiState.IDLE, this.lastContent || data, 'Resposta estável por threshold');
        }
      }, POLLING_CONFIG.STABLE_THRESHOLD_MS * 2);
    }
  }

  getCurrentState(): KimiState { return this.state; }
  getLastContent(): ExtractedContent | null { return this.lastContent; }
  getTransitionHistory(): StateTransition[] { return [...this.transitionHistory]; }

  reset(): void {
    this.state = KimiState.IDLE;
    this.lastContent = null;
    this.contentHistory = [];
    this.transitionHistory = [];
    this.lastUpdateTime = 0;
    if (this.stableTimer) {
      clearTimeout(this.stableTimer);
      this.stableTimer = null;
    }
  }
}

// ============================================
// 3. DOM EXTRACTOR
// ============================================

export interface DOMSnapshot {
  html: string;
  text: string;
  classList: string[];
  childCount: number;
  hasSpinner: boolean;
  timestamp: number;
}

export class KimiDOMExtractor {
  private page: any; // Playwright Page
  private lastThinkingHTML: string = '';
  private lastResponseHTML: string = '';
  private stabilityCounter: number = 0;
  private maxStabilityCounter: number = 3;

  constructor(page: any) {
    this.page = page;
  }

  async extract(): Promise<ExtractedContent | null> {
    try {
      const segment = await this.findLatestAssistantSegment();
      if (!segment) {
        return this.createEmptySnapshot();
      }

      const thinking = await this.extractThinking(segment);
      const response = await this.extractResponse(segment);
      const stabilityScore = this.calculateStability(thinking.html, response.html);
      const isComplete = this.detectCompleteness(thinking, response, stabilityScore);

      const snapshot: ExtractedContent = {
        thinking: thinking.text,
        response: response.text,
        isComplete,
        hasThinking: thinking.text.length > 0,
        hasResponse: response.text.length > 0,
        lastUpdated: Date.now(),
        stabilityScore,
      };

      this.lastThinkingHTML = thinking.html;
      this.lastResponseHTML = response.html;

      return snapshot;

    } catch (error) {
      console.error('[KimiDOMExtractor] Erro na extração:', error);
      return this.createErrorSnapshot(error as Error);
    }
  }

  private async findLatestAssistantSegment(): Promise<any | null> {
    const segments = await this.page.$$(KIMI_SELECTORS.SEGMENT_ASSISTANT);
    if (segments.length === 0) return null;
    return segments[segments.length - 1];
  }

  private async extractThinking(segment: any): Promise<{ text: string; html: string; raw: DOMSnapshot }> {
    let thinkingContainer = await segment.$(KIMI_SELECTORS.THINKING_CONTAINER);

    if (!thinkingContainer) {
      thinkingContainer = await segment.$('[class*="thinking-container"]');
    }

    if (!thinkingContainer) {
      return { text: '', html: '', raw: this.createEmptyDOMSnapshot() };
    }

    const contentElement = await thinkingContainer.$(KIMI_SELECTORS.THINKING_CONTENT);

    if (!contentElement) {
      const fallbackContent = await thinkingContainer.$('.markdown-container');
      if (!fallbackContent) {
        return { text: '', html: '', raw: this.createEmptyDOMSnapshot() };
      }
      return this.extractElementContent(fallbackContent);
    }

    return this.extractElementContent(contentElement);
  }

  private async extractResponse(segment: any): Promise<{ text: string; html: string; raw: DOMSnapshot }> {
    let responseContainer = await segment.$(KIMI_SELECTORS.RESPONSE_CONTENT);

    if (!responseContainer) {
      const contentBox = await segment.$(KIMI_SELECTORS.RESPONSE_CONTENT_FALLBACK);
      if (contentBox) {
        responseContainer = contentBox;
      }
    }

    if (!responseContainer) {
      return { text: '', html: '', raw: this.createEmptyDOMSnapshot() };
    }

    return this.extractElementContent(responseContainer);
  }

  private async extractElementContent(element: any): Promise<{ text: string; html: string; raw: DOMSnapshot }> {
    const text = await element.innerText() || '';
    const html = await element.innerHTML() || '';
    const classList = await element.evaluate((el: Element) => Array.from(el.classList));
    const childCount = await element.evaluate((el: Element) => el.children.length);
    const hasSpinner = await element.evaluate((el: Element) => 
      el.querySelector('[class*="spinner"], [class*="loading"]') !== null
    );

    const snapshot: DOMSnapshot = {
      html,
      text,
      classList,
      childCount,
      hasSpinner,
      timestamp: Date.now(),
    };

    return { text: text.trim(), html, raw: snapshot };
  }

  private calculateStability(currentThinkingHTML: string, currentResponseHTML: string): number {
    let score = 0;

    if (currentThinkingHTML === this.lastThinkingHTML && currentThinkingHTML.length > 0) {
      score += 0.3;
      this.stabilityCounter++;
    } else {
      this.stabilityCounter = 0;
    }

    if (currentResponseHTML === this.lastResponseHTML && currentResponseHTML.length > 0) {
      score += 0.3;
    }

    if (this.stabilityCounter >= this.maxStabilityCounter) {
      score += 0.4;
    }

    return Math.min(score, 1.0);
  }

  private detectCompleteness(
    thinking: { text: string; html: string; raw: DOMSnapshot },
    response: { text: string; html: string; raw: DOMSnapshot },
    stabilityScore: number
  ): boolean {
    if (thinking.raw.hasSpinner) return false;

    if (thinking.text.length === 0 && response.text.length > 0 && stabilityScore > 0.6) {
      return true;
    }

    if (thinking.text.length > 0 && response.text.length > 0 && stabilityScore >= 1.0) {
      return true;
    }

    if (thinking.text.length > 0 && response.text.length === 0 && stabilityScore >= 1.0) {
      return true;
    }

    return false;
  }

  private createEmptySnapshot(): ExtractedContent {
    return {
      thinking: '',
      response: '',
      isComplete: false,
      hasThinking: false,
      hasResponse: false,
      lastUpdated: Date.now(),
      stabilityScore: 0,
    };
  }

  private createErrorSnapshot(error: Error): ExtractedContent {
    return {
      thinking: '',
      response: '',
      isComplete: false,
      hasThinking: false,
      hasResponse: false,
      lastUpdated: Date.now(),
      stabilityScore: 0,
    };
  }

  private createEmptyDOMSnapshot(): DOMSnapshot {
    return {
      html: '',
      text: '',
      classList: [],
      childCount: 0,
      hasSpinner: false,
      timestamp: Date.now(),
    };
  }

  reset(): void {
    this.lastThinkingHTML = '';
    this.lastResponseHTML = '';
    this.stabilityCounter = 0;
  }
}

// ============================================
// 4. TEXT CLEANER
// ============================================

export interface CleanResult {
  thinking: string;
  response: string;
  removedSegments: RemovedSegment[];
  stats: CleaningStats;
}

export interface RemovedSegment {
  type: 'self-talk' | 'repetition' | 'raw-markup' | 'response-tag' | 'delimiter';
  original: string;
  position: number;
  pattern: string;
}

export interface CleaningStats {
  selfTalkRemoved: number;
  repetitionsRemoved: number;
  tagsStripped: number;
  markupRemoved: number;
  totalCharsRemoved: number;
  originalThinkingLength: number;
  originalResponseLength: number;
}

export class KimiTextCleaner {
  private removedSegments: RemovedSegment[] = [];
  private stats: CleaningStats;

  constructor() {
    this.stats = this.createEmptyStats();
  }

  clean(thinking: string, response: string): CleanResult {
    this.removedSegments = [];
    this.stats = this.createEmptyStats();

    this.stats.originalThinkingLength = thinking.length;
    this.stats.originalResponseLength = response.length;

    let cleanedThinking = thinking;
    let cleanedResponse = response;

    cleanedThinking = this.stripResponseTags(cleanedThinking);
    cleanedResponse = this.stripResponseTags(cleanedResponse);
    cleanedThinking = this.removeSelfTalk(cleanedThinking);
    cleanedThinking = this.removeRepetitions(cleanedThinking);
    cleanedThinking = this.removeRawMarkup(cleanedThinking);
    cleanedThinking = this.removeDelimiters(cleanedThinking);
    cleanedThinking = this.finalNormalization(cleanedThinking);
    cleanedResponse = this.finalNormalization(cleanedResponse);

    this.stats.totalCharsRemoved = 
      (this.stats.originalThinkingLength - cleanedThinking.length) +
      (this.stats.originalResponseLength - cleanedResponse.length);

    return {
      thinking: cleanedThinking,
      response: cleanedResponse,
      removedSegments: [...this.removedSegments],
      stats: { ...this.stats },
    };
  }

  private stripResponseTags(text: string): string {
    let result = text;
    const matches = text.match(TEXT_PATTERNS.RESPONSE_TAG);

    if (matches) {
      this.stats.tagsStripped += matches.length;
      matches.forEach(match => {
        this.removedSegments.push({
          type: 'response-tag',
          original: match,
          position: text.indexOf(match),
          pattern: 'RESPONSE_TAG',
        });
      });
      result = text.replace(TEXT_PATTERNS.RESPONSE_TAG, '');
    }

    return result;
  }

  private removeSelfTalk(text: string): string {
    let result = text;

    TEXT_PATTERNS.SELF_TALK.forEach((pattern, index) => {
      const matches = result.match(pattern);
      if (matches) {
        this.stats.selfTalkRemoved += matches.length;
        matches.forEach(match => {
          this.removedSegments.push({
            type: 'self-talk',
            original: match,
            position: result.indexOf(match),
            pattern: `SELF_TALK[${index}]`,
          });
        });
        result = result.replace(pattern, '');
      }
    });

    return result;
  }

  private removeRepetitions(text: string): string {
    let result = text;

    TEXT_PATTERNS.REPETITION_PATTERNS.forEach((pattern, index) => {
      const matches = result.match(pattern);
      if (matches) {
        this.stats.repetitionsRemoved += matches.length;
        matches.forEach(match => {
          this.removedSegments.push({
            type: 'repetition',
            original: match,
            position: result.indexOf(match),
            pattern: `REPETITION[${index}]`,
          });
        });
        result = result.replace(pattern, '');
      }
    });

    return result;
  }

  private removeRawMarkup(text: string): string {
    let result = text;

    const lines = result.split('\n');
    const cleanedLines = lines.map(line => {
      if (/^\s*<[a-zA-Z][^>]*>\s*$/.test(line) && !line.includes('```')) {
        this.stats.markupRemoved++;
        this.removedSegments.push({
          type: 'raw-markup',
          original: line,
          position: 0,
          pattern: 'RAW_HTML',
        });
        return '';
      }
      return line;
    });

    result = cleanedLines.join('\n');
    result = result.replace(/^```\s*\n\s*```$/gm, '');

    return result;
  }

  private removeDelimiters(text: string): string {
    let result = text;

    TEXT_PATTERNS.THINKING_DELIMITERS.forEach((pattern, index) => {
      const matches = result.match(pattern);
      if (matches) {
        matches.forEach(match => {
          this.removedSegments.push({
            type: 'delimiter',
            original: match,
            position: result.indexOf(match),
            pattern: `DELIMITER[${index}]`,
          });
        });
        result = result.replace(pattern, '');
      }
    });

    return result;
  }

  private finalNormalization(text: string): string {
    return text
      .trim()
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\s+/gm, '')
      .replace(/\s+$/gm, '');
  }

  private createEmptyStats(): CleaningStats {
    return {
      selfTalkRemoved: 0,
      repetitionsRemoved: 0,
      tagsStripped: 0,
      markupRemoved: 0,
      totalCharsRemoved: 0,
      originalThinkingLength: 0,
      originalResponseLength: 0,
    };
  }
}

// ============================================
// 5. POLLING ENGINE
// ============================================

export interface PollingCallbacks {
  onStateChange?: (transition: StateTransition) => void;
  onThinkingUpdate?: (content: string, isComplete: boolean, cleaned: CleanResult) => void;
  onResponseUpdate?: (content: string, isComplete: boolean, cleaned: CleanResult) => void;
  onError?: (error: Error) => void;
  onHeartbeat?: (info: HeartbeatInfo) => void;
}

export interface HeartbeatInfo {
  state: KimiState;
  intervalMs: number;
  lastSuccess: number;
  consecutiveErrors: number;
  thinkingLength: number;
  responseLength: number;
}

export class KimiPollingEngine {
  private page: any;
  private stateMachine: KimiStateMachine;
  private domExtractor: KimiDOMExtractor;
  private textCleaner: KimiTextCleaner;
  private callbacks: PollingCallbacks;

  private isRunning: boolean = false;
  private pollTimer: any = null;
  private currentInterval: number = POLLING_CONFIG.INTERVAL_MS;
  private consecutiveErrors: number = 0;
  private lastSuccess: number = 0;
  private heartbeatCount: number = 0;

  constructor(page: any, callbacks: PollingCallbacks = {}) {
    this.page = page;
    this.callbacks = callbacks;
    this.stateMachine = new KimiStateMachine();
    this.domExtractor = new KimiDOMExtractor(page);
    this.textCleaner = new KimiTextCleaner();

    this.setupStateMachineCallbacks();
  }

  private setupStateMachineCallbacks(): void {
    this.stateMachine.onStateChange = (transition) => {
      this.callbacks.onStateChange?.(transition);
    };

    this.stateMachine.onThinkingUpdate = (content, isComplete) => {
      const cleaned = this.textCleaner.clean(content, '');
      this.callbacks.onThinkingUpdate?.(cleaned.thinking, isComplete, cleaned);
    };

    this.stateMachine.onResponseUpdate = (content, isComplete) => {
      const cleaned = this.textCleaner.clean('', content);
      this.callbacks.onResponseUpdate?.(cleaned.response, isComplete, cleaned);
    };

    this.stateMachine.onError = (error) => {
      this.callbacks.onError?.(error);
    };
  }

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.currentInterval = POLLING_CONFIG.INTERVAL_MS;
    this.consecutiveErrors = 0;
    this.lastSuccess = Date.now();

    this.scheduleNextPoll();
  }

  stop(): void {
    this.isRunning = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  reset(): void {
    this.stop();
    this.stateMachine.reset();
    this.domExtractor.reset();
    this.consecutiveErrors = 0;
    this.currentInterval = POLLING_CONFIG.INTERVAL_MS;
  }

  private scheduleNextPoll(): void {
    if (!this.isRunning) return;

    this.pollTimer = setTimeout(() => {
      this.executePoll();
    }, this.currentInterval);
  }

  private async executePoll(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const snapshot = await this.domExtractor.extract();

      if (snapshot) {
        this.stateMachine.processSnapshot(snapshot);
        this.consecutiveErrors = 0;
        this.currentInterval = POLLING_CONFIG.INTERVAL_MS;
        this.lastSuccess = Date.now();
      } else {
        this.stateMachine.processSnapshot({
          thinking: '',
          response: '',
          isComplete: true,
          hasThinking: false,
          hasResponse: false,
          lastUpdated: Date.now(),
          stabilityScore: 1.0,
        });
      }

    } catch (error) {
      this.consecutiveErrors++;
      this.currentInterval = Math.min(
        this.currentInterval * POLLING_CONFIG.BACKOFF_MULTIPLIER,
        POLLING_CONFIG.MAX_INTERVAL_MS
      );
      this.callbacks.onError?.(error as Error);

      if (this.consecutiveErrors > 5) {
        console.error(`[KimiPollingEngine] ${this.consecutiveErrors} erros consecutivos`);
      }
    }

    this.heartbeatCount++;
    if (this.heartbeatCount % 10 === 0) {
      this.emitHeartbeat();
    }

    this.scheduleNextPoll();
  }

  private emitHeartbeat(): void {
    const lastContent = this.stateMachine.getLastContent();
    this.callbacks.onHeartbeat?.({
      state: this.stateMachine.getCurrentState(),
      intervalMs: Math.round(this.currentInterval),
      lastSuccess: this.lastSuccess,
      consecutiveErrors: this.consecutiveErrors,
      thinkingLength: lastContent?.thinking.length || 0,
      responseLength: lastContent?.response.length || 0,
    });
  }

  getCurrentState(): KimiState {
    return this.stateMachine.getCurrentState();
  }

  isActive(): boolean {
    return this.isRunning;
  }
}

// ============================================
// 6. TUI STATUS INDICATORS
// ============================================

export interface StatusTheme {
  thinking: { emoji: string; color: string; label: string };
  responding: { emoji: string; color: string; label: string };
  idle: { emoji: string; color: string; label: string };
  error: { emoji: string; color: string; label: string };
}

export const DEFAULT_STATUS_THEME: StatusTheme = {
  thinking: { emoji: '🟡', color: '#f59e0b', label: 'Analisando' },
  responding: { emoji: '🟢', color: '#10b981', label: 'Respondendo' },
  idle: { emoji: '⚪', color: '#6b7280', label: 'Aguardando' },
  error: { emoji: '🔴', color: '#ef4444', label: 'Erro' },
};

export class TUIStatusRenderer {
  private theme: StatusTheme;
  private currentStatusLine: string = '';
  private thinkingLines: string[] = [];
  private responseLines: string[] = [];
  private maxThinkingLines: number = 8;
  private maxResponseLines: number = 20;

  constructor(theme: StatusTheme = DEFAULT_STATUS_THEME) {
    this.theme = theme;
  }

  renderStatusLine(state: KimiState): string {
    const config = this.theme[state];
    this.currentStatusLine = `${config.emoji} ${config.label}`;
    return this.currentStatusLine;
  }

  renderThinking(content: string, isComplete: boolean, cleaned: CleanResult): string[] {
    const lines = content.split('\n').filter(l => l.trim());

    if (lines.length > this.maxThinkingLines) {
      this.thinkingLines = lines.slice(-this.maxThinkingLines);
    } else {
      this.thinkingLines = lines;
    }

    const prefix = isComplete ? '✓' : '⋯';
    const color = isComplete ? '#6b7280' : '#f59e0b';

    return this.thinkingLines.map((line, i) => {
      const isLast = i === this.thinkingLines.length - 1 && !isComplete;
      const cursor = isLast ? '▌' : ' ';
      return `{${color}}${prefix}${cursor}{/} ${line}`;
    });
  }

  renderResponse(content: string, isComplete: boolean, cleaned: CleanResult): string[] {
    const lines = content.split('\n');

    if (lines.length > this.maxResponseLines) {
      this.responseLines = lines.slice(-this.maxResponseLines);
    } else {
      this.responseLines = lines;
    }

    const prefix = isComplete ? '✓' : '▶';
    const color = isComplete ? '#10b981' : '#3b82f6';

    return this.responseLines.map((line, i) => {
      const isLast = i === this.responseLines.length - 1 && !isComplete;
      const cursor = isLast ? '▌' : ' ';
      return `{${color}}${prefix}${cursor}{/} ${line}`;
    });
  }

  renderTransition(transition: StateTransition): string {
    const fromConfig = this.theme[transition.from];
    const toConfig = this.theme[transition.to];

    return `\n{${fromConfig.color}}${fromConfig.emoji} ${transition.from}{/} → {${toConfig.color}}${toConfig.emoji} ${transition.to}{/}\n  └─ ${transition.reason}`;
  }

  renderCleaningStats(cleaned: CleanResult): string {
    const { stats } = cleaned;
    if (stats.totalCharsRemoved === 0) return '';

    return `{#6b7280}🧹 Limpo: ${stats.totalCharsRemoved} chars | ` +
           `self-talk: ${stats.selfTalkRemoved} | ` +
           `repetições: ${stats.repetitionsRemoved} | ` +
           `tags: ${stats.tagsStripped}{/}`;
  }

  renderHeartbeat(info: {
    state: KimiState;
    intervalMs: number;
    lastSuccess: number;
    consecutiveErrors: number;
    thinkingLength: number;
    responseLength: number;
  }): string {
    const age = Date.now() - info.lastSuccess;
    const ageStr = age < 1000 ? `${age}ms` : `${Math.round(age/1000)}s`;

    return `{#6b7280}💓 ${info.state} | ${info.intervalMs}ms | ` +
           `last: ${ageStr} ago | errors: ${info.consecutiveErrors} | ` +
           `content: ${info.thinkingLength}+${info.responseLength}{/}`;
  }

  setMaxThinkingLines(n: number): void { this.maxThinkingLines = n; }
  setMaxResponseLines(n: number): void { this.maxResponseLines = n; }
}

// ============================================
// 7. LUNA CLI ADAPTER — Integração Completa
// ============================================

export interface LunaKimiConfig {
  page: any; // Playwright Page
  onThinking?: (lines: string[], stats: CleanResult) => void;
  onResponse?: (lines: string[], stats: CleanResult) => void;
  onStatusChange?: (status: string, transition?: StateTransition) => void;
  onError?: (error: Error) => void;
  onHeartbeat?: (info: string) => void;
  maxThinkingLines?: number;
  maxResponseLines?: number;
}

export class LunaKimiAdapter {
  private engine: KimiPollingEngine;
  private renderer: TUIStatusRenderer;
  private config: LunaKimiConfig;

  constructor(config: LunaKimiConfig) {
    this.config = config;
    this.renderer = new TUIStatusRenderer(DEFAULT_STATUS_THEME);

    if (config.maxThinkingLines) {
      this.renderer.setMaxThinkingLines(config.maxThinkingLines);
    }
    if (config.maxResponseLines) {
      this.renderer.setMaxResponseLines(config.maxResponseLines);
    }

    const callbacks: PollingCallbacks = {
      onStateChange: (transition) => {
        const statusLine = this.renderer.renderStatusLine(transition.to);
        const transitionStr = this.renderer.renderTransition(transition);
        config.onStatusChange?.(`${statusLine}${transitionStr}`, transition);
      },

      onThinkingUpdate: (content, isComplete, cleaned) => {
        const lines = this.renderer.renderThinking(content, isComplete, cleaned);
        config.onThinking?.(lines, cleaned);
      },

      onResponseUpdate: (content, isComplete, cleaned) => {
        const lines = this.renderer.renderResponse(content, isComplete, cleaned);
        config.onResponse?.(lines, cleaned);
      },

      onError: (error) => {
        const statusLine = this.renderer.renderStatusLine(KimiState.ERROR);
        config.onStatusChange?.(statusLine);
        config.onError?.(error);
      },

      onHeartbeat: (info) => {
        const heartbeatStr = this.renderer.renderHeartbeat(info);
        config.onHeartbeat?.(heartbeatStr);
      },
    };

    this.engine = new KimiPollingEngine(config.page, callbacks);
  }

  start(): void {
    this.engine.start();
    this.config.onStatusChange?.(this.renderer.renderStatusLine(KimiState.IDLE));
  }

  stop(): void {
    this.engine.stop();
  }

  reset(): void {
    this.engine.reset();
  }

  getState(): KimiState {
    return this.engine.getCurrentState();
  }

  isActive(): boolean {
    return this.engine.isActive();
  }
}

// ============================================
// 8. EXEMPLO DE USO
// ============================================

/*
import { Page } from 'playwright';
import { LunaKimiAdapter } from './kimiThinkingExtractor';

async function setupKimiWatcher(page: Page) {
  const adapter = new LunaKimiAdapter({
    page,

    onStatusChange: (status, transition) => {
      console.log(status);
    },

    onThinking: (lines, cleaned) => {
      lines.forEach(line => console.log(line));
      if (cleaned.stats.totalCharsRemoved > 0) {
        console.log(`🧹 ${cleaned.stats.totalCharsRemoved} chars removidos`);
      }
    },

    onResponse: (lines, cleaned) => {
      lines.forEach(line => console.log(line));
    },

    onError: (error) => {
      console.error('❌ Erro no watcher:', error.message);
    },

    maxThinkingLines: 6,
    maxResponseLines: 50,
  });

  adapter.start();
  return adapter;
}
*/

// ============================================
// 9. EXPORTAÇÕES
// ============================================

export {
  KIMI_SELECTORS,
  TEXT_PATTERNS,
  POLLING_CONFIG,
  KimiState,
  KimiStateMachine,
  KimiDOMExtractor,
  KimiTextCleaner,
  KimiPollingEngine,
  TUIStatusRenderer,
  LunaKimiAdapter,
  DEFAULT_STATUS_THEME,
};
