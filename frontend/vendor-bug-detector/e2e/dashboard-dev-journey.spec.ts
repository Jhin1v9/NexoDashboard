import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.describe('BugDetector Cloud - Jornada do Dev', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.header h1')).toContainText('BugDetector Cloud');
  });

  test('dev acessa dashboard, vê stats e expande um report rico', async ({ page }) => {
    await expect(page.locator('.stat-pill').nth(0)).toContainText('Total');
    await expect(page.locator('.stat-pill').nth(1)).toContainText('Pendentes');
    await expect(page.locator('.stat-pill').nth(2)).toContainText('Resolvidos');

    const firstCard = page.locator('.card').first();
    await expect(firstCard.locator('.card-title')).toContainText('Botão de pagamento');
    await expect(firstCard.locator('.severity')).toContainText('high');

    await firstCard.locator('.toggle-btn').click();
    await expect(firstCard.locator('.details')).toBeVisible();

    const tabs = ['Visão geral', 'Mídia', 'Técnico', 'Performance', 'IA'];
    for (const tabLabel of tabs) {
      await expect(firstCard.locator('.tab', { hasText: new RegExp(`^${tabLabel}`) })).toBeVisible();
    }
  });

  test('dev navega pela aba Visão geral e vê dados do dispositivo', async ({ page }) => {
    const firstCard = page.locator('.card').first();
    await firstCard.locator('.toggle-btn').click();

    await expect(firstCard.locator('.tab.active')).toContainText('Visão geral');
    await expect(firstCard.locator('.detail-block', { hasText: 'URL' })).toContainText('https://loja-demo.com/checkout');
    await expect(firstCard.locator('.detail-block', { hasText: 'Dispositivo' })).toContainText('Android');
    await expect(firstCard.locator('.detail-block', { hasText: 'Dispositivo' })).toContainText('Chrome');
  });

  test('dev abre a aba Mídia e vê screenshot + session replay', async ({ page }) => {
    const firstCard = page.locator('.card').first();
    await firstCard.locator('.toggle-btn').click();

    await firstCard.locator('.tab', { hasText: /^Mídia/ }).click();
    await expect(firstCard.locator('.media-label', { hasText: 'Screenshot' })).toBeVisible();
    await expect(firstCard.locator('.media-label', { hasText: 'Session Replay' })).toBeVisible();

    await firstCard.locator('.media-card').first().click();
    await expect(page.locator('.lightbox')).toBeVisible();

    await page.locator('.lightbox-close').click();
    await expect(page.locator('.lightbox')).not.toBeVisible();
  });

  test('dev abre a aba Técnico e analisa console logs e network requests', async ({ page }) => {
    const firstCard = page.locator('.card').first();
    await firstCard.locator('.toggle-btn').click();

    await firstCard.locator('.tab', { hasText: /^Técnico/ }).click();

    await expect(firstCard.locator('text=Console logs (4)')).toBeVisible();
    await expect(firstCard.locator('.console-line.error')).toContainText('TypeError: Cannot read properties of undefined');

    await expect(firstCard.locator('text=Network requests (4)')).toBeVisible();
    await expect(firstCard.locator('.data-table tbody tr')).toHaveCount(4);

    const errRow = firstCard.locator('.data-table tbody tr').filter({ hasText: 'payment/intent' });
    await expect(errRow.locator('.status')).toContainText('ERR');

    await firstCard.locator('.copy-btn').click();
    await expect(firstCard.locator('.copy-btn')).toContainText('Copiar');
  });

  test('dev abre a aba Performance e vê métricas de load', async ({ page }) => {
    const firstCard = page.locator('.card').first();
    await firstCard.locator('.toggle-btn').click();

    await firstCard.locator('.tab', { hasText: /^Performance/ }).click();
    await expect(firstCard.locator('.perf-label', { hasText: 'Load time' })).toBeVisible();
    await expect(firstCard.locator('.perf-value').first()).toContainText('1240');
    await expect(firstCard.locator('.perf-label', { hasText: 'Largest Contentful Paint' })).toBeVisible();
  });

  test('dev abre a aba IA, lê análise e copia código corrigido', async ({ page }) => {
    const firstCard = page.locator('.card').first();
    await firstCard.locator('.toggle-btn').click();

    await firstCard.locator('.tab', { hasText: /^IA/ }).click();
    await expect(firstCard.locator('text=Análise da IA')).toBeVisible();
    await expect(firstCard.locator('.detail-block', { hasText: 'Causa raiz' })).toContainText('undefined');

    const codeBlock = firstCard.locator('.code-block').filter({ hasText: 'handlePayment' });
    await expect(codeBlock).toContainText('paymentConfig?.token');

    await codeBlock.locator('.copy-btn').click();
  });

  test('dev marca um report como resolvido e atualiza os stats', async ({ page, request }) => {
    // Garante estado inicial: pega o ID do primeiro report e reseta para pending
    let res = await request.get('/api/reports');
    const reports = await res.json();
    const rich = reports.find((r: any) => r.description?.includes('pagamento'));
    expect(rich).toBeDefined();

    await request.patch(`/api/reports/${rich.id}/status`, { data: { status: 'pending' } });
    await page.reload();

    const firstCard = page.locator('.card').first();
    await expect(firstCard.locator('.card-meta')).toContainText('Pendente');

    // Guarda os valores de stats antes da ação
    const resolvedBeforeText = await page.locator('.stat-pill').nth(2).textContent();
    const resolvedBefore = parseInt(resolvedBeforeText?.match(/\d+/)?.[0] || '0', 10);

    await firstCard.locator('.icon-btn.resolve').click();
    await expect(firstCard.locator('.card-meta')).toContainText('Resolvido');

    // Stats atualizam: pendentes zeram e resolvidos aumentam em 1
    await expect(page.locator('.stat-pill').nth(1)).toContainText('Pendentes 0');
    await expect(page.locator('.stat-pill').nth(2)).toContainText(`Resolvidos ${resolvedBefore + 1}`);
  });

  test('dev filtra reports por status e busca por texto', async ({ page, request }) => {
    // Garante estado inicial conhecido: 1 pendente (rich report)
    let res = await request.get('/api/reports');
    const reports = await res.json();
    const rich = reports.find((r: any) => r.description?.includes('pagamento'));
    if (rich) {
      await request.patch(`/api/reports/${rich.id}/status`, { data: { status: 'pending' } });
    }
    await page.reload();

    const totalBefore = await page.locator('.stat-pill').nth(0).textContent().then(t => parseInt(t?.match(/\d+/)?.[0] || '0', 10));

    // Filtro Pendentes
    await page.locator('.filter-btn', { hasText: 'Pendentes' }).click();
    let visibleCards = page.locator('.card');
    await expect(visibleCards).toHaveCount(1);
    await expect(visibleCards.first().locator('.card-title')).toContainText('Botão de pagamento');

    // Filtro Resolvidos
    await page.locator('.filter-btn', { hasText: 'Resolvidos' }).click();
    visibleCards = page.locator('.card');
    // Pode ter 0 ou mais dependendo do histórico; apenas validamos que não mostra o pendente
    const resolvedCount = await visibleCards.count();
    if (resolvedCount > 0) {
      await expect(visibleCards.first().locator('.card-title')).not.toContainText('Botão de pagamento');
    }

    // Busca por "checkout"
    await page.locator('.filter-btn', { hasText: 'Todos' }).click();
    await page.locator('.search').fill('checkout');
    visibleCards = page.locator('.card');
    await expect(visibleCards).toHaveCount(1);
    await expect(visibleCards.first().locator('.card-title')).toContainText('checkout');

    // Limpa busca
    await page.locator('.search').fill('');
    await expect(page.locator('.card')).toHaveCount(totalBefore);
  });
});
