/**
 * E2E Spec: Captura de Leads (Demo Request)
 * Testa o fluxo completo: landing → formulário multi-step → dashboard
 *
 * Seletores baseados no DOM real do RegisterPage.jsx:
 * - Inputs: placeholder-based (sem name/id)
 * - Company size: botões toggle (não <select>)
 * - Confirmação: "Obrigado, {nome}!"
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
    companySize: '11-50 funcionários',
    message: 'Mensagem de teste E2E',
  };

  test('visitante preenche formulário e recebe confirmação', async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto();
    await landing.clickRegistrar();

    // ── Step 1: Dados pessoais ──
    await page.getByPlaceholder('Seu nome').fill(lead.name);
    await page.getByPlaceholder('voce@empresa.com').fill(lead.email);
    await page.getByPlaceholder('+34 600 000 000').fill(lead.phone);
    await page.getByRole('button', { name: /continuar/i }).click();

    // ── Step 2: Empresa ──
    await page.getByPlaceholder('Sua empresa').fill(lead.companyName);
    await page.getByText(lead.companySize).click();
    await page.getByPlaceholder(/Conte-nos sobre/).fill(lead.message);

    // Submete
    await page.getByRole('button', { name: /solicitar demo/i }).click();

    // Confirmação
    await expect(page.getByText(/Obrigado/)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Recebemos sua solicitação/)).toBeVisible();
  });

  test('lead aparece no dashboard após envio', async ({ page }) => {
    // 1. Admin faz login
    const login = new LoginPage(page);
    await login.goto();
    await login.login('abner', '7741');

    // 2. Navega para Leads
    await page.getByText(/Leads/i).first().click();
    await page.waitForURL(/\/leads|dashboard/, { timeout: 10000 });

    // 3. Verifica que o lead do teste anterior aparece
    await expect(page.getByText(lead.name).first()).toBeVisible({ timeout: 5000 });
  });
});
