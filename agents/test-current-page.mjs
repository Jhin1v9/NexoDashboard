/**
 * Inspect the CURRENT Kimi page (user's active session)
 * where sandbox execution is happening RIGHT NOW.
 */

import { chromium } from 'playwright';

async function inspect() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];

  // Find the page with the active Kimi chat (the one with the latest activity)
  let targetPage = null;
  let latestTime = 0;

  for (const page of context.pages()) {
    if (page.url().includes('kimi.com')) {
      // Check if this page has a .toolcall-ipython (active execution)
      const hasIpython = await page.evaluate(() => !!document.querySelector('.toolcall-ipython')).catch(() => false);
      if (hasIpython) {
        targetPage = page;
        break;
      }
      // Fallback: use the page with the most recent URL
      const urlTime = Date.now(); // simplified
      if (urlTime > latestTime) {
        latestTime = urlTime;
        targetPage = page;
      }
    }
  }

  if (!targetPage) {
    console.log('❌ Nenhuma página da Kimi encontrada');
    process.exit(1);
  }

  console.log(`🌐 Página: ${targetPage.url()}`);

  // Deep inspection
  const inspection = await targetPage.evaluate(() => {
    const last = document.querySelector('.segment-assistant:last-of-type') ||
                 document.querySelector('.segment-assistant');
    if (!last) return { error: 'no segment' };

    // Toolcalls
    const toolcalls = [];
    last.querySelectorAll('.toolcall-container').forEach((tc, i) => {
      const title = tc.querySelector('.toolcall-title-name-text, .running-text');
      const content = tc.querySelector('.toolcall-content');
      const codeInContent = content?.querySelector('pre, code')?.innerText?.slice(0, 300);
      const contentText = content?.innerText?.slice(0, 300);
      const imgs = [];
      tc.querySelectorAll('img').forEach(img => {
        if (img.src && !img.src.includes('avatar') && !img.src.includes('statics.moonshot')) {
          imgs.push(img.src.slice(0, 150));
        }
      });
      toolcalls.push({
        index: i,
        title: title?.innerText || 'no title',
        className: tc.className,
        codeInContent,
        contentText,
        images: imgs,
      });
    });

    // Segment-code blocks
    const codeBlocks = [];
    last.querySelectorAll('.segment-code').forEach((b, i) => {
      const lang = b.querySelector('.segment-code-lang')?.innerText;
      const text = b.querySelector('.segment-code-content, pre, code')?.innerText?.slice(0, 200);
      codeBlocks.push({ index: i, lang, text });
    });

    // All images
    const allImages = [];
    last.querySelectorAll('img').forEach((img, i) => {
      if (img.src && !img.src.includes('avatar') && !img.src.includes('statics.moonshot')) {
        allImages.push({ index: i, src: img.src.slice(0, 150), alt: img.alt });
      }
    });

    return { toolcalls, codeBlocks, allImages };
  });

  console.log('\n=== INSPEÇÃO DA PÁGINA ATUAL ===');
  console.log(JSON.stringify(inspection, null, 2));

  // Now test our extraction function
  console.log('\n=== TESTANDO _extractToolMirrorFromDOM ===');

  // We need to use the bridge's method... let's inline it
  const extracted = await targetPage.evaluate(() => {
    const results = [];
    const seen = new Set();
    const lastAssistant = document.querySelector('.segment-assistant:last-of-type') ||
                          document.querySelector('.segment-assistant');
    if (!lastAssistant) return results;

    // Strategy A: Sandbox execution blocks
    lastAssistant.querySelectorAll('.toolcall-container.default.toolcall-ipython').forEach(container => {
      const content = container.querySelector('.toolcall-content');
      if (!content) return;
      let codeText = '';
      const pre = content.querySelector('pre');
      const codeEl = content.querySelector('code');
      if (pre) codeText = pre.innerText.trim();
      else if (codeEl) codeText = codeEl.innerText.trim();
      else codeText = content.innerText.trim();

      if (!codeText || codeText.length < 5 || seen.has(codeText)) return;
      seen.add(codeText);

      const images = [];
      container.querySelectorAll('img').forEach(img => {
        if (img.src && !img.src.includes('avatar.moonshot.cn') && !img.src.includes('statics.moonshot.cn')) {
          images.push({ src: img.src, alt: img.alt || '' });
        }
      });

      let resultText = '';
      const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, null);
      let node;
      while ((node = walker.nextNode())) {
        const text = node.textContent.trim();
        if (text && text.length > 3 && !codeText.includes(text)) {
          resultText += text + '\n';
        }
      }

      results.push({ code: codeText, result: resultText.trim(), images, source: 'kimi-sandbox' });
    });

    // Strategy B: segment-code blocks
    lastAssistant.querySelectorAll('.segment-code').forEach(block => {
      const langEl = block.querySelector('.segment-code-lang');
      const lang = langEl ? langEl.innerText.toLowerCase() : '';
      if (lang.includes('plain')) return;
      const contentEl = block.querySelector('.segment-code-content, pre, code');
      if (!contentEl) return;
      const text = contentEl.innerText.trim();
      if (!text || text.length < 5 || seen.has(text)) return;
      seen.add(text);
      results.push({ code: text, result: '', images: [], source: 'kimi-text' });
    });

    return results;
  });

  console.log(JSON.stringify(extracted, null, 2));

  await browser.disconnect();
  console.log('\n🔌 Desconectado.');
}

inspect().catch(console.error);
