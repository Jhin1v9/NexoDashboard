const { test, expect } = require('@playwright/test');

const RENDER_URL = 'https://nexodashboard.onrender.com';

test('Debug Luna no frontend', async ({ page }) => {
  const logs = [];
  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`;
    logs.push(text);
    console.log(text);
  });
  page.on('pageerror', err => {
    const text = `[PAGEERROR] ${err.message}`;
    logs.push(text);
    console.log(text);
  });

  // 1. Login
  await page.goto(`${RENDER_URL}/login`, { waitUntil: 'networkidle' });
  await page.waitForSelector('input[name="username"], input[type="text"]', { timeout: 15000 });
  await page.fill('input[name="username"], input[type="text"]', 'abner');
  await page.fill('input[type="password"]', '7741');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|home)/, { timeout: 30000 });

  // 2. Clica no FAB da Luna
  await page.waitForTimeout(2000);
  const fab = page.locator('button').last();
  if (await fab.isVisible()) await fab.click();

  await page.waitForTimeout(3000);

  // 3. Tenta clicar na aba Chat se estiver na página /luna
  const chatTab = page.locator('text=Chat').first();
  if (await chatTab.isVisible().catch(() => false)) {
    await chatTab.click();
    await page.waitForTimeout(1000);
  }

  // 4. Tenta preencher input e enviar
  const input = page.locator('input, textarea').last();
  if (await input.isVisible().catch(() => false)) {
    await input.fill('oi luna');
    await input.press('Enter');
    await page.waitForTimeout(5000);
  }

  // Screenshot
  await page.screenshot({ path: '/tmp/luna-debug.png', fullPage: true });

  // Salva logs
  require('fs').writeFileSync('/tmp/luna-debug-logs.txt', logs.join('\n'));
  console.log('\n📸 Screenshot: /tmp/luna-debug.png');
  console.log('📝 Logs: /tmp/luna-debug-logs.txt');
});
