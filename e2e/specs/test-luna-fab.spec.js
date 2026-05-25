const { test, expect } = require('@playwright/test');

const RENDER_URL = 'https://nexodashboard.onrender.com';

test('Luna FAB chat responde', async ({ page }) => {
  const consoleErrors = [];
  const networkErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.log('🚨 CONSOLE ERROR:', msg.text());
    }
  });
  page.on('response', response => {
    const url = response.url();
    if (url.includes('/api/luna') && response.status() >= 400) {
      networkErrors.push({ url: url.replace(/token=[^&]+/g, 'token=...'), status: response.status() });
      console.log('🌐 NETWORK ERROR:', url.replace(/token=[^&]+/g, 'token=...'), response.status());
    }
  });

  // 1. Login
  await page.goto(`${RENDER_URL}/login`);
  await page.locator('input').first().fill('abner');
  await page.fill('input[type="password"]', '7741');
  await page.click('button').filter({ hasText: /Entrar/i }).first();
  await page.waitForURL(/\/(dashboard|home)/, { timeout: 30000 });

  // 2. Clica no FAB flutuante (botão circular no canto inferior direito)
  console.log('🌙 Clicando no FAB...');
  // O FAB é geralmente um botão fixo no canto inferior direito
  const fab = page.locator('button').filter({ has: page.locator('svg, img, .iconify') }).last();
  await fab.click();
  await page.waitForTimeout(1000);

  // Tira screenshot do chat panel
  await page.screenshot({ path: '/tmp/luna-fab-step1.png' });

  // 3. Procura input de mensagem no chat panel
  const chatInput = page.locator('input[placeholder*="mensagem" i], textarea[placeholder*="mensagem" i], input[type="text"]').last();
  await chatInput.fill('oi luna');
  await chatInput.press('Enter');
  console.log('💬 Mensagem enviada no FAB chat');

  // 4. Aguarda resposta
  await page.waitForTimeout(8000);
  await page.screenshot({ path: '/tmp/luna-fab-step2-resposta.png', fullPage: true });

  const pageContent = await page.content();
  const hasReply = /Oi!|Opa|Tô por aqui|Luna/i.test(pageContent);
  console.log('📝 Resposta da Luna?', hasReply);
  console.log('🚨 Console errors:', consoleErrors.length);
  console.log('🌐 Network errors:', networkErrors.length);
});
