// ============================================================
// CORRETOR CIRURGICO — Lê arquivo real e aplica correções
// Rode: node corrigir-cirurgico.js
// ============================================================

const fs = require('fs');

const ARQUIVO = './luna-cto-agent-v15-1.cjs';
const BACKUP = ARQUIVO + '.bak-' + Date.now();

if (!fs.existsSync(ARQUIVO)) {
  console.log('❌ Arquivo nao encontrado');
  process.exit(1);
}

// Backup
fs.copyFileSync(ARQUIVO, BACKUP);
console.log('✅ Backup:', BACKUP);

let linhas = fs.readFileSync(ARQUIVO, 'utf8').split('\n');
let alteracoes = 0;

function mostrarLinha(n, contexto = 2) {
  const start = Math.max(0, n - contexto);
  const end = Math.min(linhas.length, n + contexto + 1);
  for (let i = start; i < end; i++) {
    const marca = i === n ? '>>>' : '   ';
    console.log(`${marca} ${i + 1}: ${linhas[i].slice(0, 80)}`);
  }
}

// ============================================================
// CORRECAO 1: SCROLL_WAIT
// ============================================================
console.log('\n[1/5] Procurando SCROLL_WAIT...');
let achou = false;
for (let i = 0; i < linhas.length; i++) {
  if (linhas[i].includes('SCROLL_WAIT')) {
    console.log(`   Achado na linha ${i + 1}:`);
    mostrarLinha(i, 0);
    if (linhas[i].includes('2000')) {
      linhas[i] = linhas[i].replace('2000', '300');
      alteracoes++;
      console.log('   ✅ Alterado para 300');
    } else if (linhas[i].includes('300')) {
      console.log('   ℹ️  Ja esta 300');
    }
    achou = true;
    break;
  }
}
if (!achou) console.log('   ❌ Nao achado');

// ============================================================
// CORRECAO 2: Protecao arrays em updateBufferFromClassified
// ============================================================
console.log('\n[2/5] Procurando updateBufferFromClassified...');
achou = false;
for (let i = 0; i < linhas.length; i++) {
  if (linhas[i].includes('updateBufferFromClassified') && linhas[i].includes('(')) {
    console.log(`   Achado na linha ${i + 1}:`);
    mostrarLinha(i, 1);

    // Procura a linha do "for" depois da função
    let forLinha = -1;
    for (let j = i + 1; j < Math.min(linhas.length, i + 10); j++) {
      if (linhas[j].trim().startsWith('for ') && linhas[j].includes('classified')) {
        forLinha = j;
        break;
      }
    }

    if (forLinha !== -1) {
      console.log(`   "for" encontrado na linha ${forLinha + 1}`);

      // Verifica se ja tem protecao
      let jaTem = false;
      for (let j = i + 1; j < forLinha; j++) {
        if (linhas[j].includes('this.cp.buffer.newTasks')) {
          jaTem = true;
          break;
        }
      }

      if (jaTem) {
        console.log('   ℹ️  Protecao ja existe');
      } else {
        // Insere protecao ANTES do for
        const indent = linhas[forLinha].match(/^(\s*)/)[1];
        const protecao = [
          indent + '// Protecao: garante que arrays existem',
          indent + 'if (!this.cp.buffer.newTasks) this.cp.buffer.newTasks = [];',
          indent + 'if (!this.cp.buffer.newIdeas) this.cp.buffer.newIdeas = [];',
          indent + 'if (!this.cp.buffer.newDecisions) this.cp.buffer.newDecisions = [];',
          indent + 'if (!this.cp.buffer.newLinks) this.cp.buffer.newLinks = [];',
          indent + 'if (!this.cp.buffer.newLeads) this.cp.buffer.newLeads = [];',
          indent + 'if (!this.cp.buffer.newNews) this.cp.buffer.newNews = [];'
        ];

        linhas.splice(forLinha, 0, ...protecao);
        alteracoes++;
        console.log('   ✅ Protecao inserida');
      }
    } else {
      console.log('   ❌ "for" nao encontrado apos a funcao');
    }

    achou = true;
    break;
  }
}
if (!achou) console.log('   ❌ Nao achado');

// ============================================================
// CORRECAO 3: disconnect seguro
// ============================================================
console.log('\n[3/5] Procurando browser.disconnect...');
achou = false;
for (let i = 0; i < linhas.length; i++) {
  if (linhas[i].includes('browser.disconnect') || linhas[i].includes('this.browser.disconnect')) {
    console.log(`   Achado na linha ${i + 1}:`);
    mostrarLinha(i, 2);

    // Verifica se ja tem typeof
    let jaTem = false;
    for (let j = Math.max(0, i - 3); j < i; j++) {
      if (linhas[j].includes('typeof') && linhas[j].includes('disconnect')) {
        jaTem = true;
        break;
      }
    }

    if (jaTem) {
      console.log('   ℹ️  Ja tem verificacao');
    } else {
      // Substitui a linha
      const indent = linhas[i].match(/^(\s*)/)[1];
      linhas[i] = indent + "if (typeof this.browser.disconnect === 'function') {";

      // Insere linhas depois
      const novasLinhas = [
        indent + '  await this.browser.disconnect();',
        indent + "} else if (typeof this.browser.close === 'function') {",
        indent + '  await this.browser.close();',
        indent + '}'
      ];

      linhas.splice(i + 1, 0, ...novasLinhas);
      alteracoes++;
      console.log('   ✅ disconnect corrigido');
    }

    achou = true;
    break;
  }
}
if (!achou) console.log('   ❌ Nao achado');

// ============================================================
// CORRECAO 4: scrollToTop → extracao acumulativa
// ============================================================
console.log('\n[4/5] Procurando scrollToTop...');
achou = false;
let scrollStart = -1;
let scrollEnd = -1;

for (let i = 0; i < linhas.length; i++) {
  if (linhas[i].includes('async scrollToTop') && linhas[i].includes('(')) {
    scrollStart = i;
    console.log(`   Inicio achado na linha ${i + 1}`);

    // Procura o fim da funcao (proxima funcao async ou }
    for (let j = i + 1; j < linhas.length; j++) {
      if (linhas[j].includes('async extractMessages') || linhas[j].includes('async extractChat')) {
        scrollEnd = j;
        console.log(`   Fim achado na linha ${j + 1}`);
        break;
      }
    }

    if (scrollEnd !== -1) {
      // Verifica se ja tem acumulador
      let jaTem = false;
      for (let j = scrollStart; j < scrollEnd; j++) {
        if (linhas[j].includes('_accumulatedMessages')) {
          jaTem = true;
          break;
        }
      }

      if (jaTem) {
        console.log('   ℹ️  Ja tem extracao acumulativa');
      } else {
        // Remove funcao antiga e insere nova
        const indent = '  ';
        const novaFuncao = [
          indent + 'async scrollToTop() {',
          indent + '  if (!this.page) return 0;',
          indent + "  log.playwright('Carregando historico (extracao acumulativa)...');",
          indent + '  const allMessagesMap = new Map();',
          indent + '  let scrollCount = 0;',
          indent + '  let lastCount = 0;',
          indent + '  let stableCount = 0;',
          indent + '  ',
          indent + '  while (scrollCount < CONFIG.MAX_SCROLLS) {',
          indent + '    const currentMessages = await this.page.evaluate(() => {',
          indent + '      const msgs = [];',
          indent + '      const elements = document.querySelectorAll(\'[data-testid="msg-container"], [data-testid="msg-image"], [data-testid="msg-video"], .message, .msg\');',
          indent + '      elements.forEach(el => {',
          indent + '        try {',
          indent + '          const textEl = el.querySelector(\'.selectable-text, .copyable-text, [dir="ltr"]\');',
          indent + '          const text = textEl ? textEl.innerText : \'\';',
          indent + '          let author = \'Desconhecido\';',
          indent + '          const preText = el.getAttribute(\'data-pre-plain-text\');',
          indent + '          if (preText) {',
          indent + '            const match = preText.match(/\\[(.*?)\\]/);',
          indent + '            if (match) author = match[1];',
          indent + '          }',
          indent + '          const timeEl = el.querySelector(\'[data-testid="msg-meta"], .msg-time\');',
          indent + '          const time = timeEl ? timeEl.innerText : \'\';',
          indent + '          const id = el.getAttribute(\'data-id\') || (text + author + time).slice(0, 50);',
          indent + '          if (text || id) msgs.push({ id, author, text, time });',
          indent + '        } catch (e) {}',
          indent + '      });',
          indent + '      return msgs;',
          indent + '    });',
          indent + '    ',
          indent + '    let addedCount = 0;',
          indent + '    for (const msg of currentMessages) {',
          indent + '      if (!allMessagesMap.has(msg.id)) {',
          indent + '        allMessagesMap.set(msg.id, msg);',
          indent + '        addedCount++;',
          indent + '      }',
          indent + '    }',
          indent + '    ',
          indent + '    const totalUnique = allMessagesMap.size;',
          indent + '    log.playwright(`Scroll ${scrollCount+1}/${CONFIG.MAX_SCROLLS} — ${currentMessages.length} visiveis | ${addedCount} novas | Total: ${totalUnique}`);',
          indent + '    ',
          indent + '    if (totalUnique === lastCount) {',
          indent + '      stableCount++;',
          indent + '      if (stableCount >= 5) {',
          indent + '        log.success(`Historico completo! ${totalUnique} mensagens`);',
          indent + '        break;',
          indent + '      }',
          indent + '    } else {',
          indent + '      stableCount = 0;',
          indent + '      lastCount = totalUnique;',
          indent + '    }',
          indent + '    ',
          indent + '    await this.page.evaluate(() => {',
          indent + '      const chat = document.querySelector(\'[data-testid="conversation-panel-messages"]\');',
          indent + '      if (chat) chat.scrollBy({ top: -chat.clientHeight * 3, behavior: \'instant\' });',
          indent + '    });',
          indent + '    ',
          indent + '    await this.page.waitForTimeout(800);',
          indent + '    scrollCount++;',
          indent + '  }',
          indent + '  ',
          indent + '  this._accumulatedMessages = Array.from(allMessagesMap.values());',
          indent + '  log.success(`${this._accumulatedMessages.length} mensagens unicas extraidas`);',
          indent + '  return scrollCount;',
          indent + '}'
        ];

        linhas.splice(scrollStart, scrollEnd - scrollStart, ...novaFuncao);
        alteracoes++;
        console.log('   ✅ scrollToTop substituido por extracao acumulativa');
      }
    } else {
      console.log('   ❌ Fim da funcao nao encontrado');
    }

    achou = true;
    break;
  }
}
if (!achou) console.log('   ❌ Nao achado');

// ============================================================
// CORRECAO 5: extractMessages usa acumulador
// ============================================================
console.log('\n[5/5] Procurando extractMessages...');
achou = false;
let extractStart = -1;
let extractEnd = -1;

for (let i = 0; i < linhas.length; i++) {
  if (linhas[i].includes('async extractMessages') && linhas[i].includes('(')) {
    extractStart = i;
    console.log(`   Inicio achado na linha ${i + 1}`);

    for (let j = i + 1; j < linhas.length; j++) {
      if (linhas[j].includes('async extractChat') || (linhas[j].trim() === '}' && j > i + 5)) {
        extractEnd = j + 1;
        console.log(`   Fim achado na linha ${extractEnd}`);
        break;
      }
    }

    if (extractEnd !== -1) {
      let jaTem = false;
      for (let j = extractStart; j < extractEnd; j++) {
        if (linhas[j].includes('_accumulatedMessages')) {
          jaTem = true;
          break;
        }
      }

      if (jaTem) {
        console.log('   ℹ️  Ja usa acumulador');
      } else {
        const indent = '  ';
        const novaFuncao = [
          indent + 'async extractMessages() {',
          indent + '  if (!this.page) return [];',
          indent + "  log.extract('Obtendo mensagens...');",
          indent + '  ',
          indent + '  if (this._accumulatedMessages && this._accumulatedMessages.length > 0) {',
          indent + '    log.success(`${this._accumulatedMessages.length} mensagens do acumulador`);',
          indent + '    return this._accumulatedMessages;',
          indent + '  }',
          indent + '  ',
          indent + '  const messages = await this.page.evaluate(() => {',
          indent + '    const msgs = [];',
          indent + '    const elements = document.querySelectorAll(\'[data-testid="msg-container"], [data-testid="msg-image"], [data-testid="msg-video"], .message, .msg\');',
          indent + '    elements.forEach(el => {',
          indent + '      try {',
          indent + '        const textEl = el.querySelector(\'.selectable-text, .copyable-text, [dir="ltr"]\');',
          indent + '        const text = textEl ? textEl.innerText : \'\';',
          indent + '        let author = \'Desconhecido\';',
          indent + '        const preText = el.getAttribute(\'data-pre-plain-text\');',
          indent + '        if (preText) {',
          indent + '          const match = preText.match(/\\[(.*?)\\]/);',
          indent + '          if (match) author = match[1];',
          indent + '        }',
          indent + '        const timeEl = el.querySelector(\'[data-testid="msg-meta"], .msg-time\');',
          indent + '        const time = timeEl ? timeEl.innerText : \'\';',
          indent + '        const id = el.getAttribute(\'data-id\') || (text + author + time).slice(0, 50);',
          indent + '        if (text || id) msgs.push({ id, author, text, time });',
          indent + '      } catch (e) {}',
          indent + '    });',
          indent + '    return msgs;',
          indent + '  });',
          indent + '  ',
          indent + '  log.success(`${messages.length} mensagens extraidas`);',
          indent + '  return messages;',
          indent + '}'
        ];

        linhas.splice(extractStart, extractEnd - extractStart, ...novaFuncao);
        alteracoes++;
        console.log('   ✅ extractMessages usa acumulador');
      }
    }

    achou = true;
    break;
  }
}
if (!achou) console.log('   ❌ Nao achado');

// ============================================================
// SALVAR
// ============================================================
fs.writeFileSync(ARQUIVO, linhas.join('\n'), 'utf8');

console.log('\n═══════════════════════════════════════════');
console.log('🎉 CORRECOES APLICADAS:', alteracoes, '/ 5');
console.log('═══════════════════════════════════════════');
console.log('');
if (alteracoes < 5) {
  console.log('⚠️  ALGUMAS CORRECOES NAO FORAM APLICADAS');
  console.log('   Rode: node diagnostico-luna.js');
  console.log('   Me mande o resultado para analise.');
}
console.log('');
console.log('Teste: node luna-cto-agent-v15-1.cjs');
