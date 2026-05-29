/**
 * Test REAL sandbox execution — forces Kimi to use ipython tool
 * This should trigger .toolcall-ipython with actual execution
 */

import { KimiBridge } from './kimi-bridge.cjs';

const bridge = new KimiBridge({ cdpUrl: 'http://127.0.0.1:9222' });

async function test() {
  console.log('🔌 Conectando...');
  await bridge.connect();
  console.log('✅ Conectado\n');

  const userId = 'test-sandbox-real';
  const page = await bridge._getOrCreateUserPage(userId);

  // Force matplotlib execution — this REQUIRES Kimi sandbox
  const prompt = 'Execute código Python para gerar um gráfico de barras com matplotlib. Valores: [10, 25, 15, 30, 20]. Salve em /tmp/grafico_teste.png e mostre o gráfico.';
  console.log(`📤 Prompt: "${prompt}"\n`);

  let sandboxDetected = false;
  let codeExtracted = null;
  let resultExtracted = null;
  let imagesExtracted = [];

  try {
    const stream = bridge.sendMessageStream(userId, prompt, { mode: 'thinking' });

    for await (const event of stream) {
      const ts = new Date().toISOString().split('T')[1].slice(0, 8);

      if (event.type === 'action_detected') {
        sandboxDetected = true;
        codeExtracted = event.code;
        resultExtracted = event.kimiResult;
        imagesExtracted = event.kimiImages || [];
        console.log(`\n\x1b[1;33m[${ts}] ⚡ ACTION DETECTED\x1b[0m`);
        console.log(`   source: ${event.source}`);
        console.log(`   sandbox: ${event.action?.params?.command?.includes('PYEOF') ? 'YES' : 'NO'}`);
        console.log(`   code: ${event.code?.length} chars`);
        console.log(`   kimiResult: ${event.kimiResult?.length || 0} chars`);
        console.log(`   kimiImages: ${event.kimiImages?.length || 0}`);
        console.log(`   code preview:\n\x1b[36m${event.code?.slice(0, 200)}\x1b[0m`);
        if (event.kimiResult) {
          console.log(`   result preview:\n\x1b[35m${event.kimiResult?.slice(0, 200)}\x1b[0m`);
        }
      }

      if (event.type === 'done') {
        console.log(`\n\x1b[1;32m[${ts}] ✅ DONE\x1b[0m finalResponse=${event.response?.length}`);
      }
    }
  } catch (err) {
    console.error('\n\x1b[1;31m❌ ERRO:\x1b[0m', err.message);
  }

  // Direct DOM extraction after stream
  console.log('\n\x1b[90m--- Extração direta do DOM ---\x1b[0m');
  try {
    const blocks = await bridge._extractToolMirrorFromDOM(page);
    console.log(`Blocos encontrados: ${blocks.length}`);
    for (const b of blocks) {
      console.log(`\n  [${b.source}] sandbox=${b.sandboxExecution} lang=${b.language}`);
      console.log(`  code (${b.code.length} chars):\n  \x1b[36m${b.code.slice(0, 150)}\x1b[0m`);
      if (b.result) {
        console.log(`  result (${b.result.length} chars):\n  \x1b[35m${b.result.slice(0, 150)}\x1b[0m`);
      }
      if (b.images.length) {
        console.log(`  images: ${b.images.length}`);
        b.images.forEach((img, i) => console.log(`    [${i}] ${img.src?.slice(0, 80)}`));
      }
    }
  } catch (e) {
    console.error('Erro:', e.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('RESUMO');
  console.log('='.repeat(60));
  console.log(`Sandbox execution detectada: ${sandboxDetected ? '✅ SIM' : '❌ NÃO'}`);
  console.log(`Código extraído: ${codeExtracted ? '✅ SIM' : '❌ NÃO'} (${codeExtracted?.length || 0} chars)`);
  console.log(`Resultado extraído: ${resultExtracted ? '✅ SIM' : '❌ NÃO'} (${resultExtracted?.length || 0} chars)`);
  console.log(`Imagens extraídas: ${imagesExtracted.length}`);

  await bridge.disconnect();
  console.log('\n🔌 Desconectado.');
  process.exit(sandboxDetected ? 0 : 1);
}

test().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
