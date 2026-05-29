/**
 * Real-time DOM observer for Kimi sandbox execution
 * Polls the DOM every 2s and prints what it sees until execution completes.
 */

import { chromium } from 'playwright';

const CDP_URL = 'http://127.0.0.1:9222';

async function observe() {
  console.log('🔌 Conectando ao Chrome...');
  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0];
  const page = context.pages().find(p => p.url().includes('kimi.com'));

  if (!page) {
    console.log('❌ Nenhuma página da Kimi encontrada');
    process.exit(1);
  }

  console.log(`🌐 Página atual: ${page.url()}`);

  // Navigate to new chat
  await page.goto('https://www.kimi.com/?chat_enter_method=new_chat');
  await page.waitForTimeout(3000);

  // Send prompt
  const prompt = 'Execute código Python para gerar um gráfico de barras com matplotlib. Valores: [10, 25, 15, 30, 20]. Salve em /tmp/grafico_teste.png e mostre o gráfico.';
  console.log(`\n📤 Enviando: ${prompt}\n`);

  const input = page.locator('textarea, [contenteditable="true"]').first();
  await input.fill(prompt);
  await page.waitForTimeout(300);
  await input.press('Enter');

  // Poll DOM every 2 seconds for up to 3 minutes
  console.log('⏳ Observando DOM em tempo real (poll a cada 2s, max 3min)...\n');

  const startTime = Date.now();
  const maxDuration = 3 * 60 * 1000; // 3 minutes
  let pollCount = 0;
  let lastState = '';

  while (Date.now() - startTime < maxDuration) {
    await page.waitForTimeout(2000);
    pollCount++;

    const state = await page.evaluate(() => {
      const last = document.querySelector('.segment-assistant');
      if (!last) return { error: 'no segment' };

      const toolcalls = [];
      last.querySelectorAll('.toolcall-container').forEach((tc, i) => {
        const title = tc.querySelector('.toolcall-title-name-text');
        const running = tc.querySelector('.running-text');
        toolcalls.push({
          index: i,
          className: tc.className,
          title: title?.innerText || running?.innerText || 'no title',
          hasImages: tc.querySelectorAll('img').length,
        });
      });

      const codeBlocks = [];
      last.querySelectorAll('.segment-code').forEach((b, i) => {
        const lang = b.querySelector('.segment-code-lang')?.innerText || 'unknown';
        const text = b.querySelector('.segment-code-content, pre, code')?.innerText?.slice(0, 150);
        codeBlocks.push({ index: i, lang, text });
      });

      const images = [];
      last.querySelectorAll('img').forEach((img, i) => {
        if (img.src && !img.src.includes('avatar')) {
          images.push({ index: i, src: img.src.slice(0, 100), alt: img.alt });
        }
      });

      const hasSpinner = !!last.querySelector('.running-text, [class*="running"]');
      const hasIpython = !!last.querySelector('.toolcall-ipython');

      return { toolcalls, codeBlocks, images, hasSpinner, hasIpython };
    });

    // Only print if state changed
    const stateStr = JSON.stringify(state);
    if (stateStr !== lastState) {
      lastState = stateStr;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\n[⏱️ ${elapsed}s | poll #${pollCount}]`);
      console.log(`  🛠️ toolcalls: ${state.toolcalls.length}`);
      state.toolcalls.forEach(tc => {
        console.log(`    [${tc.index}] "${tc.title}" | class=${tc.className.slice(0, 60)} | images=${tc.hasImages}`);
      });
      console.log(`  📦 codeBlocks: ${state.codeBlocks.length}`);
      state.codeBlocks.forEach(cb => {
        console.log(`    [${cb.index}] lang=${cb.lang} | text="${cb.text?.slice(0, 80)}..."`);
      });
      console.log(`  🖼️ images: ${state.images.length}`);
      state.images.forEach(img => {
        console.log(`    [${img.index}] src=${img.src.slice(0, 60)}`);
      });
      console.log(`  🔄 hasSpinner: ${state.hasSpinner} | hasIpython: ${state.hasIpython}`);

      // Stop if no spinner and we have toolcalls (execution complete)
      if (!state.hasSpinner && state.toolcalls.length > 0 && state.codeBlocks.length > 0) {
        console.log('\n✅ Execução completa detectada!');
        break;
      }
    }
  }

  // Final deep extraction
  console.log('\n🔍 EXTRAÇÃO FINAL DO DOM:');
  const final = await page.evaluate(() => {
    const last = document.querySelector('.segment-assistant');
    if (!last) return null;

    const results = [];
    const seen = new Set();

    last.querySelectorAll('.segment-code').forEach(block => {
      const lang = block.querySelector('.segment-code-lang')?.innerText?.toLowerCase() || '';
      const content = block.querySelector('.segment-code-content, pre, code')?.innerText?.trim();
      if (!content || seen.has(content)) return;
      seen.add(content);

      const isInsideToolcall = !!block.closest('.toolcall-container');

      results.push({
        lang,
        text: content,
        isInsideToolcall,
      });
    });

    // Images
    const images = [];
    last.querySelectorAll('.ipython-images-container img, .toolcall-container img').forEach(img => {
      if (img.src && !img.src.includes('avatar')) {
        images.push({ src: img.src, alt: img.alt });
      }
    });

    return { results, images, html: last.innerHTML?.slice(0, 2000) };
  });

  console.log(JSON.stringify(final, null, 2)?.slice(0, 5000));

  await browser.disconnect();
  console.log('\n🔌 Desconectado.');
}

observe().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
