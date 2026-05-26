/**
 * Luna-Kimi Bridge v2.1
 * Multi-user Playwright automation for Kimi Web (kimi.com) via CDP
 *
 * Patterns borrowed from luna-cto-agent.cjs (Luna v15.1–v19.0):
 * - Persistent Logger with circular buffer + rotation
 * - Keep-alive (uncaughtException / unhandledRejection)
 * - SessionStore (CheckpointManager pattern) with debounced save
 * - Multi-strategy selector fallback
 *
 * Architecture:
 * - Single BrowserContext (contexts()[0]) — the ONLY one with logged-in cookies
 * - One Page per Telegram userId
 * - Semaphore limits max concurrent pages (default 5)
 * - Idle cleanup closes inactive pages after 10min
 * - Crash/disconnect detection with auto-reconnect
 * - Rate limiting per userId
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Lazy-load turndown — fail gracefully if not installed
let TurndownService = null;
try {
  TurndownService = require('turndown');
} catch (e) {
  console.warn('[KimiBridge] turndown not installed; Markdown extraction will fallback to plain text');
}

// ============================================================
// KEEP-ALIVE — don't let the process die
// ============================================================
process.on('uncaughtException', (err) => {
  console.error('[KIMI-KEEP-ALIVE] Uncaught Exception:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[KIMI-KEEP-ALIVE] Unhandled Rejection:', reason);
});

// ============================================================
// CONFIG
// ============================================================
const CDP_PORTS = [9222, 9223, 9224, 9225];
const DEFAULT_TIMEOUT = parseInt(process.env.KIMI_TIMEOUT, 10) || 120000;
const MAX_CONCURRENT_PAGES = parseInt(process.env.KIMI_MAX_PAGES, 10) || 5;
const IDLE_TIMEOUT_MS = parseInt(process.env.KIMI_IDLE_TIMEOUT, 10) || 10 * 60 * 1000;
const COOLDOWN_MS = parseInt(process.env.KIMI_COOLDOWN_MS, 10) || 5000;
const MAX_TEXT_TYPE_LENGTH = parseInt(process.env.KIMI_MAX_TYPE_LENGTH, 10) || 500;
const LOG_MAX_SIZE_MB = parseInt(process.env.KIMI_LOG_MAX_MB, 10) || 10;
const ARTIFACTS_DIR = path.join(__dirname, '..', 'ARTIFACTS');
const SESSION_STORE_PATH = path.join(ARTIFACTS_DIR, 'kimi-sessions.json');

function makeCdpUrl(port) { return `http://127.0.0.1:${port}`; }
function getPortFromUrl(url) {
  try { return parseInt(new URL(url).port, 10); } catch { return 9222; }
}

if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

// ============================================================
// UTILS
// ============================================================
function hashUserId(userId) {
  return crypto.createHash('sha256').update(String(userId)).digest('hex').slice(0, 8);
}

// ============================================================
// LOGGER — persistent with circular buffer + rotation
// ============================================================
class KimiLogger {
  constructor() {
    this.logFile = path.join(ARTIFACTS_DIR, 'kimi-bridge.log');
    this.events = [];
  }

  _h() {
    return new Date().toISOString();
  }

  _rotateIfNeeded() {
    try {
      if (fs.existsSync(this.logFile)) {
        const stats = fs.statSync(this.logFile);
        if (stats.size > LOG_MAX_SIZE_MB * 1024 * 1024) {
          const rotated = this.logFile + '.1';
          if (fs.existsSync(rotated)) fs.unlinkSync(rotated);
          fs.renameSync(this.logFile, rotated);
        }
      }
    } catch (e) { /* ignore rotation errors */ }
  }

  _w(level, msg) {
    const line = `[${level}] [${this._h()}] ${msg}`;
    console.log(line);
    try {
      this._rotateIfNeeded();
      fs.appendFileSync(this.logFile, line + '\n');
    } catch (e) { /* ignore log write errors */ }
    this.events.push({ type: level, msg, time: this._h() });
    if (this.events.length > 200) this.events.shift();
  }

  info(m) { this._w('INFO', m); }
  success(m) { this._w('SUCCESS', m); }
  error(m) { this._w('ERROR', m); }
  warn(m) { this._w('WARN', m); }
  debug(m) { this._w('DEBUG', m); }
  getEvents() { return this.events; }
}
const log = new KimiLogger();

// ============================================================
// SESSION STORE — persists user sessions between restarts
// ============================================================
class KimiSessionStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = this._load();
    this._saveTimer = null;
  }

  _load() {
    const defaults = { users: {}, lastCleanup: null };
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8').replace(/^\uFEFF/, '');
        const parsed = JSON.parse(raw);
        return { ...defaults, ...parsed };
      }
    } catch (err) {
      log.warn(`SessionStore load failed: ${err.message}`);
    }
    return defaults;
  }

  _saveImmediate() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      log.warn(`SessionStore save failed: ${err.message}`);
    }
  }

  save() {
    // Debounced save: batch rapid updates
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._saveImmediate(), 500);
  }

  getUser(userId) {
    return this.data.users[userId] || null;
  }

  setUser(userId, info) {
    this.data.users[userId] = { ...this.getUser(userId), ...info, updatedAt: new Date().toISOString() };
    this.save();
  }

  removeUser(userId) {
    delete this.data.users[userId];
    this.save();
  }

  getAllUserIds() {
    return Object.keys(this.data.users);
  }
}

// ============================================================
// SEMAPHORE — limits concurrent pages with ownership tracking
// ============================================================
class Semaphore {
  constructor(max) {
    this.max = max;
    this.current = 0;
    this.waiters = [];
  }

  async acquire() {
    if (this.current < this.max) {
      this.current++;
      return;
    }
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  release() {
    if (this.waiters.length > 0) {
      const next = this.waiters.shift();
      next();
    } else {
      this.current = Math.max(0, this.current - 1);
    }
  }
}

// ============================================================
// KIMI BRIDGE v2.1
// ============================================================
class KimiBridge {
  constructor(options = {}) {
    this.cdpUrl = options.cdpUrl || null; // discovered dynamically
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
    this.maxPages = options.maxPages ?? MAX_CONCURRENT_PAGES;
    this.idleTimeout = options.idleTimeout ?? IDLE_TIMEOUT_MS;
    this.debug = options.debug || false;

    this.browser = null;
    this.context = null;
    this.userSessions = new Map(); // userId -> { page, chatUrl, lastActivity, processing, mode }
    this.semaphore = new Semaphore(this.maxPages);
    this.store = new KimiSessionStore(SESSION_STORE_PATH);
    this.lastRequestTime = new Map(); // userId -> timestamp (rate limiting)
    this.idleTimer = null;

    // Initialize turndown if available
    this.turndown = null;
    if (TurndownService) {
      this.turndown = new TurndownService({
        codeBlockStyle: 'fenced',
        headingStyle: 'atx',
        bulletListMarker: '-',
      });
    }
  }

  /**
   * Probe a single CDP port to see if Chrome is listening.
   */
  async _probePort(port) {
    const http = require('http');
    return new Promise((resolve) => {
      const req = http.get(`${makeCdpUrl(port)}/json/version`, (res) => {
        resolve(res.statusCode === 200 ? port : 0);
      });
      req.on('error', () => resolve(0));
      req.setTimeout(2000, () => { req.destroy(); resolve(0); });
    });
  }

  /**
   * Find first working CDP port among CDP_PORTS.
   * Returns 0 if none respond.
   */
  async _findWorkingPort() {
    for (const port of CDP_PORTS) {
      const ok = await this._probePort(port);
      if (ok) return port;
    }
    return 0;
  }

  /**
   * Get current CDP URL. Discovers dynamically on first use.
   */
  async _getCdpUrl() {
    if (this.cdpUrl) return this.cdpUrl;
    const port = await this._findWorkingPort();
    if (port) {
      this.cdpUrl = makeCdpUrl(port);
      log.info(`Auto-discovered Chrome on ${this.cdpUrl}`);
      return this.cdpUrl;
    }
    // Fallback to default for error messages
    return makeCdpUrl(CDP_PORTS[0]);
  }

  /**
   * Reset CDP URL (e.g. after Chrome restart on different port).
   */
  _resetCdpUrl() {
    this.cdpUrl = null;
  }

  _log(...args) {
    const msg = args.join(' ');
    if (this.debug) log.debug(msg);
  }

  /**
   * Connect to Chrome via CDP. Uses browser.contexts()[0] ONLY.
   * Never creates newContext() — incognito contexts lose the Kimi login.
   */
  async connect() {
    if (this.browser) {
      this._log('Already connected');
      return this;
    }

    const cdpUrl = await this._getCdpUrl();
    log.info(`Connecting to Chrome at ${cdpUrl}`);
    try {
      this.browser = await chromium.connectOverCDP(cdpUrl);
    } catch (e) {
      // Clear cached URL so next attempt re-discovers
      this._resetCdpUrl();
      throw e;
    }
    const contexts = this.browser.contexts();

    if (!contexts || contexts.length === 0) {
      throw new Error('No browser contexts found via CDP. Is Chrome running with --remote-debugging-port?');
    }

    this.context = contexts[0];
    log.success(`Connected! Using context[0] with ${this.context.pages().length} existing page(s)`);

    // Register crash/disconnect listeners
    this.browser.on('disconnected', () => {
      log.warn('Browser disconnected via CDP');
      this.browser = null;
      this.context = null;
      this._resetCdpUrl();
    });

    // Start idle cleanup timer
    this._startIdleCleanup();

    return this;
  }

  /**
   * Disconnect: close all user pages, release semaphore, disconnect browser.
   * NEVER calls browser.close() (that kills Chrome).
   */
  async disconnect() {
    log.info('Disconnecting KimiBridge...');

    if (this.idleTimer) {
      clearInterval(this.idleTimer);
      this.idleTimer = null;
    }

    for (const [userId, session] of this.userSessions) {
      try {
        if (session.page && !session.page.isClosed()) {
          // Remove listeners before closing
          session.page.removeAllListeners('crash');
          await session.page.close();
          log.info(`Closed page for user ${hashUserId(userId)}`);
        }
      } catch (e) {
        log.warn(`Error closing page for ${hashUserId(userId)}: ${e.message}`);
      }
      this.semaphore.release();
    }
    this.userSessions.clear();

    if (this.browser) {
      try {
        if (typeof this.browser.disconnect === 'function') {
          await this.browser.disconnect();
          log.info('Browser disconnected (CDP)');
        } else {
          log.warn('browser.disconnect not available, skipping');
        }
      } catch (e) {
        log.warn(`Browser disconnect error: ${e.message}`);
      }
      this.browser = null;
      this.context = null;
    }

    log.success('KimiBridge disconnected');
  }

  /**
   * Ensure connected to CDP with auto-reconnect on disconnect
   */
  async _ensureConnected() {
    if (!this.browser || !this.context) {
      log.info('Reconnecting to Chrome...');
      await this.connect();
    }
  }

  /**
   * Rate limiting: check if user is within cooldown
   */
  _checkCooldown(userId) {
    const last = this.lastRequestTime.get(userId);
    if (last && Date.now() - last < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 1000);
      throw new Error(`Aguarde ${remaining}s antes de enviar outra mensagem`);
    }
    this.lastRequestTime.set(userId, Date.now());
  }

  /**
   * Get or create a dedicated Page for a user.
   * Reuses existing page if still open.
   */
  async _getOrCreateUserPage(userId) {
    await this._ensureConnected();

    const existing = this.userSessions.get(userId);
    if (existing && existing.page && !existing.page.isClosed()) {
      // Health-check: verify the page still responds via CDP
      try {
        await existing.page.evaluate(() => true);
        existing.lastActivity = Date.now();
        return existing.page;
      } catch (e) {
        log.warn(`Stale page for user ${hashUserId(userId)}, recreating: ${e.message}`);
        try { await existing.page.close(); } catch {}
        this.userSessions.delete(userId);
        this.semaphore.current = Math.max(0, this.semaphore.current - 1);
      }
    }

    // Acquire semaphore slot
    log.info(`Acquiring semaphore slot for user ${hashUserId(userId)} (${this.semaphore.current}/${this.maxPages})`);
    await this.semaphore.acquire();

    // Restore previous chat URL from store if available
    const stored = this.store.getUser(userId);
    const chatUrl = stored?.chatUrl || 'https://kimi.com/?chat_enter_method=new_chat';

    let page = null;
    try {
      log.info(`Creating new page for user ${hashUserId(userId)}`);
      page = await this.context.newPage();

      // Register crash listener
      page.on('crash', () => {
        log.error(`Page crashed for user ${hashUserId(userId)}`);
        this.userSessions.delete(userId);
        this.semaphore.release();
      });

      // Inject stream interceptor BEFORE navigation so it captures the chat API calls
      await this._injectStreamInterceptor(page);

      await page.goto(chatUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
    } catch (e) {
      log.warn(`Navigation failed for ${hashUserId(userId)}: ${e.message}`);
      if (page && !page.isClosed()) {
        try { await page.close(); } catch {}
      }
      this.semaphore.release();
      throw e;
    }

    const session = {
      page,
      chatUrl: page.url(),
      lastActivity: Date.now(),
      processing: false,
      mode: stored?.mode || 'instant',
    };

    this.userSessions.set(userId, session);
    this.store.setUser(userId, { chatUrl: session.chatUrl, mode: session.mode });

    log.success(`Page ready for user ${hashUserId(userId)}: ${session.chatUrl}`);
    return page;
  }

  /**
   * Verify the user session is not expired (not showing Log In screen)
   * Uses specific login selectors, not free text matching.
   */
  async _verifySession(page) {
    const isLoggedIn = await page.evaluate(() => {
      // Check for actual login form elements, not just text presence
      const hasLoginForm = !!(
        document.querySelector('form[action*="login"], form[action*="auth"]') ||
        document.querySelector('input[type="password"]') ||
        document.querySelector('button[type="submit"]') &&
        document.querySelector('input[name="email"], input[name="username"], input[type="email"]')
      );
      const hasAppContent = !!(
        document.querySelector('.chat-editor, .markdown-container, .segment-assistant-actions')
      );
      return !hasLoginForm && hasAppContent;
    }).catch(() => false);

    if (!isLoggedIn) {
      throw new Error('Kimi session expired — please log in again in Chrome');
    }
    return true;
  }

  /**
   * Extract response using multi-strategy fallback.
   * Prioritizes stream interceptor, then React Fiber, then DOM selectors.
   */
  async _extractResponse(page) {
    // Strategy 0: Stream interceptor — most reliable
    try {
      const intercepted = await page.evaluate(() => {
        const s = window.__lunaStream;
        if (s && s.active && s.content) return s.content;
        return null;
      });
      if (intercepted && intercepted.trim()) {
        log.success(`Extracted via stream-intercept: ${intercepted.slice(0, 80)}...`);
        return intercepted.trim();
      }
    } catch (e) {
      this._log(`Stream intercept extraction failed: ${e.message}`);
    }

    // Strategy 1: Browser-evaluate — React Fiber + smart DOM
    const strategies = [
      {
        type: 'evaluate',
        selector: null,
        fn: async () => {
          return await page.evaluate(() => {
            try {
              // ── Helpers ──
              function getReactFiber(dom) {
                const key = Object.keys(dom).find(k =>
                  k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')
                );
                return key ? dom[key] : null;
              }
              function findMessageFiber(fiber) {
                let node = fiber;
                while (node) {
                  const props = node.memoizedProps || node.pendingProps;
                  if (props && (props.message || props.msg || props.data?.message)) return node;
                  node = node.return;
                }
                return null;
              }
              function isInsideThink(el, boundary) {
                let parent = el.parentElement;
                while (parent && parent !== boundary) {
                  const pc = (parent.className || '').toLowerCase();
                  if (pc.includes('think') || pc.includes('thinking') || pc.includes('reasoning')) return true;
                  parent = parent.parentElement;
                }
                return false;
              }

              // ── Find last assistant ──
              const assistantSelectors = [
                '.segment-assistant', '.message-assistant',
                '[data-testid="assistant-message"]', '[data-testid="message-assistant"]',
                '.chat-message--assistant',
                '[class*="assistant"][class*="segment"]',
                '[class*="assistant"][class*="message"]',
              ];
              let lastAssistant = null;
              for (const sel of assistantSelectors) {
                const els = document.querySelectorAll(sel);
                if (els.length) { lastAssistant = els[els.length - 1]; break; }
              }
              if (!lastAssistant) {
                const allMsg = document.querySelectorAll('.chat-message, .message-item, [data-testid="message-container"]');
                if (allMsg.length) lastAssistant = allMsg[allMsg.length - 1];
              }
              if (!lastAssistant) return '';

              // ── React Fiber inspection ──
              const fiber = getReactFiber(lastAssistant);
              const msgFiber = fiber ? findMessageFiber(fiber) : null;
              if (msgFiber) {
                const props = msgFiber.memoizedProps || msgFiber.pendingProps;
                const msg = props?.message || props?.msg || props?.data;
                if (msg) {
                  const content = msg.content || msg.text || msg.response || '';
                  if (content) return String(content).trim();
                }
              }

              // ── DOM: markdown containers excluding thinking ──
              const mdContainers = lastAssistant.querySelectorAll('.markdown-container, [class*="markdown"]');
              for (let i = mdContainers.length - 1; i >= 0; i--) {
                const md = mdContainers[i];
                if (!isInsideThink(md, lastAssistant)) {
                  const text = md.innerText?.trim();
                  if (text && text.length > 0) return text;
                }
              }

              // ── Fallback: assistant text minus think blocks ──
              let fullText = lastAssistant.innerText?.trim() || '';
              const thinkBlocks = lastAssistant.querySelectorAll(
                '.thinking-container, .think-block, [class*="thinking"], [class*="reasoning"]'
              );
              for (const tb of thinkBlocks) {
                fullText = fullText.replace(tb.innerText?.trim() || '', '');
              }
              return fullText.trim();
            } catch (e) {
              return '';
            }
          });
        },
      },
      // Strategy 2: Plain text from paragraph elements
      {
        type: 'paragraph',
        selector: '.markdown-container .paragraph',
        fn: async (el) => {
          const texts = await el.allInnerTexts();
          return texts.join('\n\n');
        },
      },
      // Strategy 3: Direct innerText from markdown container
      {
        type: 'innerText',
        selector: '.markdown-container .markdown',
        fn: async (el) => {
          return await el.innerText();
        },
      },
      // Strategy 4: Turndown (markdown conversion)
      {
        type: 'turndown',
        selector: '.markdown-container .markdown',
        fn: async (el) => {
          if (!this.turndown) throw new Error('turndown not available');
          const html = await el.innerHTML();
          return this.turndown.turndown(html);
        },
      },
      // Strategy 5: Fallback to body text
      {
        type: 'plaintext',
        selector: 'body',
        fn: async (el) => {
          const text = await el.innerText();
          return text.trim();
        },
      },
    ];

    for (const strategy of strategies) {
      try {
        let result;
        if (strategy.type === 'evaluate') {
          result = await strategy.fn();
        } else {
          const locator = page.locator(strategy.selector).last();
          const exists = await locator.count();
          if (exists === 0) {
            this._log(`Strategy ${strategy.type}: element not found`);
            continue;
          }
          result = await strategy.fn(locator);
        }
        if (result && result.trim()) {
          log.success(`Extracted via ${strategy.type}: ${result.slice(0, 80)}...`);
          return result.trim();
        }
      } catch (e) {
        this._log(`Strategy ${strategy.type} failed: ${e.message}`);
      }
    }

    throw new Error('EXTRACTION_FAILED: Nenhuma resposta encontrada');
  }

  /**
   * Detect the actual mode currently selected in the Kimi UI
   */
  async _detectActualMode(page) {
    try {
      const label = await page.locator('.chat-editor-action .model-name').textContent({ timeout: 5000 });
      if (label.includes('Instant')) return 'instant';
      if (label.includes('Thinking')) return 'thinking';
      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Wait for response completion using Combined Signal with streaming support.
   * Calls onPartial(text, status) periodically so callers can show live updates.
   *
   * Status values:
   *   'writing'  — text changed since last poll (Kimi is generating)
   *   'thinking' — text stable for >5s but not yet complete (Kimi paused/re-reasoning)
   *   'done'     — action buttons visible + text stable for 2s (complete)
   *
   * Throws on timeout.
   */
  async _waitForResponse(page, mode = 'instant', onPartial = null, initialText = '') {
    // Generous timeouts: Kimi often pauses, re-reasons, and continues.
    const maxTimeout = mode === 'instant' ? 300000 : 600000;
    const startTime = Date.now();

    // Phase 0: Wait for text to CHANGE from initialText — this ensures we don't
    // detect the previous response as "done" when buttons are still visible.
    log.info('Waiting for new response text to appear...');
    let textHasChanged = false;
    const changeTimeout = 30000; // wait up to 30s for text to start changing
    const changeStart = Date.now();
    while (Date.now() - changeStart < changeTimeout) {
      try {
        const currentText = await page.locator('.markdown-container .markdown').last().innerText({ timeout: 2000 }).catch(() => '');
        if (currentText !== initialText && currentText.trim().length > 0) {
          textHasChanged = true;
          log.success('New response text detected');
          break;
        }
      } catch (e) {
        // Element might not exist yet
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    if (!textHasChanged) {
      log.warn('Text did not change from initial — response may already be present or failed to start');
    }

    // Phase 1: Wait for action buttons (they appear when response is done)
    log.info('Waiting for assistant action buttons...');
    let buttonsVisible = false;
    try {
      await page.waitForSelector('.segment-assistant-actions .icon-button', {
        timeout: maxTimeout,
        state: 'visible',
      });
      buttonsVisible = true;
      log.success('Action buttons detected — response likely complete');
    } catch (e) {
      log.warn(`Timeout waiting for action buttons: ${e.message}`);
    }

    // Phase 2: Poll text with streaming callbacks
    log.info('Polling text with streaming...');
    const stabilityWindow = 2000;
    const thinkingWindow = 5000; // if stable >5s and buttons not visible = thinking
    const pollInterval = 1500;   // poll every 1.5s for partial updates
    let lastText = '';
    let stableSince = null;
    let thinkingNotified = false;

    while (Date.now() - startTime < maxTimeout) {
      try {
        const currentText = await page.locator('.markdown-container .markdown').last().innerText({ timeout: 2000 }).catch(() => '');

        // Notify partial update when text changes
        if (currentText !== lastText && currentText.trim().length > 0) {
          stableSince = null;
          thinkingNotified = false;
          lastText = currentText;
          if (onPartial) {
            try { onPartial(currentText, 'writing'); } catch {}
          }
          continue; // skip stability check this iteration
        }

        // Text is stable
        if (currentText.trim().length > 0) {
          if (!stableSince) {
            stableSince = Date.now();
          } else {
            const stableFor = Date.now() - stableSince;

            // If buttons visible and stable >2s = DONE
            if (buttonsVisible && stableFor >= stabilityWindow) {
              log.success(`Text stable for ${stableFor}ms + buttons visible — response complete`);
              if (onPartial) {
                try { onPartial(currentText, 'done'); } catch {}
              }
              return;
            }

            // If stable >5s but no buttons yet = THINKING (Kimi paused)
            if (!thinkingNotified && stableFor >= thinkingWindow) {
              thinkingNotified = true;
              log.info(`Text stable for ${stableFor}ms — Kimi may be re-reasoning`);
              if (onPartial) {
                try { onPartial(currentText, 'thinking'); } catch {}
              }
            }
          }
        }
      } catch (e) {
        // Element might not exist yet
      }

      await new Promise(r => setTimeout(r, pollInterval));
    }

    throw new Error(`Response timeout after ${maxTimeout}ms (mode: ${mode})`);
  }

  /**
   * Set Kimi mode (instant or thinking) for a user's page
   */
  async setMode(userId, mode) {
    if (!['instant', 'thinking'].includes(mode)) {
      throw new Error(`Invalid mode: ${mode}. Use 'instant' or 'thinking'`);
    }

    const page = await this._getOrCreateUserPage(userId);
    const session = this.userSessions.get(userId);

    // Check if already in desired mode
    const currentLabel = await page.locator('.chat-editor-action .model-name').textContent({ timeout: 3000 }).catch(() => '');
    const targetLabel = mode === 'instant' ? 'K2.6 Instant' : 'K2.6 Thinking';

    if (currentLabel.includes(targetLabel)) {
      this._log(`Already in ${mode} mode`);
      session.mode = mode;
      this.store.setUser(userId, { mode });
      return mode;
    }

    log.info(`Switching user ${hashUserId(userId)} to ${mode} mode...`);

    try {
      // Try to dismiss any overlay first (Escape key or click on body)
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(200);

      // Click mode selector — use JS click to bypass overlay intercept
      await page.evaluate(() => {
        const el = document.querySelector('.chat-editor-action .model-name');
        if (el) el.click();
      });
      await page.waitForTimeout(500);

      // Scope to dropdown to avoid clicking wrong element
      const dropdown = page.locator('[role=listbox], .dropdown-menu, .model-dropdown').last();
      const option = dropdown.locator('text=' + targetLabel).or(page.getByText(targetLabel)).first();
      await option.click({ timeout: 3000 });
      await page.waitForTimeout(800);

      session.mode = mode;
      this.store.setUser(userId, { mode });
      log.success(`Mode switched to ${mode} for user ${hashUserId(userId)}`);
      return mode;
    } catch (e) {
      log.warn(`Mode switch failed (overlay or element not found): ${e.message}. Continuing with current mode.`);
      // Don't throw — mode switch is not critical
      return session.mode || 'instant';
    }
  }

  /**
   * Create a new chat for a user (does NOT use sendMessage)
   */
  async newChat(userId) {
    const page = await this._getOrCreateUserPage(userId);
    const session = this.userSessions.get(userId);

    // Reset stream interceptor state to prevent cross-message contamination
    await page.evaluate(() => { if (window.__lunaResetStream) window.__lunaResetStream(); });

    log.info(`Creating new chat for user ${hashUserId(userId)}`);
    await page.goto('https://kimi.com/?chat_enter_method=new_chat', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    session.chatUrl = page.url();
    this.store.setUser(userId, { chatUrl: session.chatUrl });

    log.success(`New chat created for user ${hashUserId(userId)}: ${session.chatUrl}`);
    return { chatUrl: session.chatUrl, mode: session.mode };
  }

  /**
   * Send an image (screenshot, file, etc.) to Kimi Web.
   * Supports optional text to accompany the image.
   *
   * Strategy:
   * 1. Decode base64 to temp PNG file
   * 2. Inject a hidden file input into the Kimi DOM
   * 3. Use Playwright setInputFiles to upload
   * 4. Trigger change event so Kimi processes the upload
   * 5. Optionally send accompanying text
   * 6. Wait for response normally
   */
  async sendImage(userId, imageBase64, text = '', options = {}) {
    if (!imageBase64 || !imageBase64.trim()) {
      throw new Error('Image base64 is required');
    }

    // Rate limiting
    this._checkCooldown(userId);

    const page = await this._getOrCreateUserPage(userId);
    const session = this.userSessions.get(userId);

    if (session.processing) {
      log.warn(`User ${hashUserId(userId)} is already processing — queueing image upload`);
      const startWait = Date.now();
      while (session.processing) {
        if (Date.now() - startWait > 60000) {
          throw new Error('Timeout waiting for previous message to complete');
        }
        await new Promise(r => setTimeout(r, 500));
      }
    }

    session.processing = true;
    session.lastActivity = Date.now();

    try {
      await this._verifySession(page);

      if (options.newChat) {
        await page.goto('https://kimi.com/?chat_enter_method=new_chat', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);
        session.chatUrl = page.url();
        this.store.setUser(userId, { chatUrl: session.chatUrl });
      }

      if (options.mode) {
        await this.setMode(userId, options.mode);
      }

      const actualMode = await this._detectActualMode(page) || session.mode || 'instant';
      log.info(`User ${hashUserId(userId)} sending image (text=${text ? 'yes' : 'no'}, mode=${actualMode})`);

      await page.bringToFront();

      // Step 1: Save base64 to temp file
      const tmpDir = path.join(ARTIFACTS_DIR, 'tmp-uploads');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      const tmpFile = path.join(tmpDir, `kimi-upload-${hashUserId(userId)}-${Date.now()}.png`);
      const buffer = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      fs.writeFileSync(tmpFile, buffer);
      log.info(`Image saved to temp file: ${tmpFile} (${buffer.length} bytes)`);

      // Step 2: Inject hidden file input and upload
      const fileInputSelector = await page.evaluate(() => {
        // Try to find existing file input
        let input = document.querySelector('input[type="file"]');
        if (!input) {
          // Create one if not exists
          input = document.createElement('input');
          input.type = 'file';
          input.style.display = 'none';
          input.id = '_luna_bridge_file_input_' + Date.now();
          document.body.appendChild(input);
        }
        return input.id || '_luna_bridge_file_input';
      });

      const fileInput = page.locator(`#${fileInputSelector}, input[type="file"]`).first();
      await fileInput.setInputFiles(tmpFile);
      log.info(`File input populated: ${tmpFile}`);

      // Step 3: Trigger change event and wait for upload UI to appear
      await page.evaluate((selector) => {
        const input = document.querySelector(`#${selector}`) || document.querySelector('input[type="file"]');
        if (input) {
          const event = new Event('change', { bubbles: true });
          input.dispatchEvent(event);
        }
      }, fileInputSelector);

      // Wait for image to be processed by Kimi UI (thumbnail/preview appears)
      log.info('Waiting for image upload to be processed by Kimi...');
      await page.waitForTimeout(2000);

      // Step 4: Send optional text
      if (text && text.trim()) {
        const inputLocator = page.locator('textarea, [contenteditable="true"]').first();
        await inputLocator.fill('');
        await page.waitForTimeout(300);
        if (text.length <= MAX_TEXT_TYPE_LENGTH) {
          await inputLocator.type(text, { delay: 50 });
        } else {
          await inputLocator.fill(text);
        }
        await page.waitForTimeout(500);
      }

      // Step 5: Press Enter to send
      const sendLocator = page.locator('textarea, [contenteditable="true"]').first();
      await sendLocator.press('Enter');
      log.info(`Image (+text) sent for user ${hashUserId(userId)}`);

      // Step 6: Wait for response
      await this._waitForResponse(page, actualMode, options.onPartialResponse || null);
      const response = await this._extractResponse(page);

      session.chatUrl = page.url();
      this.store.setUser(userId, { chatUrl: session.chatUrl });

      log.success(`Response ready for user ${hashUserId(userId)} (len=${response.length})`);

      // Cleanup temp file
      try { fs.unlinkSync(tmpFile); } catch {}

      return {
        response,
        chatUrl: session.chatUrl,
        mode: session.mode,
      };
    } catch (err) {
      try {
        await page.locator('textarea, [contenteditable="true"]').first().fill('');
      } catch {}
      throw err;
    } finally {
      session.processing = false;
      session.lastActivity = Date.now();
    }
  }

  /**
   * Send a message and wait for response
   */
  async sendMessage(userId, text, options = {}) {
    if (!text || !text.trim()) {
      throw new Error('Message text is required');
    }

    // Rate limiting
    this._checkCooldown(userId);

    const page = await this._getOrCreateUserPage(userId);

    // Reset stream interceptor state to prevent cross-message contamination
    await page.evaluate(() => { if (window.__lunaResetStream) window.__lunaResetStream(); });
    const session = this.userSessions.get(userId);

    // Cooldown check: wait for current processing to finish
    if (session.processing) {
      log.warn(`User ${hashUserId(userId)} is already processing — queueing`);
      const startWait = Date.now();
      while (session.processing) {
        if (Date.now() - startWait > 60000) {
          throw new Error('Timeout waiting for previous message to complete');
        }
        await new Promise(r => setTimeout(r, 500));
      }
    }

    session.processing = true;
    session.lastActivity = Date.now();

    try {
      // Verify session
      await this._verifySession(page);

      // Handle newChat option
      if (options.newChat) {
        await page.goto('https://kimi.com/?chat_enter_method=new_chat', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);
        session.chatUrl = page.url();
        this.store.setUser(userId, { chatUrl: session.chatUrl });
      }

      // Set mode if specified
      if (options.mode) {
        await this.setMode(userId, options.mode);
      }

      // Detect actual mode from UI for correct timeout
      const actualMode = await this._detectActualMode(page) || session.mode || 'instant';
      log.info(`User ${hashUserId(userId)} sending message (len=${text.length}, mode=${actualMode})`);

      // Use locator (auto-resolves at action time, never stale)
      const inputLocator = page.locator('textarea, [contenteditable="true"]').first();
      const inputCount = await inputLocator.count();
      if (inputCount === 0) {
        throw new Error('Input field not found on Kimi Web');
      }

      // Bring page to front (Chrome may throttle inactive tabs)
      await page.bringToFront();

      // Clear any existing text first
      await inputLocator.fill('');
      await page.waitForTimeout(300);

      // Type with human-like delay, but use fill for long texts
      if (text.length <= MAX_TEXT_TYPE_LENGTH) {
        await inputLocator.type(text, { delay: 50 });
      } else {
        log.info(`Text too long (${text.length} chars), using fill instead of type`);
        await inputLocator.fill(text);
      }
      await page.waitForTimeout(500 + Math.floor(Math.random() * 1000));

      // Press Enter to send
      await inputLocator.press('Enter');
      log.info(`Message sent for user ${hashUserId(userId)}`);

      // Capture current text BEFORE waiting for response — this prevents
      // detecting the previous response as "done" if buttons are still visible
      const initialText = await page.locator('.markdown-container .markdown').last().innerText({ timeout: 2000 }).catch(() => '');
      log.info(`Initial text captured (len=${initialText.length}), waiting for new response...`);

      // Wait for response with combined signal + streaming
      await this._waitForResponse(page, actualMode, options.onPartialResponse || null, initialText);

      // Extract response
      const response = await this._extractResponse(page);

      // Update chat URL
      session.chatUrl = page.url();
      this.store.setUser(userId, { chatUrl: session.chatUrl });

      log.success(`Response ready for user ${hashUserId(userId)} (len=${response.length})`);

      return {
        response,
        chatUrl: session.chatUrl,
        mode: session.mode,
      };
    } catch (err) {
      // Try to clear input on error so next message doesn't have leftover text
      try {
        await page.locator('textarea, [contenteditable="true"]').first().fill('');
      } catch {}
      throw err;
    } finally {
      session.processing = false;
      session.lastActivity = Date.now();
    }
  }

  /**
   * Get status for a user's session
   */
  async getStatus(userId) {
    const session = this.userSessions.get(userId);
    if (!session) {
      return { active: false, message: 'No active session for this user' };
    }

    const page = session.page;
    if (!page || page.isClosed()) {
      return { active: false, message: 'Page was closed' };
    }

    const pageStatus = await page.evaluate(() => ({
      url: window.location.href,
      title: document.title,
      loggedIn: !document.body.innerText.includes('Log In'),
      hasResponse: !!document.querySelector('.markdown-container .paragraph'),
      mode: document.querySelector('.chat-editor-action .model-name')?.innerText?.trim() || null,
    })).catch(() => ({ error: 'Page evaluation failed' }));

    return {
      active: true,
      userId: hashUserId(userId),
      chatUrl: session.chatUrl,
      mode: session.mode,
      lastActivity: new Date(session.lastActivity).toISOString(),
      processing: session.processing,
      pageStatus,
    };
  }

  /**
   * Get global bridge status (all users)
   */
  async getGlobalStatus() {
    await this._ensureConnected();
    const users = [];
    for (const [userId, session] of this.userSessions) {
      users.push({
        userId: hashUserId(userId),
        chatUrl: session.chatUrl,
        mode: session.mode,
        lastActivity: new Date(session.lastActivity).toISOString(),
        processing: session.processing,
        pageClosed: !session.page || session.page.isClosed(),
      });
    }
    return {
      connected: !!this.browser,
      cdpUrl: this.cdpUrl,
      maxPages: this.maxPages,
      activePages: this.userSessions.size,
      semaphore: { current: this.semaphore.current, max: this.semaphore.max },
      users,
    };
  }

  /**
   * Check if Chrome is running with CDP and start if needed.
   * Supports dynamic ports (9222-9225). Kills headless Chrome. Starts visible Chrome.
   * Returns { running: bool, started: bool, pid?: number, error?: string, wasHeadless?: bool, port?: number }
   */
  async checkChrome() {
    const { execSync, spawn } = require('child_process');
    const http = require('http');
    const os = require('os');
    const net = require('net');
    const userDataDir = path.join(os.homedir(), '.luna', 'chrome-profile');

    // Helper: check if a port has Chrome responding
    const probePort = (port) => new Promise((resolve) => {
      const req = http.get(`${makeCdpUrl(port)}/json/version`, (res) => {
        resolve(res.statusCode === 200 ? port : 0);
      });
      req.on('error', () => resolve(0));
      req.setTimeout(2000, () => { req.destroy(); resolve(0); });
    });

    // Helper: check if port is occupied by any process
    const isPortOccupied = (port) => new Promise((resolve) => {
      const s = net.createServer();
      s.once('error', () => resolve(true));
      s.once('listening', () => { s.close(() => resolve(false)); });
      s.listen(port, '127.0.0.1');
    });

    // Phase 1: Scan all ports for existing Chrome
    let foundPort = 0;
    let wasHeadless = false;
    let existingProfileDir = null;
    for (const port of CDP_PORTS) {
      const ok = await probePort(port);
      if (!ok) continue;
      foundPort = port;
      // Check if this Chrome is headless
      try {
        const psOutput = execSync(`ps aux | grep 'chrome.*remote-debugging-port=${port}' | grep -v grep`, { encoding: 'utf8' });
        const dataDirMatch = psOutput.match(/--user-data-dir=([^\s]+)/);
        if (dataDirMatch) existingProfileDir = dataDirMatch[1];
        if (psOutput.includes('--headless') || psOutput.includes('--ozone-platform=headless')) {
          wasHeadless = true;
          log.warn(`Chrome headless detectado na porta ${port}. Matando...`);
          execSync(`pkill -f 'chrome.*remote-debugging-port=${port}'`);
          await new Promise(r => setTimeout(r, 3000));
          foundPort = 0;
          wasHeadless = false;
          existingProfileDir = null;
        } else {
          // Valid visible Chrome found
          this.cdpUrl = makeCdpUrl(port);
          return { running: true, started: false, wasHeadless: false, port };
        }
      } catch {
        // Could not determine, assume it's ok
        this.cdpUrl = makeCdpUrl(port);
        return { running: true, started: false, wasHeadless: false, port };
      }
    }

    // Phase 2: Find first free port to start Chrome on
    let startPort = CDP_PORTS[0];
    for (const port of CDP_PORTS) {
      const occupied = await isPortOccupied(port);
      if (!occupied) { startPort = port; break; }
    }
    // If all ports occupied by non-Chrome processes, use the first one and warn
    if (startPort !== CDP_PORTS[0]) {
      const allOccupied = await Promise.all(CDP_PORTS.map(p => isPortOccupied(p)));
      if (allOccupied.every(o => o)) {
        log.warn('Todas as portas CDP ocupadas por outros processos. Usando porta 9222 mesmo assim.');
        startPort = CDP_PORTS[0];
      }
    }

    // Start visible Chrome
    const chromeCmds = [
      'google-chrome',
      'google-chrome-stable',
      'chromium',
      'chromium-browser',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
    ];
    let chromePath = null;
    for (const cmd of chromeCmds) {
      try { execSync(`which ${cmd}`, { stdio: 'ignore' }); chromePath = cmd; break; } catch {}
    }
    if (!chromePath) {
      return { running: false, started: false, error: 'Chrome não encontrado. Instale google-chrome-stable ou chromium.' };
    }

    try {
      const profileDir = existingProfileDir || userDataDir;
      if (existingProfileDir) log.info(`Reutilizando perfil existente: ${existingProfileDir}`);

      const proc = spawn(chromePath, [
        `--remote-debugging-port=${startPort}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--user-data-dir=' + profileDir,
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        'https://kimi.com/',
      ], { detached: true, stdio: 'ignore', env: { ...process.env, DISPLAY: process.env.DISPLAY || ':0' } });
      proc.unref();

      await new Promise(r => setTimeout(r, 5000));

      // Verify it started
      const ok = await probePort(startPort);
      if (ok) {
        this.cdpUrl = makeCdpUrl(startPort);
        return { running: true, started: true, pid: proc.pid, wasHeadless, profileDir, port: startPort };
      }
      return { running: false, started: true, pid: proc.pid, wasHeadless, profileDir, port: startPort, error: 'Chrome iniciou mas não respondeu em 5s' };
    } catch (e) {
      return { running: false, started: false, error: e.message };
    }
  }

  /**
   * Check login state on a page using browser-native selectors (no :has-text()).
   */
  async _checkLoginState(page) {
    try {
      return await page.evaluate(() => {
        const bodyText = document.body?.innerText?.toLowerCase() || '';
        // Look for actual login indicators
        const hasLoginBtn = !!(
          document.querySelector('a[href*="login"], a[href*="signin"], button[class*="login"], button[class*="signin"]') ||
          document.querySelector('input[type="password"]')
        );
        const hasChatInput = !!(
          document.querySelector('textarea[placeholder], [contenteditable="true"]') ||
          document.querySelector('div[role="textbox"]')
        );
        const hasLoginText = bodyText.includes('log in') || bodyText.includes('sign in') || bodyText.includes('登录') || bodyText.includes('entrar');
        const hasWelcome = bodyText.includes('welcome') || bodyText.includes('kimi');
        // Consider logged in if we see chat input AND no login text/button
        const loggedIn = hasChatInput && !hasLoginText && !hasLoginBtn;
        return { loggedIn, hasLoginBtn, hasChatInput, hasLoginText, hasWelcome, url: location.href };
      });
    } catch (e) {
      return { loggedIn: false, error: e.message };
    }
  }

  /**
   * Ensure user is logged into Kimi Web. Opens page and brings to front.
   * If not logged in, navigates to kimi.com and starts polling.
   */
  async ensureLogin(userId) {
    let page;
    try {
      page = await this._getOrCreateUserPage(userId);
      await page.bringToFront().catch(() => {});
    } catch (e) {
      return { loggedIn: false, error: `Failed to get page: ${e.message}`, action: 'login_required' };
    }

    // Check current state
    const state = await this._checkLoginState(page);
    if (state.loggedIn) {
      return { loggedIn: true, message: 'Já está logado no Kimi Web', url: state.url };
    }

    // Not logged in — navigate to kimi.com and bring to front
    log.info(`User not logged in, navigating to Kimi login page`);
    try {
      await page.goto('https://kimi.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(1500);
      await page.bringToFront().catch(() => {});
    } catch (e) {
      log.warn(`Navigation to kimi.com failed: ${e.message}`);
      // Try again with a fresh page
      try {
        const session = this.userSessions.get(userId);
        if (session && session.page && !session.page.isClosed()) {
          await session.page.close().catch(() => {});
          this.userSessions.delete(userId);
          this.semaphore.current = Math.max(0, this.semaphore.current - 1);
        }
        page = await this._getOrCreateUserPage(userId);
        await page.bringToFront().catch(() => {});
      } catch (e2) {
        return { loggedIn: false, error: `Failed to navigate: ${e2.message}`, action: 'login_required' };
      }
    }

    // Quick re-check after navigation
    const state2 = await this._checkLoginState(page);
    if (state2.loggedIn) {
      return { loggedIn: true, message: 'Já está logado no Kimi Web', url: state2.url };
    }

    return {
      loggedIn: false,
      message: 'Naveguei para kimi.com. Por favor, faça login manualmente no navegador que abriu.',
      action: 'login_required',
      url: state2.url,
    };
  }

  /**
   * Poll the page until login is detected or timeout.
   * @returns {Promise<{loggedIn: boolean, message: string}>}
   */
  async waitForLogin(userId, maxWaitMs = 60000, intervalMs = 2500) {
    const session = this.userSessions.get(userId);
    if (!session || !session.page || session.page.isClosed()) {
      return { loggedIn: false, message: 'Página não encontrada. Use /login primeiro.' };
    }
    const page = session.page;
    const start = Date.now();
    let lastState = null;

    while (Date.now() - start < maxWaitMs) {
      const state = await this._checkLoginState(page);
      lastState = state;
      if (state.loggedIn) {
        // Update stored chat URL
        try {
          const url = await page.evaluate(() => location.href);
          session.chatUrl = url;
          this.store.setUser(userId, { chatUrl: url, mode: session.mode });
        } catch {}
        return { loggedIn: true, message: 'Login detectado! Pronto para usar.', url: state.url };
      }
      await new Promise(r => setTimeout(r, intervalMs));
    }

    return {
      loggedIn: false,
      message: 'Tempo esgotado aguardando login. Faça login manualmente no Chrome.',
      lastState,
      action: 'login_timeout',
    };
  }

  /**
   * Logout user: close page, clear session, optionally kill Chrome.
   */
  async logout(userId, opts = {}) {
    const session = this.userSessions.get(userId);
    if (session) {
      if (session.page && !session.page.isClosed()) {
        try { await session.page.close(); } catch {}
      }
      this.userSessions.delete(userId);
      this.semaphore.current = Math.max(0, this.semaphore.current - 1);
    }

    if (opts.killChrome) {
      try {
        const { execSync } = require('child_process');
        // Kill Chrome on ALL possible CDP ports
        for (const port of CDP_PORTS) {
          try { execSync(`pkill -f 'chrome.*remote-debugging-port=${port}'`); } catch {}
        }
        this._resetCdpUrl();
        log.info('Chrome killed');
        return { success: true, message: 'Logout completo. Chrome fechado.' };
      } catch (e) {
        return { success: true, message: 'Sessão encerrada. Chrome já estava fechado.' };
      }
    }

    return { success: true, message: 'Logout completo. Sessão encerrada.' };
  }

  /**
   * Check if there's already a visible Chrome running on any CDP port.
   * Returns details including which port is in use.
   */
  async getChromeStatus() {
    const { execSync } = require('child_process');
    for (const port of CDP_PORTS) {
      try {
        const psOutput = execSync(`ps aux | grep 'chrome.*remote-debugging-port=${port}' | grep -v grep`, { encoding: 'utf8' });
        const isHeadless = psOutput.includes('--headless') || psOutput.includes('--ozone-platform=headless');
        const profileMatch = psOutput.match(/--user-data-dir=([^\s]+)/);
        const pidMatch = psOutput.match(/^\S+\s+(\d+)/);
        return {
          running: true,
          isHeadless: !!isHeadless,
          profileDir: profileMatch ? profileMatch[1] : null,
          pid: pidMatch ? parseInt(pidMatch[1]) : null,
          port,
        };
      } catch {
        // No Chrome on this port, try next
      }
    }
    return { running: false };
  }

  /**
   * Screenshot a user's page
   */
  async screenshot(userId, ssPath = null) {
    const page = await this._getOrCreateUserPage(userId);
    const filePath = ssPath || path.join(ARTIFACTS_DIR, `kimi-screenshot-${hashUserId(userId)}-${Date.now()}.png`);

    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await page.screenshot({ path: filePath, fullPage: true });
    log.info(`Screenshot saved: ${filePath}`);
    return filePath;
  }

  /**
   * Start idle cleanup timer — closes inactive pages
   */
  _startIdleCleanup() {
    if (this.idleTimer) clearInterval(this.idleTimer);
    this.idleTimer = setInterval(() => {
      const now = Date.now();
      for (const [userId, session] of this.userSessions) {
        if (session.processing) continue;
        if (now - session.lastActivity > this.idleTimeout) {
          log.info(`Idle cleanup: closing page for user ${hashUserId(userId)}`);
          try {
            if (session.page && !session.page.isClosed()) {
              session.page.removeAllListeners('crash');
              session.page.close().catch(e => log.warn(`Idle close error: ${e.message}`));
            }
          } catch (e) {
            log.warn(`Idle cleanup error for ${hashUserId(userId)}: ${e.message}`);
          }
          this.userSessions.delete(userId);
          this.semaphore.release();
        }
      }
    }, 60000); // Check every minute
  }

  // ============================================================
  // STREAMING + STEER (v2.2)
  // ============================================================

  /**
   * Inject a stream interceptor script into the page to capture raw API responses.
   * This is the MOST reliable way to separate thinking from response because
   * the Kimi API returns them as separate fields (reasoning_content vs content).
   */
  async _injectStreamInterceptor(page) {
    try {
      await page.addInitScript(() => {
        if (window.__lunaInterceptorInstalled) return;
        window.__lunaInterceptorInstalled = true;
        const MAX_EVENTS = 500;
        window.__lunaStream = {
          reasoning: '', content: '', events: [], active: false, startTime: Date.now(), error: null
        };
        window.__lunaResetStream = function() {
          window.__lunaStream.reasoning = '';
          window.__lunaStream.content = '';
          window.__lunaStream.events = [];
          window.__lunaStream.active = false;
          window.__lunaStream.error = null;
        };

        function isChatUrl(url) {
          if (typeof url !== 'string') return false;
          return url.includes('/chat/completions') ||
                 url.includes('/api/chat') ||
                 url.includes('/api/conversation') ||
                 url.includes('/v1/chat') ||
                 url.includes('/api/v1/chat') ||
                 url.includes('/stream');
        }

        function parseSseChunk(chunk) {
          const lines = chunk.split('\n');
          const results = [];
          let currentData = '';
          for (const line of lines) {
            if (line.startsWith('data:')) {
              const data = line.slice(5).trim();
              if (data === '[DONE]') {
                results.push({ done: true });
                continue;
              }
              currentData = data;
              try {
                const json = JSON.parse(data);
                const choice = json.choices?.[0];
                if (choice?.delta) {
                  results.push({
                    reasoning: choice.delta.reasoning_content || choice.delta.reasoning || '',
                    content: choice.delta.content || '',
                  });
                } else if (choice?.message) {
                  results.push({
                    reasoning: choice.message.reasoning_content || choice.message.reasoning || '',
                    content: choice.message.content || '',
                  });
                }
              } catch (e) { /* ignore parse errors */ }
            }
          }
          return results;
        }

        function accumulate(results) {
          if (!results || !results.length) return;
          window.__lunaStream.active = true;
          for (const r of results) {
            if (r.done) continue;
            if (r.reasoning) window.__lunaStream.reasoning += r.reasoning;
            if (r.content) window.__lunaStream.content += r.content;
            window.__lunaStream.events.push(r);
            // Circular buffer: keep only last MAX_EVENTS
            if (window.__lunaStream.events.length > MAX_EVENTS) {
              window.__lunaStream.events = window.__lunaStream.events.slice(-MAX_EVENTS);
            }
          }
        }

        // ── Intercept fetch ──
        const origFetch = window.fetch;
        window.fetch = async function(...args) {
          const url = args[0]?.url || args[0];
          const isChat = isChatUrl(url);
          if (!isChat) return origFetch.apply(this, args);

          window.__lunaStream.active = true;
          const response = await origFetch.apply(this, args);

          // Read stream in real-time using ReadableStream reader
          try {
            const cloned = response.clone();
            const reader = cloned.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              // Process complete SSE lines from buffer
              const lines = buffer.split('\n');
              buffer = lines.pop(); // keep incomplete line in buffer
              const chunk = lines.join('\n');
              if (chunk) {
                const results = parseSseChunk(chunk);
                accumulate(results);
              }
            }
            // Process any remaining buffer
            if (buffer) {
              const results = parseSseChunk(buffer);
              accumulate(results);
            }
          } catch (e) {
            window.__lunaStream.error = e.message;
          }
          return response;
        };

        // ── Intercept XMLHttpRequest ──
        const origOpen = XMLHttpRequest.prototype.open;
        const origSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.open = function(method, url, ...rest) {
          this._lunaIsChat = isChatUrl(url);
          return origOpen.call(this, method, url, ...rest);
        };
        XMLHttpRequest.prototype.send = function(...args) {
          if (this._lunaIsChat) {
            window.__lunaStream.active = true;
            const origOnReady = this.onreadystatechange;
            this.onreadystatechange = function() {
              if (this.readyState >= 3 && this.responseText) {
                const newText = this.responseText.slice(this._lunaLastLen || 0);
                this._lunaLastLen = this.responseText.length;
                const results = parseSseChunk(newText);
                accumulate(results);
              }
              if (origOnReady) origOnReady.apply(this, arguments);
            };
          }
          return origSend.apply(this, args);
        };

        // ── Intercept EventSource ──
        const origEventSource = window.EventSource;
        if (origEventSource) {
          window.EventSource = function(url, options) {
            const es = new origEventSource(url, options);
            if (isChatUrl(url)) {
              window.__lunaStream.active = true;
              es.addEventListener('message', (event) => {
                const results = parseSseChunk(event.data);
                accumulate(results);
              });
            }
            return es;
          };
          Object.setPrototypeOf(window.EventSource, origEventSource);
          window.EventSource.prototype = origEventSource.prototype;
        }

        // ── Intercept WebSocket ──
        const origWebSocket = window.WebSocket;
        if (origWebSocket) {
          window.WebSocket = function(url, protocols) {
            const ws = new origWebSocket(url, protocols);
            // Mark as chat if URL contains chat-related patterns or if messages look like chat deltas
            ws._lunaIsChat = isChatUrl(url) || /chat|stream|completion/i.test(url);
            ws.addEventListener('message', (event) => {
              if (!ws._lunaIsChat) return;
              window.__lunaStream.active = true;
              let data = event.data;
              if (typeof data === 'string') {
                // Try to parse as JSON or newline-delimited JSON
                const lines = data.split('\n');
                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed) continue;
                  // SSE-style data: prefix
                  const payload = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
                  if (payload === '[DONE]') continue;
                  try {
                    const json = JSON.parse(payload);
                    const choices = json.choices || json.messages || json.data;
                    if (Array.isArray(choices)) {
                      for (const choice of choices) {
                        const delta = choice.delta || choice.message || choice;
                        if (delta) {
                          accumulate([{
                            reasoning: delta.reasoning_content || delta.reasoning || '',
                            content: delta.content || delta.text || '',
                          }]);
                        }
                      }
                    } else if (json.reasoning_content || json.content || json.text) {
                      accumulate([{
                        reasoning: json.reasoning_content || json.reasoning || '',
                        content: json.content || json.text || '',
                      }]);
                    }
                  } catch (e) {
                    // Not JSON — could be plain text stream
                    accumulate([{ content: payload }]);
                  }
                }
              }
            });
            return ws;
          };
          Object.setPrototypeOf(window.WebSocket, origWebSocket);
          window.WebSocket.prototype = origWebSocket.prototype;
        }
      });
    } catch (e) {
      log.warn(`Stream interceptor injection failed: ${e.message}`);
    }
  }

  /**
   * Poll the DOM for current thinking and response text.
   * Uses MULTI-LAYER strategy:
   *   1. Stream interceptor (most reliable — reads raw API deltas)
   *   2. React Fiber inspection (finds component props)
   *   3. Computed-style heuristic (grey/italic = thinking)
   *   4. CSS selector fallback
   *
   * Returns { thinking, response, canSteer, isGenerating, source }
   */
  async _pollThinkingAndResponse(page) {
    try {
      // Layer 1: Stream interceptor (reads raw API data injected by _injectStreamInterceptor)
      const intercepted = await page.evaluate(() => {
        const s = window.__lunaStream;
        if (s && s.active) {
          return {
            thinking: s.reasoning,
            response: s.content,
            source: 'intercept',
            hasData: s.reasoning.length > 0 || s.content.length > 0,
          };
        }
        return null;
      });
      // CRITICAL: When interceptor is active, trust it EXCLUSIVELY.
      // Do NOT fallback to DOM scraping because the DOM may render
      // thinking text in containers that look like response containers.
      if (intercepted) {
        const { canSteer, isGenerating } = await this._detectUiState(page);
        this._log(`[_poll] interceptor: thinking=${intercepted.thinking.length}, response=${intercepted.response.length}, source=${intercepted.source}`);
        return { ...intercepted, canSteer, isGenerating };
      }

      // Layer 2–4: DOM-based extraction
      const domResult = await page.evaluate(() => {
        // ── Helpers ──
        function getReactFiber(dom) {
          const key = Object.keys(dom).find(k =>
            k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')
          );
          return key ? dom[key] : null;
        }

        function findMessageFiber(fiber) {
          let node = fiber;
          while (node) {
            const props = node.memoizedProps || node.pendingProps;
            if (props && (props.message || props.msg || props.data?.message || props.conversation)) {
              return node;
            }
            node = node.return;
          }
          return null;
        }

        function isThinkingByStyle(el) {
          const style = window.getComputedStyle(el);
          const color = style.color;
          const fontStyle = style.fontStyle;
          // Thinking blocks are often grey-ish and italic
          const isGrey = color.includes('128') || color.includes('grey') || color.includes('gray') ||
                         color.includes('150') || color.includes('169') || color.includes('rgb(156') ||
                         color.includes('rgb(107');
          return isGrey && fontStyle === 'italic';
        }

        function isInsideThinkContainer(el, boundary) {
          let parent = el.parentElement;
          while (parent && parent !== boundary) {
            const pc = (parent.className || '').toLowerCase();
            if (pc.includes('think') || pc.includes('thinking') || pc.includes('reasoning')) return true;
            if (isThinkingByStyle(parent)) return true;
            parent = parent.parentElement;
          }
          return false;
        }

        // 1. Find last assistant message
        const assistantSelectors = [
          '.segment-assistant',
          '.message-assistant',
          '[data-testid="assistant-message"]',
          '[data-testid="message-assistant"]',
          '.chat-message--assistant',
          '[class*="assistant"][class*="segment"]',
          '[class*="assistant"][class*="message"]',
        ];
        let lastAssistant = null;
        for (const sel of assistantSelectors) {
          const els = document.querySelectorAll(sel);
          if (els.length) { lastAssistant = els[els.length - 1]; break; }
        }
        if (!lastAssistant) {
          // Fallback: last message-like container
          const allMsg = document.querySelectorAll('.chat-message, .message-item, [data-testid="message-container"]');
          if (allMsg.length) lastAssistant = allMsg[allMsg.length - 1];
        }
        if (!lastAssistant) return { thinking: '', response: '', source: 'none' };

        // 2. React Fiber deep inspection
        const fiber = getReactFiber(lastAssistant);
        const msgFiber = fiber ? findMessageFiber(fiber) : null;
        if (msgFiber) {
          const props = msgFiber.memoizedProps || msgFiber.pendingProps;
          const msg = props?.message || props?.msg || props?.data;
          if (msg) {
            const reasoning = msg.reasoning_content || msg.reasoning || msg.think || '';
            const content = msg.content || msg.text || msg.response || '';
            if (reasoning || content) {
              return {
                thinking: String(reasoning).trim(),
                response: String(content).trim(),
                source: 'react-fiber',
              };
            }
          }
        }

        // 3. Walk all text containers inside assistant and classify
        const textBlocks = [];
        const walker = document.createTreeWalker(lastAssistant, NodeFilter.SHOW_ELEMENT, null);
        let node;
        while ((node = walker.nextNode())) {
          const tag = node.tagName.toLowerCase();
          if (tag === 'p' || tag === 'div' || tag === 'span' || tag === 'pre') {
            const text = node.innerText?.trim();
            if (text && text.length > 2) {
              const isThink = isInsideThinkContainer(node, lastAssistant) || isThinkingByStyle(node);
              textBlocks.push({ text, isThink, el: node });
            }
          }
        }

        // Separate thinking and response
        let thinking = '';
        let response = '';

        // Strategy A: if we have classified blocks
        const thinkBlocks = textBlocks.filter(b => b.isThink);
        const respBlocks = textBlocks.filter(b => !b.isThink);

        if (thinkBlocks.length && respBlocks.length) {
          thinking = thinkBlocks.map(b => b.text).join('\n\n');
          response = respBlocks.map(b => b.text).join('\n\n');
          return { thinking, response, source: 'style-heuristic' };
        }

        // Strategy B: look for explicit thinking containers by class
        const thinkSelectors = [
          '.thinking-container', '.think-block', '.thinking-block',
          '.segment-thinking', '.assistant-thinking',
          '[data-testid="thinking"]', '[data-testid="think-block"]',
          '[class*="thinking"]', '[class*="reasoning"]',
        ];
        for (const sel of thinkSelectors) {
          const els = lastAssistant.querySelectorAll(sel);
          if (els.length) {
            const lastThink = els[els.length - 1];
            const text = lastThink.innerText?.trim();
            if (text && text.length > 5) {
              thinking = text;
              break;
            }
          }
        }

        // Strategy C: extract response — last markdown NOT inside think
        const mdContainers = lastAssistant.querySelectorAll('.markdown-container, [class*="markdown"]');
        for (let i = mdContainers.length - 1; i >= 0; i--) {
          const md = mdContainers[i];
          if (!isInsideThinkContainer(md, lastAssistant)) {
            const text = md.innerText?.trim();
            if (text) { response = text; break; }
          }
        }

        // Strategy D: if no markdown found, use all text minus thinking
        if (!response) {
          const allText = lastAssistant.innerText?.trim() || '';
          if (thinking && allText.includes(thinking)) {
            response = allText.replace(thinking, '').trim();
          } else {
            response = allText;
          }
        }

        // ── Heuristic: if we still have everything in response and nothing in thinking,
        // try to detect thinking vs response by content patterns ──
        if (!thinking && response.length > 500) {
          // Common thinking starters (PT/EN/ES)
          const thinkStarters = /^(O usuário|Vou |Agora |Preciso |Primeiro |Vamos |Então |Deixa |Hmm |Ok |Okay |Let me |I need |I'll |First |Now |So |The user |Hmm |Okay )/i;
          // Look for transition to structured response: code block, JSON, or markdown headers
          const codeBlockIdx = response.indexOf('```');
          const jsonStartIdx = response.search(/\{\s*"/);
          const mdHeaderIdx = response.search(/\n#{1,3}\s/);
          const transitionIdx = codeBlockIdx > 50 ? codeBlockIdx
            : (jsonStartIdx > 50 ? jsonStartIdx
            : (mdHeaderIdx > 50 ? mdHeaderIdx : -1));
          if (transitionIdx > 100 && thinkStarters.test(response)) {
            thinking = response.slice(0, transitionIdx).trim();
            response = response.slice(transitionIdx).trim();
          }
        }

        return { thinking, response, source: 'dom-fallback' };
      });

      const { canSteer, isGenerating } = await this._detectUiState(page);
      this._log(`[_poll] dom-fallback: source=${domResult.source}, think=${domResult.thinking.length}, resp=${domResult.response.length}`);
      return { ...domResult, canSteer, isGenerating };
    } catch (e) {
      return { thinking: '', response: '', canSteer: false, isGenerating: false, source: 'error' };
    }
  }

  /**
   * Detect UI state: canSteer and isGenerating from DOM buttons.
   */
  async _detectUiState(page) {
    try {
      return await page.evaluate(() => {
        // Can we steer? (send button is active, not disabled)
        const sendBtnSelectors = ['.send-button-container', '[class*="send"]', 'button[type="submit"]', '[aria-label*="send" i]'];
        let canSteer = false;
        for (const sel of sendBtnSelectors) {
          const btn = document.querySelector(sel);
          if (btn) {
            canSteer = !btn.disabled && !btn.className.includes('disabled') && btn.offsetParent !== null;
            if (canSteer) break;
          }
        }

        // Is still generating? (stop button visible OR no send button = generating)
        const stopBtnSelectors = ['.stop-button-container', '[class*="stop"]', '[class*="cancel"]', '[aria-label*="stop" i]'];
        let isGenerating = false;
        for (const sel of stopBtnSelectors) {
          const btn = document.querySelector(sel);
          if (btn && btn.offsetParent !== null) {
            isGenerating = true;
            break;
          }
        }
        if (!isGenerating && !canSteer) {
          const anySend = document.querySelector('.send-button-container, [class*="send"]');
          if (!anySend || anySend.offsetParent === null) isGenerating = true;
        }
        return { canSteer, isGenerating };
      });
    } catch (e) {
      return { canSteer: false, isGenerating: false };
    }
  }

  /**
   * Check if we can inject a steer message mid-response.
   */
  async canSteer(userId) {
    const session = this.userSessions.get(userId);
    if (!session || !session.page || session.page.isClosed()) return false;
    const { canSteer } = await this._pollThinkingAndResponse(session.page);
    return canSteer;
  }

  /**
   * Inject a steer message while Kimi is generating.
   * This sends new text into the conversation mid-flight.
   */
  async injectSteer(userId, text) {
    if (!text || !text.trim()) {
      throw new Error('Steer text is required');
    }

    const page = await this._getOrCreateUserPage(userId);
    const session = this.userSessions.get(userId);

    log.info(`Injecting steer for user ${hashUserId(userId)}: "${text.slice(0, 60)}..."`);

    try {
      // Check if send button is active
      const canSteer = await this.canSteer(userId);
      if (!canSteer) {
        log.warn(`Cannot steer — send button is disabled (Kimi may be finalizing)`);
        return { success: false, error: 'Send button disabled — cannot steer right now' };
      }

      // Find input and inject text
      const inputLocator = page.locator('textarea, [contenteditable="true"]').first();
      await inputLocator.fill(text);
      await page.waitForTimeout(300);

      // Click send or press Enter
      const sendBtn = page.locator('.send-button-container').first();
      const hasSendBtn = await sendBtn.count() > 0;

      if (hasSendBtn) {
        await sendBtn.click({ timeout: 3000 });
      } else {
        await inputLocator.press('Enter');
      }

      log.success(`Steer injected for user ${hashUserId(userId)}`);
      return { success: true };
    } catch (err) {
      log.error(`Steer injection failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Send message with REAL-TIME STREAMING.
   * Yields: { type: 'thinking_delta'|'response_delta'|'can_steer'|'done', text?, value? }
   *
   * Pattern inspired by ShellAgent's Provider.chat() async generator.
   */
  async *sendMessageStream(userId, text, options = {}) {
    if (!text || !text.trim()) {
      throw new Error('Message text is required');
    }

    // Rate limiting
    this._checkCooldown(userId);

    const page = await this._getOrCreateUserPage(userId);
    const session = this.userSessions.get(userId);

    // Reset stream interceptor state to prevent cross-message contamination
    await page.evaluate(() => { if (window.__lunaResetStream) window.__lunaResetStream(); });

    // Wait for any ongoing processing
    if (session.processing) {
      log.warn(`User ${hashUserId(userId)} already processing — waiting`);
      const startWait = Date.now();
      while (session.processing) {
        if (Date.now() - startWait > 60000) {
          throw new Error('Timeout waiting for previous message');
        }
        await new Promise(r => setTimeout(r, 500));
      }
    }

    session.processing = true;
    session.lastActivity = Date.now();

    try {
      await this._verifySession(page);

      if (options.newChat) {
        await page.goto('https://kimi.com/?chat_enter_method=new_chat', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);
        session.chatUrl = page.url();
        this.store.setUser(userId, { chatUrl: session.chatUrl });
      }

      if (options.mode) {
        await this.setMode(userId, options.mode);
      }

      const actualMode = await this._detectActualMode(page) || session.mode || 'instant';
      log.info(`User ${hashUserId(userId)} streaming message (mode=${actualMode})`);

      // Verify input exists
      const inputLocator = page.locator('textarea, [contenteditable="true"]').first();
      const inputCount = await inputLocator.count();
      if (inputCount === 0) {
        throw new Error('Input field not found on Kimi Web');
      }

      // Bring page to front (Chrome throttles inactive tabs)
      await page.bringToFront();

      // Send message
      await inputLocator.fill('');
      await page.waitForTimeout(300);

      if (text.length <= MAX_TEXT_TYPE_LENGTH) {
        await inputLocator.type(text, { delay: 50 });
      } else {
        // For large texts in contenteditable, use fill but also dispatch input events
        log.info(`Text too long (${text.length} chars), using fill with event dispatch`);
        await inputLocator.fill(text);
        await page.waitForTimeout(200);
        // Dispatch input event to ensure Kimi detects the text
        await page.evaluate(() => {
          const el = document.querySelector('textarea, [contenteditable="true"]');
          if (el) {
            el.dispatchEvent(new InputEvent('input', { bubbles: true, data: el.value || el.innerText }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
      }
      await page.waitForTimeout(500);
      await inputLocator.press('Enter');
      log.info(`Message sent, starting stream poll`);

      // Capture initial text to detect changes
      const initialText = await page.locator('.markdown-container .markdown').last().innerText({ timeout: 2000 }).catch(() => '');

      // Stream polling loop
      const maxTimeout = actualMode === 'instant' ? 300000 : 600000;
      const startTime = Date.now();
      const pollInterval = 800; // Poll every 800ms for responsiveness

      let lastThinking = '';
      let lastResponse = '';
      let lastCanSteer = false;
      let isComplete = false;
      let buttonsVisible = false;

      // Phase 0: Wait for text to start changing
      let textHasChanged = false;
      const changeDeadline = Date.now() + 30000;
      let pollCount = 0;
      while (Date.now() < changeDeadline) {
        const { thinking, response } = await this._pollThinkingAndResponse(page);
        const combined = thinking + response;
        if (combined !== initialText && combined.length > 0) {
          textHasChanged = true;
          break;
        }
        // Heartbeat: yield waiting status every 5 polls so TUI knows we're alive
        if (++pollCount % 5 === 0) {
          yield { type: 'waiting', message: 'Aguardando resposta do Kimi...' };
        }
        await new Promise(r => setTimeout(r, 500));
      }

      if (!textHasChanged) {
        throw new Error('Kimi não iniciou resposta em 30s — possível erro de envio ou seletores desatualizados');
      }

      // Phase 1: Stream until complete
      let lastActivity = Date.now();
      const INACTIVITY_TIMEOUT = 60000; // 60s without any change = error

      while (Date.now() - startTime < maxTimeout && !isComplete) {
        const poll = await this._pollThinkingAndResponse(page);

        // Track activity
        const hadChange = poll.thinking !== lastThinking || poll.response !== lastResponse || poll.canSteer !== lastCanSteer;
        if (hadChange || poll.thinking || poll.response) {
          lastActivity = Date.now();
        }

        // Yield thinking deltas
        if (poll.thinking && poll.thinking !== lastThinking) {
          const delta = poll.thinking.slice(lastThinking.length);
          if (delta) {
            yield { type: 'thinking_delta', text: delta };
          } else if (poll.thinking.length < lastThinking.length) {
            yield { type: 'thinking_delta', text: poll.thinking };
          }
          lastThinking = poll.thinking;
        }

        // Yield response deltas
        if (poll.response && poll.response !== lastResponse) {
          const delta = poll.response.slice(lastResponse.length);
          if (delta) {
            yield { type: 'response_delta', text: delta };
          } else if (poll.response.length < lastResponse.length) {
            yield { type: 'response_delta', text: poll.response };
          }
          lastResponse = poll.response;
        }

        // Yield steer availability
        if (poll.canSteer !== lastCanSteer) {
          yield { type: 'can_steer', value: poll.canSteer };
          lastCanSteer = poll.canSteer;
        }

        // Check completion: buttons visible + text stable
        try {
          const hasButtons = await page.locator('.segment-assistant-actions .icon-button').count() > 0;
          if (hasButtons) buttonsVisible = true;
        } catch {}

        // Complete if: buttons visible AND not generating AND text stable
        if (buttonsVisible && !poll.isGenerating) {
          await new Promise(r => setTimeout(r, 1500));
          const finalPoll = await this._pollThinkingAndResponse(page);
          if (!finalPoll.isGenerating && finalPoll.response === lastResponse) {
            isComplete = true;
            break;
          }
        }

        // Also complete if no generation for a while after text appeared
        if (textHasChanged && !poll.isGenerating && lastResponse.length > 0 && buttonsVisible) {
          isComplete = true;
          break;
        }

        // Inactivity timeout: if nothing changed for 60s, something is wrong
        if (Date.now() - lastActivity > INACTIVITY_TIMEOUT) {
          throw new Error('Nenhuma atividade detectada por 60s — possível travamento ou erro de conexão');
        }

        // Heartbeat every ~10 polls
        if (++pollCount % 10 === 0) {
          yield { type: 'waiting', message: 'Processando...' };
        }

        await new Promise(r => setTimeout(r, pollInterval));
      }

      // Final extraction for clean response
      // _extractResponse uses React Fiber + DOM filtering to separate thinking from response.
      // lastResponse accumulated during polling may be polluted with thinking text when
      // the stream interceptor is not active and DOM fallback cannot separate them.
      // Therefore: ALWAYS prefer _extractResponse when it returns meaningful text.
      // Only fall back to lastResponse if _extractResponse fails or returns nothing.
      let finalResponse = lastResponse;
      try {
        const extracted = await this._extractResponse(page);
        if (extracted && extracted.trim().length > 50) {
          // Heuristic: if extracted is much shorter, it likely successfully removed thinking.
          // If it's longer or similar, it's the full response. Either way, prefer it.
          finalResponse = extracted.trim();
          if (extracted.length < lastResponse.length * 0.5) {
            log.info(`_extractResponse returned clean text (${extracted.length} vs polluted ${lastResponse.length}) — using clean extraction`);
          }
        } else if (extracted) {
          log.warn(`_extractResponse returned very short text (${extracted.length}), using lastResponse as fallback`);
        }
      } catch (e) {
        log.warn(`_extractResponse failed: ${e.message}, using lastResponse as fallback`);
      }
      session.chatUrl = page.url();
      this.store.setUser(userId, { chatUrl: session.chatUrl });

      yield { type: 'done', response: finalResponse, thinking: lastThinking };

    } catch (err) {
      try { await page.locator('textarea, [contenteditable="true"]').first().fill(''); } catch {}
      throw err;
    } finally {
      session.processing = false;
      session.lastActivity = Date.now();
    }
  }

  /**
   * Copy last response (clicks copy button on Kimi UI)
   * Uses aria-label/title instead of hardcoded indices.
   */
  async copyLastResponse(userId) {
    const page = await this._getOrCreateUserPage(userId);
    log.info(`Clicking copy button for user ${hashUserId(userId)}`);

    await page.evaluate(() => {
      const container = document.querySelector('.segment-assistant-actions');
      if (!container) return false;
      // Find by aria-label or SVG name
      const btn = container.querySelector('[aria-label="Copy"], button[title="Copy"], .icon-button');
      if (btn) { btn.click(); return true; }
      // Fallback: first icon-button
      const fallback = container.querySelector('.icon-button');
      if (fallback) { fallback.click(); return true; }
      return false;
    }).catch(() => false);

    await page.waitForTimeout(500);
    return true;
  }

  /**
   * Regenerate last response
   */
  async regenerateLastResponse(userId) {
    const page = await this._getOrCreateUserPage(userId);
    log.info(`Clicking regenerate for user ${hashUserId(userId)}`);

    await page.evaluate(() => {
      const container = document.querySelector('.segment-assistant-actions');
      if (!container) return false;
      const btn = container.querySelector('[aria-label="Regenerate"], button[title="Regenerate"], [aria-label="Refresh"]');
      if (btn) { btn.click(); return true; }
      // Fallback: second icon-button
      const buttons = container.querySelectorAll('.icon-button');
      if (buttons.length > 1) { buttons[1].click(); return true; }
      return false;
    }).catch(() => false);

    const session = this.userSessions.get(userId);
    const actualMode = await this._detectActualMode(page) || session.mode || 'instant';
    await this._waitForResponse(page, actualMode);
    return this._extractResponse(page);
  }
}

// ============================================================
// SINGLETON HELPERS
// ============================================================
let bridgeInstance = null;

async function getKimiBridge(options = {}) {
  if (!bridgeInstance) {
    bridgeInstance = new KimiBridge(options);
    await bridgeInstance.connect();
  }
  return bridgeInstance;
}

async function closeKimiBridge() {
  if (bridgeInstance) {
    await bridgeInstance.disconnect();
    bridgeInstance = null;
  }
}

module.exports = {
  KimiBridge,
  getKimiBridge,
  closeKimiBridge,
  KimiLogger,
  KimiSessionStore,
};
