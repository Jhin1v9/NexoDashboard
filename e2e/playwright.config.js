/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Playwright E2E Config — NEXO Dashboard PRO
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * • Base URL: http://localhost:3457 (frontend Vite)
 * • API URL: http://localhost:3456 (backend Node)
 * • Browsers: Chromium (headless para CI, headed para dev)
 * • Parallel: 2 workers (evita conflito no banco)
 * • Screenshots/vídeos em falha
 * • Trace viewer para debug
 * ═══════════════════════════════════════════════════════════════════════════
 */

const { defineConfig, devices } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
  testDir: './specs',

  /* Roda 2 testes em paralelo (evita race condition no PG) */
  workers: 2,

  /* Falha rápido em CI, retry em dev */
  retries: process.env.CI ? 1 : 0,

  /* Reporter: lista bonita + HTML */
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],

  /* Shared settings para todos os projetos */
  use: {
    baseURL: 'http://localhost:3457',

    /* Tira screenshot em toda falha */
    screenshot: 'only-on-failure',

    /* Grava vídeo em falha */
    video: 'retain-on-failure',

    /* Ativa trace (timeline de rede/DOM/console para debug) */
    trace: 'retain-on-failure',

    /* Viewport padrão */
    viewport: { width: 1440, height: 900 },

    /* Timeout por ação (clicar, preencher, etc.) */
    actionTimeout: 10000,

    /* Timeout de navegação */
    navigationTimeout: 15000,
  },

  /* Projetos = browsers para testar */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Descomente para testar multi-browser:
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],

  /* Setup global: sobe backend + frontend antes dos testes */
  globalSetup: path.resolve(__dirname, 'setup', 'global-setup.js'),

  /* Teardown global: mata processos após os testes */
  globalTeardown: path.resolve(__dirname, 'setup', 'global-teardown.js'),

  /* Timeout total por teste */
  timeout: 60000,
});
