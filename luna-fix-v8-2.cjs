#!/usr/bin/env node
// ============================================================
// LUNA FIX v8.2 — CORRECAO DOS 3 CASOS RESTANTES
// ============================================================

const fs = require('fs');
const path = require('path');

const AGENTS_DIR = path.join(process.cwd(), 'agents');
const agentPath = path.join(AGENTS_DIR, 'luna-cto-agent.cjs');

console.log('[LUNA FIX v8.2] Corrigindo 3 casos restantes...\n');

let content = fs.readFileSync(agentPath, 'utf8');
let modified = false;

// ============================================================
// FIX 1: C1 — global.SCHEMAS
// ============================================================
console.log('[FIX 1] C1 — global.SCHEMAS');
if (!content.includes('global.SCHEMAS = SCHEMAS')) {
  // Adicionar global.SCHEMAS = SCHEMAS após loadAllSchemas()
  content = content.replace(
    'SCHEMAS = loadAllSchemas();',
    'SCHEMAS = loadAllSchemas();\n\n// Exportar para acesso global\nglobal.SCHEMAS = SCHEMAS;'
  );
  console.log('  [OK] global.SCHEMAS adicionado');
  modified = true;
} else {
  console.log('  [SKIP] ja existe');
}

// ============================================================
// FIX 2: C11 — Buffer seguro (verificar se ja esta correto)
// ============================================================
console.log('\n[FIX 2] C11 — Buffer seguro');
const hasSentVar = content.includes('let sent = false');
const hasSentCheck = content.includes('if (sent)');
if (hasSentVar && hasSentCheck) {
  console.log('  [OK] Buffer seguro ja esta correto (let sent + if sent)');
} else if (content.includes('this.cp.buffer.newMessages = [];') && 
           content.includes('await this.reportGroup.sendMessage(report)')) {
  console.log('  [WARN] Buffer pode nao estar 100% seguro, mas estrutura existe');
} else {
  console.log('  [INFO] Verificacao manual necessaria');
}

// ============================================================
// FIX 3: A12 — /status espanhol
// ============================================================
console.log('\n[FIX 3] A12 — /status espanhol');
if (!content.includes("cmd === '/estado'")) {
  // O replace anterior falhou porque o padrao nao bateu exatamente
  // Vamos tentar com um padrao mais flexivel
  const statusPattern = /else if \(cmd === ['"]\/status['"]\) \{/;
  if (statusPattern.test(content)) {
    content = content.replace(
      statusPattern,
      "else if (cmd === '/status' || cmd === '/estado') {"
    );
    console.log('  [OK] /status -> /status || /estado');
    modified = true;
  } else {
    console.log('  [FAIL] Padrao /status nao encontrado');
  }
} else {
  console.log('  [SKIP] ja existe');
}

// ============================================================
// SALVAR
// ============================================================
if (modified) {
  fs.writeFileSync(agentPath, content, 'utf8');
  console.log('\n[OK] Arquivo salvo com correcoes');
} else {
  console.log('\n[INFO] Nenhuma modificacao necessaria');
}

// ============================================================
// VERIFICACAO FINAL
// ============================================================
console.log('\n===========================================================');
console.log('  VERIFICACAO FINAL');
console.log('===========================================================');

const finalContent = fs.readFileSync(agentPath, 'utf8');
const checks = [
  { name: 'C1 — global.SCHEMAS', test: () => finalContent.includes('global.SCHEMAS = SCHEMAS') },
  { name: 'C11 — buffer seguro', test: () => finalContent.includes('let sent = false') && finalContent.includes('if (sent)') },
  { name: 'A12 — /status espanhol', test: () => finalContent.includes("cmd === '/estado'") },
];

let allOk = true;
for (const check of checks) {
  const ok = check.test();
  console.log(`  [${ok ? 'OK' : 'FAIL'}] ${check.name}`);
  if (!ok) allOk = false;
}

console.log('\n' + (allOk ? '🎉 TODOS OS 3 CASOS CORRIGIDOS!' : '⚠️  Alguns casos ainda precisam de atencao'));
