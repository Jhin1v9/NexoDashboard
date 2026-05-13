/**
 * SessionReplayEngine
 * Grava eventos DOM num buffer circular para reprodução posterior.
 * Captura: clicks, scrolls, movimentos de mouse (amostrados), inputs,
 * redimensionamento de viewport e mudanças de URL.
 */

export interface ReplayEvent {
  type: 'mousemove' | 'click' | 'scroll' | 'input' | 'resize' | 'navigation';
  timestamp: number;
  data: Record<string, unknown>;
}

export interface SessionReplayData {
  events: ReplayEvent[];
  startTime: number;
  endTime: number;
  viewport: { width: number; height: number };
}

export interface SessionReplayOptions {
  /** Duração máxima do buffer em ms (padrão: 30000) */
  maxDuration?: number;
  /** Intervalo mínimo entre eventos de mousemove em ms */
  mouseMoveThrottle?: number;
  /** Target para escuta de eventos (default: document) */
  target?: Document | HTMLElement;
}

export class SessionReplayEngine {
  private events: ReplayEvent[] = [];
  private startTime = 0;
  private options: Required<Pick<SessionReplayOptions, 'maxDuration' | 'mouseMoveThrottle'>> & { target: Document | HTMLElement };
  private isRecording = false;
  private lastMouseMove = 0;
  private observers: (() => void)[] = [];
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options: SessionReplayOptions = {}) {
    this.options = {
      maxDuration: 30000,
      mouseMoveThrottle: 50,
      target: options.target || document,
      ...options,
    };
  }

  /** Inicia a gravação de eventos */
  start(): void {
    if (this.isRecording) return;
    this.isRecording = true;
    this.startTime = Date.now();
    this.events = [];
    this.observers = [];

    const target = this.options.target;

    // Mouse move (throttled)
    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - this.lastMouseMove < this.options.mouseMoveThrottle) return;
      this.lastMouseMove = now;
      this.pushEvent({
        type: 'mousemove',
        timestamp: now,
        data: { x: e.clientX, y: e.clientY },
      });
    };
    target.addEventListener('mousemove', handleMouseMove as EventListener);
    this.observers.push(() => target.removeEventListener('mousemove', handleMouseMove as EventListener));

    // Click
    const handleClick = (e: MouseEvent) => {
      this.pushEvent({
        type: 'click',
        timestamp: Date.now(),
        data: { x: e.clientX, y: e.clientY, target: this.getSelector(e.target as Element) },
      });
    };
    target.addEventListener('click', handleClick as EventListener, true);
    this.observers.push(() => target.removeEventListener('click', handleClick as EventListener, true));

    // Scroll
    const handleScroll = () => {
      this.pushEvent({
        type: 'scroll',
        timestamp: Date.now(),
        data: { x: window.scrollX, y: window.scrollY },
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    this.observers.push(() => window.removeEventListener('scroll', handleScroll));

    // Input (change em inputs e textareas)
    const handleInput = (e: Event) => {
      const el = e.target as HTMLInputElement | HTMLTextAreaElement;
      if (!el || (!el.tagName.match(/INPUT|TEXTAREA|SELECT/i))) return;
      const isSensitive = this.isSensitiveInput(el);
      this.pushEvent({
        type: 'input',
        timestamp: Date.now(),
        data: {
          selector: this.getSelector(el),
          value: isSensitive ? '***' : el.value,
          tag: el.tagName.toLowerCase(),
        },
      });
    };
    target.addEventListener('change', handleInput, true);
    this.observers.push(() => target.removeEventListener('change', handleInput, true));

    // Resize
    const handleResize = () => {
      this.pushEvent({
        type: 'resize',
        timestamp: Date.now(),
        data: { width: window.innerWidth, height: window.innerHeight },
      });
    };
    window.addEventListener('resize', handleResize);
    this.observers.push(() => window.removeEventListener('resize', handleResize));

    // Navigation (popstate)
    const handlePopState = () => {
      this.pushEvent({
        type: 'navigation',
        timestamp: Date.now(),
        data: { url: window.location.href },
      });
    };
    window.addEventListener('popstate', handlePopState);
    this.observers.push(() => window.removeEventListener('popstate', handlePopState));

    // Inicial viewport
    this.pushEvent({
      type: 'resize',
      timestamp: this.startTime,
      data: { width: window.innerWidth, height: window.innerHeight },
    });

    // Limpeza periódica de eventos antigos
    this.cleanupInterval = setInterval(() => this.trimOldEvents(), 5000);
  }

  /** Para a gravação */
  stop(): SessionReplayData {
    this.isRecording = false;
    this.observers.forEach((cleanup) => cleanup());
    this.observers = [];
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    return {
      events: [...this.events],
      startTime: this.startTime,
      endTime: Date.now(),
      viewport: { width: window.innerWidth, height: window.innerHeight },
    };
  }

  /** Limpa o buffer sem parar gravação */
  clear(): void {
    this.events = [];
    this.startTime = Date.now();
  }

  /** Retorna se está gravando */
  get recording(): boolean {
    return this.isRecording;
  }

  /** Retorna snapshot atual do buffer */
  getSnapshot(): SessionReplayData {
    return {
      events: [...this.events],
      startTime: this.startTime,
      endTime: Date.now(),
      viewport: { width: window.innerWidth, height: window.innerHeight },
    };
  }

  private pushEvent(event: ReplayEvent): void {
    this.events.push(event);
    this.trimOldEvents();
  }

  private trimOldEvents(): void {
    const cutoff = Date.now() - this.options.maxDuration;
    const index = this.events.findIndex((e) => e.timestamp >= cutoff);
    if (index > 0) {
      this.events = this.events.slice(index);
    }
  }

  private getSelector(el: Element | null): string | null {
    if (!el) return null;
    try {
      if (el.id) return `#${el.id}`;
      if (el.className && typeof el.className === 'string') {
        const cls = el.className.split(' ').filter(Boolean).join('.');
        if (cls) return `.${cls}`;
      }
      return el.tagName.toLowerCase();
    } catch {
      return null;
    }
  }

  private isSensitiveInput(el: HTMLInputElement | HTMLTextAreaElement): boolean {
    if (el.type === 'password') return true;
    const name = (el.name || '').toLowerCase();
    const id = (el.id || '').toLowerCase();
    const sensitive = ['password', 'cpf', 'ssn', 'credit', 'card', 'cvv', 'secret', 'token'];
    return sensitive.some((s) => name.includes(s) || id.includes(s));
  }
}

export default SessionReplayEngine;
