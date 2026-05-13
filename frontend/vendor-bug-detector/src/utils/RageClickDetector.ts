/**
 * Rage Click & Dead Click Detector
 * Detects user frustration signals:
 * - Rage clicks: 3+ clicks on same element within 1 second
 * - Dead clicks: clicks with no visual effect within 100ms
 * - Frustration score: composite metric per session
 */

export interface ClickEvent {
  timestamp: number;
  x: number;
  y: number;
  target: string | null;
  hadEffect: boolean;
}

export interface RageClickReport {
  type: 'rage-click';
  timestamp: string;
  element: string | null;
  clickCount: number;
  timeWindowMs: number;
  severity: 'low' | 'medium' | 'high';
}

export interface DeadClickReport {
  type: 'dead-click';
  timestamp: string;
  element: string | null;
  selector: string | null;
  waitTimeMs: number;
}

export interface FrustrationMetrics {
  rageClickCount: number;
  deadClickCount: number;
  frustrationScore: number; // 0-100
  mostFrustratedElement: string | null;
}

export interface RageClickConfig {
  enabled: boolean;
  /** Clicks within this window (ms) to count as rage */
  rageWindowMs: number;
  /** Min clicks to trigger rage click */
  rageThreshold: number;
  /** Max ms to wait for visual feedback before calling dead click */
  deadClickThresholdMs: number;
  /** Ignore clicks on these selectors */
  ignoreSelectors: string[];
}

export const DEFAULT_RAGE_CLICK_CONFIG: RageClickConfig = {
  enabled: true,
  rageWindowMs: 1000,
  rageThreshold: 3,
  deadClickThresholdMs: 100,
  ignoreSelectors: ['[data-bug-detector-ui]', 'body', 'html'],
};

export class RageClickDetector {
  private config: RageClickConfig;
  private clicks: ClickEvent[] = [];
  private isActive = false;
  private rageListeners: ((report: RageClickReport) => void)[] = [];
  private deadListeners: ((report: DeadClickReport) => void)[] = [];
  private deadClickTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private rageReports: RageClickReport[] = [];
  private deadReports: DeadClickReport[] = [];

  constructor(config: Partial<RageClickConfig> = {}) {
    this.config = { ...DEFAULT_RAGE_CLICK_CONFIG, ...config };
  }

  activate(): void {
    if (this.isActive || !this.config.enabled) return;
    this.isActive = true;
    document.addEventListener('click', this.handleClick, true);
  }

  deactivate(): void {
    if (!this.isActive) return;
    this.isActive = false;
    document.removeEventListener('click', this.handleClick, true);
    this.deadClickTimers.forEach((timer) => clearTimeout(timer));
    this.deadClickTimers.clear();
  }

  onRageClick(callback: (report: RageClickReport) => void): () => void {
    this.rageListeners.push(callback);
    return () => {
      this.rageListeners = this.rageListeners.filter((l) => l !== callback);
    };
  }

  onDeadClick(callback: (report: DeadClickReport) => void): () => void {
    this.deadListeners.push(callback);
    return () => {
      this.deadListeners = this.deadListeners.filter((l) => l !== callback);
    };
  }

  getMetrics(): FrustrationMetrics {
    const rageCount = this.rageReports.length;
    const deadCount = this.deadReports.length;

    // Calculate frustration score: 0-100
    // Base: 10 points per rage click, 5 per dead click, capped at 100
    let score = Math.min(100, rageCount * 15 + deadCount * 5);

    // Boost if concentrated on single element
    const elementCounts = new Map<string, number>();
    [...this.rageReports, ...this.deadReports].forEach((r) => {
      if (r.element) {
        elementCounts.set(r.element, (elementCounts.get(r.element) || 0) + 1);
      }
    });

    let mostFrustrated: string | null = null;
    let maxCount = 0;
    elementCounts.forEach((count, el) => {
      if (count > maxCount) {
        maxCount = count;
        mostFrustrated = el;
      }
    });

    if (maxCount >= 3) score = Math.min(100, score + 20);

    return {
      rageClickCount: rageCount,
      deadClickCount: deadCount,
      frustrationScore: score,
      mostFrustratedElement: mostFrustrated,
    };
  }

  getRageClicks(): RageClickReport[] {
    return [...this.rageReports];
  }

  getDeadClicks(): DeadClickReport[] {
    return [...this.deadReports];
  }

  clear(): void {
    this.clicks = [];
    this.rageReports = [];
    this.deadReports = [];
    this.deadClickTimers.forEach((t) => clearTimeout(t));
    this.deadClickTimers.clear();
  }

  // ============================================================================
  // PRIVATE
  // ============================================================================

  private handleClick = (e: MouseEvent): void => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const selector = this.getSelector(target);

    // Ignore bug-detector UI
    if (this.config.ignoreSelectors.some((s) => target.matches(s))) return;
    if (target.closest('[data-bug-detector-ui]')) return;

    const now = Date.now();
    const clickEvent: ClickEvent = {
      timestamp: now,
      x: e.clientX,
      y: e.clientY,
      target: selector,
      hadEffect: false, // Will be checked
    };

    this.clicks.push(clickEvent);

    // Dead click detection
    this.checkDeadClick(target, selector, now);

    // Rage click detection
    this.checkRageClick(target, selector, now);

    // Cleanup old clicks
    this.cleanupOldClicks(now);
  };

  private checkDeadClick(target: HTMLElement, selector: string | null, now: number): void {
    const timerKey = selector || `${now}`;

    // Cancel previous timer for same element
    const existing = this.deadClickTimers.get(timerKey);
    if (existing) clearTimeout(existing);

    // Check if click had effect by observing DOM changes or navigation
    const beforeHref = window.location.href;
    const beforeHash = window.location.hash;

    const timer = setTimeout(() => {
      this.deadClickTimers.delete(timerKey);

      const hadNavigation = window.location.href !== beforeHref && window.location.hash === beforeHash;
      const hadFocusChange = document.activeElement === target || target.contains(document.activeElement as Node);

      // Check for visual feedback: class changes, style changes, child changes
      // This is heuristic - we check if element or parent got a new class
      const hadVisualFeedback = this.checkVisualFeedback(target);

      if (!hadNavigation && !hadFocusChange && !hadVisualFeedback) {
        const report: DeadClickReport = {
          type: 'dead-click',
          timestamp: new Date(now).toISOString(),
          element: target.tagName.toLowerCase(),
          selector,
          waitTimeMs: this.config.deadClickThresholdMs,
        };
        this.deadReports.push(report);
        this.deadListeners.forEach((cb) => {
          try { cb(report); } catch { /* ignore */ }
        });
      }
    }, this.config.deadClickThresholdMs);

    this.deadClickTimers.set(timerKey, timer);
  }

  private checkVisualFeedback(target: HTMLElement): boolean {
    // Heuristic: check if element or a sibling/child got 'active', 'pressed', 'selected' classes
    const feedbackClasses = ['active', 'pressed', 'selected', 'clicked', 'focus', 'open'];
    const checkEl = (el: HTMLElement): boolean => {
      return feedbackClasses.some((c) => el.classList.contains(c));
    };

    if (checkEl(target)) return true;

    // Check parent (for button groups, tabs, etc)
    const parent = target.parentElement;
    if (parent && checkEl(parent as HTMLElement)) return true;

    return false;
  }

  private checkRageClick(target: HTMLElement, selector: string | null, now: number): void {
    if (!selector) return;

    const windowStart = now - this.config.rageWindowMs;
    const recentClicks = this.clicks.filter(
      (c) => c.target === selector && c.timestamp >= windowStart
    );

    if (recentClicks.length >= this.config.rageThreshold) {
      // Check if we already reported a rage click for this element recently
      const alreadyReported = this.rageReports.some(
        (r) => r.element === selector &&
          new Date(r.timestamp).getTime() > windowStart
      );

      if (!alreadyReported) {
        const severity: RageClickReport['severity'] =
          recentClicks.length >= 5 ? 'high' : recentClicks.length >= 4 ? 'medium' : 'low';

        const report: RageClickReport = {
          type: 'rage-click',
          timestamp: new Date(now).toISOString(),
          element: selector,
          clickCount: recentClicks.length,
          timeWindowMs: this.config.rageWindowMs,
          severity,
        };

        this.rageReports.push(report);
        this.rageListeners.forEach((cb) => {
          try { cb(report); } catch { /* ignore */ }
        });
      }
    }
  }

  private cleanupOldClicks(now: number): void {
    const cutoff = now - this.config.rageWindowMs * 2;
    this.clicks = this.clicks.filter((c) => c.timestamp >= cutoff);
  }

  private getSelector(el: HTMLElement): string | null {
    try {
      if (el.id) return `#${CSS.escape(el.id)}`;
      const cls = Array.from(el.classList).filter((c) => !c.startsWith('_')).slice(0, 2).join('.');
      if (cls) return `${el.tagName.toLowerCase()}.${cls}`;
      return el.tagName.toLowerCase();
    } catch {
      return null;
    }
  }
}

export default RageClickDetector;
