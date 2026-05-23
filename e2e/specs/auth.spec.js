/**
 * E2E Spec: Autenticação
 * Testa login, logout e proteção de rotas
 */

const { test, expect } = require('@playwright/test');
const { LoginPage } = require('../pages/LoginPage.js');

test.describe('Autenticação', () => {
  test('usuário faz login com credenciais válidas', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login('abner', '7741');

    // Deve estar no dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    // Verifica elemento característico do dashboard (header com nome do usuário)
    await expect(page.locator('text=Abner').first()).toBeVisible();
  });

  test('usuário permanece na página de login com credenciais inválidas', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.usernameInput.fill('abner');
    await login.passwordInput.fill('senha-errada');
    await login.submitButton.click();

    // Deve permanecer na página de login
    await expect(page).toHaveURL(/\/login/);
    // O botão de submit ainda deve estar visível
    await expect(login.submitButton).toBeVisible();
  });

  test('rota protegida redireciona para login quando não autenticado', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page.locator('text=Entrar')).toBeVisible();
  });
});
