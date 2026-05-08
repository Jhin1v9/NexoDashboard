// ============================================================
// CORRETOR SIMPLES — Procura texto e substitui
// Rode: node corrigir-simples.js
// ============================================================

const fs = require('fs');

const ARQUIVO = './luna-cto-agent-v15-1.cjs';
const BACKUP = ARQUIVO + '.bak-' + Date.now();

if (!fs.existsSync(ARQUIVO)) {
  console.log('❌ Arquivo nao encontrado:', ARQUIVO);
  process.exit(1);
}

// Backup
fs.copyFileSync(ARQUIVO, BACKUP);
console.log('✅ Backup:', BACKUP);

let c = fs.readFileSync(ARQUIVO, 'utf8');
let feitas = 0;

function trocar(antigo, novo, nome) {
  if (c.includes(antigo)) {
    c = c.split(antigo).join(novo);
    feitas++;
    console.log('✅', nome);
    return true;
  }
  console.log('❌ NAO ACHOU:', nome);
  return false;
}

// ============================================================
// CORRECAO 1: scroll rapido
// ============================================================
trocar('SCROLL_WAIT: 2000,', 'SCROLL_WAIT: 300,', 'Scroll rapido');

// ============================================================
// CORRECAO 2: protecao arrays
// ============================================================
const TEXTO_ANTIGO_BUFFER = `  updateBufferFromClassified(classified) {\n    for (const item of classified) {`;

const TEXTO_NOVO_BUFFER = `  updateBufferFromClassified(classified) {\n    if (!this.cp.buffer.newTasks) this.cp.buffer.newTasks = [];\n    if (!this.cp.buffer.newIdeas) this.cp.buffer.newIdeas = [];\n    if (!this.cp.buffer.newDecisions) this.cp.buffer.newDecisions = [];\n    if (!this.cp.buffer.newLinks) this.cp.buffer.newLinks = [];\n    if (!this.cp.buffer.newLeads) this.cp.buffer.newLeads = [];\n    if (!this.cp.buffer.newNews) this.cp.buffer.newNews = [];\n    for (const item of classified) {`;

trocar(TEXTO_ANTIGO_BUFFER, TEXTO_NOVO_BUFFER, 'Protecao arrays');

// ============================================================
// CORRECAO 3: disconnect seguro
// ============================================================
const TEXTO_ANTIGO_DISCONNECT = `        await this.browser.disconnect();\n        log.playwright('Desconectado do Chrome (Chrome continua aberto)');`;

const TEXTO_NOVO_DISCONNECT = `        if (typeof this.browser.disconnect === 'function') {\n          await this.browser.disconnect();\n        } else if (typeof this.browser.close === 'function') {\n          await this.browser.close();\n        }\n        log.playwright('Desconectado do Chrome (Chrome continua aberto)');`;

trocar(TEXTO_ANTIGO_DISCONNECT, TEXTO_NOVO_DISCONNECT, 'Disconnect seguro');

// ============================================================
// CORRECAO 4: scrollToTop → EXTRACAO ACUMULATIVA
// ============================================================
const TEXTO_ANTIGO_SCROLL = `  async scrollToTop() {\n    if (!this.page) return 0;\n    \n    log.playwright('Iniciando scroll infinito ate o topo...');\n    let scrollCount = 0;\n    let lastHeight = 0;\n    let stableCount = 0;\n    \n    while (scrollCount < CONFIG.MAX_SCROLLS) {\n      const currentScroll = await this.page.evaluate(() => {\n        const chat = document.querySelector('[data-testid="conversation-panel-messages"]');\n        return chat ? chat.scrollHeight : 0;\n      });\n      \n      if (currentScroll === lastHeight) {\n        stableCount++;\n        if (stableCount >= 3) {\n          log.success(\`Fim do historico detectado apos \${scrollCount} scrolls\`);\n          break;\n        }\n      } else {\n        stableCount = 0;\n        lastHeight = currentScroll;\n      }\n      \n      await this.page.evaluate(() => {\n        const chat = document.querySelector('[data-testid="conversation-panel-messages"]');\n        if (chat) chat.scrollTop = 0;\n      });\n      \n      await this.page.keyboard.press('PageUp');\n      \n      scrollCount++;\n      log.playwright(\`Scroll \${scrollCount}/\${CONFIG.MAX_SCROLLS} — altura: \${currentScroll}\`);\n      \n      await this.page.waitForTimeout(CONFIG.SCROLL_WAIT);\n    }\n    \n    return scrollCount;\n  }`;

const TEXTO_NOVO_SCROLL = `  async scrollToTop() {\n    if (!this.page) return 0;\n    \n    log.playwright('Carregando historico (extracao acumulativa)...');\n    const allMessagesMap = new Map();\n    let scrollCount = 0;\n    let lastCount = 0;\n    let stableCount = 0;\n    \n    while (scrollCount < CONFIG.MAX_SCROLLS) {\n      const currentMessages = await this.page.evaluate(() => {\n        const msgs = [];\n        const elements = document.querySelectorAll('[data-testid="msg-container"], [data-testid="msg-image"], [data-testid="msg-video"], .message, .msg');\n        elements.forEach(el => {\n          try {\n            const textEl = el.querySelector('.selectable-text, .copyable-text, [dir="ltr"]');\n            const text = textEl ? textEl.innerText : '';\n            let author = 'Desconhecido';\n            const preText = el.getAttribute('data-pre-plain-text');\n            if (preText) {\n              const match = preText.match(/\\[(.*?)\\]/);\n              if (match) author = match[1];\n            }\n            const timeEl = el.querySelector('[data-testid="msg-meta"], .msg-time');\n            const time = timeEl ? timeEl.innerText : '';\n            const id = el.getAttribute('data-id') || (text + author + time).slice(0, 50);\n            if (text || id) msgs.push({ id, author, text, time });\n          } catch (e) {}\n        });\n        return msgs;\n      });\n      \n      let addedCount = 0;\n      for (const msg of currentMessages) {\n        if (!allMessagesMap.has(msg.id)) {\n          allMessagesMap.set(msg.id, msg);\n          addedCount++;\n        }\n      }\n      \n      const totalUnique = allMessagesMap.size;\n      log.playwright(\`Scroll \${scrollCount+1}/\${CONFIG.MAX_SCROLLS} — \${currentMessages.length} visiveis | \${addedCount} novas | Total: \${totalUnique}\`);\n      \n      if (totalUnique === lastCount) {\n        stableCount++;\n        if (stableCount >= 5) {\n          log.success(\`Historico completo! \${totalUnique} mensagens\`);\n          break;\n        }\n      } else {\n        stableCount = 0;\n        lastCount = totalUnique;\n      }\n      \n      await this.page.evaluate(() => {\n        const chat = document.querySelector('[data-testid="conversation-panel-messages"]');\n        if (chat) chat.scrollBy({ top: -chat.clientHeight * 3, behavior: 'instant' });\n      });\n      \n      await this.page.waitForTimeout(800);\n      scrollCount++;\n    }\n    \n    this._accumulatedMessages = Array.from(allMessagesMap.values());\n    log.success(\`\${this._accumulatedMessages.length} mensagens unicas extraidas\`);\n    return scrollCount;\n  }`;

trocar(TEXTO_ANTIGO_SCROLL, TEXTO_NOVO_SCROLL, 'Extracao acumulativa');

// ============================================================
// CORRECAO 5: extractMessages usa acumulador
// ============================================================
const TEXTO_ANTIGO_EXTRACT = `  async extractMessages() {\n    if (!this.page) return [];\n    \n    log.extract('Extraindo mensagens do DOM...');\n    \n    const messages = await this.page.evaluate(() => {\n      const msgs = [];\n      const elements = document.querySelectorAll('[data-testid="msg-container"]');\n      \n      elements.forEach(el => {\n        try {\n          const authorEl = el.querySelector('[data-testid="msg-meta"] span') || \n                          el.querySelector('.copyable-text[data-pre-plain-text]');\n          let author = 'Desconhecido';\n          if (authorEl) {\n            const preText = authorEl.getAttribute('data-pre-plain-text');\n            if (preText) {\n              const match = preText.match(/\\[(.*?)\\]/);\n              if (match) author = match[1];\n            }\n          }\n          \n          const textEl = el.querySelector('.selectable-text.copyable-text');\n          const text = textEl ? textEl.innerText : '';\n          \n          const timeEl = el.querySelector('[data-testid="msg-meta"]');\n          const time = timeEl ? timeEl.innerText : '';\n          \n          const hasImage = el.querySelector('[data-testid="image-x-generic"]') !== null;\n          const hasLink = /https?:\\/\\//.test(text);\n          const type = hasImage ? 'image' : hasLink ? 'link' : 'text';\n          \n          const id = el.getAttribute('data-id') || Math.random().toString(36);\n          \n          msgs.push({\n            id,\n            author,\n            text,\n            time,\n            type,\n            rawHtml: el.outerHTML.slice(0, 500)\n          });\n        } catch (e) {}\n      });\n      \n      return msgs;\n    });\n    \n    log.success(\`\${messages.length} mensagens extraidas do DOM\`);\n    return messages;\n  }`;

const TEXTO_NOVO_EXTRACT = `  async extractMessages() {\n    if (!this.page) return [];\n    \n    log.extract('Obtendo mensagens...');\n    \n    if (this._accumulatedMessages && this._accumulatedMessages.length > 0) {\n      log.success(\`\${this._accumulatedMessages.length} mensagens do acumulador\`);\n      return this._accumulatedMessages;\n    }\n    \n    const messages = await this.page.evaluate(() => {\n      const msgs = [];\n      const elements = document.querySelectorAll('[data-testid="msg-container"], [data-testid="msg-image"], [data-testid="msg-video"], .message, .msg');\n      elements.forEach(el => {\n        try {\n          const textEl = el.querySelector('.selectable-text, .copyable-text, [dir="ltr"]');\n          const text = textEl ? textEl.innerText : '';\n          let author = 'Desconhecido';\n          const preText = el.getAttribute('data-pre-plain-text');\n          if (preText) {\n            const match = preText.match(/\\[(.*?)\\]/);\n            if (match) author = match[1];\n          }\n          const timeEl = el.querySelector('[data-testid="msg-meta"], .msg-time');\n          const time = timeEl ? timeEl.innerText : '';\n          const id = el.getAttribute('data-id') || (text + author + time).slice(0, 50);\n          if (text || id) msgs.push({ id, author, text, time });\n        } catch (e) {}\n      });\n      return msgs;\n    });\n    \n    log.success(\`\${messages.length} mensagens extraidas\`);\n    return messages;\n  }`;

trocar(TEXTO_ANTIGO_EXTRACT, TEXTO_NOVO_EXTRACT, 'extractMessages usa acumulador');

// ============================================================
// SALVAR
// ============================================================
fs.writeFileSync(ARQUIVO, c, 'utf8');

console.log('');
console.log('═══════════════════════════════════════════');
console.log('🎉 CORRECOES FEITAS:', feitas, '/ 5');
console.log('═══════════════════════════════════════════');
console.log('');
if (feitas < 5) {
  console.log('⚠️  ALGUMAS CORRECOES NAO FORAM APLICADAS');
  console.log('   O arquivo pode ja estar corrigido ou ter formato diferente.');
  console.log('   Rode o diagnostico: node diagnosticar-e-corrigir.js');
}
console.log('');
console.log('Teste: node luna-cto-agent-v15-1.cjs');
