#!/usr/bin/env node
/**
 * NEXO Dashboard — E2E Smoke Test + Relatório
 * Usa Playwright para navegar em todas as páginas e capturar erros.
 *
 * ⚠️  Este script contém credenciais de teste. Deve ser executado apenas com NODE_ENV=test.
 */

if (process.env.NODE_ENV !== 'test') {
  console.error('❌ Este script de teste só pode ser executado com NODE_ENV=test');
  process.exit(1);
}

const { chromium } = require('playwright');
const fs = require('fs');

const BASE_URL = 'http://localhost:3457';
const API_URL = 'http://localhost:3456';

const CREDENTIALS = { username: 'abner', password: '7741' };

const PAGES = [
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/tarefas', name: 'Tarefas' },
  { path: '/leads', name: 'Leads' },
  { path: '/financeiro', name: 'Financeiro' },
  { path: '/financeiro/caixa', name: 'Caixa' },
  { path: '/financeiro/gastos', name: 'Gastos' },
  { path: '/ideias', name: 'Ideias' },
  { path: '/orcamentos', name: 'Orçamentos' },
  { path: '/clientes', name: 'Clientes' },
  { path: '/projetos', name: 'Projetos' },
  { path: '/whatsapp', name: 'WhatsApp' },
  { path: '/email', name: 'Email' },
  { path: '/relatorios', name: 'Relatórios' },
  { path: '/github', name: 'GitHub' },
  { path: '/vercel', name: 'Vercel' },
  { path: '/ferramentas', name: 'Ferramentas' },
  { path: '/luna', name: 'Luna' },
  { path: '/sistema', name: 'Sistema' },
  { path: '/settings', name: 'Configurações' },
  { path: '/seguranca', name: 'Segurança' },
  { path: '/changelog', name: 'Changelog' },
];

const API_TESTS = [
  { endpoint: '/api/health', method: 'GET', auth: false },
  { endpoint: '/api/auth/me', method: 'GET', auth: true },
  { endpoint: '/api/tasks', method: 'GET', auth: true },
  { endpoint: '/api/tasks/stats', method: 'GET', auth: true },
  { endpoint: '/api/leads', method: 'GET', auth: true },
  { endpoint: '/api/cash-box', method: 'GET', auth: true },
  { endpoint: '/api/cash-box/statement', method: 'GET', auth: true },
  { endpoint: '/api/finance/summary', method: 'GET', auth: true },
  { endpoint: '/api/finance/transactions', method: 'GET', auth: true },
  { endpoint: '/api/links', method: 'GET', auth: true },
  { endpoint: '/api/notifications', method: 'GET', auth: true },
  { endpoint: '/api/users', method: 'GET', auth: true },
  { endpoint: '/api/whatsapp/history', method: 'GET', auth: true },
  { endpoint: '/api/ideas', method: 'GET', auth: false },
  { endpoint: '/api/ideas/stats', method: 'GET', auth: true },
  { endpoint: '/api/changelog', method: 'GET', auth: false },
  { endpoint: '/api/changelog/latest', method: 'GET', auth: false },
  { endpoint: '/api/changelog/unread', method: 'GET', auth: true },
  { endpoint: '/api/luna/dashboard-state', method: 'GET', auth: true },
  { endpoint: '/api/system/status', method: 'GET', auth: true },
  { endpoint: '/api/whatsapp/status', method: 'GET', auth: true },
  { endpoint: '/api/agents/status', method: 'GET', auth: true },
  { endpoint: '/api/payments', method: 'GET', auth: true },
  { endpoint: '/api/quotes', method: 'GET', auth: true },
  { endpoint: '/api/expenses', method: 'GET', auth: true },
  { endpoint: '/api/members', method: 'GET', auth: true },
  { endpoint: '/api/security-logs', method: 'GET', auth: true },
  { endpoint: '/api/luna/threads', method: 'GET', auth: true },
  { endpoint: '/api/workspace/servers', method: 'GET', auth: true },
  { endpoint: '/api/dashboard/summary', method: 'GET', auth: true },
  { endpoint: '/api/dashboard/metrics', method: 'GET', auth: true },
  { endpoint: '/api/analytics/overview', method: 'GET', auth: true },
  { endpoint: '/api/kpi', method: 'GET', auth: true },
  { endpoint: '/api/security/settings', method: 'GET', auth: true },
  { endpoint: '/api/finance/categories', method: 'GET', auth: true },
  { endpoint: '/api/tasks/categories', method: 'GET', auth: true },
];

async function run() {
  console.log('🚀 Iniciando testes E2E do NEXO Dashboard...\n');

  const report = {
    timestamp: new Date().toISOString(),
    pages: [],
    api: [],
    summary: { passed: 0, failed: 0, warnings: 0 }
  };

  let token = null;

  // ── 1. Testes de API diretos ────────────────────────────────────────────
  console.log('📡 Testando APIs diretamente...');

  // Login para pegar token
  try {
    const loginRes = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(CREDENTIALS)
    });
    const loginData = await loginRes.json();
    if (loginData.success) token = loginData.token;
  } catch (e) {
    console.log('   ⚠️ Login API falhou:', e.message);
  }

  for (const test of API_TESTS) {
    const url = `${API_URL}${test.endpoint}`;
    const headers = { 'Content-Type': 'application/json' };
    if (test.auth && token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await fetch(url, { method: test.method, headers });
      const text = await res.text();
      const ok = res.ok;
      const entry = {
        endpoint: test.endpoint,
        method: test.method,
        status: res.status,
        ok,
        error: ok ? null : text.slice(0, 200)
      };
      report.api.push(entry);
      if (ok) report.summary.passed++; else report.summary.failed++;
      process.stdout.write(ok ? '✅' : '💥');
    } catch (e) {
      report.api.push({ endpoint: test.endpoint, method: test.method, status: 0, ok: false, error: e.message });
      report.summary.failed++;
      process.stdout.write('💥');
    }
  }
  console.log('\n');

  // ── 2. Testes E2E com Playwright ────────────────────────────────────────
  console.log('🎭 Iniciando Playwright...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  const consoleErrors = [];
  const networkErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push({ url: page.url(), text: msg.text() });
    }
  });

  page.on('response', res => {
    if (res.status() >= 400) {
      networkErrors.push({ url: res.url(), status: res.status() });
    }
  });

  // Login
  console.log('   🔐 Fazendo login...');
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="username"]', CREDENTIALS.username);
  await page.fill('input[name="password"]', CREDENTIALS.password);
  await page.click('button:has-text("Entrar")');
  await page.waitForURL('**/dashboard', { timeout: 10000 });

  // Navegar por todas as páginas
  for (const p of PAGES) {
    process.stdout.write(`   📄 ${p.name}... `);
    try {
      await page.goto(`${BASE_URL}${p.path}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(500); // espera renderização final

      const errors = consoleErrors.filter(e => e.url.includes(p.path));
      const netErrors = networkErrors.filter(e => e.url.includes('/api/'));

      const entry = {
        name: p.name,
        path: p.path,
        ok: netErrors.filter(e => e.status >= 500).length === 0,
        consoleErrors: errors.length,
        networkErrors: netErrors.filter(e => e.status >= 500).length,
        network4xx: netErrors.filter(e => e.status >= 400 && e.status < 500).length
      };
      report.pages.push(entry);

      if (entry.ok && entry.consoleErrors === 0) {
        report.summary.passed++;
        process.stdout.write('✅\n');
      } else {
        report.summary.warnings++;
        process.stdout.write(`⚠️ (${entry.networkErrors} net, ${entry.consoleErrors} console)\n`);
      }
    } catch (e) {
      report.pages.push({ name: p.name, path: p.path, ok: false, error: e.message });
      report.summary.failed++;
      process.stdout.write(`💥 ${e.message.slice(0, 60)}\n`);
    }
  }

  // ── 3. Testes de interação (criar dados) ────────────────────────────────
  console.log('\n📝 Testando criação de dados via frontend...');

  // Criar tarefa
  try {
    await page.goto(`${BASE_URL}/tarefas`, { waitUntil: 'networkidle' });
    // Tenta encontrar botão de adicionar tarefa
    const addBtn = await page.locator('button:has-text("Nova"), button:has-text("Adicionar"), button:has-text("+"), [data-testid="add-task"]').first();
    if (await addBtn.isVisible().catch(() => false)) {
      await addBtn.click();
      await page.fill('input[placeholder*="título" i], input[name="title"]', 'Tarefa E2E Test');
      await page.click('button:has-text("Salvar"), button:has-text("Criar")');
      await page.waitForTimeout(1000);
      report.summary.passed++;
      console.log('   ✅ Criar tarefa');
    } else {
      console.log('   ⚠️ Botão de criar tarefa não encontrado');
    }
  } catch (e) {
    report.summary.failed++;
    console.log('   💥 Criar tarefa:', e.message);
  }

  // Criar ideia
  try {
    await page.goto(`${BASE_URL}/ideias/nova`, { waitUntil: 'networkidle' });
    await page.fill('input[placeholder*="título" i], input[name="title"]', 'Ideia E2E Test');
    await page.selectOption('select[name="type"]', 'feature');
    await page.click('button:has-text("Salvar"), button:has-text("Criar")');
    await page.waitForTimeout(1000);
    report.summary.passed++;
    console.log('   ✅ Criar ideia');
  } catch (e) {
    report.summary.failed++;
    console.log('   💥 Criar ideia:', e.message);
  }

  await browser.close();

  // ── 4. Gerar Relatório ─────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('                    RELATÓRIO E2E');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Data: ${report.timestamp}`);
  console.log(`\n📊 Resumo:`);
  console.log(`   ✅ Passaram: ${report.summary.passed}`);
  console.log(`   ⚠️  Alertas:  ${report.summary.warnings}`);
  console.log(`   💥 Falharam:  ${report.summary.failed}`);

  console.log(`\n📡 APIs (${report.api.length} testadas):`);
  const failedApis = report.api.filter(a => !a.ok);
  if (failedApis.length === 0) {
    console.log('   Todas as APIs retornaram 200 OK');
  } else {
    for (const a of failedApis) {
      console.log(`   💥 ${a.method} ${a.endpoint} → ${a.status}`);
      if (a.error) console.log(`      → ${a.error}`);
    }
  }

  console.log(`\n📄 Páginas (${report.pages.length} testadas):`);
  const failedPages = report.pages.filter(p => !p.ok);
  if (failedPages.length === 0) {
    console.log('   Todas as páginas carregaram sem erro 500');
  } else {
    for (const p of failedPages) {
      console.log(`   💥 ${p.name} (${p.path})`);
      if (p.error) console.log(`      → ${p.error}`);
    }
  }

  const warnPages = report.pages.filter(p => p.ok && (p.consoleErrors > 0 || p.networkErrors > 0));
  if (warnPages.length > 0) {
    console.log(`\n⚠️  Páginas com alertas:`);
    for (const p of warnPages) {
      console.log(`   ⚠️  ${p.name}: ${p.networkErrors} erros de rede, ${p.consoleErrors} erros de console`);
    }
  }

  // Salvar relatório JSON
  const reportPath = '/home/jhin/NEXO_DASHBOARD_PRO/e2e-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n💾 Relatório JSON salvo em: ${reportPath}`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

run().catch(e => {
  console.error('❌ Erro fatal no teste E2E:', e);
  process.exit(1);
});
