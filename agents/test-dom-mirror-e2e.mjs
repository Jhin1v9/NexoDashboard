/**
 * End-to-end DOM Mirror test with LunaSoul execution
 * Verifies that DOM-extracted code is actually executed locally.
 */

import { LunaSoul } from './luna-soul.cjs';
import { KimiBridge } from './kimi-bridge.cjs';

const bridge = new KimiBridge({ cdpUrl: 'http://127.0.0.1:9222' });
const soul = new LunaSoul({ kimiBridge: bridge });

async function test() {
  console.log('🔌 Conectando...');
  await bridge.connect();
  console.log('✅ Conectado\n');

  const prompt = 'Calcule a soma dos quadrados de 1 a 100 usando Python e me diga o resultado.';
  console.log(`📤 Usuário: "${prompt}"\n`);

  let actionExecuted = false;
  let actionResult = null;
  let actionError = null;
  let finalResponse = null;

  try {
    const stream = soul.processMessageStream(prompt, {
      sessionId: 'test-e2e-dom-mirror',
      mode: 'instant',
    });

    for await (const ev of stream) {
      const ts = new Date().toISOString().split('T')[1].slice(0, 8);

      switch (ev.type) {
        case 'thinking_delta':
          process.stdout.write(`\x1b[90m[${ts}] 💭 ${ev.text?.slice(0, 60).replace(/\n/g, ' ')}\x1b[0m\n`);
          break;

        case 'response_delta':
          process.stdout.write(`\x1b[32m[${ts}] 📝 ${ev.text?.slice(0, 60).replace(/\n/g, ' ')}\x1b[0m\n`);
          break;

        case 'action_start':
          console.log(`\x1b[1;33m[${ts}] ⚡ EXECUTANDO: ${ev.tool}\x1b[0m`);
          break;

        case 'action_end': {
          actionExecuted = true;
          const res = ev.result?.result;
          actionResult = res;
          if (res?.stderr) actionError = res.stderr;
          console.log(`\x1b[1;36m[${ts}] ✅ RESULTADO:\x1b[0m`);
          if (res?.stdout) console.log(`   stdout: ${res.stdout.slice(0, 200)}`);
          if (res?.stderr) console.log(`   stderr: ${res.stderr.slice(0, 200)}`);
          if (res?.output) console.log(`   output: ${res.output.slice(0, 200)}`);
          break;
        }

        case 'waiting':
          console.log(`\x1b[90m[${ts}] ⏳ ${ev.message}\x1b[0m`);
          break;

        case 'done':
          finalResponse = ev.result?.response;
          console.log(`\n\x1b[1;32m[${ts}] ✅ CONVERSA FINALIZADA\x1b[0m`);
          break;

        case 'error':
          console.error(`\x1b[1;31m[${ts}] ❌ ERRO: ${ev.error}\x1b[0m`);
          break;
      }
    }
  } catch (err) {
    console.error('\n\x1b[1;31m❌ FATAL:\x1b[0m', err.message);
    console.error(err.stack);
  }

  console.log('\n' + '='.repeat(60));
  console.log('RESULTADO E2E');
  console.log('='.repeat(60));

  if (actionExecuted) {
    console.log('\n\x1b[1;32m✅ Action foi executada localmente!\x1b[0m');
    if (actionResult?.stdout?.includes('338350') || actionResult?.output?.includes('338350')) {
      console.log('\x1b[1;32m✅ Resultado correto: 338350\x1b[0m');
    } else {
      console.log('\x1b[1;33m⚠️ Resultado:', actionResult?.stdout || actionResult?.output, '\x1b[0m');
    }
  } else {
    console.log('\n\x1b[1;31m❌ Action NÃO foi executada\x1b[0m');
  }

  if (actionError) {
    console.log('\n\x1b[1;31m❌ Erro na execução:\x1b[0m', actionError);
  }

  if (finalResponse) {
    console.log(`\n\x1b[90mResposta final:\x1b[0m`);
    console.log(finalResponse.slice(0, 400));
  }

  await bridge.disconnect();
  console.log('\n🔌 Desconectado.');
  process.exit(actionExecuted ? 0 : 1);
}

test().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
