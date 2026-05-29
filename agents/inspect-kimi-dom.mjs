/**
 * Inspeciona o DOM do Kimi Web quando ele executa ipython.
 * Envia prompt → espera resposta → tira prints → clica em elementos → explora DOM.
 */

import { chromium } from 'playwright';

const SS_DIR = '/home/jhin/NEXO_DASHBOARD_PRO/agents/screenshots-debug';

async function screenshot(page, name) {
  const path = `${SS_DIR}/${Date.now()}_${name}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log(`📸 Screenshot: ${path}`);
}

async function inspectDOM(page, label) {
  const info = await page.evaluate(() => {
    const results = {};
    // Procura por elementos que possam conter código, tool calls, execução
    const selectors = [
      'pre', 'code', '.code-block', '.code-execution', '.execution',
      '[class*="code"]', '[class*="execution"]', '[class*="ipython"]',
      '[class*="tool"]', '[class*="action"]', '[class*="python"]',
      'details', 'summary', '.segment-assistant', '.markdown-container',
      '.thinking-container', '.think-block'
    ];
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        results[sel] = Array.from(els).slice(0, 5).map(el => ({
          tag: el.tagName,
          class: el.className,
          text: (el.innerText || '').slice(0, 200),
          childCount: el.children.length,
        }));
      }
    }
    return results;
  });
  console.log(`\n🔍 DOM INSPECTION [${label}]:`, JSON.stringify(info, null, 2));
}

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  
  // Usa uma página existente do Kimi ou cria nova
  let page = context.pages().find(p => p.url().includes('kimi'));
  if (!page) {
    page = await context.newPage();
    await page.goto('https://kimi.com/?chat_enter_method=new_chat', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
  }
  
  console.log('🌐 Página atual:', await page.url());
  await screenshot(page, '01_initial');
  
  // Envia um prompt que FORCE ipython
  const prompt = 'Calcule a soma dos quadrados dos números de 1 a 100 usando Python e mostre o código e o resultado.';
  console.log('\n📤 Enviando prompt:', prompt);
  
  const input = page.locator('textarea, [contenteditable="true"]').first();
  await input.fill(prompt);
  await input.press('Enter');
  
  // Aguarda e tira prints durante o processamento
  console.log('⏳ Aguardando resposta (30s)...');
  
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(5000);
    console.log(`\n--- Checkpoint ${i + 1} (${(i + 1) * 5}s) ---`);
    await screenshot(page, `02_response_${(i + 1) * 5}s`);
    await inspectDOM(page, `t+${(i + 1) * 5}s`);
  }
  
  // Tenta clicar em elementos de thinking/expandir detalhes
  console.log('\n🖱️ Tentando clicar em elementos interativos...');
  
  const clickable = await page.evaluate(() => {
    const candidates = [];
    // Procura por details/summary (thinking blocks costumam ser details)
    document.querySelectorAll('details, summary, button, [role="button"]').forEach((el, i) => {
      const text = (el.innerText || el.textContent || '').slice(0, 100);
      if (text.includes('Thinking') || text.includes('Pensando') || text.includes('Python') || 
          text.includes('code') || text.includes('execut') || text.includes('ipython')) {
        candidates.push({ index: i, tag: el.tagName, text, rect: el.getBoundingClientRect() });
      }
    });
    return candidates.slice(0, 10);
  });
  
  console.log('Elementos clicáveis encontrados:', JSON.stringify(clickable, null, 2));
  
  // Clica no primeiro elemento relevante se houver
  if (clickable.length > 0) {
    const first = clickable[0];
    console.log(`\n🖱️ Clicando em: ${first.tag} - "${first.text}"`);
    await page.mouse.click(first.rect.x + first.rect.width / 2, first.rect.y + first.rect.height / 2);
    await page.waitForTimeout(2000);
    await screenshot(page, '03_after_click');
  }
  
  // Inspeciona estado global do window
  console.log('\n🔍 Procurando variáveis globais...');
  const globals = await page.evaluate(() => {
    const interesting = [];
    for (const key of Object.keys(window)) {
      try {
        const val = window[key];
        if (val && typeof val === 'object') {
          const str = JSON.stringify(val);
          if (str.includes('message') || str.includes('chat') || str.includes('tool') || 
              str.includes('ipython') || str.includes('code') || str.includes('segment')) {
            if (str.length > 50 && str.length < 10000) {
              interesting.push({ key, size: str.length, preview: str.slice(0, 300) });
            }
          }
        }
      } catch {}
    }
    return interesting.slice(0, 20);
  });
  
  console.log('Globals interessantes:', JSON.stringify(globals, null, 2));
  
  await screenshot(page, '04_final');
  console.log('\n✅ Inspeção completa.');
  
  await browser.close();
}

main().catch(err => {
  console.error('❌ Erro:', err);
  process.exit(1);
});
