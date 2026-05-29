#!/usr/bin/env node
/**
 * Teste E2E — Caminho direto para enviar mensagens ao Kimi Web
 * Sem TUI. Apenas bridge + soul.
 */
import { KimiBridge } from './kimi-bridge.cjs';
import { LunaSoul } from './luna-soul.cjs';
import { SessionManager } from './session-manager.cjs';

const USER_ID = 'luna-cli-test';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function sendMessageDirect(text, options = {}) {
  const bridge = new KimiBridge();
  await bridge.connect(USER_ID);

  console.log(`\n📤 Enviando: "${text.slice(0, 60)}${text.length > 60 ? '...' : ''}"`);
  console.log('⏳ Aguardando resposta...\n');

  const stream = bridge.sendMessageStream(USER_ID, text, {
    mode: options.mode || 'thinking',
  });

  let thinking = '';
  let response = '';
  let actions = [];

  for await (const ev of stream) {
    switch (ev.type) {
      case 'thinking_delta':
        thinking += ev.text || '';
        process.stdout.write('\r🧠 Thinking: ' + thinking.slice(-60).replace(/\n/g, ' '));
        break;
      case 'response_delta':
        response += ev.text || '';
        process.stdout.write('\r💬 Response: ' + response.slice(-60).replace(/\n/g, ' '));
        break;
      case 'action_detected':
        console.log(`\n🔧 DOM Action detected: ${ev.action?.tool} (${ev.code?.length || 0} chars)`);
        actions.push(ev);
        break;
      case 'waiting':
        process.stdout.write('\r⏳ ' + (ev.message || 'Processando...'));
        break;
      case 'done':
        console.log('\n✅ Done');
        break;
      case 'error':
        console.log('\n❌ Error:', ev.error);
        break;
    }
  }

  await bridge.disconnect();

  return { thinking, response, actions };
}

async function main() {
  const args = process.argv.slice(2);
  const text = args.join(' ') || 'Oi! Me fale sobre você em uma frase.';

  console.log('═══════════════════════════════════════════════════════');
  console.log('  LUNA E2E TEST — Caminho Direto (sem TUI)');
  console.log('═══════════════════════════════════════════════════════');

  try {
    const result = await sendMessageDirect(text);

    console.log('\n───────────────────────────────────────────────────────');
    console.log('RESULTADO:');
    console.log('───────────────────────────────────────────────────────');
    console.log('Thinking length:', result.thinking.length);
    console.log('Response length:', result.response.length);
    console.log('Actions detected:', result.actions.length);
    console.log('\n📝 Response preview:');
    console.log(result.response.slice(0, 500));
    if (result.response.length > 500) console.log('...');

  } catch (err) {
    console.error('\n❌ Falha:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
