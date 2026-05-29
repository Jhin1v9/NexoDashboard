#!/usr/bin/env node
import { LunaSoul } from './luna-soul.cjs';
import { SessionManager } from './session-manager.cjs';
import fs from 'fs';

async function main() {
  const msg = process.argv.slice(2).join(' ') || 'Crie um arquivo em /tmp/luna-e2e.txt com o texto "Hello Luna"';

  console.log('══════════════════════════════════════════════════');
  console.log('  LUNA E2E TEST — Sem screenshots');
  console.log('══════════════════════════════════════════════════');
  console.log('📤 Mensagem:', msg, '\n');

  const luna = new LunaSoul({ defaultMode: 'thinking' });
  await luna.init({ userId: 'luna-cli' });

  const session = new SessionManager().getOrCreateCurrentSession();
  const stream = luna.processMessageStream(msg, {
    sessionId: session.id, mode: 'thinking', userId: 'luna-cli',
  });

  const events = [];
  let thinking = '';
  let response = '';

  for await (const ev of stream) {
    events.push({ type: ev.type, t: Date.now() });

    switch (ev.type) {
      case 'thinking_start':
        console.log('🧠 [thinking_start]');
        break;
      case 'thinking_delta':
        thinking = ev.fullThinking || '';
        process.stdout.write('\r🧠 ' + thinking.slice(-50).replace(/\n/g, ' '));
        break;
      case 'response_delta':
        response = ev.fullResponse || '';
        process.stdout.write('\r💬 ' + response.slice(-50).replace(/\n/g, ' '));
        break;
      case 'action_start':
        console.log(`\n🔧 [action_start] ${ev.tool}`);
        break;
      case 'action_end':
        console.log(`\n✅ [action_end] ${ev.tool} success=${ev.result?.success}`);
        if (ev.result?.result?.stdout) console.log('   stdout:', ev.result.result.stdout.slice(0, 200));
        if (ev.result?.result?.stderr) console.log('   stderr:', ev.result.result.stderr.slice(0, 200));
        break;
      case 'waiting':
        process.stdout.write('\r⏳ ' + (ev.message || '...'));
        break;
      case 'response_done':
        console.log('\n✅ [response_done]');
        break;
      case 'done':
        console.log('\n✅ [done] mode=' + ev.result?.mode);
        break;
      case 'error':
        console.log('\n❌ [error]', ev.error);
        break;
    }
  }

  console.log('\n──────────────────────────────────────────────────');
  console.log('RESUMO:');
  const types = {};
  for (const e of events) types[e.type] = (types[e.type] || 0) + 1;
  for (const [t, c] of Object.entries(types)) console.log(`  ${t}: ${c}`);
  console.log('Thinking:', thinking.length, 'chars');
  console.log('Response:', response.length, 'chars');

  const file = '/tmp/luna-e2e.txt';
  console.log('File:', fs.existsSync(file) ? '✅ ' + fs.readFileSync(file, 'utf8') : '❌ NOT FOUND');

  await luna.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
