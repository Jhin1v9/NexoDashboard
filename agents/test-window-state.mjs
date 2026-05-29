/**
 * Inspect window.* globals on kimi.com to find where chat messages / tool calls
 * are stored in the frontend state.
 */

import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const page = await context.newPage();

  await page.goto('https://kimi.com/?chat_enter_method=new_chat', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Send a message that triggers ipython
  const input = page.locator('textarea, [contenteditable="true"]').first();
  await input.fill('calculate 123*456 with python');
  await input.press('Enter');
  await page.waitForTimeout(20000);

  // Scan window for interesting globals
  const findings = await page.evaluate(() => {
    const results = [];
    for (const key of Object.keys(window)) {
      try {
        const val = window[key];
        if (val == null) continue;
        if (typeof val === 'object') {
          // Look for objects that might contain messages, chat, or tool calls
          const str = JSON.stringify(val).toLowerCase();
          if (str.includes('message') || str.includes('chat') || str.includes('tool') || str.includes('ipython')) {
            const size = str.length;
            if (size > 100 && size < 50000) {
              results.push({ key, type: typeof val, size, preview: str.slice(0, 200) });
            }
          }
        }
      } catch {}
    }
    return results.sort((a, b) => b.size - a.size).slice(0, 20);
  });

  console.log('🔍 Top window globals containing chat/tool data:\n');
  for (const f of findings) {
    console.log(`  ${f.key} (${f.type}, ${f.size} chars)`);
    console.log(`    Preview: ${f.preview}`);
    console.log();
  }

  // Also try to find React fibers with tool call data
  const reactFindings = await page.evaluate(() => {
    const results = [];
    // Walk DOM looking for React fibers
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let node;
    while ((node = walker.nextNode())) {
      const key = Object.keys(node).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
      if (key) {
        const fiber = node[key];
        const str = JSON.stringify(fiber.memoizedProps || fiber.pendingProps || {}).toLowerCase();
        if (str.includes('tool') || str.includes('ipython') || str.includes('action')) {
          results.push({ tag: node.tagName, class: node.className, preview: str.slice(0, 300) });
          if (results.length >= 10) break;
        }
      }
    }
    return results;
  });

  console.log('\n🔍 React fibers with tool data:\n');
  for (const f of reactFindings) {
    console.log(`  <${f.tag} class="${f.class}">`);
    console.log(`    Props: ${f.preview}`);
    console.log();
  }

  await page.close();
  await browser.close();
}

main().catch(console.error);
