/**
 * Rate Limiter
 * Controla frequência de operações para evitar sobrecarga de API
 */

interface RateLimiterConfig {
  maxRequests: number;
  windowMs: number;
}

export class RateLimiter {
  private requests: number[] = [];
  private config: RateLimiterConfig;

  constructor(config: RateLimiterConfig) {
    this.config = config;
  }

  /** Verifica se pode fazer uma nova requisição */
  canProceed(): boolean {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    // Remove requisições antigas fora da janela
    this.requests = this.requests.filter(time => time > windowStart);
    
    // Verifica se ainda há espaço na janela
    return this.requests.length < this.config.maxRequests;
  }

  /** Registra uma nova requisição */
  recordRequest(): void {
    this.requests.push(Date.now());
  }

  /** Aguarda até poder fazer a próxima requisição */
  async waitForSlot(): Promise<void> {
    while (!this.canProceed()) {
      const now = Date.now();
      const windowStart = now - this.config.windowMs;
      const oldestRequest = this.requests[0];
      const waitTime = Math.max(0, oldestRequest - windowStart + 100);
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  /** Retorna tempo restante até poder fazer requisição (ms) */
  getTimeUntilNextSlot(): number {
    if (this.canProceed()) return 0;
    
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const oldestRequest = this.requests[0];
    
    return Math.max(0, oldestRequest - windowStart);
  }

  /** Retorna quantas requisições ainda são permitidas na janela atual */
  getRemainingRequests(): number {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const currentRequests = this.requests.filter(time => time > windowStart).length;
    
    return Math.max(0, this.config.maxRequests - currentRequests);
  }
}

export default RateLimiter;
