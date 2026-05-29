/**
 * Debug: test extraction of Kimi's result block from DOM
 */

import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const page = context.pages().find(p => p.url().includes('kimi.com'));
  if (!page) { console.log('No kimi page'); process.exit(1); }

  const r = await page.evaluate(() => {
    const last = document.querySelector('.segment-assistant');
    if (!last) return { error: 'no segment' };

    // All segment-code blocks
    const blocks = [];
    last.querySelectorAll('.segment-code').forEach((b, i) => {
      const langEl = b.querySelector('.segment-code-lang');
      const content = b.querySelector('.segment-code-content, pre, code');
      blocks.push({
        index: i,
        lang: langEl?.innerText || 'unknown',
        text: content?.innerText?.slice(0, 100) || 'no text',
        className: b.className,
      });
    });

    // All pre blocks with classes
    const pres = [];
    last.querySelectorAll('pre').forEach((p, i) => {
      pres.push({
        index: i,
        className: p.className,
        text: p.innerText?.slice(0, 100),
      });
    });

    return { blocks, pres };
  });

  console.log(JSON.stringify(r, null, 2));
  await browser.disconnect();
}

test().catch(console.error);
