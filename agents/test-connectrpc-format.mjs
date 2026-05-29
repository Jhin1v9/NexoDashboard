/**
 * Capture the raw body of kimi.gateway.chat.v1.ChatService/Chat response
 * to understand the Connect-RPC streaming format.
 */

import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const page = await context.newPage();

  // Intercept the ChatService/Chat request and log response body
  page.route('**/ChatService/Chat', async (route, request) => {
    console.log('\n🎯 INTERCEPTED:', request.method(), request.url());
    console.log('   Headers:', JSON.stringify(request.headers()));

    const response = await route.fetch();
    const body = await response.text();
    console.log('\n📦 RESPONSE BODY (' + body.length + ' chars):');
    console.log(body.slice(0, 3000));
    console.log('\n--- end of body preview ---\n');

    // Fulfill with original response so page works normally
    route.fulfill({
      status: response.status(),
      headers: response.headers(),
      body,
    });
  });

  await page.goto('https://kimi.com/?chat_enter_method=new_chat', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const input = page.locator('textarea, [contenteditable="true"]').first();
  await input.fill('calculate 123*456 with python3');
  await input.press('Enter');

  // Wait for response
  await page.waitForTimeout(25000);

  await page.close();
  await browser.close();
}

main().catch(console.error);
