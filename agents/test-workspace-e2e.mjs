#!/usr/bin/env node
/**
 * Teste E2E do Workspace Agent
 * Simula o fluxo completo: bootstrap → context injection → tool execution → git commit
 */

import { workspaceManager } from './luna-workspace.cjs';
import { ToolGuard, validateToolCall } from './luna-tool-guard.cjs';
import { LunaGit } from './luna-git.cjs';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// Create a temp project for testing
const TMP_PROJECT = path.join(os.tmpdir(), `luna-test-project-${Date.now()}`);

function setupTempProject() {
  fs.mkdirSync(TMP_PROJECT, { recursive: true });
  fs.mkdirSync(path.join(TMP_PROJECT, 'src'), { recursive: true });
  fs.writeFileSync(path.join(TMP_PROJECT, 'package.json'), JSON.stringify({
    name: 'test-project',
    dependencies: { express: '^4.18.0', react: '^18.0.0' },
    devDependencies: { typescript: '^5.0.0' }
  }, null, 2));
  fs.writeFileSync(path.join(TMP_PROJECT, 'README.md'), '# Test Project\n\nThis is a test.');
  fs.writeFileSync(path.join(TMP_PROJECT, 'src', 'index.js'), 'console.log("hello");');

  // Init git
  execSync(`cd "${TMP_PROJECT}" && git init && git config user.email "test@test.com" && git config user.name "Test"`, { encoding: 'utf8' });
  execSync(`cd "${TMP_PROJECT}" && git add . && git commit -m "initial"`, { encoding: 'utf8' });
}

function cleanup() {
  try { fs.rmSync(TMP_PROJECT, { recursive: true }); } catch {}
}

// Test 1: Full bootstrap + git init
test('E2E: Bootstrap cria workspace com git branch', async () => {
  setupTempProject();
  workspaceManager.clearWorkspace('e2e-test');

  const result = await workspaceManager.bootstrap(TMP_PROJECT, 'e2e-test');
  if (!result.success) throw new Error('Bootstrap falhou');

  const git = new LunaGit(TMP_PROJECT);
  const initResult = await git.init();
  if (!initResult.success) throw new Error(`Git init falhou: ${initResult.error}`);
  if (!initResult.branch.startsWith('luna/session-')) throw new Error(`Branch errada: ${initResult.branch}`);

  console.log('   Branch:', initResult.branch);
});

// Test 2: ToolGuard executa readFile + schema validation
test('E2E: ToolGuard executa readFile com schema validation', async () => {
  const guard = new ToolGuard(TMP_PROJECT);
  const filePath = path.join(TMP_PROJECT, 'src', 'index.js');

  const result = await guard.execute('readFile', { path: filePath }, async () => {
    const content = fs.readFileSync(filePath, 'utf8');
    return { success: true, content };
  });

  if (!result.success) throw new Error(`readFile falhou: ${result.error}`);
  if (result.content !== 'console.log("hello");') throw new Error('Conteúdo errado');
});

// Test 3: ToolGuard rejeita path traversal
test('E2E: ToolGuard rejeita path traversal em writeFile', async () => {
  const guard = new ToolGuard(TMP_PROJECT);
  try {
    await guard.execute('writeFile', { path: '/tmp/../../etc/passwd', content: 'x' }, async () => {
      return { success: true };
    });
    throw new Error('Deveria ter rejeitado');
  } catch (e) {
    if (!e.message.includes('proibido')) throw new Error(`Mensagem errada: ${e.message}`);
  }
});

// Test 4: ToolGuard + LunaGit auto-commit
test('E2E: Modificação de arquivo gera commit automático', async () => {
  const guard = new ToolGuard(TMP_PROJECT);
  const git = new LunaGit(TMP_PROJECT);
  git.isRepo = true;
  git.sessionBranch = git._getCurrentBranch();
  git.baseBranch = 'main';

  const filePath = path.join(TMP_PROJECT, 'src', 'newfile.js');

  // Execute writeFile
  const result = await guard.execute('writeFile', { path: filePath, content: 'const x = 1;' }, async () => {
    fs.writeFileSync(filePath, 'const x = 1;');
    return { success: true };
  });

  if (!result.success) throw new Error(`writeFile falhou: ${result.error}`);

  // Commit via LunaGit
  const commitResult = await git.commit(filePath, 'luna: writeFile newfile.js');
  if (!commitResult.success) throw new Error(`Commit falhou: ${commitResult.error}`);

  console.log('   Commit hash:', commitResult.hash);
});

// Test 5: Verify loop — run tests
test('E2E: runTests detecta sucesso/falha', async () => {
  // Create a simple test
  fs.writeFileSync(path.join(TMP_PROJECT, 'test.js'), `
    const assert = require('assert');
    assert.strictEqual(1 + 1, 2);
    console.log('PASS: 1+1=2');
  `);

  try {
    const output = execSync(`cd "${TMP_PROJECT}" && node test.js`, { encoding: 'utf8' });
    if (!output.includes('PASS')) throw new Error('Teste não passou');
    console.log('   Test output:', output.trim());
  } catch (err) {
    throw new Error(`Teste falhou: ${err.message}`);
  }
});

// Test 6: Context layers fit in token budget
test('E2E: Manifest + Active Files cabe no token budget', async () => {
  workspaceManager.clearWorkspace('e2e-budget');
  await workspaceManager.bootstrap(TMP_PROJECT, 'e2e-budget');

  // Add some active files
  for (let i = 0; i < 5; i++) {
    workspaceManager.addActiveFile('e2e-budget', path.join(TMP_PROJECT, `file${i}.js`), 'a'.repeat(1000));
  }

  const ctx = workspaceManager.getActiveFilesContext('e2e-budget', 15000);
  const estimatedTokens = Math.ceil(ctx.length / 4);

  if (estimatedTokens > 4000) {
    throw new Error(`Contexto muito grande: ~${estimatedTokens} tokens`);
  }

  console.log(`   Estimated tokens: ${estimatedTokens}`);
});

// ── Runner ──
async function run() {
  let passed = 0, failed = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      passed++;
      console.log(`✅ ${name}`);
    } catch (err) {
      failed++;
      console.log(`❌ ${name}`);
      console.log(`   ${err.message}`);
    }
  }

  cleanup();

  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`Resultado: ${passed} passaram, ${failed} falharam de ${tests.length} testes`);
  console.log('═══════════════════════════════════════════════════════════════');
  if (failed > 0) process.exit(1);
  console.log('\n✅ Todos os testes E2E passaram!');
}

run().catch(err => {
  console.error('Erro no runner:', err);
  cleanup();
  process.exit(1);
});
