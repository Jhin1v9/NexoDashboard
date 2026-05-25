#!/usr/bin/env node
/**
 * Teste do Workspace Bootstrap
 */

import { workspaceManager } from './luna-workspace.cjs';
import { ToolGuard, validateToolCall, computeChecksum, FileChecksumCache } from './luna-tool-guard.cjs';
import fs from 'fs';
import path from 'path';
import os from 'os';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// Test 1: Bootstrap no próprio projeto Luna
const LUNA_PATH = '/home/jhin/NEXO_DASHBOARD_PRO';

test('Workspace bootstrap funciona no diretório agents', async () => {
  workspaceManager.clearWorkspace('test-1');
  const result = await workspaceManager.bootstrap(LUNA_PATH, 'test-1');
  if (!result.success) throw new Error('Bootstrap falhou');
  if (!result.manifest) throw new Error('Manifest não gerado');
  if (result.manifest.name !== 'NEXO_DASHBOARD_PRO') throw new Error(`Nome errado: ${result.manifest.name}`);
  console.log('   Manifest keys:', Object.keys(result.manifest).join(', '));
});

test('Stack detection encontra Node.js', async () => {
  workspaceManager.clearWorkspace('test-2');
  await workspaceManager.bootstrap(LUNA_PATH, 'test-2');
  const manifest = workspaceManager.getManifest('test-2');
  if (!manifest.detectedStack) throw new Error('Stack não detectada');
  // agents tem package.json com ink, react, etc.
  if (!manifest.keyFiles['package.json'] || manifest.keyFiles['package.json'] === 'não encontrado') {
    throw new Error('package.json não encontrado');
  }
});

test('Git state detection funciona', async () => {
  workspaceManager.clearWorkspace('test-3');
  await workspaceManager.bootstrap(LUNA_PATH, 'test-3');
  const manifest = workspaceManager.getManifest('test-3');
  if (!manifest.gitState.isRepo) throw new Error('Não detectou repo git');
  if (!manifest.gitState.branch) throw new Error('Branch não detectada');
  console.log('   Branch:', manifest.gitState.branch, '| Dirty:', manifest.gitState.dirty);
});

test('Active files cache funciona', async () => {
  workspaceManager.clearWorkspace('test-4');
  await workspaceManager.bootstrap(LUNA_PATH, 'test-4');
  workspaceManager.addActiveFile('test-4', '/test/file.js', 'console.log("hello")');
  const content = workspaceManager.getActiveFile('test-4', '/test/file.js');
  if (content !== 'console.log("hello")') throw new Error('Cache não funcionou');
  const ctx = workspaceManager.getActiveFilesContext('test-4');
  if (!ctx.includes('hello')) throw new Error('Contexto não inclui conteúdo');
});

test('ToolGuard schema validation rejeita tool inexistente', () => {
  try {
    validateToolCall('toolInexistente', {});
    throw new Error('Deveria ter rejeitado');
  } catch (e) {
    if (!e.message.includes('não existe')) throw new Error(`Mensagem errada: ${e.message}`);
  }
});

test('ToolGuard schema validation rejeita path traversal', () => {
  try {
    validateToolCall('writeFile', { path: '/tmp/../etc/passwd', content: 'x' });
    throw new Error('Deveria ter rejeitado');
  } catch (e) {
    if (!e.message.includes('proibido')) throw new Error(`Mensagem errada: ${e.message}`);
  }
});

test('ToolGuard schema validation rejeita path relativo', () => {
  try {
    validateToolCall('writeFile', { path: 'relative/path.js', content: 'x' });
    throw new Error('Deveria ter rejeitado');
  } catch (e) {
    if (!e.message.includes('absoluto')) throw new Error(`Mensagem errada: ${e.message}`);
  }
});

test('Checksum detecta drift', () => {
  const tmpFile = path.join(os.tmpdir(), `luna-test-${Date.now()}.txt`);
  fs.writeFileSync(tmpFile, 'v1');
  const cache = new FileChecksumCache();
  cache.record(tmpFile);
  fs.writeFileSync(tmpFile, 'v2');
  const check = cache.verify(tmpFile);
  if (check.ok) throw new Error('Deveria ter detectado drift');
  if (!check.reason.includes('drift')) throw new Error(`Motivo errado: ${check.reason}`);
  fs.unlinkSync(tmpFile);
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
  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`Resultado: ${passed} passaram, ${failed} falharam de ${tests.length} testes`);
  console.log('═══════════════════════════════════════════════════════════════');
  if (failed > 0) process.exit(1);
  console.log('\n✅ Todos os testes passaram!');
}

run().catch(err => {
  console.error('Erro no runner:', err);
  process.exit(1);
});
