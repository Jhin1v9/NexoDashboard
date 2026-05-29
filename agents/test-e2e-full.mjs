#!/usr/bin/env node
/**
 * Teste E2E Completo — LunaSoul + Screenshots (viewport)
 */
import { chromium } from 'playwright';
import { LunaSoul } from './luna-soul.cjs';
import { SessionManager } from './session-manager.cjs';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = '/home/jhin/NEXO_DASHBOARD_PRO/agents/test-screenshots';
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

let shotCount = 0;
async function screenshot(page, label) {
  const file = path.join(SCREENSHOT_DIR, `shot-${String(++shotCount).padStart(2, '0')}-${label}.png`);
  await page.screenshot({ path: file }); // viewport only — fullPage trava no Kimi
  console.log(`📸 ${file}`);
  return file;
}

async function main() {
  const args = process.argv.slice(2);
  const text = args.join(' ') || 'Crie um arquivo em /tmp/luna-e2e.txt com "Hello Luna"';

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  LUNA E2E FULL TEST — LunaSoul + Playwright Screenshots');
  console.log('═══════════════════════════════════════════════════════════════');

  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  const pages = context.pages();
  const kimiPage = pages.find(p => p.url().includes('kimi.com'));
  if (!kimiPage) { console.error('❌ Kimi page not found'); process.exit(1); }
  console.log('🌐 Kimi page:', kimiPage.url());

  await screenshot(kimiPage, '01-initial');

  const luna = new LunaSoul({ defaultMode: 'thinking' });
  await luna.init({ userId: 'luna-cli' });

  const sessionManager = new SessionManager();
  const session = sessionManager.getOrCreateCurrentSession();

  console.log(`\n📤 Msg: "${text.slice(0, 70)}${text.length > 70 ? '...' : ''}"`);
  const events = [];
  const startTime = Date.now();

  try {
    const stream = luna.processMessageStream(text, {
      sessionId: session.id, mode: 'thinking', userId: 'luna-cli',
    });

    for await (const ev of stream) {
      events.push({ type: ev.type, time: Date.now() - startTime });

      switch (ev.type) {
        case 'thinking_start':
          console.log('🧠 Thinking started');
          break;
        case 'thinking_delta':
          process.stdout.write('\r🧠 ' + (ev.fullThinking?.slice(-50) || '').replace(/\n/g, ' '));
          break;
        case 'response_delta':
          process.stdout.write('\r💬 ' + (ev.fullResponse?.slice(-50) || '').replace(/\n/g, ' '));
          break;
        case 'action_start':
          console.log(`\n🔧 Action: ${ev.tool}`);
          await screenshot(kimiPage, `02-action-${ev.tool}`);
          break;
        case 'action_end':
          console.log(`\n✅ Action done: ${ev.tool} → ${ev.result?.success ? 'OK' : 'FAIL'}`);
          if (ev.result?.result?.stdout) console.log('   stdout:', ev.result.result.stdout.slice(0, 100));
          if (ev.result?.result?.stderr) console.log('   stderr:', ev.result.result.stderr.slice(0, 100));
          break;
        case 'waiting':
          process.stdout.write('\r⏳ ' + (ev.message || '...'));
          break;
        case 'response_done':
          console.log('\n✅ Response done');
          await screenshot(kimiPage, '03-response-done');
          break;
        case 'done':
          console.log('\n✅ Stream done');
          break;
        case 'error':
          console.log('\n❌ Error:', ev.error);
          break;
      }
    }

    await screenshot(kimiPage, '04-final');

    console.log('\n───────────────────────────────────────────────────────────────');
    console.log('RESUMO:');
    console.log('Total events:', events.length);
    const types = {};
    for (const e of events) types[e.type] = (types[e.type] || 0) + 1;
    for (const [t, c] of Object.entries(types)) console.log(`  ${t}: ${c}`);
    console.log('Duration:', ((Date.now() - startTime) / 1000).toFixed(1), 's');

    // Check file
    if (text.includes('/tmp/luna-e2e.txt')) {
      const exists = fs.existsSync('/tmp/luna-e2e.txt');
      console.log('File created:', exists ? '✅ YES' : '❌ NO');
      if (exists) console.log('Content:', fs.readFileSync('/tmp/luna-e2e.txt', 'utf8'));
    }

  } catch (err) {
    console.error('\n❌ Fail:', err.message);
    await screenshot(kimiPage, '05-error');
  }

  await luna.disconnect();
  await browser.close();
  console.log('\n📁 Screenshots:', SCREENSHOT_DIR);
}

main().catch(console.error);
