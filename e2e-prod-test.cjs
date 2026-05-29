#!/usr/bin/env node
/**
 * NEXO Dashboard — E2E Teste em Produção (Render)
 * Testa login de todos usuários e cria dados reais.
 */

const { chromium } = require('playwright');

const BASE_URL = 'https://nexodashboard.onrender.com';

const USERS = [
  { id: 'abner', name: 'Abner', password: '7741' },
  { id: 'nonoke', name: 'Nonoke', password: '7741' },
  { id: 'elias', name: 'Elias', password: '7741' },
];

const WAIT_OPTIONS = { waitUntil: 'networkidle', timeout: 30000 };

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log('🚀 Testando NEXO Dashboard em PRODUÇÃO...\n');
  console.log('URL:', BASE_URL);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  const report = {
    timestamp: new Date().toISOString(),
    users: [],
    created: [],
    errors: []
  };

  // ── Testar cada usuário ─────────────────────────────────────────────────
  for (const user of USERS) {
    console.log(`\n👤 Testando usuário: ${user.name} (${user.id})`);

    try {
      // Login
      await page.goto(`${BASE_URL}/login`, WAIT_OPTIONS);
      await sleep(1000);

      // Verificar se já está logado (redirect para /dashboard)
      if (!page.url().includes('/dashboard')) {
        await page.fill('input[name="username"]', user.id);
        await page.fill('input[name="password"]', user.password);
        await page.click('button:has-text("Entrar")');
        await page.waitForURL('**/dashboard', { timeout: 15000 });
      }

      console.log('   ✅ Login OK');

      // Coletar erros de console e rede
      const consoleErrors = [];
      const networkErrors = [];

      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('response', res => {
        if (res.status() >= 500) networkErrors.push({ url: res.url(), status: res.status() });
      });

      // Navegar por páginas principais
      const pagesToTest = [
        { path: '/dashboard', name: 'Dashboard' },
        { path: '/tarefas', name: 'Tarefas' },
        { path: '/leads', name: 'Leads' },
        { path: '/financeiro', name: 'Financeiro' },
        { path: '/ideias', name: 'Ideias' },
        { path: '/orcamentos', name: 'Orçamentos' },
        { path: '/clientes', name: 'Clientes' },
        { path: '/workspace', name: 'Workspace' },
        { path: '/settings', name: 'Configurações' },
      ];

      const userReport = { user: user.id, pages: [], login: true, consoleErrors: [], networkErrors: [] };

      for (const p of pagesToTest) {
        process.stdout.write(`   📄 ${p.name}... `);
        try {
          await page.goto(`${BASE_URL}${p.path}`, { waitUntil: 'networkidle', timeout: 20000 });
          await sleep(800);

          const netErrs = networkErrors.filter(e => e.url.includes('/api/') && e.status >= 500);
          const has500 = netErrs.length > 0;

          userReport.pages.push({ name: p.name, ok: !has500 });

          if (has500) {
            process.stdout.write(`💥 ${netErrs.map(e => e.status).join(',')}\n`);
            userReport.networkErrors.push(...netErrs);
          } else {
            process.stdout.write('✅\n');
          }
        } catch (e) {
          process.stdout.write(`💥 ${e.message.slice(0, 50)}\n`);
          userReport.pages.push({ name: p.name, ok: false, error: e.message });
        }
      }

      userReport.consoleErrors = [...new Set(consoleErrors)];
      report.users.push(userReport);

      // Logout
      await page.goto(`${BASE_URL}/login`, WAIT_OPTIONS);
      // Limpar localStorage para garantir logout
      await page.evaluate(() => { localStorage.clear(); });
      console.log('   🚪 Logout');

    } catch (e) {
      console.log(`   💥 Erro geral: ${e.message}`);
      report.users.push({ user: user.id, login: false, error: e.message });
    }
  }

  // ── Criar dados como Abner (com marca Luna) ────────────────────────────
  console.log('\n📝 Criando dados de teste como Abner...');

  try {
    // Login como abner
    await page.goto(`${BASE_URL}/login`, WAIT_OPTIONS);
    await page.fill('input[name="username"]', 'abner');
    await page.fill('input[name="password"]', '7741');
    await page.click('button:has-text("Entrar")');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await sleep(1500);

    // ── Criar Tarefa ────────────────────────────────────────────────────
    console.log('   📝 Criando tarefa...');
    try {
      await page.goto(`${BASE_URL}/tarefas`, WAIT_OPTIONS);
      await sleep(1000);

      // Procurar botão de adicionar (pode ser "+" ou "Nova" ou texto)
      const addBtn = page.locator('button').filter({ hasText: /^(Nova|Adicionar|\+)$/i }).first();
      if (await addBtn.isVisible().catch(() => false)) {
        await addBtn.click();
        await sleep(500);
      }

      // Tentar encontrar input de título (pode estar em modal)
      const titleInput = page.locator('input[name="title"], input[placeholder*="título" i], input[placeholder*="Título" i]').first();
      if (await titleInput.isVisible().catch(() => false)) {
        await titleInput.fill('Tarefa de teste — Luna');

        const descInput = page.locator('textarea[name="description"], textarea[placeholder*="descrição" i], textarea[placeholder*="Descrição" i]').first();
        if (await descInput.isVisible().catch(() => false)) {
          await descInput.fill('Criada automaticamente pelo agente Luna durante teste E2E em produção.');
        }

        const saveBtn = page.locator('button').filter({ hasText: /^(Salvar|Criar|Adicionar)$/i }).first();
        if (await saveBtn.isVisible().catch(() => false)) {
          await saveBtn.click();
          await sleep(1000);
          report.created.push({ type: 'tarefa', status: 'ok' });
          console.log('      ✅ Tarefa criada');
        } else {
          report.created.push({ type: 'tarefa', status: 'skip', reason: 'Botão salvar não encontrado' });
          console.log('      ⚠️ Botão salvar não encontrado');
        }
      } else {
        report.created.push({ type: 'tarefa', status: 'skip', reason: 'Formulário não aberto' });
        console.log('      ⚠️ Formulário de tarefa não encontrado');
      }
    } catch (e) {
      report.created.push({ type: 'tarefa', status: 'error', reason: e.message });
      console.log('      💥', e.message.slice(0, 60));
    }

    // ── Criar Lead ──────────────────────────────────────────────────────
    console.log('   📝 Criando lead...');
    try {
      // Usar API diretamente é mais confiável que o frontend para leads
      const token = await page.evaluate(() => localStorage.getItem('token'));
      const res = await fetch(`${BASE_URL}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          name: 'Lead Teste Luna',
          email: 'luna-test@nexo-digital.app',
          phone: '+34685093192',
          source: 'teste-e2e',
          message: 'Lead criado automaticamente pelo agente Luna durante teste E2E em produção.'
        })
      });
      if (res.ok) {
        report.created.push({ type: 'lead', status: 'ok' });
        console.log('      ✅ Lead criado via API');
      } else {
        const txt = await res.text();
        report.created.push({ type: 'lead', status: 'error', reason: txt.slice(0, 100) });
        console.log('      💥', res.status, txt.slice(0, 100));
      }
    } catch (e) {
      report.created.push({ type: 'lead', status: 'error', reason: e.message });
      console.log('      💥', e.message.slice(0, 60));
    }

    // ── Criar Ideia ─────────────────────────────────────────────────────
    console.log('   📝 Criando ideia...');
    try {
      await page.goto(`${BASE_URL}/ideias/nova`, WAIT_OPTIONS);
      await sleep(1000);

      const titleInput = page.locator('input[name="title"], input[placeholder*="título" i], input[placeholder*="Título" i]').first();
      if (await titleInput.isVisible().catch(() => false)) {
        await titleInput.fill('Ideia de teste — Luna');

        const typeSelect = page.locator('select[name="type"]').first();
        if (await typeSelect.isVisible().catch(() => false)) {
          await typeSelect.selectOption('feature');
        }

        const saveBtn = page.locator('button').filter({ hasText: /^(Salvar|Criar|Publicar)$/i }).first();
        if (await saveBtn.isVisible().catch(() => false)) {
          await saveBtn.click();
          await sleep(1500);
          report.created.push({ type: 'ideia', status: 'ok' });
          console.log('      ✅ Ideia criada');
        } else {
          report.created.push({ type: 'ideia', status: 'skip', reason: 'Botão salvar não encontrado' });
          console.log('      ⚠️ Botão salvar não encontrado');
        }
      } else {
        report.created.push({ type: 'ideia', status: 'skip', reason: 'Página não carregou formulário' });
        console.log('      ⚠️ Formulário de ideia não encontrado');
      }
    } catch (e) {
      report.created.push({ type: 'ideia', status: 'error', reason: e.message });
      console.log('      💥', e.message.slice(0, 60));
    }

    // ── Criar Workspace ─────────────────────────────────────────────────
    console.log('   📝 Criando workspace...');
    try {
      await page.goto(`${BASE_URL}/workspace`, WAIT_OPTIONS);
      await sleep(1000);

      const addBtn = page.locator('button').filter({ hasText: /^(Novo|Adicionar|\+|Criar)$/i }).first();
      if (await addBtn.isVisible().catch(() => false)) {
        await addBtn.click();
        await sleep(500);
      }

      const nameInput = page.locator('input[name="nome"], input[name="name"], input[placeholder*="nome" i], input[placeholder*="Nome" i]').first();
      if (await nameInput.isVisible().catch(() => false)) {
        await nameInput.fill('Workspace Teste Luna');

        const pathInput = page.locator('input[name="caminho"], input[name="path"], input[placeholder*="caminho" i]').first();
        if (await pathInput.isVisible().catch(() => false)) {
          await pathInput.fill('/teste-luna');
        }

        const saveBtn = page.locator('button').filter({ hasText: /^(Salvar|Criar|Adicionar)$/i }).first();
        if (await saveBtn.isVisible().catch(() => false)) {
          await saveBtn.click();
          await sleep(1000);
          report.created.push({ type: 'workspace', status: 'ok' });
          console.log('      ✅ Workspace criado');
        } else {
          report.created.push({ type: 'workspace', status: 'skip', reason: 'Botão salvar não encontrado' });
          console.log('      ⚠️ Botão salvar não encontrado');
        }
      } else {
        report.created.push({ type: 'workspace', status: 'skip', reason: 'Formulário não aberto' });
        console.log('      ⚠️ Formulário de workspace não encontrado');
      }
    } catch (e) {
      report.created.push({ type: 'workspace', status: 'error', reason: e.message });
      console.log('      💥', e.message.slice(0, 60));
    }

  } catch (e) {
    report.errors.push({ phase: 'create-data', error: e.message });
    console.log('   💥 Erro ao criar dados:', e.message);
  }

  await browser.close();

  // ── Relatório Final ────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('              RELATÓRIO E2E — PRODUÇÃO (Render)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`URL: ${BASE_URL}`);
  console.log(`Data: ${report.timestamp}\n`);

  console.log('👤 Testes por usuário:');
  for (const u of report.users) {
    const okPages = u.pages.filter(p => p.ok).length;
    const totalPages = u.pages.length;
    const status = u.login ? `✅ Login OK — ${okPages}/${totalPages} páginas OK` : '💥 Login falhou';
    console.log(`   ${u.user}: ${status}`);
    if (u.networkErrors && u.networkErrors.length > 0) {
      for (const err of u.networkErrors) {
        console.log(`      💥 ${err.url} → ${err.status}`);
      }
    }
  }

  console.log('\n📝 Dados criados:');
  for (const c of report.created) {
    const icon = c.status === 'ok' ? '✅' : c.status === 'skip' ? '⚠️' : '💥';
    console.log(`   ${icon} ${c.type}${c.reason ? ': ' + c.reason : ''}`);
  }

  if (report.errors.length > 0) {
    console.log('\n❌ Erros gerais:');
    for (const e of report.errors) {
      console.log(`   💥 ${e.phase}: ${e.error}`);
    }
  }

  const totalOk = report.users.filter(u => u.login).length;
  const totalPagesOk = report.users.reduce((s, u) => s + u.pages.filter(p => p.ok).length, 0);
  const totalPages = report.users.reduce((s, u) => s + u.pages.length, 0);
  const createdOk = report.created.filter(c => c.status === 'ok').length;

  console.log('\n📊 Resumo:');
  console.log(`   Logins OK: ${totalOk}/${USERS.length}`);
  console.log(`   Páginas OK: ${totalPagesOk}/${totalPages}`);
  console.log(`   Dados criados: ${createdOk}/${report.created.length}`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

run().catch(e => {
  console.error('❌ Erro fatal:', e);
  process.exit(1);
});
