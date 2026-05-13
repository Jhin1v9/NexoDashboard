/**
 * Privacy Masking Engine
 * Automatically masks PII and sensitive data before capture/storage.
 * GDPR / CCPA / LGPD compliant by default.
 */

export interface PrivacyConfig {
  /** Enable privacy masking */
  enabled: boolean;
  /** Mask password inputs */
  maskPasswordInputs: boolean;
  /** Mask credit card numbers */
  maskCreditCards: boolean;
  /** Mask email addresses */
  maskEmails: boolean;
  /** Mask phone numbers */
  maskPhones: boolean;
  /** Mask SSN/CPF/tax IDs */
  maskTaxIds: boolean;
  /** Mask API keys and tokens in URLs/headers */
  maskApiKeys: boolean;
  /** CSS selectors for elements to always mask */
  maskSelectors: string[];
  /** Data attributes that mark elements for masking */
  maskAttributes: string[];
  /** Replace masked text with this string */
  maskReplacement: string;
  /** Also mask in screenshots (experimental) */
  maskInScreenshots: boolean;
}

export const DEFAULT_PRIVACY_CONFIG: PrivacyConfig = {
  enabled: true,
  maskPasswordInputs: true,
  maskCreditCards: true,
  maskEmails: true,
  maskPhones: true,
  maskTaxIds: true,
  maskApiKeys: true,
  maskSelectors: [],
  maskAttributes: ['data-bugdetector-mask', 'data-mask'],
  maskReplacement: '[REDACTED]',
  maskInScreenshots: false,
};

// Regex patterns for PII detection
const PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  creditCard: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b/g,
  phoneBR: /\b(?:\+?55\s?)?(?:\(?[1-9]{2}\)?\s?)?(?:9\s?)?[6-9]\d{3}[\s-]?\d{4}\b/g,
  phoneUS: /\b(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?[2-9]\d{2}[-.\s]?\d{4}\b/g,
  cpf: /\b\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2}\b/g,
  ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
  apiKey: /\b(?:api[_-]?key|token|secret|password)\s*[:=]\s*["']?[a-zA-Z0-9_\-]{16,}["']?/gi,
  bearerToken: /\bBearer\s+[a-zA-Z0-9_\-\.]+/gi,
  queryToken: /[?&](?:token|api_key|key|secret)=[a-zA-Z0-9_\-]+/gi,
};

export class PrivacyMasking {
  private config: PrivacyConfig;

  constructor(config: Partial<PrivacyConfig> = {}) {
    this.config = { ...DEFAULT_PRIVACY_CONFIG, ...config };
  }

  /** Mask a plain text string */
  maskText(text: string): string {
    if (!this.config.enabled) return text;

    let masked = text;

    if (this.config.maskEmails) {
      masked = masked.replace(PATTERNS.email, this.config.maskReplacement);
    }
    if (this.config.maskCreditCards) {
      masked = masked.replace(PATTERNS.creditCard, this.config.maskReplacement);
    }
    if (this.config.maskPhones) {
      masked = masked.replace(PATTERNS.phoneBR, this.config.maskReplacement);
      masked = masked.replace(PATTERNS.phoneUS, this.config.maskReplacement);
    }
    if (this.config.maskTaxIds) {
      masked = masked.replace(PATTERNS.cpf, this.config.maskReplacement);
      masked = masked.replace(PATTERNS.ssn, this.config.maskReplacement);
    }
    if (this.config.maskApiKeys) {
      masked = masked.replace(PATTERNS.apiKey, (match) => {
        const prefix = match.split(/[:=]/)[0];
        return `${prefix}=${this.config.maskReplacement}`;
      });
      masked = masked.replace(PATTERNS.bearerToken, `Bearer ${this.config.maskReplacement}`);
      masked = masked.replace(PATTERNS.queryToken, (match) => {
        const key = match.split('=')[0];
        return `${key}=${this.config.maskReplacement}`;
      });
    }

    return masked;
  }

  /** Mask URL query parameters */
  maskUrl(url: string): string {
    if (!this.config.enabled) return url;

    try {
      const parsed = new URL(url);
      const sensitiveParams = ['token', 'api_key', 'key', 'secret', 'password', 'auth', 'session'];

      sensitiveParams.forEach((param) => {
        if (parsed.searchParams.has(param)) {
          parsed.searchParams.set(param, this.config.maskReplacement);
        }
      });

      return parsed.toString();
    } catch {
      return this.maskText(url);
    }
  }

  /** Check if an element should be masked based on config */
  shouldMaskElement(element: Element): boolean {
    if (!this.config.enabled) return false;

    const el = element as HTMLElement;

    // Password inputs
    if (this.config.maskPasswordInputs && el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'password') {
      return true;
    }

    // Configurable selectors
    if (this.config.maskSelectors.length > 0) {
      for (const selector of this.config.maskSelectors) {
        try {
          if (el.matches(selector)) return true;
        } catch {
          // invalid selector, ignore
        }
      }
    }

    // Data attributes
    for (const attr of this.config.maskAttributes) {
      if (el.hasAttribute(attr)) return true;
    }

    // Sensitive input names/ids
    const name = (el.getAttribute('name') || '').toLowerCase();
    const id = (el.getAttribute('id') || '').toLowerCase();
    const sensitiveNames = ['password', 'senha', 'cpf', 'ssn', 'credit', 'card', 'cvv', 'secret', 'token', 'apikey'];
    if (sensitiveNames.some((s) => name.includes(s) || id.includes(s))) return true;

    return false;
  }

  /** Mask element's text content and value */
  maskElement(element: Element): Element {
    if (!this.shouldMaskElement(element)) return element;

    const clone = element.cloneNode(true) as HTMLElement;

    if (clone.tagName === 'INPUT' || clone.tagName === 'TEXTAREA') {
      (clone as HTMLInputElement).value = this.config.maskReplacement;
      clone.setAttribute('value', this.config.maskReplacement);
    }

    // Mask text content but preserve structure
    this.walkAndMaskText(clone);

    return clone;
  }

  /** Mask data object recursively (for network requests, logs, etc) */
  maskObject<T>(obj: T): T {
    if (!this.config.enabled) return obj;

    if (typeof obj === 'string') {
      return this.maskText(obj) as unknown as T;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.maskObject(item)) as unknown as T;
    }

    if (obj && typeof obj === 'object') {
      const masked: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        const isSensitiveKey = ['password', 'token', 'secret', 'apikey', 'api_key', 'auth', 'credential', 'credit_card', 'cvv', 'ssn', 'cpf']
          .some((s) => lowerKey.includes(s));

        if (isSensitiveKey && typeof value === 'string') {
          masked[key] = this.config.maskReplacement;
        } else {
          masked[key] = this.maskObject(value);
        }
      }
      return masked as T;
    }

    return obj;
  }

  /** Get list of elements to mask in the DOM (for screenshot prep) */
  getElementsToMask(root: Document | HTMLElement = document): Element[] {
    if (!this.config.enabled) return [];

    const toMask: Element[] = [];

    // Password inputs
    if (this.config.maskPasswordInputs) {
      root.querySelectorAll('input[type="password"]').forEach((el) => toMask.push(el));
    }

    // Configurable selectors
    this.config.maskSelectors.forEach((selector) => {
      try {
        root.querySelectorAll(selector).forEach((el) => {
          if (!toMask.includes(el)) toMask.push(el);
        });
      } catch {
        // invalid selector
      }
    });

    // Data attributes
    this.config.maskAttributes.forEach((attr) => {
      root.querySelectorAll(`[${attr}]`).forEach((el) => {
        if (!toMask.includes(el)) toMask.push(el);
      });
    });

    // Sensitive names/ids
    const sensitivePattern = /password|senha|cpf|ssn|credit|card|cvv|secret|token|apikey/i;
    root.querySelectorAll('input, textarea').forEach((el) => {
      const name = (el.getAttribute('name') || '').toLowerCase();
      const id = (el.getAttribute('id') || '').toLowerCase();
      if (sensitivePattern.test(name) || sensitivePattern.test(id)) {
        if (!toMask.includes(el)) toMask.push(el);
      }
    });

    return toMask;
  }

  private walkAndMaskText(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      node.textContent = this.maskText(node.textContent || '');
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;

      Array.from(el.childNodes).forEach((child) => this.walkAndMaskText(child));
    }
  }
}

export default PrivacyMasking;
