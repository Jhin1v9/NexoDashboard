/**
 * End-to-end test: verify that the bridge intercepts Kimi tool_calls
 * and synthesizes [[action]] tags in the response.
 *
 * Requires:
 *   - Chrome running with --remote-debugging-port=9222
 *   - User logged in on kimi.com
 */

import { KimiBridge } from './kimi-bridge.cjs';

const USER_ID = 'luna-test-toolcall';

async function main() {
  const bridge = new KimiBridge();
  await bridge.connect();

  console.log('🔌 Bridge connected');

  // Use a prompt that strongly triggers ipython
  const prompt = `Execute código Python e me diga o resultado de 123 * 456. Use python3.`;

  console.log(`📤 Sending: "${prompt}"`);
  console.log('⏳ Waiting for response (this may take 30-60s)...\n');

  const stream = bridge.sendMessageStream(USER_ID, prompt);
  let fullResponse = '';
  let hasAction = false;
  let hasThinking = false;

  for await (const ev of stream) {
    switch (ev.type) {
      case 'thinking_delta':
        if (!hasThinking) {
          hasThinking = true;
          process.stdout.write('🧠 Thinking: ');
        }
        process.stdout.write(ev.text);
        break;
      case 'response_delta':
        fullResponse += ev.text;
        if (ev.text.includes('[[action]]')) {
          hasAction = true;
          process.stdout.write('\n🎯 ACTION TAG DETECTED!\n');
        }
        break;
      case 'done':
        console.log('\n✅ Stream complete');
        break;
      case 'waiting':
        // heartbeat
        break;
      default:
        console.log('📡', ev.type, ev);
    }
  }

  console.log('\n────────────────────────────────────────');
  console.log('FULL RESPONSE LENGTH:', fullResponse.length);
  console.log('HAS [[action]] TAG:', hasAction);
  console.log('HAS THINKING:', hasThinking);

  if (hasAction) {
    const actionMatch = fullResponse.match(/\[\[action\]\]([\s\S]*?)\[\[\/action\]\]/);
    if (actionMatch) {
      console.log('ACTION JSON:', actionMatch[1].slice(0, 200));
    }
    console.log('\n🎉 SUCCESS: Tool call interception is working!');
    process.exitCode = 0;
  } else {
    console.log('\n⚠️ WARNING: No [[action]] tag found.');
    console.log('Kimi may have responded with plain text instead of using ipython.');
    console.log('First 500 chars of response:', fullResponse.slice(0, 500));
    process.exitCode = 1;
  }

  await bridge.disconnect();
}

main().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
