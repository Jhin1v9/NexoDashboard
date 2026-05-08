// ============================================================
// CORRETOR LUNA v15.1 — Aplica correções de forma segura
// Rode: node aplicar-correcoes.js
// ============================================================

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'luna-cto-agent-v15-1.cjs');
const BACKUP = FILE + '.backup-' + new Date().toISOString().replace(/[:.]/g, '-');

console.log('🌙 LUNA v15.1 — Corretor Node.js');
console.log('Arquivo:', FILE);

if (!fs.existsSync(FILE)) {
  console.error('❌ Arquivo nao encontrado:', FILE);
  process.exit(1);
}

// 1. Backup
fs.copyFileSync(FILE, BACKUP);
console.log('✅ Backup:', BACKUP);

let content = fs.readFileSync(FILE, 'utf8');
let changes = 0;

function replaceOnce(oldStr, newStr, desc) {
  if (content.includes(oldStr)) {
    content = content.replace(oldStr, newStr);
    changes++;
    console.log('✅', desc);
    return true;
  } else if (content.includes(newStr)) {
    console.log('ℹ️ ', desc, '- ja aplicado');
    return true;
  } else {
    console.log('⚠️ ', desc, '- NAO ENCONTRADO');
    return false;
  }
}

// ============================================================
// CORRECAO 1: SCROLL_WAIT 2000 → 300
// ============================================================
replaceOnce(
  'SCROLL_WAIT: 2000,',
  'SCROLL_WAIT: 300,',
  'SCROLL_WAIT: 2000ms → 300ms'
);

// ============================================================
// CORRECAO 2: Protecao de arrays em updateBufferFromClassified
// ============================================================
const OLD_BUFFER_START = `  updateBufferFromClassified(classified) {\n    for (const item of classified) {`;
const NEW_BUFFER_START = `  updateBufferFromClassified(classified) {\n    // Protecao: garante que arrays existem\n    if (!this.cp.buffer.newMessages) this.cp.buffer.newMessages = [];\n    if (!this.cp.buffer.newTasks) this.cp.buffer.newTasks = [];\n    if (!this.cp.buffer.newIdeas) this.cp.buffer.newIdeas = [];\n    if (!this.cp.buffer.newDecisions) this.cp.buffer.newDecisions = [];\n    if (!this.cp.buffer.newLinks) this.cp.buffer.newLinks = [];\n    if (!this.cp.buffer.newLeads) this.cp.buffer.newLeads = [];\n    if (!this.cp.buffer.newNews) this.cp.buffer.newNews = [];\n    for (const item of classified) {`;

replaceOnce(OLD_BUFFER_START, NEW_BUFFER_START, 'Protecao arrays undefined');

// ============================================================
// CORRECAO 3: disconnect() seguro
// ============================================================
const OLD_DISCONNECT = `    try {\n      if (this.browser) {\n        await this.browser.disconnect();\n        log.playwright('Desconectado do Chrome (Chrome continua aberto)');\n      }\n    } catch (e) {\n      log.warn(\`Erro ao desconectar: \${e.message}\`);\n    }`;

const NEW_DISCONNECT = `    try {\n      if (this.browser) {\n        if (typeof this.browser.disconnect === 'function') {\n          await this.browser.disconnect();\n        } else if (typeof this.browser.close === 'function') {\n          await this.browser.close();\n        }\n        log.playwright('Desconectado do Chrome (Chrome continua aberto)');\n      }\n    } catch (e) {\n      log.warn(\`Erro ao desconectar: \${e.message}\`);\n    }`;

replaceOnce(OLD_DISCONNECT, NEW_DISCONNECT, 'disconnect() seguro');

// ============================================================
// CORRECAO 4: scrollToTop() → EXTRACAO ACUMULATIVA
// ============================================================
// Remove a funcao antiga inteira e substitui
const OLD_SCROLL_START = '  async scrollToTop() {';
const OLD_SCROLL_END = '    return scrollCount;\n  }\n\n  async extractMessages()';

const NEW_SCROLL = `  async scrollToTop() {
    if (!this.page) return 0;

    log.playwright('Carregando historico completo (extracao acumulativa)...');

    const allMessagesMap = new Map();
    let scrollCount = 0;
    let lastCount = 0;
    let stableCount = 0;

    while (scrollCount < CONFIG.MAX_SCROLLS) {
      // EXTRAI mensagens ATUAIS do DOM
      const currentMessages = await this.page.evaluate(() => {
        const msgs = [];
        const elements = document.querySelectorAll(
          '[data-testid="msg-container"], [data-testid="msg-image"], [data-testid="msg-video"], .message, .msg'
        );
        elements.forEach(el => {
          try {
            const textEl = el.querySelector('.selectable-text, .copyable-text, [dir="ltr"]');
            const text = textEl ? textEl.innerText : '';
            let author = 'Desconhecido';
            const preText = el.getAttribute('data-pre-plain-text');
            if (preText) {
              const match = preText.match(/\\[(.*?)\\]/);
              if (match) author = match[1];
            }
            const timeEl = el.querySelector('[data-testid="msg-meta"], .msg-time');
            const time = timeEl ? timeEl.innerText : '';
            const id = el.getAttribute('data-id') || (text + author + time).slice(0, 50);
            if (text || id) msgs.push({ id, author, text, time });
          } catch (e) {}
        });
        return msgs;
      });

      // Acumula (remove duplicatas)
      let addedCount = 0;
      for (const msg of currentMessages) {
        if (!allMessagesMap.has(msg.id)) {
          allMessagesMap.set(msg.id, msg);
          addedCount++;
        }
      }

      const totalUnique = allMessagesMap.size;
      log.playwright(\`Scroll \${scrollCount+1}/\${CONFIG.MAX_SCROLLS} — \${currentMessages.length} visiveis | \${addedCount} novas | Total: \${totalUnique}\`);

      if (totalUnique === lastCount) {
        stableCount++;
        if (stableCount >= 5) {
          log.success(\`Historico completo! \${totalUnique} mensagens unicas\`);
          break;
        }
      } else {
        stableCount = 0;
        lastCount = totalUnique;
      }

      // Rola pra CIMA
      await this.page.evaluate(() => {
        const chat = document.querySelector('[data-testid="conversation-panel-messages"]');
        if (chat) chat.scrollBy({ top: -chat.clientHeight * 3, behavior: 'instant' });
      });

      await this.page.waitForTimeout(800);
      scrollCount++;
    }

    this._accumulatedMessages = Array.from(allMessagesMap.values());
    log.success(\`\${this._accumulatedMessages.length} mensagens unicas extraidas\`);
    return scrollCount;
  }

  async extractMessages()`;

// Procura a funcao scrollToTop antiga
const scrollStartIdx = content.indexOf(OLD_SCROLL_START);
const scrollEndIdx = content.indexOf(OLD_SCROLL_END);

if (scrollStartIdx !== -1 && scrollEndIdx !== -1 && scrollEndIdx > scrollStartIdx) {
  content = content.slice(0, scrollStartIdx) + NEW_SCROLL + content.slice(scrollEndIdx + OLD_SCROLL_END.length);
  changes++;
  console.log('✅ scrollToTop() → Extracao acumulativa');
} else if (content.includes('_accumulatedMessages')) {
  console.log('ℹ️  scrollToTop() ja com extracao acumulativa');
} else {
  console.log('⚠️  scrollToTop() nao encontrado no formato esperado');
}

// ============================================================
// CORRECAO 5: extractMessages() usa acumulador
// ============================================================
const OLD_EXTRACT_START = '  async extractMessages() {\n    if (!this.page) return [];\n    \n    log.extract(\'Extraindo mensagens do DOM...\');';
const OLD_EXTRACT_END = '    return messages;\n  }\n\n  async extractChat';

const NEW_EXTRACT = `  async extractMessages() {
    if (!this.page) return [];

    log.extract('Obtendo mensagens acumuladas...');

    if (this._accumulatedMessages && this._accumulatedMessages.length > 0) {
      log.success(\`\${this._accumulatedMessages.length} mensagens do acumulador\`);
      return this._accumulatedMessages;
    }

    // Fallback: extrai do DOM atual
    const messages = await this.page.evaluate(() => {
      const msgs = [];
      const elements = document.querySelectorAll(
        '[data-testid="msg-container"], [data-testid="msg-image"], [data-testid="msg-video"], .message, .msg'
      );
      elements.forEach(el => {
        try {
          const textEl = el.querySelector('.selectable-text, .copyable-text, [dir="ltr"]');
          const text = textEl ? textEl.innerText : '';
          let author = 'Desconhecido';
          const preText = el.getAttribute('data-pre-plain-text');
          if (preText) {
            const match = preText.match(/\\[(.*?)\\]/);
            if (match) author = match[1];
          }
          const timeEl = el.querySelector('[data-testid="msg-meta"], .msg-time');
          const time = timeEl ? timeEl.innerText : '';
          const id = el.getAttribute('data-id') || (text + author + time).slice(0, 50);
          if (text || id) msgs.push({ id, author, text, time });
        } catch (e) {}
      });
      return msgs;
    });

    log.success(\`\${messages.length} mensagens extraidas do DOM\`);
    return messages;
  }

  async extractChat`;

const extractStartIdx = content.indexOf('  async extractMessages() {');
const extractEndIdx = content.indexOf('  async extractChat');

if (extractStartIdx !== -1 && extractEndIdx !== -1 && extractEndIdx > extractStartIdx) {
  content = content.slice(0, extractStartIdx) + NEW_EXTRACT + content.slice(extractEndIdx + '  async extractChat'.length - '  async extractChat'.length);
  changes++;
  console.log('✅ extractMessages() → Usa acumulador');
} else if (content.includes('_accumulatedMessages')) {
  console.log('ℹ️  extractMessages() ja usa acumulador');
} else {
  console.log('⚠️  extractMessages() nao encontrado no formato esperado');
}

// ============================================================
// SALVAR
// ============================================================
fs.writeFileSync(FILE, content, 'utf8');

console.log('');
console.log('═══════════════════════════════════════════');
console.log('🎉 CORRECOES APLICADAS:', changes);
console.log('═══════════════════════════════════════════');
console.log('');
console.log('Para testar:');
console.log('   node luna-cto-agent-v15-1.cjs');
console.log('');
console.log('Backup:', BACKUP);
