/**
 * Luna-Kimi Bridge v2.0
 * Multi-user Playwright automation for Kimi Web (kimi.com) via CDP
 *
 * Patterns borrowed from luna-cto-agent.cjs (Luna v15.1–v19.0):
 * - Persistent Logger with circular buffer
 * - Keep-alive (uncaughtException / unhandledRejection)
 * - SessionStore (CheckpointManager pattern)
 * - Multi-strategy selector fallback
 * - processedMessageIds circular Set
 *
 * Architecture:
 * - Single BrowserContext (contexts()[0]) — the ONLY one with logged-in cookies
 * - One Page per Telegram userId
 * - Semaphore limits max concurrent pages (default 5)
 * - Idle cleanup closes pages after 10min inactivity
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

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
const DEFAULT_CDP_URL = process.env.KIMI_CDP_URL || 'http://localhost:9222';
const DEFAULT_TIMEOUT = parseInt(process.env.KIMI_TIMEOUT, 10) || 120000;
const MAX_CONCURRENT_PAGES = parseInt(process.env.KIMI_MAX_PAGES, 10) || 5;
const IDLE_TIMEOUT_MS = parseInt(process.env.KIMI_IDLE_TIMEOUT, 10) || 10 * 60 * 1000; // 10min
const COOLDOWN_MS = 5000;
const ARTIFACTS_DIR = path.join(__dirname, '..', 'ARTIFACTS');
const SESSION_STORE_PATH = path.join(ARTIFACTS_DIR, 'kimi-sessions.json');

if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

// ============================================================
// LOGGER — persistent with circular buffer
// ============================================================
class KimiLogger {
  constructor() {
    this.logFile = path.join(ARTIFACTS_DIR, 'kimi-bridge.log');
    this.events = [];
  }
  _h() {
    return new Date().toISOString();
  }
  _w(level, msg) {
    const line = `[${level}] [${this._h()}] ${msg}`;
    console.log(line);
    try {
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

  save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      log.warn(`SessionStore save failed: ${err.message}`);
    }
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
// SEMAPHORE — limits concurrent pages
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
// KIMI BRIDGE v2.0
// ============================================================
class KimiBridge {
  constructor(options = {}) {
    this.cdpUrl = options.cdpUrl || DEFAULT_CDP_URL;
    this.timeout = options.timeout || DEFAULT_TIMEOUT;
    this.maxPages = options.maxPages || MAX_CONCURRENT_PAGES;
    this.idleTimeout = options.idleTimeout || IDLE_TIMEOUT_MS;
    this.debug = options.debug || false;

    this.browser = null;
    this.context = null;
    this.userSessions = new Map(); // userId -> { page, chatUrl, lastActivity, processing, mode }
    this.semaphore = new Semaphore(this.maxPages);
    this.store = new KimiSessionStore(SESSION_STORE_PATH);
    this.processedMessageIds = new Set();
    this.idleTimer = null;

    // Initialize turndown if available
    this.turndown = null;
    if (TurndownService) {
      this.turndown = new TurndownService({
        codeBlockStyle: 'fenced',
        headingStyle: 'atx',
        bulletListMarker: '-',
      });
      // Preserve line breaks in code blocks
      this.turndown.addRule('pre', {
        filter: 'pre',
        replacement: (content, node) => {
          const code = node.querySelector('code');
          const lang = code ? (code.className.match(/language-(\w+)/)?.[1] || '') : '';
          return '\n```' + lang + '\n' + content + '\n```\n';
        },
      });
    }
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

    log.info(`Connecting to Chrome at ${this.cdpUrl}`);
    this.browser = await chromium.connectOverCDP(this.cdpUrl);
    const contexts = this.browser.contexts();

    if (!contexts || contexts.length === 0) {
      throw new Error('No browser contexts found via CDP. Is Chrome running with --remote-debugging-port?');
    }

    this.context = contexts[0];
    log.success(`Connected! Using context[0] with ${this.context.pages().length} existing page(s)`);

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
          await session.page.close();
          log.info(`Closed page for user ${userId}`);
        }
      } catch (e) {
        log.warn(`Error closing page for ${userId}: ${e.message}`);
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
   * Ensure connected to CDP
   */
  async _ensureConnected() {
    if (!this.browser || !this.context) {
      await this.connect();
    }
  }

  /**
   * Get or create a dedicated Page for a user.
   * Reuses existing page if still open.
   */
  async _getOrCreateUserPage(userId) {
    await this._ensureConnected();

    const existing = this.userSessions.get(userId);
    if (existing && existing.page && !existing.page.isClosed()) {
      existing.lastActivity = Date.now();
      return existing.page;
    }

    // Acquire semaphore slot
    log.info(`Acquiring semaphore slot for user ${userId} (${this.semaphore.current}/${this.maxPages})`);
    await this.semaphore.acquire();

    // Restore previous chat URL from store if available
    const stored = this.store.getUser(userId);
    const chatUrl = stored?.chatUrl || 'https://kimi.com/?chat_enter_method=new_chat';

    log.info(`Creating new page for user ${userId}`);
    const page = await this.context.newPage();

    try {
      await page.goto(chatUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
    } catch (e) {
      log.warn(`Navigation warning for ${userId}: ${e.message}`);
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

    log.success(`Page ready for user ${userId}: ${session.chatUrl}`);
    return page;
  }

  /**
   * Verify the user session is not expired (not showing Log In screen)
   */
  async _verifySession(page) {
    const isLoggedIn = await page.evaluate(() => {
      return !document.body.innerText.includes('Log In') &&
             !document.body.innerText.includes('登录') &&
             !document.body.innerText.includes('Sign in');
    });

    if (!isLoggedIn) {
      throw new Error('Kimi session expired — please log in again in Chrome');
    }
    return true;
  }

  /**
   * Extract response using multi-strategy fallback
   */
  async _extractResponse(page) {
    const strategies = [
      {
        type: 'turndown',
        selector: '.markdown-container .markdown',
        fn: async (el) => {
          if (!this.turndown) throw new Error('turndown not available');
          const html = await el.innerHTML();
          return this.turndown.turndown(html);
        },
      },
      {
        type: 'paragraph',
        selector: '.markdown-container .paragraph',
        fn: async (el) => {
          const texts = await el.allInnerTexts();
          return texts.join('\n\n');
        },
      },
      {
        type: 'plaintext',
        selector: 'body',
        fn: async (el) => {
          const text = await el.innerText();
          // Try to find the assistant response area
          const lines = text.split('\n').filter(l => l.trim());
          // Heuristic: look for a block after a known prompt marker
          return text.trim();
        },
      },
    ];

    for (const strategy of strategies) {
      try {
        const locator = page.locator(strategy.selector).last();
        const exists = await locator.count();
        if (exists === 0) {
          this._log(`Strategy ${strategy.type}: element not found`);
          continue;
        }
        const result = await strategy.fn(locator);
        if (result && result.trim()) {
          log.success(`Extracted via ${strategy.type}: ${result.slice(0, 80)}...`);
          return result.trim();
        }
      } catch (e) {
        this._log(`Strategy ${strategy.type} failed: ${e.message}`);
      }
    }

    return 'Nenhuma resposta encontrada';
  }

  /**
   * Wait for response completion using Combined Signal:
   * 1. Wait for assistant action buttons to appear
   * 2. Poll text stability for 2 seconds
   */
  async _waitForResponse(page, mode = 'instant') {
    const maxTimeout = mode === 'instant' ? 45000 : 120000;
    const startTime = Date.now();

    // Phase 1: Wait for action buttons (they appear when response is done)
    log.info('Waiting for assistant action buttons...');
    try {
      await page.waitForSelector('.segment-assistant-actions .icon-button', {
        timeout: maxTimeout,
        state: 'visible',
      });
      log.success('Action buttons detected — response likely complete');
    } catch (e) {
      log.warn(`Timeout waiting for action buttons: ${e.message}`);
      // Continue to phase 2 anyway
    }

    // Phase 2: Poll text stability for 2 seconds
    log.info('Polling text stability...');
    const stabilityWindow = 2000;
    const pollInterval = 500;
    let lastText = '';
    let stableSince = null;

    while (Date.now() - startTime < maxTimeout) {
      try {
        const currentText = await page.locator('.markdown-container .markdown').last().innerText().catch(() => '');

        if (currentText === lastText && currentText.trim().length > 0) {
          if (!stableSince) {
            stableSince = Date.now();
          } else if (Date.now() - stableSince >= stabilityWindow) {
            log.success(`Text stable for ${stabilityWindow}ms — response complete`);
            return;
          }
        } else {
          stableSince = null;
          lastText = currentText;
        }
      } catch (e) {
        // Element might not exist yet
      }

      await new Promise(r => setTimeout(r, pollInterval));
    }

    log.warn('Max timeout reached while waiting for response');
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
    const currentLabel = await page.locator('.chat-editor-action .model-name').textContent().catch(() => '');
    const targetLabel = mode === 'instant' ? 'K2.6 Instant' : 'K2.6 Thinking';

    if (currentLabel.includes(targetLabel)) {
      this._log(`Already in ${mode} mode`);
      session.mode = mode;
      this.store.setUser(userId, { mode });
      return mode;
    }

    log.info(`Switching user ${userId} to ${mode} mode...`);

    // Click mode selector
    await page.click('.chat-editor-action .model-name');
    await page.waitForTimeout(500);

    // Click the desired option
    await page.getByText(targetLabel).click();
    await page.waitForTimeout(1000);

    session.mode = mode;
    this.store.setUser(userId, { mode });

    log.success(`Mode switched to ${mode} for user ${userId}`);
    return mode;
  }

  /**
   * Send a message and wait for response
   */
  async sendMessage(userId, text, options = {}) {
    if (!text || !text.trim()) {
      throw new Error('Message text is required');
    }

    const page = await this._getOrCreateUserPage(userId);
    const session = this.userSessions.get(userId);

    // Cooldown check
    if (session.processing) {
      log.warn(`User ${userId} is already processing a message — queueing`);
      // Wait for current processing to finish
      while (session.processing) {
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

      log.info(`User ${userId} sending: ${text.slice(0, 60)}`);

      // Find input and type with human-like delay
      const input = await page.$('textarea, [contenteditable="true"]');
      if (!input) {
        throw new Error('Input field not found on Kimi Web');
      }

      // Clear any existing text first
      await input.fill('');
      await page.waitForTimeout(300);

      // Type with human-like delay
      await input.type(text, { delay: 50 });
      await page.waitForTimeout(500 + Math.floor(Math.random() * 1000));

      // Press Enter to send
      await input.press('Enter');
      log.info(`Message sent for user ${userId}`);

      // Wait for response with combined signal
      const mode = session.mode || 'instant';
      await this._waitForResponse(page, mode);

      // Extract response
      const response = await this._extractResponse(page);

      // Update chat URL
      session.chatUrl = page.url();
      this.store.setUser(userId, { chatUrl: session.chatUrl });

      log.success(`Response extracted for user ${userId}: ${response.slice(0, 80)}...`);

      return {
        response,
        chatUrl: session.chatUrl,
        mode: session.mode,
      };
    } finally {
      session.processing = false;
      session.lastActivity = Date.now();
    }
  }

  /**
   * Create a new chat for a user
   */
  async newChat(userId) {
    return this.sendMessage(userId, '', { newChat: true });
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
    if (page.isClosed()) {
      return { active: false, message: 'Page was closed' };
    }

    const pageStatus = await page.evaluate(() => ({
      url: window.location.href,
      title: document.title,
      loggedIn: !document.body.innerText.includes('Log In'),
      hasResponse: !!document.querySelector('.markdown-container .paragraph'),
      mode: document.querySelector('.chat-editor-action .model-name')?.innerText?.trim() || null,
    }));

    return {
      active: true,
      userId,
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
        userId,
        chatUrl: session.chatUrl,
        mode: session.mode,
        lastActivity: new Date(session.lastActivity).toISOString(),
        processing: session.processing,
        pageClosed: session.page.isClosed(),
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
   * Screenshot a user's page
   */
  async screenshot(userId, ssPath = null) {
    const page = await this._getOrCreateUserPage(userId);
    const filePath = ssPath || path.join(ARTIFACTS_DIR, `kimi-screenshot-${userId}-${Date.now()}.png`);
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
          log.info(`Idle cleanup: closing page for user ${userId}`);
          try {
            if (!session.page.isClosed()) {
              session.page.close();
            }
          } catch (e) {
            log.warn(`Idle cleanup error for ${userId}: ${e.message}`);
          }
          this.userSessions.delete(userId);
          this.semaphore.release();
        }
      }
    }, 60000); // Check every minute
  }

  /**
   * Copy last response (clicks copy button on Kimi UI)
   */
  async copyLastResponse(userId) {
    const page = await this._getOrCreateUserPage(userId);
    log.info(`Clicking copy button for user ${userId}`);

    await page.evaluate(() => {
      const buttons = document.querySelectorAll('.segment-assistant-actions .icon-button');
      if (buttons.length > 0) buttons[0].click(); // Copy is index 0
    });

    await page.waitForTimeout(500);
    return true;
  }

  /**
   * Regenerate last response
   */
  async regenerateLastResponse(userId) {
    const page = await this._getOrCreateUserPage(userId);
    log.info(`Clicking regenerate for user ${userId}`);

    await page.evaluate(() => {
      const buttons = document.querySelectorAll('.segment-assistant-actions .icon-button');
      if (buttons.length > 1) buttons[1].click(); // Refresh is index 1
    });

    const session = this.userSessions.get(userId);
    await this._waitForResponse(page, session.mode);
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
