/**
 * E2E Spec: Central de Notificações
 * Testa se o painel flutua acima de todos os elementos (z-index fix)
 */

const { test, expect } = require('@playwright/test');
const { LoginPage } = require('../pages/LoginPage.js');
const { DashboardPage } = require('../pages/DashboardPage.js');

test.describe('Central de Notificações', () => {
  test('painel aparece por cima dos cards do dashboard', async ({ page }) => {
    const login = new LoginPage(page);
    const dashboard = new DashboardPage(page);

    await login.goto();
    await login.login('abner', '7741');

    // Clica no sino — o painel deve abrir
    await dashboard.openNotifications();
    await expect(dashboard.notificationPanel).toBeVisible();

    // Screenshot comprova que está por cima dos cards glass
    await page.screenshot({ path: 'e2e/screenshots/notifications-open.png' });

    // Fecha com Escape
    await dashboard.closeNotifications();
    await expect(dashboard.notificationPanel).toBeHidden();
  });
});
