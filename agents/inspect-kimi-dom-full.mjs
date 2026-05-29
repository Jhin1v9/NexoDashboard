/**
 * Deep DOM inspection of Kimi Web Python execution blocks
 * Maps: code block, result block, images, stdout, stderr, tables
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const CDP_URL = 'http://127.0.0.1:9222';
const SS_DIR = path.join(process.cwd(), 'screenshots-debug');
if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });

async function inspect() {
  console.log('🔌 Conectando ao Chrome via CDP...');
  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0];

  // Find existing kimi page or create new
  let page = context.pages().find(p => p.url().includes('kimi.com'));
  if (!page) {
    page = await context.newPage();
    await page.goto('https://www.kimi.com');
    await page.waitForTimeout(3000);
  }

  console.log(`🌐 Página: ${page.url()}`);

  // Navigate to new chat
  await page.goto('https://www.kimi.com/?chat_enter_method=new_chat');
  await page.waitForTimeout(3000);

  // Send a complex Python prompt
  const prompts = [
    'Execute Python para: 1) Criar uma lista dos números primos entre 1 e 50, 2) Calcular a média, 3) Mostrar o resultado formatado. Mostre o código e o resultado.',
    'Agora crie um gráfico simples de barras com matplotlib mostrando os 5 primeiros números primos e seus quadrados. Salve e mostre.',
  ];

  for (let pi = 0; pi < prompts.length; pi++) {
    const prompt = prompts[pi];
    console.log(`\n📤 Prompt ${pi+1}: ${prompt.slice(0, 80)}...`);

    const input = page.locator('textarea, [contenteditable="true"]').first();
    await input.fill(prompt);
    await page.waitForTimeout(300);
    await input.press('Enter');

    // Wait for response
    await page.waitForTimeout(15000);

    // Take screenshot
    const ssPath = path.join(SS_DIR, `dom-inspect-${Date.now()}-${pi}.png`);
    await page.screenshot({ path: ssPath, fullPage: true });
    console.log(`📸 Screenshot: ${ssPath}`);

    // Deep DOM inspection
    const inspection = await page.evaluate(() => {
      const results = {
        url: location.href,
        segments: [],
        toolcalls: [],
        codeBlocks: [],
        resultBlocks: [],
        images: [],
        tables: [],
        allClasses: new Set(),
      };

      // 1. All assistant segments
      document.querySelectorAll('.segment-assistant').forEach((seg, idx) => {
        const segInfo = {
          index: idx,
          text: seg.innerText?.slice(0, 200),
          childCount: seg.children.length,
          className: seg.className,
        };
        results.segments.push(segInfo);
      });

      // 2. Tool call containers (ipython, search, etc.)
      document.querySelectorAll('[class*="toolcall"]').forEach((el, idx) => {
        const tc = {
          index: idx,
          tag: el.tagName,
          className: el.className,
          text: el.innerText?.slice(0, 300),
          hasChildren: el.children.length > 0,
        };
        // Find nested elements
        const codeEl = el.querySelector('pre, code, .segment-code-content');
        if (codeEl) tc.code = codeEl.innerText?.slice(0, 300);
        const resultEl = el.querySelector('.toolcall-result, .execution-result, [class*="result"]');
        if (resultEl) tc.result = resultEl.innerText?.slice(0, 300);
        results.toolcalls.push(tc);
      });

      // 3. Code blocks
      document.querySelectorAll('pre, code, .segment-code, [class*="code-"]').forEach((el, idx) => {
        results.codeBlocks.push({
          index: idx,
          tag: el.tagName,
          className: el.className,
          text: el.innerText?.slice(0, 400),
          parentClass: el.parentElement?.className?.slice(0, 100),
        });
      });

      // 4. Result/output blocks
      document.querySelectorAll('[class*="result"], [class*="output"], [class*="execution"], .markdown-container').forEach((el, idx) => {
        results.resultBlocks.push({
          index: idx,
          tag: el.tagName,
          className: el.className,
          text: el.innerText?.slice(0, 400),
        });
      });

      // 5. Images
      document.querySelectorAll('img').forEach((img, idx) => {
        results.images.push({
          index: idx,
          src: img.src?.slice(0, 200),
          alt: img.alt,
          className: img.className,
          parentClass: img.parentElement?.className?.slice(0, 100),
        });
      });

      // 6. Tables
      document.querySelectorAll('table').forEach((tbl, idx) => {
        results.tables.push({
          index: idx,
          rows: tbl.rows.length,
          text: tbl.innerText?.slice(0, 300),
        });
      });

      // 7. Collect all unique class names for pattern discovery
      document.querySelectorAll('*').forEach(el => {
        if (el.className && typeof el.className === 'string') {
          el.className.split(' ').forEach(c => {
            if (c.includes('tool') || c.includes('code') || c.includes('exec') || c.includes('result') || c.includes('python') || c.includes('ipython')) {
              results.allClasses.add(c);
            }
          });
        }
      });
      results.allClasses = Array.from(results.allClasses).sort();

      return results;
    });

    console.log('\n=== INSPEÇÃO DOM ===');
    console.log(JSON.stringify(inspection, null, 2).slice(0, 8000));

    // Also try to find specific result containers
    const specific = await page.evaluate(() => {
      const find = (sel) => {
        const el = document.querySelector(sel);
        return el ? { found: true, text: el.innerText?.slice(0, 300), className: el.className } : { found: false };
      };
      return {
        '.toolcall-ipython': find('.toolcall-ipython'),
        '.ipython-images-container': find('.ipython-images-container'),
        '.segment-code': find('.segment-code'),
        '.segment-code-content': find('.segment-code-content'),
        '.execution-result': find('.execution-result'),
        '[class*="execution-result"]': find('[class*="execution-result"]'),
        '[class*="toolcall-result"]': find('[class*="toolcall-result"]'),
        '[class*="output-"]': find('[class*="output-"]'),
        '.markdown-container': find('.markdown-container'),
      };
    });
    console.log('\n=== SELETORES ESPECÍFICOS ===');
    console.log(JSON.stringify(specific, null, 2));

    await page.waitForTimeout(5000);
  }

  await browser.disconnect();
  console.log('\n🔌 Desconectado.');
}

inspect().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
