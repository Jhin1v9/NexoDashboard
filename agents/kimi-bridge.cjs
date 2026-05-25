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
const DEFAULT_CDP_URL = process.env.KIMI_CDP_URL || 'http://127.0.0.1:9222';
const DEFAULT_TIMEOUT = parseInt(process.env.KIMI_TIMEOUT, 10) || 120000;
const MAX_CONCURRENT_PAGES = parseInt(process.env.KIMI_MAX_PAGES, 10) || 5;
const IDLE_TIMEOUT_MS = parseInt(process.env.KIMI_IDLE_TIMEOUT, 10) || 10 * 60 * 1000;
const COOLDOWN_MS = parseInt(process.env.KIMI_COOLDOWN_MS, 10) || 5000;
const MAX_TEXT_TYPE_LENGTH = parseInt(process.env.KIMI_MAX_TYPE_LENGTH, 10) || 500;
const LOG_MAX_SIZE_MB = parseInt(process.env.KIMI_LOG_MAX_MB, 10) || 10;
const ARTIFACTS_DIR = path.join(__dirname, '..', 'ARTIFACTS');
const SESSION_STORE_PATH = path.join(ARTIFACTS_DIR, 'kimi-sessions.json');

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
    this.cdpUrl = options.cdpUrl || DEFAULT_CDP_URL;
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

    // Register crash/disconnect listeners
    this.browser.on('disconnected', () => {
      log.warn('Browser disconnected via CDP');
      this.browser = null;
      this.context = null;
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
      existing.lastActivity = Date.now();
      return existing.page;
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
    const currentLabel = await page.locator('.chat-editor-action .model-name').textContent({ timeout: 5000 }).catch(() => '');
    const targetLabel = mode === 'instant' ? 'K2.6 Instant' : 'K2.6 Thinking';

    if (currentLabel.includes(targetLabel)) {
      this._log(`Already in ${mode} mode`);
      session.mode = mode;
      this.store.setUser(userId, { mode });
      return mode;
    }

    log.info(`Switching user ${hashUserId(userId)} to ${mode} mode...`);

    // Click mode selector with short timeout
    await page.click('.chat-editor-action .model-name', { timeout: 5000 });
    await page.waitForTimeout(500);

    // Scope to dropdown to avoid clicking wrong element
    const dropdown = page.locator('[role=listbox], .dropdown-menu, .model-dropdown').last();
    const option = dropdown.locator('text=' + targetLabel).or(page.getByText(targetLabel)).first();
    await option.click({ timeout: 5000 });
    await page.waitForTimeout(1000);

    session.mode = mode;
    this.store.setUser(userId, { mode });

    log.success(`Mode switched to ${mode} for user ${hashUserId(userId)}`);
    return mode;
  }

  /**
   * Create a new chat for a user (does NOT use sendMessage)
   */
  async newChat(userId) {
    const page = await this._getOrCreateUserPage(userId);
    const session = this.userSessions.get(userId);

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
   * Kills headless Chrome and starts visible Chrome for login.
   * Returns { running: bool, started: bool, pid?: number, error?: string, wasHeadless?: bool }
   */
  async checkChrome() {
    const { execSync, spawn } = require('child_process');
    const http = require('http');
    const os = require('os');
    const userDataDir = path.join(os.homedir(), '.luna', 'chrome-profile');

    // Check if Chrome is already listening on CDP port (use IPv4 explicitly)
    let existingChrome = null;
    try {
      await new Promise((resolve, reject) => {
        const req = http.get('http://127.0.0.1:9222/json/version', (res) => {
          if (res.statusCode === 200) resolve(true);
          else reject(new Error('Status ' + res.statusCode));
        });
        req.on('error', reject);
        req.setTimeout(3000, () => { req.destroy(); reject(new Error('Timeout')); });
      });
      existingChrome = true;
    } catch {
      existingChrome = false;
    }

    // If running, check if it's headless and capture its user-data-dir
    let wasHeadless = false;
    let existingProfileDir = null;
    if (existingChrome) {
      try {
        const psOutput = execSync("ps aux | grep 'chrome.*remote-debugging-port=9222' | grep -v grep", { encoding: 'utf8' });
        // Extract user-data-dir from existing Chrome
        const dataDirMatch = psOutput.match(/--user-data-dir=([^\s]+)/);
        if (dataDirMatch) existingProfileDir = dataDirMatch[1];

        if (psOutput.includes('--headless') || psOutput.includes('--ozone-platform=headless')) {
          wasHeadless = true;
          log.warn('Chrome headless detectado. Matando para iniciar visível...');
          // Kill headless chrome
          execSync("pkill -f 'chrome.*remote-debugging-port=9222'");
          await new Promise(r => setTimeout(r, 3000));
          existingChrome = false;
        } else {
          return { running: true, started: false, wasHeadless: false };
        }
      } catch {
        // Could not determine, assume it's ok
        return { running: true, started: false, wasHeadless: false };
      }
    }

    // Not running or was headless — start visible Chrome
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
      // Reuse the existing profile dir if we found one, otherwise use default
      const profileDir = existingProfileDir || userDataDir;
      if (existingProfileDir) {
        log.info(`Reutilizando perfil existente: ${existingProfileDir}`);
      }

      const proc = spawn(chromePath, [
        '--remote-debugging-port=9222',
        '--no-first-run',
        '--no-default-browser-check',
        '--user-data-dir=' + profileDir,
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        // NO --headless — we need a visible window for login
      ], { detached: true, stdio: 'ignore', env: { ...process.env, DISPLAY: process.env.DISPLAY || ':0' } });
      proc.unref();

      // Wait for Chrome to start
      await new Promise(r => setTimeout(r, 5000));

      // Verify it started (use IPv4)
      try {
        await new Promise((resolve, reject) => {
          const req = http.get('http://127.0.0.1:9222/json/version', (res) => {
            if (res.statusCode === 200) resolve(true);
            else reject(new Error('Status ' + res.statusCode));
          });
          req.on('error', reject);
          req.setTimeout(5000, () => { req.destroy(); reject(new Error('Timeout')); });
        });
        return { running: true, started: true, pid: proc.pid, wasHeadless, profileDir };
      } catch {
        return { running: false, started: true, pid: proc.pid, wasHeadless, profileDir, error: 'Chrome iniciou mas não respondeu em 5s' };
      }
    } catch (e) {
      return { running: false, started: false, error: e.message };
    }
  }

  /**
   * Ensure user is logged into Kimi Web. Opens login page if not.
   */
  async ensureLogin(userId) {
    const page = await this._getOrCreateUserPage(userId);
    const isLoggedIn = await page.evaluate(() => {
      // Multiple login indicators
      const hasLoginBtn = !!document.querySelector('button:has-text("Log In"), a:has-text("Log In"), [class*="login"]');
      const hasUserAvatar = !!document.querySelector('[class*="avatar"], [class*="user"]');
      const hasChatInput = !!document.querySelector('textarea, [contenteditable="true"]');
      const bodyText = document.body?.innerText || '';
      const hasLoginText = bodyText.includes('Log In') || bodyText.includes('Sign In') || bodyText.includes('登录');
      return { loggedIn: !hasLoginText && hasChatInput, hasLoginText, hasChatInput };
    }).catch(() => ({ loggedIn: false, error: 'Page evaluation failed' }));

    if (!isLoggedIn.loggedIn) {
      log.info(`User not logged in, navigating to Kimi login page`);
      await page.goto('https://kimi.com/', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      return {
        loggedIn: false,
        message: 'Naveguei para kimi.com. Por favor, faça login manualmente no navegador que abriu.',
        action: 'login_required',
      };
    }
    return { loggedIn: true, message: 'Já está logado no Kimi Web' };
  }

  /**
   * Logout user: close page, clear session, optionally kill Chrome.
   */
  async logout(userId, opts = {}) {
    const session = this.userSessions.get(userId);
    if (session) {
      // Close page
      if (session.page && !session.page.isClosed()) {
        try { await session.page.close(); } catch {}
      }
      this.userSessions.delete(userId);
      this.semaphore.current = Math.max(0, this.semaphore.current - 1);
    }

    if (opts.killChrome) {
      try {
        const { execSync } = require('child_process');
        execSync("pkill -f 'chrome.*remote-debugging-port=9222'");
        log.info('Chrome killed');
        return { success: true, message: 'Logout completo. Chrome fechado.' };
      } catch (e) {
        return { success: true, message: 'Sessão encerrada. Chrome já estava fechado.' };
      }
    }

    return { success: true, message: 'Logout completo. Sessão encerrada.' };
  }

  /**
   * Check if there's already a visible Chrome running and return details.
   */
  async getChromeStatus() {
    const { execSync } = require('child_process');
    try {
      const psOutput = execSync("ps aux | grep 'chrome.*remote-debugging-port=9222' | grep -v grep", { encoding: 'utf8' });
      const isHeadless = psOutput.includes('--headless') || psOutput.includes('--ozone-platform=headless');
      const profileMatch = psOutput.match(/--user-data-dir=([^\s]+)/);
      const pidMatch = psOutput.match(/^\S+\s+(\d+)/);
      return {
        running: true,
        isHeadless: !!isHeadless,
        profileDir: profileMatch ? profileMatch[1] : null,
        pid: pidMatch ? parseInt(pidMatch[1]) : null,
      };
    } catch {
      return { running: false };
    }
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
   * Poll the DOM for current thinking and response text.
   * Returns { thinking, response, canSteer } in real-time.
   */
  async _pollThinkingAndResponse(page) {
    try {
      return await page.evaluate(() => {
        // Thinking: try multiple selectors (Kimi Web UI changes frequently)
        const thinkingSelectors = [
          '.thinking-container',
          '.toolcall-container.thinking-container',
          '[class*="thinking"]',
          '[class*="reasoning"]',
        ];
        let thinking = '';
        for (const sel of thinkingSelectors) {
          const els = document.querySelectorAll(sel);
          const text = Array.from(els).map(el => el.innerText?.trim()).filter(Boolean).join('\n');
          if (text) { thinking = text; break; }
        }

        // Response: try multiple selectors aligned with _extractResponse
        const responseSelectors = [
          '.markdown-container .markdown',
          '.markdown-container .paragraph',
          '.markdown-container .markdown p',
          '[class*="markdown"]',
          '[class*="message-content"]',
        ];
        let response = '';
        for (const sel of responseSelectors) {
          const els = document.querySelectorAll(sel);
          const text = Array.from(els).map(el => el.innerText?.trim()).filter(Boolean).join('\n\n');
          if (text) { response = text; break; }
        }

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
        // Fallback: if no send button is visible, we're probably generating
        if (!isGenerating && !canSteer) {
          const anySend = document.querySelector('.send-button-container, [class*="send"]');
          if (!anySend || anySend.offsetParent === null) {
            isGenerating = true;
          }
        }

        return { thinking, response, canSteer, isGenerating };
      });
    } catch (e) {
      return { thinking: '', response: '', canSteer: false, isGenerating: false };
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
      const finalResponse = await this._extractResponse(page);
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
