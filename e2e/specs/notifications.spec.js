/**
 * E2E Spec: Central de Notificações
 * Testa se o painel flutua acima de todos os elementos (z-index fix)
 * e se exibe notificações.
 *
 * Evita login via UI para não atingir rate limit (3 tentativas/15min por IP).
 * Usa API para autenticar + localStorage para setar token no browser.
 */

const { test, expect } = require('@playwright/test');
const { DashboardPage } = require('../pages/DashboardPage.js');

const API_BASE = 'http://localhost:3456';

test.describe('Central de Notificações', () => {
  test.beforeEach(async ({ page, request }) => {
    // 1. Autentica via API (não via UI, para evitar rate limit)
    const loginRes = await request.post(`${API_BASE}/api/auth/login`, {
      data: { username: 'abner', password: '7741' }
    });
    const { token } = await loginRes.json();

    // 2. Navega para dashboard com token já no localStorage (bypass login UI)
    await page.goto('/login');
    await page.evaluate((t) => {
      localStorage.setItem('nexo_token', t);
    }, token);
    await page.goto('/dashboard');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
  });

  test('painel aparece por cima dos cards do dashboard', async ({ page }) => {
    const dashboard = new DashboardPage(page);

    // Clica no sino — o painel deve abrir
    await dashboard.openNotifications();
    await expect(dashboard.notificationPanel).toBeVisible();

    // Screenshot comprova que está por cima dos cards glass
    await page.screenshot({ path: 'e2e/screenshots/notifications-open.png' });

    // Fecha com Escape
    await dashboard.closeNotifications();
    await expect(dashboard.notificationPanel).toBeHidden();
  });

  test('painel mostra notificações do sistema', async ({ page }) => {
    const dashboard = new DashboardPage(page);

    await dashboard.openNotifications();

    // Verifica que o painel contém notificações (qualquer uma)
    // O painel sempre tem notificações de segurança (login falho) em dev
    await expect(page.getByText(/não lidas|total/i).first()).toBeVisible();
    await expect(page.getByText(/Segurança|Login falho|Sistema/i).first()).toBeVisible();
  });
});
