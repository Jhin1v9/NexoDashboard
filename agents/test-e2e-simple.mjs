#!/usr/bin/env node
import { chromium } from 'playwright';
import { LunaSoul } from './luna-soul.cjs';
import { SessionManager } from './session-manager.cjs';
import fs from 'fs';

async function shot(page, name) {
  const f = `/home/jhin/NEXO_DASHBOARD_PRO/agents/test-screenshots/${name}.png`;
  // Use CDP directly — Playwright screenshot waits for fonts which hang on Kimi Web
  const cdp = await page.context().newCDPSession(page);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(f, Buffer.from(data, 'base64'));
  await cdp.detach();
  console.log('📸', f);
}

async function main() {
  fs.mkdirSync('/home/jhin/NEXO_DASHBOARD_PRO/agents/test-screenshots', { recursive: true });

  console.log('1️⃣ Conectando ao Chrome...');
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const page = browser.contexts()[0].pages()[0];
  console.log('   URL:', page.url().slice(0, 60));

  console.log('2️⃣ Screenshot inicial');
  await shot(page, '01-start');

  console.log('3️⃣ Inicializando LunaSoul...');
  const luna = new LunaSoul({ defaultMode: 'thinking' });
  await luna.init({ userId: 'luna-cli' });

  const session = new SessionManager().getOrCreateCurrentSession();
  const msg = 'Crie um arquivo em /tmp/luna-e2e.txt com o texto "Hello Luna"';
  console.log('4️⃣ Enviando:', msg);

  const stream = luna.processMessageStream(msg, {
    sessionId: session.id, mode: 'thinking', userId: 'luna-cli',
  });

  let thinking = '';
  let response = '';
  let actionCount = 0;

  for await (const ev of stream) {
    if (ev.type === 'thinking_delta') {
      thinking = ev.fullThinking || '';
      process.stdout.write('\r🧠 ' + thinking.slice(-40).replace(/\n/g, ' '));
    }
    if (ev.type === 'response_delta') {
      response = ev.fullResponse || '';
      process.stdout.write('\r💬 ' + response.slice(-40).replace(/\n/g, ' '));
    }
    if (ev.type === 'action_start') {
      console.log('\n🔧 Action:', ev.tool);
      await shot(page, `02-action-${++actionCount}`);
    }
    if (ev.type === 'action_end') {
      console.log('\n✅ Action done:', ev.tool, ev.result?.success ? 'OK' : 'FAIL');
    }
    if (ev.type === 'done') {
      console.log('\n✅ Done');
    }
    if (ev.type === 'error') {
      console.log('\n❌ Error:', ev.error);
    }
  }

  console.log('\n5️⃣ Screenshot final');
  await shot(page, '03-final');

  console.log('\n─────────────────────────────────');
  console.log('THINKING:', thinking.length, 'chars');
  console.log('RESPONSE:', response.length, 'chars');
  console.log('ACTIONS:', actionCount);

  const fileExists = fs.existsSync('/tmp/luna-e2e.txt');
  console.log('FILE:', fileExists ? '✅ ' + fs.readFileSync('/tmp/luna-e2e.txt', 'utf8') : '❌ NOT CREATED');

  await luna.disconnect();
  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
