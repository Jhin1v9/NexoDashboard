const { test, expect } = require('@playwright/test');

const RENDER_URL = 'https://nexodashboard.onrender.com';

test('Luna responde no chat do dashboard', async ({ page }) => {
  // 1. Login
  await page.goto(`${RENDER_URL}/login`);
  await page.fill('input[type="text"], input[name="username"]', 'abner');
  await page.fill('input[type="password"]', '7741');
  await page.click('button:has-text("Entrar"), button[type="submit"]');
  await page.waitForURL(/\/(dashboard|home)/, { timeout: 30000 });

  // 2. Abre o chat da Luna (clica no FAB ou no menu Luna)
  const lunaButton = page.locator('button, a, div').filter({ hasText: /Luna/i }).first();
  if (await lunaButton.isVisible().catch(() => false)) {
    await lunaButton.click();
  }

  // Alternativa: navegar direto para /luna
  await page.goto(`${RENDER_URL}/luna`);
  await page.waitForLoadState('networkidle');

  // 3. Espera o chat carregar
  const input = page.locator('input, textarea').filter({ has: page.locator(':visible') }).first();
  await expect(input).toBeVisible({ timeout: 15000 });

  // 4. Digita mensagem
  await input.fill('oi tudo bem');
  await input.press('Enter');

  // 5. Aguarda resposta (máximo 20s)
  await page.waitForTimeout(3000);

  // Verifica se há mensagem de resposta da Luna
  const lunaMessages = page.locator('text=/E aí|Oi|Opa|Luna|resposta/i');
  const count = await lunaMessages.count();
  console.log('Mensagens da Luna visíveis:', count);

  // Captura console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.log('CONSOLE ERROR:', msg.text());
    }
  });

  // Captura network errors
  const networkErrors = [];
  page.on('response', response => {
    const url = response.url();
    if (url.includes('/api/luna') && response.status() >= 400) {
      networkErrors.push({ url, status: response.status() });
      console.log('NETWORK ERROR:', url, response.status());
    }
  });

  await page.waitForTimeout(5000);

  // Screenshot
  await page.screenshot({ path: '/tmp/luna-chat-test.png', fullPage: true });
  console.log('📸 Screenshot:', '/tmp/luna-chat-test.png');
  console.log('Console errors:', consoleErrors.length);
  console.log('Network errors:', networkErrors.length);
});
