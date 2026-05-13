/**
 * NetworkMonitor - Monitoramento de requisições de rede
 */

import type { NetworkRequest } from '../types';

/** Configuração do NetworkMonitor */
interface NetworkMonitorConfig {
  maxRequests?: number;
  captureSuccessful?: boolean;
  captureFailed?: boolean;
}

/** Classe para monitorar requisições de rede */
export class NetworkMonitor {
  private requests: NetworkRequest[] = [];
  private config: Required<NetworkMonitorConfig>;
  private originalFetch: typeof fetch;
  private originalXHR: typeof XMLHttpRequest;
  private isMonitoring = false;

  constructor(config: NetworkMonitorConfig = {}) {
    this.config = {
      maxRequests: config.maxRequests ?? 50,
      captureSuccessful: config.captureSuccessful ?? true,
      captureFailed: config.captureFailed ?? true,
    };
    this.originalFetch = window.fetch.bind(window);
    this.originalXHR = window.XMLHttpRequest;
  }

  /** Inicia o monitoramento */
  start(): void {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    this.interceptFetch();
    this.interceptXHR();
  }

  /** Para o monitoramento */
  stop(): void {
    if (!this.isMonitoring) return;
    this.isMonitoring = false;

    // Restaurar fetch original
    window.fetch = this.originalFetch;
    // Não é possível restaurar XMLHttpRequest de forma simples
  }

  /** Retorna as requisições capturadas */
  getRequests(): NetworkRequest[] {
    return [...this.requests];
  }

  /** Retorna apenas requisições com erro */
  getFailedRequests(): NetworkRequest[] {
    return this.requests.filter(req => req.status >= 400 || req.error);
  }

  /** Limpa as requisições */
  clear(): void {
    this.requests = [];
  }

  /** Intercepta o fetch */
  private interceptFetch(): void {
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const startTime = performance.now();
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      try {
        const response = await this.originalFetch(input, init);
        const duration = performance.now() - startTime;

        if (this.config.captureSuccessful || !response.ok) {
          this.addRequest({
            url,
            method,
            status: response.status,
            duration,
            timestamp: new Date().toISOString(),
          });
        }

        return response;
      } catch (error) {
        const duration = performance.now() - startTime;

        if (this.config.captureFailed) {
          this.addRequest({
            url,
            method,
            status: 0,
            duration,
            timestamp: new Date().toISOString(),
            error: (error as Error).message,
          });
        }

        throw error;
      }
    };
  }

  /** Intercepta XMLHttpRequest */
  private interceptXHR(): void {
    const self = this;

    class InterceptedXHR extends XMLHttpRequest {
      private startTime = 0;
      private method = 'GET';
      private url = '';

      open(method: string, url: string | URL, ...args: unknown[]): void {
        this.method = method;
        this.url = typeof url === 'string' ? url : url.toString();
        super.open(method, url, ...(args as [boolean, string | null, string | null]));
      }

      send(body?: Document | XMLHttpRequestBodyInit | null): void {
        this.startTime = performance.now();

        this.addEventListener('loadend', () => {
          const duration = performance.now() - this.startTime;
          const status = this.status;

          if ((self.config.captureSuccessful && status < 400) ||
              (self.config.captureFailed && (status >= 400 || status === 0))) {
            self.addRequest({
              url: this.url,
              method: this.method,
              status,
              duration,
              timestamp: new Date().toISOString(),
              error: status >= 400 ? this.statusText : undefined,
            });
          }
        });

        super.send(body);
      }
    }

    window.XMLHttpRequest = InterceptedXHR as typeof XMLHttpRequest;
  }

  /** Adiciona uma requisição */
  private addRequest(request: NetworkRequest): void {
    this.requests.push(request);

    // Limitar quantidade de requisições
    if (this.requests.length > this.config.maxRequests) {
      this.requests = this.requests.slice(-this.config.maxRequests);
    }
  }
}

export default NetworkMonitor;
