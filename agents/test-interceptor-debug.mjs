/**
 * Debug script: verify that the interceptor is actually monkey-patching
 * fetch/XHR and capture which URLs kimi.com uses for chat API.
 */

import { KimiBridge } from './kimi-bridge.cjs';

const USER_ID = 'luna-debug-interceptor';

async function main() {
  const bridge = new KimiBridge();
  await bridge.connect();
  console.log('🔌 Bridge connected');

  const page = await bridge._getOrCreateUserPage(USER_ID);

  // Inject a network listener to see ALL requests
  await page.route('**/*', async (route, request) => {
    const url = request.url();
    if (url.includes('kimi') || url.includes('moonshot') || url.includes('chat') || url.includes('stream')) {
      console.log('🌐 NETWORK:', request.method(), url);
    }
    route.continue();
  });

  // Navigate to kimi.com
  await page.goto('https://kimi.com/?chat_enter_method=new_chat', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Check if interceptor is installed
  const check = await page.evaluate(() => ({
    interceptorInstalled: !!window.__lunaInterceptorInstalled,
    fetchIsOrig: window.fetch === window.__lunaOrigFetch,
    hasLunaStream: !!window.__lunaStream,
    xhrOpenPatched: XMLHttpRequest.prototype.open.toString().includes('_lunaIsChat'),
  }));

  console.log('\n📊 INTERCEPTOR CHECK:', check);

  // Send a test message
  const input = page.locator('textarea, [contenteditable="true"]').first();
  await input.fill('hello');
  await input.press('Enter');
  await page.waitForTimeout(5000);

  // Check stream state
  const state = await page.evaluate(() => {
    const s = window.__lunaStream;
    return s ? {
      active: s.active,
      contentLen: s.content?.length || 0,
      eventCount: s.events?.length || 0,
      toolCalls: Object.keys(s.toolCalls || {}),
    } : { error: 'no stream' };
  });

  console.log('📊 STREAM STATE after message:', state);

  await bridge.disconnect();
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
