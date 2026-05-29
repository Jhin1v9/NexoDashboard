/**
 * End-to-end test v2: verify interceptor state via CDP.
 * Uses a prompt that strongly forces ipython tool usage.
 */

import { KimiBridge } from './kimi-bridge.cjs';

const USER_ID = 'luna-test-toolcall-v2';

async function main() {
  const bridge = new KimiBridge();
  await bridge.connect();
  console.log('🔌 Bridge connected');

  // Prompt that forces code execution
  const prompt = `Crie um arquivo de texto em /tmp/test-luna-bridge.txt contendo a string "SUCCESS" usando Python. Você DEVE usar python3 para isso.`;

  console.log(`📤 Sending: "${prompt}"\n`);

  const stream = bridge.sendMessageStream(USER_ID, prompt);
  let fullResponse = '';

  for await (const ev of stream) {
    switch (ev.type) {
      case 'response_delta':
        fullResponse += ev.text;
        break;
      case 'done':
        console.log('✅ Stream complete');
        break;
    }
  }

  // ── CRITICAL: Inspect interceptor state directly via CDP ──
  const session = bridge.userSessions.get(USER_ID);
  const page = session?.page;

  if (page && !page.isClosed()) {
    const interceptorState = await page.evaluate(() => {
      const s = window.__lunaStream;
      if (!s) return { error: 'NO __lunaStream' };
      return {
        active: s.active,
        contentLength: s.content?.length || 0,
        reasoningLength: s.reasoning?.length || 0,
        eventCount: s.events?.length || 0,
        toolCallKeys: s.toolCalls ? Object.keys(s.toolCalls) : [],
        toolCallDetails: s.toolCalls ? Object.entries(s.toolCalls).map(([k, v]) => ({
          index: k,
          name: v.name,
          id: v.id,
          argsLength: v.args?.length || 0,
          complete: v.complete,
          emitted: v.emitted,
        })) : [],
        emittedActions: s.emittedActions || [],
      };
    });

    console.log('\n────────────────────────────────────────');
    console.log('INTERCEPTOR STATE:', JSON.stringify(interceptorState, null, 2));
  }

  console.log('\n────────────────────────────────────────');
  console.log('RESPONSE LENGTH:', fullResponse.length);
  console.log('HAS [[action]]:', fullResponse.includes('[[action]]'));
  console.log('First 800 chars:', fullResponse.slice(0, 800));

  await bridge.disconnect();
}

main().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
