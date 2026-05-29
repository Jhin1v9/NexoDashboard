/**
 * Teste Supervisor Luna — Criação de Projeto Grande
 * Objetivo: Testar se Kimi Web consegue criar algo grande no PC,
 * guiando e corrigindo a Luna quando ela erra.
 */

const { LunaSoul } = require('./agents/luna-soul.cjs');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const PROJECT_DIR = '/home/jhin/Documentos/portfolio-luna-teste';
const LOG_FILE = '/home/jhin/NEXO_DASHBOARD_PRO/teste-supervisor-luna.log';
const MAX_ATTEMPTS = 5;
const SESSION_ID = 'supervisor-test-' + Date.now();

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function clearLog() {
  try { fs.writeFileSync(LOG_FILE, ''); } catch {}
}

// ═══════════════════════════════════════════════════════════════
// PROMPTS
// ═══════════════════════════════════════════════════════════════

const PROMPT_INICIAL = `Crie um app React INCRÍVEL de portfólio pessoal para um desenvolvedor full-stack chamado "Abner Gabriel" (CEO da NEXO DIGITAL S.L.).

REGRAS OBRIGATÓRIAS:
1. Crie tudo em ${PROJECT_DIR}
2. Use Vite + React + Tailwind CSS + Framer Motion + Lucide React
3. Dark mode futurista (fundo escuro, acentos neon cyan #00f0ff e purple #a855f7)
4. Seções obrigatórias: Hero (com typing animation), Sobre, Skills (barras animadas), Projetos (cards com hover), Contato, Footer
5. Totalmente responsivo (mobile, tablet, desktop)
6. Um easter egg Matrix: clique no nome no hero ativa chuva de caracteres verdes
7. Animações de entrada suaves com Framer Motion (fade in, slide up)
8. Ícones com Lucide React
9. Após criar todos os arquivos, execute "npm run build" e garanta que o build passe sem erros
10. Se houver erros de build, corrija-os imediatamente

INSTRUÇÕES CRÍTICAS PARA NÃO ERRAR:
- SEMPRE feche todas as tags JSX: <div>...</div>, <span>...</span>, <p>...</p>, <h2>...</h2>
- NUNCA deixe arquivos truncados. Se um arquivo for grande, crie-o por partes, mas cada parte deve ser válida
- Verifique SEMPRE se o conteúdo que você escreveu está completo antes de passar para o próximo arquivo
- NUNCA esqueça de atualizar App.jsx para importar e renderizar seus componentes
- NUNCA esqueça de atualizar index.html com o título correto
- Use executeShell para criar arquivos grandes via heredoc ou echo, ou writeFile para arquivos menores
- Após criar CADA arquivo, verifique se ele existe e tem conteúdo completo

RELEMBRANDO: O objetivo é um projeto COMPLETO e FUNCIONAL. Não pare no meio.
`;

// ═══════════════════════════════════════════════════════════════
// VALIDAÇÃO
// ═══════════════════════════════════════════════════════════════

function validateProject() {
  const errors = [];

  // 1. Diretório existe?
  if (!fs.existsSync(PROJECT_DIR)) {
    return { valid: false, errors: ['Diretório do projeto não existe'] };
  }

  // 2. package.json existe?
  const pkgPath = path.join(PROJECT_DIR, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    errors.push('package.json não encontrado');
  }

  // 3. Arquivos críticos existem?
  const criticalFiles = [
    'index.html',
    'vite.config.js',
    'tailwind.config.js',
    'src/main.jsx',
    'src/App.jsx',
    'src/index.css',
    'src/components/Hero.jsx',
    'src/components/About.jsx',
    'src/components/Skills.jsx',
    'src/components/Projects.jsx',
    'src/components/Contact.jsx',
    'src/components/Footer.jsx',
    'src/components/MatrixRain.jsx',
  ];
  for (const f of criticalFiles) {
    const fp = path.join(PROJECT_DIR, f);
    if (!fs.existsSync(fp)) {
      errors.push(`Arquivo faltando: ${f}`);
    } else {
      const content = fs.readFileSync(fp, 'utf8');
      if (content.trim().length < 50) {
        errors.push(`Arquivo muito curto/possivelmente truncado: ${f}`);
      }
    }
  }

  // 4. Consegue fazer build?
  try {
    execSync('npm run build', { cwd: PROJECT_DIR, encoding: 'utf8', timeout: 120000, stdio: 'pipe' });
    log('✅ Build passou sem erros!');
  } catch (e) {
    const stderr = e.stderr || e.stdout || e.message || '';
    errors.push(`Build falhou: ${stderr.slice(0, 800)}`);
  }

  // 5. App.jsx importa os componentes?
  const appPath = path.join(PROJECT_DIR, 'src/App.jsx');
  if (fs.existsSync(appPath)) {
    const appContent = fs.readFileSync(appPath, 'utf8');
    const requiredImports = ['Hero', 'About', 'Skills', 'Projects', 'Contact', 'Footer'];
    for (const comp of requiredImports) {
      if (!appContent.includes(comp)) {
        errors.push(`App.jsx não importa/renderiza o componente: ${comp}`);
      }
    }
  }

  // 6. index.html tem título correto?
  const htmlPath = path.join(PROJECT_DIR, 'index.html');
  if (fs.existsSync(htmlPath)) {
    const html = fs.readFileSync(htmlPath, 'utf8');
    if (!html.includes('Abner Gabriel') && !html.includes('NEXO DIGITAL')) {
      errors.push('index.html não tem título correto (Abner Gabriel / NEXO DIGITAL)');
    }
  }

  return { valid: errors.length === 0, errors };
}

// ═══════════════════════════════════════════════════════════════
// LOOP PRINCIPAL
// ═══════════════════════════════════════════════════════════════

async function runSupervisor() {
  clearLog();
  log('🚀 Iniciando Supervisor Luna');
  log(`📁 Projeto: ${PROJECT_DIR}`);
  log(`🆔 Sessão: ${SESSION_ID}`);

  const luna = new LunaSoul({ autoConfirmDestructive: true });
  await luna.init({ userId: 'supervisor-test' });
  log('✅ Luna inicializado (auto-confirm destrutivo ativado)');

  let currentPrompt = PROMPT_INICIAL;
  let attempt = 0;

  while (attempt < MAX_ATTEMPTS) {
    attempt++;
    log(`\n═══════════════════════════════════════════════`);
    log(`🔄 TENTATIVA ${attempt}/${MAX_ATTEMPTS}`);
    log(`═══════════════════════════════════════════════`);

    if (attempt > 1) {
      log('⏳ Aguardando 5s antes de enviar correção...');
      await new Promise(r => setTimeout(r, 5000));
    }

    // Envia mensagem para Luna
    log('📤 Enviando prompt para Luna...');
    const stream = luna.processMessageStream(currentPrompt, {
      sessionId: SESSION_ID,
      userId: 'supervisor-test',
      mode: 'thinking',
      persona: 'engenheiro',
    });

    let actionCount = 0;
    let errorCount = 0;
    let lastResponse = '';

    for await (const ev of stream) {
      switch (ev.type) {
        case 'thinking_start':
          log('🧠 [THINKING START]');
          break;
        case 'thinking_delta':
          // Silencioso para não poluir, apenas pontos
          process.stdout.write('.');
          break;
        case 'response_delta':
          lastResponse = ev.fullResponse || ev.text || '';
          break;
        case 'action_start':
          actionCount++;
          log(`\n🔧 [ACTION #${actionCount}]: ${ev.tool}`);
          break;
        case 'action_end':
          log(`✅ [ACTION DONE #${actionCount}]: success=${ev.result?.success}`);
          if (ev.result?.result?.stderr) {
            log(`⚠️  STDERR: ${ev.result.result.stderr.slice(0, 300)}`);
          }
          break;
        case 'error':
          errorCount++;
          log(`❌ [ERROR]: ${ev.error || ev.message}`);
          break;
        case 'done':
          log('\n🎉 [DONE]');
          break;
      }
    }

    log(`\n📊 Estatísticas da tentativa ${attempt}:`);
    log(`   Ações executadas: ${actionCount}`);
    log(`   Erros: ${errorCount}`);
    log(`   Tamanho última resposta: ${lastResponse.length} chars`);

    // Validação
    log('\n🔍 Validando projeto...');
    const validation = validateProject();

    if (validation.valid) {
      log('\n🎊🎊🎊 SUCESSO! Projeto válido e build passou! 🎊🎊🎊');
      log(`📁 Local: ${PROJECT_DIR}`);
      await luna.disconnect();
      return;
    }

    log(`\n❌ Projeto INVÁLIDO. Erros encontrados (${validation.errors.length}):`);
    for (const err of validation.errors) {
      log(`   - ${err}`);
    }

    if (attempt < MAX_ATTEMPTS) {
      log('\n📋 Construindo prompt de correção...');
      currentPrompt = `O projeto que você criou tem erros. POR FAVOR, corrija TODOS os seguintes problemas:

${validation.errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}

INSTRUÇÕES:
- Não recrie tudo do zero a menos que seja necessário. Foque em corrigir os erros listados.
- Se um arquivo estiver faltando, crie-o.
- Se um arquivo estiver truncado ou quebrado, reescreva-o completamente.
- Se o build falhar, leia a mensagem de erro com atenção e corrija a causa raiz.
- SEMPRE feche tags JSX.
- Após corrigir, execute "npm run build" novamente para confirmar que está tudo ok.
- O diretório do projeto é: ${PROJECT_DIR}
`;
    }
  }

  log(`\n💀 Máximo de tentativas (${MAX_ATTEMPTS}) atingido. Teste falhou.`);
  await luna.disconnect();
  process.exit(1);
}

runSupervisor().catch(err => {
  console.error('Supervisor crash:', err);
  process.exit(1);
});
