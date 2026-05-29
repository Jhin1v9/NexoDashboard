/**
 * Inspect the actual network format used by kimi.com for chat responses.
 * We capture ALL responses and log their URLs, content-types, and first bytes.
 */

import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const page = await context.newPage();

  // Capture every response
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('kimi') && (url.includes('chat') || url.includes('stream') || url.includes('apiv2'))) {
      const ct = response.headers()['content-type'] || 'unknown';
      console.log('\n🌐 RESPONSE:', response.request().method(), url);
      console.log('   Content-Type:', ct);
      try {
        const body = await response.body();
        console.log('   Body length:', body.length);
        console.log('   First 200 bytes (hex):', body.slice(0, 200).toString('hex'));
        console.log('   First 200 bytes (text):', body.slice(0, 200).toString('utf8').replace(/\n/g, '\\n'));
      } catch (e) {
        console.log('   Body error:', e.message);
      }
    }
  });

  await page.goto('https://kimi.com/?chat_enter_method=new_chat', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Send a message
  const input = page.locator('textarea, [contenteditable="true"]').first();
  await input.fill('hello');
  await input.press('Enter');

  // Wait for response
  await page.waitForTimeout(15000);

  await page.close();
  await browser.close();
}

main().catch(console.error);
