#!/usr/bin/env node
// ============================================================
// LUNA CLEANUP MASTER v1.0 — Organizador de Pastas NEXO
// ============================================================
// Este script:
// 1. Escaneia TODAS as pastas e arquivos
// 2. Mostra última data modificada
// 3. Sugere o que apagar (backups antigos, temp, cache, etc.)
// 4. PERGUNTA antes de apagar qualquer coisa
// ============================================================

const fs = require('fs');
const path = require('path');

const PROJECT_DIR = process.cwd();

// Padrões de arquivos/pastas que provavelmente são lixo
const JUNK_PATTERNS = [
  // Backups antigos (mais de 7 dias)
  { pattern: /^luna-fix-v\d+/, type: 'dir', desc: 'Backup antigo do fix script', minAgeDays: 0 },
  { pattern: /^backup-/, type: 'dir', desc: 'Backup genérico', minAgeDays: 7 },
  { pattern: /^old-/, type: 'any', desc: 'Arquivo/pasta antigo', minAgeDays: 14 },
  { pattern: /^temp-?/, type: 'any', desc: 'Arquivo temporário', minAgeDays: 1 },
  { pattern: /^test-/, type: 'any', desc: 'Arquivo de teste', minAgeDays: 3 },

  // Caches
  { pattern: /\.cache$/, type: 'any', desc: 'Cache', minAgeDays: 1 },
  { pattern: /\.tmp$/, type: 'file', desc: 'Arquivo temporário', minAgeDays: 1 },
  { pattern: /\.temp$/, type: 'file', desc: 'Arquivo temporário', minAgeDays: 1 },
  { pattern: /~$/, type: 'file', desc: 'Backup de editor', minAgeDays: 1 },
  { pattern: /^\./, type: 'file', desc: 'Arquivo oculto', minAgeDays: 7 },

  // Logs antigos
  { pattern: /\.log$/, type: 'file', desc: 'Log antigo', minAgeDays: 7 },
  { pattern: /^log-/, type: 'file', desc: 'Log antigo', minAgeDays: 7 },

  // Node modules duplicados ou corrompidos
  { pattern: /^node_modules_/, type: 'dir', desc: 'node_modules backup', minAgeDays: 1 },
  { pattern: /^package-lock.*\.backup/, type: 'file', desc: 'Backup package-lock', minAgeDays: 1 },

  // Arquivos de debug
  { pattern: /\.debug$/, type: 'file', desc: 'Arquivo de debug', minAgeDays: 1 },
  { pattern: /^debug-/, type: 'any', desc: 'Arquivo de debug', minAgeDays: 1 },

  // Arquivos de erro
  { pattern: /\.error$/, type: 'file', desc: 'Arquivo de erro', minAgeDays: 1 },
  { pattern: /^error-/, type: 'any', desc: 'Arquivo de erro', minAgeDays: 1 },

  // Vários scripts de fix (manter só o mais recente)
  { pattern: /^luna-fix-master-v\d+.*\.cjs$/, type: 'file', desc: 'Script de fix antigo', minAgeDays: 0 },
  { pattern: /^luna-fix-v\d+.*\.(cjs|js|mjs)$/, type: 'file', desc: 'Script de fix antigo', minAgeDays: 0 },
];

// Pastas que NUNCA devem ser apagadas
const PROTECTED_DIRS = [
  'agents',
  'backend',
  'frontend',
  'public',
  'artifacts',
  'node_modules',
  '.git',
  'src',
  'dist',
  'build',
];

// Arquivos que NUNCA devem ser apagados
const PROTECTED_FILES = [
  'package.json',
  'package-lock.json',
  '.env',
  '.env.local',
  'README.md',
  'server.js',
  'luna-cto-agent.cjs',
  'SmartClassifier_v16.js',
  'LunaBrain_v16.js',
  'luna-scheduler.mjs',
];

let scanResults = [];
let toDelete = [];

function log(msg) {
  console.log(`[${new Date().toLocaleTimeString('pt-BR')}] ${msg}`);
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getAgeDays(stats) {
  const now = Date.now();
  const mtime = stats.mtime.getTime();
  return Math.floor((now - mtime) / (1000 * 60 * 60 * 24));
}

function isProtected(filePath, basename, isDir) {
  // Proteger pastas críticas
  if (isDir && PROTECTED_DIRS.includes(basename)) return true;

  // Proteger arquivos críticos
  if (!isDir && PROTECTED_FILES.includes(basename)) return true;

  // Proteger se está dentro de pasta protegida
  const relative = path.relative(PROJECT_DIR, filePath);
  const parts = relative.split(path.sep);
  for (const part of parts) {
    if (PROTECTED_DIRS.includes(part)) return true;
  }

  return false;
}

function scanDir(dir, depth = 0) {
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    const isDir = item.isDirectory();
    const stats = fs.statSync(fullPath);
    const ageDays = getAgeDays(stats);
    const size = isDir ? getDirSize(fullPath) : stats.size;

    const entry = {
      name: item.name,
      path: fullPath,
      relative: path.relative(PROJECT_DIR, fullPath),
      isDir,
      size,
      ageDays,
      modified: stats.mtime.toISOString(),
      protected: isProtected(fullPath, item.name, isDir),
      depth
    };

    scanResults.push(entry);

    if (isDir && !isProtected(fullPath, item.name, isDir)) {
      scanDir(fullPath, depth + 1);
    }
  }
}

function getDirSize(dir) {
  let size = 0;
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        size += getDirSize(fullPath);
      } else {
        size += fs.statSync(fullPath).size;
      }
    }
  } catch (e) {}
  return size;
}

function analyzeJunk() {
  for (const entry of scanResults) {
    if (entry.protected) continue;

    for (const junk of JUNK_PATTERNS) {
      const matchesType = junk.type === 'any' || 
                         (junk.type === 'dir' && entry.isDir) ||
                         (junk.type === 'file' && !entry.isDir);

      if (matchesType && junk.pattern.test(entry.name)) {
        toDelete.push({
          ...entry,
          reason: junk.desc,
          minAge: junk.minAgeDays
        });
        break;
      }
    }
  }
}

function showScan() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  📁 ESTRUTURA COMPLETA DO PROJETO');
  console.log('═══════════════════════════════════════════════════════════');

  // Agrupar por pasta pai
  const byParent = {};
  for (const entry of scanResults) {
    const parent = path.dirname(entry.relative);
    if (!byParent[parent]) byParent[parent] = [];
    byParent[parent].push(entry);
  }

  for (const [parent, items] of Object.entries(byParent).sort()) {
    if (parent === '.') {
      console.log(`\n📂 RAIZ (${items.length} itens):`);
    } else {
      console.log(`\n📂 ${parent}/ (${items.length} itens):`);
    }

    for (const item of items.sort((a, b) => b.size - a.size)) {
      const icon = item.isDir ? '📁' : '📄';
      const protected = item.protected ? ' 🔒' : '';
      const age = item.ageDays === 0 ? 'HOJE' : `${item.ageDays}d`;
      console.log(`  ${icon} ${item.name.padEnd(40)} ${formatSize(item.size).padStart(10)}  ${age}${protected}`);
    }
  }
}

function showJunk() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🗑️  ARQUIVOS/PASTAS SUGERIDOS PARA APAGAR');
  console.log('═══════════════════════════════════════════════════════════');

  if (toDelete.length === 0) {
    console.log('  ✅ Nada encontrado para apagar! Pasta está organizada.');
    return;
  }

  // Ordenar por tamanho (maior primeiro)
  toDelete.sort((a, b) => b.size - a.size);

  let totalSize = 0;
  for (let i = 0; i < toDelete.length; i++) {
    const item = toDelete[i];
    totalSize += item.size;
    const icon = item.isDir ? '📁' : '📄';
    console.log(`\n  ${i + 1}. ${icon} ${item.relative}`);
    console.log(`     Motivo: ${item.reason}`);
    console.log(`     Tamanho: ${formatSize(item.size)} | Idade: ${item.ageDays} dias`);
    console.log(`     Modificado: ${item.modified}`);
  }

  console.log(`\n  💾 TOTAL A LIBERAR: ${formatSize(totalSize)}`);
}

function deleteItems(indices) {
  const deleted = [];
  const failed = [];

  for (const idx of indices) {
    const item = toDelete[idx - 1];
    if (!item) continue;

    try {
      if (item.isDir) {
        fs.rmSync(item.path, { recursive: true, force: true });
      } else {
        fs.unlinkSync(item.path);
      }
      deleted.push(item);
      console.log(`  ✅ Apagado: ${item.relative}`);
    } catch (e) {
      failed.push({ item, error: e.message });
      console.log(`  ❌ Erro ao apagar ${item.relative}: ${e.message}`);
    }
  }

  console.log(`\n  📊 Resumo: ${deleted.length} apagados, ${failed.length} falhas`);
}

// ============================================================
// MAIN
// ============================================================
console.log('═══════════════════════════════════════════════════════════');
console.log('  🌙 LUNA CLEANUP MASTER v1.0');
console.log(`  📁 Scanning: ${PROJECT_DIR}`);
console.log('═══════════════════════════════════════════════════════════');

// Fase 1: Scan
scanDir(PROJECT_DIR);
showScan();

// Fase 2: Análise
analyzeJunk();
showJunk();

// Fase 3: Interativo
if (toDelete.length > 0) {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  ⚠️  DESEJA APAGAR ALGO?');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Opções:');
  console.log('    - Digite números separados por vírgula (ex: 1,3,5)');
  console.log('    - Digite "todos" para apagar TUDO da lista');
  console.log('    - Digite "nenhum" ou pressione Enter para não apagar nada');
  console.log('    - Digite "sair" para encerrar');

  // Como não temos readline interativo aqui, vamos salvar a lista em JSON
  // para o usuário decidir depois
  const reportPath = path.join(PROJECT_DIR, 'luna-cleanup-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    scanned: scanResults.length,
    junkFound: toDelete.length,
    items: toDelete.map(d => ({
      index: toDelete.indexOf(d) + 1,
      name: d.name,
      relative: d.relative,
      isDir: d.isDir,
      size: d.size,
      sizeFormatted: formatSize(d.size),
      ageDays: d.ageDays,
      reason: d.reason,
      modified: d.modified
    }))
  }, null, 2));

  console.log(`\n  📄 Relatório salvo em: ${reportPath}`);
  console.log('  Abra o JSON, veja o que quer apagar, e execute:');
  console.log('    node luna-cleanup-executor.cjs 1,3,5');
}

console.log('\n✨ Scan completo!');
