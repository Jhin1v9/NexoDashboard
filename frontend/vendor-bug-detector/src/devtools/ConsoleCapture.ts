/**
 * ConsoleCapture - Captura logs do console
 */

import type { ConsoleLog } from '../types';

/** Configuração do ConsoleCapture */
interface ConsoleCaptureConfig {
  maxLogs?: number;
  captureErrors?: boolean;
  captureWarnings?: boolean;
  captureInfo?: boolean;
  captureDebug?: boolean;
}

/** Classe para capturar logs do console */
export class ConsoleCapture {
  private logs: ConsoleLog[] = [];
  private config: Required<ConsoleCaptureConfig>;
  private originalConsole: typeof console;
  private isCapturing = false;

  constructor(config: ConsoleCaptureConfig = {}) {
    this.config = {
      maxLogs: config.maxLogs ?? 50,
      captureErrors: config.captureErrors ?? true,
      captureWarnings: config.captureWarnings ?? true,
      captureInfo: config.captureInfo ?? true,
      captureDebug: config.captureDebug ?? false,
    };
    this.originalConsole = { ...console };
  }

  /** Inicia a captura de logs */
  start(): void {
    if (this.isCapturing) return;
    this.isCapturing = true;

    // Interceptar console.error
    if (this.config.captureErrors) {
      console.error = (...args: unknown[]) => {
        this.addLog('error', args);
        this.originalConsole.error(...args);
      };
    }

    // Interceptar console.warn
    if (this.config.captureWarnings) {
      console.warn = (...args: unknown[]) => {
        this.addLog('warn', args);
        this.originalConsole.warn(...args);
      };
    }

    // Interceptar console.info
    if (this.config.captureInfo) {
      console.info = (...args: unknown[]) => {
        this.addLog('info', args);
        this.originalConsole.info(...args);
      };
    }

    // Interceptar console.log
    if (this.config.captureDebug) {
      console.log = (...args: unknown[]) => {
        this.addLog('log', args);
        this.originalConsole.log(...args);
      };
    }
  }

  /** Para a captura de logs */
  stop(): void {
    if (!this.isCapturing) return;
    this.isCapturing = false;

    // Restaurar console original
    console.error = this.originalConsole.error;
    console.warn = this.originalConsole.warn;
    console.info = this.originalConsole.info;
    console.log = this.originalConsole.log;
  }

  /** Retorna os logs capturados */
  getLogs(): ConsoleLog[] {
    return [...this.logs];
  }

  /** Retorna apenas logs de erro */
  getErrors(): ConsoleLog[] {
    return this.logs.filter(log => log.type === 'error');
  }

  /** Retorna apenas logs de warning */
  getWarnings(): ConsoleLog[] {
    return this.logs.filter(log => log.type === 'warn');
  }

  /** Limpa os logs */
  clear(): void {
    this.logs = [];
  }

  /** Adiciona um log */
  private addLog(type: ConsoleLog['type'], args: unknown[]): void {
    const message = args.map(arg => this.formatArg(arg)).join(' ');
    const stack = type === 'error' ? this.captureStack() : undefined;

    const log: ConsoleLog = {
      type,
      message,
      timestamp: new Date().toISOString(),
      stack,
    };

    this.logs.push(log);

    // Limitar quantidade de logs
    if (this.logs.length > this.config.maxLogs) {
      this.logs = this.logs.slice(-this.config.maxLogs);
    }
  }

  /** Formata um argumento para string */
  private formatArg(arg: unknown): string {
    if (typeof arg === 'string') return arg;
    if (typeof arg === 'number') return String(arg);
    if (typeof arg === 'boolean') return String(arg);
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
    try {
      return JSON.stringify(arg);
    } catch {
      return '[Object]';
    }
  }

  /** Captura a stack trace */
  private captureStack(): string | undefined {
    try {
      throw new Error();
    } catch (e) {
      const stack = (e as Error).stack;
      if (stack) {
        // Remover as primeiras linhas (são do próprio ConsoleCapture)
        return stack.split('\n').slice(3).join('\n');
      }
    }
    return undefined;
  }
}

export default ConsoleCapture;
