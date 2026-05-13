/**
 * Auto Error Detector
 * Captures JavaScript errors automatically without user intervention.
 * Includes: window.onerror, unhandledrejection, stack trace capture,
 * error grouping by fingerprint, and context enrichment.
 */

import type { ConsoleLog, NetworkRequest } from '../types';

export interface CapturedError {
  id: string;
  timestamp: string;
  type: 'js-error' | 'unhandledrejection' | 'resource-error' | 'console-error';
  message: string;
  stack?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  fingerprint: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  url: string;
  userAgent: string;
  viewport: { width: number; height: number };
  consoleLogs: ConsoleLog[];
  networkRequests: NetworkRequest[];
  sessionReplaySnapshot?: unknown;
}

export interface AutoErrorConfig {
  enabled: boolean;
  captureConsoleErrors: boolean;
  captureResourceErrors: boolean;
  maxErrorsPerMinute: number;
  sampleRate: number;
  includeLocalhost: boolean;
  ignorePatterns: RegExp[];
}

export const DEFAULT_AUTO_ERROR_CONFIG: AutoErrorConfig = {
  enabled: true,
  captureConsoleErrors: true,
  captureResourceErrors: true,
  maxErrorsPerMinute: 30,
  sampleRate: 1.0,
  includeLocalhost: true,
  ignorePatterns: [
    /Script error\.?/i,
    /chrome-extension:\/\//i,
    /moz-extension:\/\//i,
    /ResizeObserver loop limit exceeded/i,
    /Network error/i,
  ],
};

/** Generate error fingerprint for deduplication */
function generateFingerprint(message: string, stack?: string, filename?: string): string {
  const normalizedMessage = message.replace(/\d+/g, 'N').replace(/['"`][a-f0-9-]{8,}['"`]/g, "'ID'");
  const normalizedStack = (stack || '')
    .split('\n')
    .slice(0, 3)
    .join('\n')
    .replace(/:\d+:\d+/g, ':L:C')
    .replace(/\b[0-9a-f]{8,}\b/g, 'ID');
  const key = `${normalizedMessage}|${filename || ''}|${normalizedStack}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return `err_${Math.abs(hash).toString(36)}`;
}

export class AutoErrorDetector {
  private config: AutoErrorConfig;
  private errors: Map<string, CapturedError> = new Map();
  private recentErrors: string[] = [];
  private isActive = false;
  private consoleBuffer: ConsoleLog[] = [];
  private networkBuffer: NetworkRequest[] = [];
  private originalConsoleError: typeof console.error | null = null;
  private listeners: ((error: CapturedError) => void)[] = [];

  constructor(config: Partial<AutoErrorConfig> = {}) {
    this.config = { ...DEFAULT_AUTO_ERROR_CONFIG, ...config };
  }

  activate(): void {
    if (this.isActive || !this.config.enabled) return;
    this.isActive = true;

    this.setupWindowError();
    this.setupUnhandledRejection();
    this.setupResourceError();
    this.setupConsoleErrorCapture();
  }

  deactivate(): void {
    if (!this.isActive) return;
    this.isActive = false;

    window.removeEventListener('error', this.handleWindowError);
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
    window.removeEventListener('error', this.handleResourceError, true);

    if (this.originalConsoleError) {
      console.error = this.originalConsoleError;
      this.originalConsoleError = null;
    }
  }

  onError(callback: (error: CapturedError) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  getErrors(): CapturedError[] {
    return Array.from(this.errors.values()).sort(
      (a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
    );
  }

  getErrorByFingerprint(fingerprint: string): CapturedError | undefined {
    return this.errors.get(fingerprint);
  }

  clear(): void {
    this.errors.clear();
    this.recentErrors = [];
    this.consoleBuffer = [];
    this.networkBuffer = [];
  }

  /** Set console logs buffer (called by CaptureManager) */
  setConsoleBuffer(logs: ConsoleLog[]): void {
    this.consoleBuffer = [...logs];
  }

  /** Set network requests buffer (called by CaptureManager) */
  setNetworkBuffer(requests: NetworkRequest[]): void {
    this.networkBuffer = [...requests];
  }

  // ============================================================================
  // PRIVATE
  // ============================================================================

  private handleWindowError = (event: ErrorEvent): void => {
    this.processError({
      type: 'js-error',
      message: event.message || 'Unknown error',
      stack: event.error?.stack,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  };

  private handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
    let message: string;
    let stack: string | undefined;

    if (event.reason instanceof Error) {
      message = event.reason.message;
      stack = event.reason.stack;
    } else if (typeof event.reason === 'string') {
      message = event.reason;
    } else {
      try {
        message = JSON.stringify(event.reason);
      } catch {
        message = 'Unhandled promise rejection';
      }
    }

    this.processError({
      type: 'unhandledrejection',
      message,
      stack,
    });
  };

  private handleResourceError = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const tag = target.tagName?.toLowerCase();
    if (tag !== 'img' && tag !== 'script' && tag !== 'link') return;

    const src = (target as HTMLImageElement | HTMLScriptElement).src ||
      (target as HTMLLinkElement).href || 'unknown';

    this.processError({
      type: 'resource-error',
      message: `Failed to load ${tag}: ${src}`,
      filename: src,
    });
  };

  private setupWindowError(): void {
    window.addEventListener('error', this.handleWindowError);
  }

  private setupUnhandledRejection(): void {
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  private setupResourceError(): void {
    window.addEventListener('error', this.handleResourceError, true);
  }

  private setupConsoleErrorCapture(): void {
    if (!this.config.captureConsoleErrors) return;

    this.originalConsoleError = console.error;
    const self = this;

    console.error = function (...args: unknown[]) {
      const message = args.map((a) => (typeof a === 'string' ? a : String(a))).join(' ');
      self.processError({
        type: 'console-error',
        message: message.slice(0, 500),
      });
      self.originalConsoleError!.apply(console, args);
    };
  }

  private processError(data: {
    type: CapturedError['type'];
    message: string;
    stack?: string;
    filename?: string;
    lineno?: number;
    colno?: number;
  }): void {
    // Rate limiting
    if (!this.checkRateLimit()) return;

    // Sampling
    if (Math.random() > this.config.sampleRate) return;

    // Ignore patterns
    if (this.config.ignorePatterns.some((pattern) => pattern.test(data.message))) return;

    // Ignore localhost if configured
    if (!this.config.includeLocalhost && window.location.hostname === 'localhost') return;

    const fingerprint = generateFingerprint(data.message, data.stack, data.filename);
    const now = new Date().toISOString();

    const existing = this.errors.get(fingerprint);
    if (existing) {
      existing.count++;
      existing.lastSeen = now;
      existing.consoleLogs = [...this.consoleBuffer.slice(-20)];
      existing.networkRequests = [...this.networkBuffer.slice(-10)];
      this.notifyListeners(existing);
      return;
    }

    const error: CapturedError = {
      id: crypto.randomUUID(),
      timestamp: now,
      type: data.type,
      message: data.message,
      stack: data.stack,
      filename: data.filename,
      lineno: data.lineno,
      colno: data.colno,
      fingerprint,
      count: 1,
      firstSeen: now,
      lastSeen: now,
      url: window.location.href,
      userAgent: navigator.userAgent,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      consoleLogs: [...this.consoleBuffer.slice(-20)],
      networkRequests: [...this.networkBuffer.slice(-10)],
    };

    this.errors.set(fingerprint, error);
    this.recentErrors.push(fingerprint);
    if (this.recentErrors.length > 1000) {
      this.recentErrors.shift();
    }

    this.notifyListeners(error);
  }

  private checkRateLimit(): boolean {
    const oneMinuteAgo = Date.now() - 60000;
    this.recentErrors = this.recentErrors.filter((fp) => {
      const err = this.errors.get(fp);
      return err && new Date(err.timestamp).getTime() > oneMinuteAgo;
    });

    // Count unique errors in last minute (by timestamp of first occurrence)
    const recentCount = this.recentErrors.filter((fp) => {
      const err = this.errors.get(fp);
      return err && new Date(err.timestamp).getTime() > oneMinuteAgo;
    }).length;

    return recentCount < this.config.maxErrorsPerMinute;
  }

  private notifyListeners(error: CapturedError): void {
    this.listeners.forEach((cb) => {
      try {
        cb(error);
      } catch {
        // ignore listener errors
      }
    });
  }
}

export default AutoErrorDetector;
