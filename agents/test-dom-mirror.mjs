/**
 * Test DOM Mirror extraction — Luna v3.2 Critical Path
 * Sends a message that forces Kimi to use ipython, then verifies
 * that we extract the code from the DOM and emit action_detected.
 */

import { KimiBridge } from './kimi-bridge.cjs';

const bridge = new KimiBridge({ cdpUrl: 'http://127.0.0.1:9222' });

async function test() {
  console.log('🔌 Conectando ao bridge...');
  await bridge.connect();
  console.log('✅ Conectado');

  const userId = 'test-dom-mirror';

  // Reuse existing page if any
  const page = await bridge._getOrCreateUserPage(userId);
  console.log(`📄 Página: ${page.url()}`);

  const prompt = 'Calcule a soma dos quadrados dos números de 1 a 100 usando Python. Mostre o código Python usado e o resultado.';
  console.log(`\n📤 Enviando: "${prompt}"`);
  console.log('⏳ Aguardando stream...\n');

  let actionDetected = false;
  let detectedCode = null;
  let detectedAction = null;
  let finalResponse = null;

  try {
    const stream = bridge.sendMessageStream(userId, prompt, { mode: 'instant' });

    for await (const event of stream) {
      const ts = new Date().toISOString().split('T')[1].slice(0, 8);

      switch (event.type) {
        case 'thinking_delta':
          process.stdout.write(`\x1b[90m[${ts}] 💭 ${event.text.slice(0, 80).replace(/\n/g, ' ')}\x1b[0m\n`);
          break;

        case 'response_delta':
          process.stdout.write(`\x1b[32m[${ts}] 📝 ${event.text.slice(0, 80).replace(/\n/g, ' ')}\x1b[0m\n`);
          break;

        case 'action_detected':
          actionDetected = true;
          detectedCode = event.code;
          detectedAction = event.action;
          console.log(`\n\x1b[1;33m[${ts}] ⚡ ACTION DETECTED (DOM MIRROR)\x1b[0m`);
          console.log(`   source: ${event.source}`);
          console.log(`   tool: ${event.action?.tool}`);
          console.log(`   code length: ${event.code?.length} chars`);
          console.log(`   code preview:\n\x1b[36m${event.code?.slice(0, 300)}\x1b[0m`);
          console.log(`   command preview:\n\x1b[35m${event.action?.params?.command?.slice(0, 200)}\x1b[0m\n`);
          break;

        case 'waiting':
          console.log(`\x1b[90m[${ts}] ⏳ ${event.message}\x1b[0m`);
          break;

        case 'done':
          finalResponse = event.response;
          console.log(`\n\x1b[1;32m[${ts}] ✅ STREAM DONE\x1b[0m`);
          console.log(`   finalResponse length: ${event.response?.length}`);
          console.log(`   thinking length: ${event.thinking?.length}`);
          break;
      }
    }
  } catch (err) {
    console.error('\n\x1b[1;31m❌ ERRO:\x1b[0m', err.message);
    console.error(err.stack);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('RESULTADO DO TESTE');
  console.log('='.repeat(60));

  if (actionDetected) {
    console.log('\n\x1b[1;32m✅ SUCESSO: action_detected foi emitido!\x1b[0m');
    console.log(`   Código extraído: ${detectedCode.length} chars`);
    console.log(`   Tool: ${detectedAction?.tool}`);
    console.log(`\n   Código completo:\n\x1b[36m${detectedCode}\x1b[0m`);
  } else {
    console.log('\n\x1b[1;31m❌ FALHA: action_detected NÃO foi emitido\x1b[0m');
    console.log('   Possíveis causas:');
    console.log('   - Kimi não usou ipython (respondeu em texto puro)');
    console.log('   - Seletores DOM mudaram');
    console.log('   - Bloco de código ainda não renderizou no momento da extração');
  }

  if (finalResponse) {
    console.log(`\n\x1b[90mResposta final (${finalResponse.length} chars):\x1b[0m`);
    console.log(finalResponse.slice(0, 500));
  }

  // Extra: try direct DOM extraction now
  console.log('\n\x1b[90m--- Extração direta do DOM agora ---\x1b[0m');
  try {
    const blocks = await bridge._extractIpythonBlocksFromDOM(page);
    console.log(`Blocos encontrados: ${blocks.length}`);
    for (const b of blocks) {
      console.log(`  [${b.source}] ${b.language}: ${b.code.length} chars`);
      console.log(`  \x1b[36m${b.code.slice(0, 200)}\x1b[0m`);
    }
  } catch (e) {
    console.error('Erro na extração direta:', e.message);
  }

  await bridge.disconnect();
  console.log('\n🔌 Desconectado.');
  process.exit(actionDetected ? 0 : 1);
}

test().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
