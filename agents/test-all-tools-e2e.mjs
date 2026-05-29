#!/usr/bin/env node
/**
 * Teste E2E Abrangente — Todas as ferramentas Luna + Fluxo completo
 * Testa cada tool call individualmente e depois um fluxo E2E real.
 */
import { LunaSoul } from './luna-soul.cjs';
import { SessionManager } from './session-manager.cjs';
import fs from 'fs';
import path from 'path';

const TEST_DIR = '/tmp/luna-tool-test-' + Date.now();
const RESULTS = [];
let pass = 0, fail = 0;

function log(category, name, success, detail = '') {
  const icon = success ? '✅' : '❌';
  console.log(`${icon} [${category}] ${name}${detail ? ' — ' + detail : ''}`);
  RESULTS.push({ category, name, success, detail });
  if (success) pass++; else fail++;
}

async function testToolDirect(luna, tool, params, expectSuccess = true) {
  const action = { mode: 'ACTION', tool, params };
  const result = await luna._handleAction(action, 'test-session', {});
  const ok = result.success === expectSuccess;
  log('TOOL', tool, ok, ok ? (result.result?.stdout?.slice(0, 60) || 'OK') : result.error);
  return result;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  TESTE E2E ABRANGENTE — Todas as ferramentas Luna');
  console.log('═══════════════════════════════════════════════════════════════\n');

  fs.mkdirSync(TEST_DIR, { recursive: true });

  // ── Inicializar LunaSoul ──
  const luna = new LunaSoul({ defaultMode: 'thinking' });
  await luna.init({ userId: 'luna-cli' });

  // ═══════════════════════════════════════════════════════════════
  // 1. TESTES DIRETOS DE FERRAMENTAS
  // ═══════════════════════════════════════════════════════════════
  console.log('\n📁 FERRAMENTAS DE ARQUIVO\n');

  await testToolDirect(luna, 'writeFile', { path: `${TEST_DIR}/test.txt`, content: 'Hello Luna' });
  await testToolDirect(luna, 'readFile', { path: `${TEST_DIR}/test.txt` });
  await testToolDirect(luna, 'appendFile', { path: `${TEST_DIR}/test.txt`, content: '\nLine 2' });
  await testToolDirect(luna, 'getFileInfo', { path: `${TEST_DIR}/test.txt` });
  await testToolDirect(luna, 'copyFile', { source: `${TEST_DIR}/test.txt`, destination: `${TEST_DIR}/test-copy.txt` });
  await testToolDirect(luna, 'moveFile', { source: `${TEST_DIR}/test-copy.txt`, destination: `${TEST_DIR}/test-moved.txt` });
  await testToolDirect(luna, 'replaceInFile', { path: `${TEST_DIR}/test.txt`, old: 'Hello', new: 'Hi' });
  await testToolDirect(luna, 'createDirectory', { path: `${TEST_DIR}/subdir` });
  await testToolDirect(luna, 'listFiles', { pattern: `${TEST_DIR}/*` });
  await testToolDirect(luna, 'viewDirectory', { path: TEST_DIR });
  await testToolDirect(luna, 'glob', { pattern: `${TEST_DIR}/*.txt` });
  await testToolDirect(luna, 'deleteFile', { path: `${TEST_DIR}/test-moved.txt` });
  await testToolDirect(luna, 'removeDirectory', { path: `${TEST_DIR}/subdir` });

  console.log('\n🔍 FERRAMENTAS DE BUSCA\n');

  await testToolDirect(luna, 'searchFiles', { pattern: 'Hello', path: TEST_DIR });
  await testToolDirect(luna, 'grep', { pattern: 'Hello', path: TEST_DIR });
  await testToolDirect(luna, 'getCurrentDirectory', {});

  console.log('\n🌐 FERRAMENTAS WEB (stubs)\n');

  const searchResult = await testToolDirect(luna, 'searchWeb', { query: 'test' });
  const fetchResult = await testToolDirect(luna, 'fetchURL', { url: 'https://example.com' });

  console.log('\n🖥️ FERRAMENTAS DE SHELL\n');

  await testToolDirect(luna, 'executeShell', { command: 'echo "shell test"' });
  await testToolDirect(luna, 'executeShell', { command: 'python3 -c "print(2+2)"' });
  await testToolDirect(luna, 'executeShell', { command: `python3 <<'EOF'
with open('${TEST_DIR}/py-test.txt', 'w') as f:
    f.write('from python')
EOF` });

  console.log('\n🧠 OUTRAS FERRAMENTAS\n');

  await testToolDirect(luna, 'think', { thought: 'Testing think tool' });
  await testToolDirect(luna, 'checkSyntax', { path: `${TEST_DIR}/test.txt` });

  // ═══════════════════════════════════════════════════════════════
  // 2. TESTE E2E: CRIAR HTML+CSS EM DOCUMENTOS
  // ═══════════════════════════════════════════════════════════════
  console.log('\n\n🎨 TESTE E2E: HTML+CSS em Documentos\n');

  const docPath = '/home/jhin/Documentos/luna-test-html';
  fs.mkdirSync(docPath, { recursive: true });

  const session = new SessionManager().getOrCreateCurrentSession();
  const prompt = `Crie um site simples em ${docPath}/ com:
1. index.html — página com título "Luna Test", um parágrafo "Criado por Luna" e um botão estilizado
2. style.css — fundo azul escuro, texto branco, botão verde com hover
3. main.js — quando clicar no botão, mostra um alert "Hello from Luna!"

Use as ferramentas writeFile para criar cada arquivo.`;

  console.log('📤 Enviando prompt E2E...');
  const startE2E = Date.now();

  const stream = luna.processMessageStream(prompt, {
    sessionId: session.id, mode: 'thinking', userId: 'luna-cli',
  });

  let e2eEvents = [];
  let e2eActions = 0;
  let e2eErrors = [];

  for await (const ev of stream) {
    e2eEvents.push(ev.type);
    if (ev.type === 'action_start') {
      e2eActions++;
      console.log(`  🔧 ${ev.tool}`);
    }
    if (ev.type === 'action_end') {
      if (!ev.result?.success) {
        e2eErrors.push(`${ev.tool}: ${ev.result?.error}`);
        console.log(`  ❌ ${ev.tool} FAILED: ${ev.result?.error}`);
      } else {
        console.log(`  ✅ ${ev.tool} OK`);
      }
    }
    if (ev.type === 'error') {
      e2eErrors.push(`stream: ${ev.error}`);
      console.log(`  ❌ Stream error: ${ev.error}`);
    }
  }

  const e2eTime = ((Date.now() - startE2E) / 1000).toFixed(1);

  // Verificar arquivos criados
  const filesCreated = ['index.html', 'style.css', 'main.js'].map(f => {
    const p = path.join(docPath, f);
    const exists = fs.existsSync(p);
    const size = exists ? fs.statSync(p).size : 0;
    return { file: f, exists, size };
  });

  console.log('\n  📁 Arquivos criados:');
  for (const f of filesCreated) {
    log('E2E', f.file, f.exists, f.exists ? `${f.size} bytes` : 'NOT FOUND');
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. RESUMO
  // ═══════════════════════════════════════════════════════════════
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('  RESUMO FINAL');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`\n✅ Passaram: ${pass}`);
  console.log(`❌ Falharam: ${fail}`);
  console.log(`📊 Total:    ${pass + fail}`);

  console.log('\n── E2E HTML+CSS ──');
  console.log(`Tempo: ${e2eTime}s`);
  console.log(`Actions: ${e2eActions}`);
  console.log(`Errors: ${e2eErrors.length}`);
  if (e2eErrors.length) e2eErrors.forEach(e => console.log(`  ❌ ${e}`));

  const allFilesOk = filesCreated.every(f => f.exists);
  console.log(`\nHTML+CSS criado: ${allFilesOk ? '✅ SIM' : '❌ INCOMPLETO'}`);

  console.log('\n── Problemas conhecidos ──');
  console.log('  ⚠️ Upload de imagem: Kimi Web não reconhece (método atual incompatível)');
  console.log('  ⚠️ searchWeb/fetchURL: Stubs (requem API key)');
  console.log('  ⚠️ clipboardRead/clipboardWrite: Requer xclip/xsel instalado');

  await luna.disconnect();

  // Cleanup
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
}

main().catch(e => { console.error(e); process.exit(1); });
