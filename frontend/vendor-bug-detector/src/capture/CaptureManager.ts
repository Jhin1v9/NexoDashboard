/**
 * Gerenciador de Captura
 * Captura screenshots, logs, network e métricas
 */

import type { 
  CaptureConfig, 
  ConsoleLog, 
  NetworkRequest, 
  PerformanceMetrics 
} from '../types';

/** Capturas realizadas */
export interface Captures {
  screenshot?: string;
  consoleLogs?: ConsoleLog[];
  networkRequests?: NetworkRequest[];
  performanceMetrics?: PerformanceMetrics;
}

/** Classe CaptureManager */
export class CaptureManager {
  private config: Required<CaptureConfig>;
  private consoleLogs: ConsoleLog[] = [];
  private networkRequests: NetworkRequest[] = [];
  private originalConsole: Partial<typeof console> = {};
  private originalFetch: typeof fetch | null = null;
  private originalXHR: typeof XMLHttpRequest | null = null;
  
  // LIMITES PARA PREVENIR MEMORY LEAKS
  private readonly MAX_LOGS = 1000;
  private readonly MAX_NETWORK_REQUESTS = 500;

  constructor(config: Required<CaptureConfig>) {
    this.config = config;
  }

  /** Ativa captura de console e network */
  activate(): void {
    this.setupConsoleCapture();
    this.setupNetworkCapture();
  }

  /** Desativa captura de console e network */
  deactivate(): void {
    this.restoreConsole();
    this.restoreNetwork();
  }

  /** Captura tudo */
  async captureAll(element?: Element): Promise<Captures> {
    const captures: Captures = {};

    if (this.config.screenshot && element) {
      captures.screenshot = await this.captureScreenshot(element);
    }

    if (this.config.console) {
      captures.consoleLogs = this.getConsoleLogs();
    }

    if (this.config.network) {
      captures.networkRequests = this.getNetworkRequests();
    }

    if (this.config.performance) {
      captures.performanceMetrics = this.capturePerformanceMetrics();
    }

    return captures;
  }

  /** Captura screenshot */
  async captureScreenshot(element?: Element): Promise<string> {
    try {
      // Lazy load html2canvas
      const html2canvas = (await import('html2canvas')).default;
      
      const target = element || document.body;
      const canvas = await html2canvas(target as HTMLElement, {
        logging: false,
        useCORS: true,
        allowTaint: true,
        scale: window.devicePixelRatio,
        backgroundColor: null,
      });

      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('Erro ao capturar screenshot:', error);
      return '';
    }
  }

  /** Captura screenshot da viewport inteira */
  async captureFullPage(): Promise<string> {
    try {
      const html2canvas = (await import('html2canvas')).default;
      
      const canvas = await html2canvas(document.body, {
        logging: false,
        useCORS: true,
        allowTaint: true,
        scale: 1,
        height: document.body.scrollHeight,
        windowHeight: document.body.scrollHeight,
      });

      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('Erro ao capturar página:', error);
      return '';
    }
  }

  /** Obtém logs do console */
  getConsoleLogs(): ConsoleLog[] {
    return [...this.consoleLogs];
  }

  /** Limpa logs do console */
  clearConsoleLogs(): void {
    this.consoleLogs = [];
  }

  /** Obtém requisições de rede */
  getNetworkRequests(): NetworkRequest[] {
    return [...this.networkRequests];
  }

  /** Limpa requisições */
  clearNetworkRequests(): void {
    this.networkRequests = [];
  }

  /** Captura métricas de performance */
  capturePerformanceMetrics(): PerformanceMetrics {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType('paint');

    const metrics: PerformanceMetrics = {
      loadTime: navigation ? navigation.loadEventEnd - navigation.startTime : 0,
      domContentLoaded: navigation ? navigation.domContentLoadedEventEnd - navigation.startTime : 0,
    };

    paint.forEach(entry => {
      if (entry.name === 'first-paint') {
        metrics.firstPaint = entry.startTime;
      }
      if (entry.name === 'first-contentful-paint') {
        metrics.firstContentfulPaint = entry.startTime;
      }
    });

    return metrics;
  }

  /** Destrói e limpa */
  destroy(): void {
    this.deactivate();
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private setupConsoleCapture(): void {
    if (!this.config.console) return;

    // Salva originais
    this.originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
    };

    // Helper seguro para serializar argumentos do console
    const safeStringify = (arg: unknown): string => {
      if (arg === null) return 'null';
      if (arg === undefined) return 'undefined';
      if (typeof arg !== 'object') return String(arg).slice(0, 1000);
      try {
        return JSON.stringify(arg).slice(0, 1000);
      } catch {
        return '[Object]';
      }
    };

    // Sobrescreve com LIMITAÇÃO DE MEMÓRIA (FIFO)
    const captureLog = (level: ConsoleLog['type'], ...args: unknown[]) => {
      const log: ConsoleLog = {
        type: level,
        message: args.map(arg => safeStringify(arg)).join(' '),
        timestamp: new Date().toISOString(),
        stack: level === 'error' ? new Error().stack?.slice(0, 2000) : undefined,
      };
      
      // FIFO: remove o mais antigo se atingiu limite
      if (this.consoleLogs.length >= this.MAX_LOGS) {
        this.consoleLogs.shift();
      }
      this.consoleLogs.push(log);

      // Mantém comportamento original
      this.originalConsole[level]?.apply(console, args);
    };

    console.log = (...args) => captureLog('log', ...args);
    console.warn = (...args) => captureLog('warn', ...args);
    console.error = (...args) => captureLog('error', ...args);
    console.info = (...args) => captureLog('info', ...args);
  }

  private restoreConsole(): void {
    if (this.originalConsole.log) console.log = this.originalConsole.log;
    if (this.originalConsole.warn) console.warn = this.originalConsole.warn;
    if (this.originalConsole.error) console.error = this.originalConsole.error;
    if (this.originalConsole.info) console.info = this.originalConsole.info;
  }

  /** Adiciona request com limitação de memória */
  private addNetworkRequest(request: NetworkRequest): void {
    if (this.networkRequests.length >= this.MAX_NETWORK_REQUESTS) {
      this.networkRequests.shift();
    }
    this.networkRequests.push(request);
  }

  private setupNetworkCapture(): void {
    if (!this.config.network) return;

    // Intercepta fetch
    this.originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = performance.now();
      const [url, options] = args;
      
      try {
        const response = await this.originalFetch!.apply(window, args);
        
        this.addNetworkRequest({
          url: url.toString().slice(0, 500), // Limita URL
          method: options?.method || 'GET',
          status: response.status,
          statusText: response.statusText,
          duration: performance.now() - startTime,
          timestamp: new Date().toISOString(),
        });

        return response;
      } catch (error) {
        this.addNetworkRequest({
          url: url.toString().slice(0, 500),
          method: options?.method || 'GET',
          status: 0,
          statusText: 'Network Error',
          duration: performance.now() - startTime,
          timestamp: new Date().toISOString(),
        });
        throw error;
      }
    };

    // Intercepta XMLHttpRequest — preserva prototype e propriedades estáticas
    this.originalXHR = window.XMLHttpRequest;
    const self = this;

    function InterceptedXHR(this: XMLHttpRequest): XMLHttpRequest {
      const xhr = new (self.originalXHR as typeof XMLHttpRequest)();
      const startTime = performance.now();
      let requestUrl = '';
      let requestMethod = 'GET';

      const originalOpen = xhr.open.bind(xhr);
      xhr.open = function(method: string, url: string | URL) {
        requestMethod = method;
        requestUrl = url.toString();
        return originalOpen(method, url);
      };

      xhr.addEventListener('loadend', function() {
        self.addNetworkRequest({
          url: requestUrl.slice(0, 500),
          method: requestMethod,
          status: xhr.status,
          statusText: xhr.statusText,
          duration: performance.now() - startTime,
          timestamp: new Date().toISOString(),
        });
      });

      return xhr;
    }

    // Preserva prototype e propriedades estáticas (DONE, OPENED, etc.)
    if (self.originalXHR) {
      Object.setPrototypeOf(InterceptedXHR, self.originalXHR);
      InterceptedXHR.prototype = self.originalXHR.prototype;
      // Copia propriedades estáticas
      for (const key of Object.getOwnPropertyNames(self.originalXHR)) {
        if (key !== 'prototype' && key !== 'length' && key !== 'name') {
          try {
            (InterceptedXHR as any)[key] = (self.originalXHR as any)[key];
          } catch { /* ignore read-only */ }
        }
      }
    }
    window.XMLHttpRequest = InterceptedXHR as unknown as typeof XMLHttpRequest;
  }

  private restoreNetwork(): void {
    if (this.originalFetch) {
      window.fetch = this.originalFetch;
    }
    if (this.originalXHR) {
      window.XMLHttpRequest = this.originalXHR;
    }
  }
}

export default CaptureManager;
