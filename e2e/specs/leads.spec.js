/**
 * E2E Spec: Captura de Leads (Demo Request)
 * Testa o fluxo completo: landing → formulário → dashboard
 */

const { test, expect } = require('@playwright/test');
const { LandingPage } = require('../pages/LandingPage.js');
const { LoginPage } = require('../pages/LoginPage.js');

test.describe('Lead Capture (Demo Request)', () => {
  const lead = {
    name: 'Empresa Teste E2E',
    email: `e2e-${Date.now()}@nexo.com`,
    phone: '+351 900 000 000',
    companyName: 'TestCorp E2E',
    companySize: '11-50',
    message: 'Mensagem de teste E2E',
  };

  test('visitante preenche formulário e recebe confirmação', async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto();
    await landing.clickRegistrar();

    // Step 1: Dados pessoais
    await page.locator('input[name="name"], input[placeholder*="nome"]').first().fill(lead.name);
    await page.locator('input[name="email"], input[type="email"]').first().fill(lead.email);
    await page.locator('input[name="phone"], input[type="tel"]').first().fill(lead.phone);
    await page.locator('button', { hasText: /próximo|continuar|next/i }).first().click();

    // Step 2: Empresa
    await page.locator('input[name="companyName"], input[placeholder*="empresa"]').first().fill(lead.companyName);
    await page.locator('select[name="companySize"]').first().selectOption(lead.companySize);
    await page.locator('textarea[name="message"], textarea[placeholder*="mensagem"]').first().fill(lead.message);
    await page.locator('button', { hasText: /enviar|solicitar|submit/i }).first().click();

    // Confirmação
    await expect(page.locator('text=/obrigado|sucesso|confirm/i')).toBeVisible({ timeout: 10000 });
  });

  test('lead aparece no dashboard após envio', async ({ page }) => {
    // 1. Admin faz login
    const login = new LoginPage(page);
    await login.goto();
    await login.login('abner', '7741');

    // 2. Navega para Leads
    await page.click('text=Leads');
    await page.waitForURL(/\/leads|dashboard/, { timeout: 10000 });

    // 3. Verifica que o lead do teste anterior aparece
    await expect(page.locator(`text=${lead.name}`).first()).toBeVisible({ timeout: 5000 });
  });
});
