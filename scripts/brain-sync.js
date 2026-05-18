#!/usr/bin/env node
/**
 * NEXO Brain Sync
 * Sincroniza o .brain local com o repositório principal-brain no GitHub
 *
 * Uso: node scripts/brain-sync.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BRAIN_REPO = 'https://github.com/Jhin1v9/principal-brain.git';
const LOCAL_BRAIN = path.join(__dirname, '..', '.brain');
const TEMP_DIR = path.join(__dirname, '..', '.brain-temp');

function log(msg) {
  console.log(`[BrainSync] ${msg}`);
}

function main() {
  try {
    log('Iniciando sincronização com principal-brain...');

    // Verificar se .brain existe localmente
    if (!fs.existsSync(LOCAL_BRAIN)) {
      log('⚠️ .brain local não encontrado. Criando estrutura...');
      fs.mkdirSync(LOCAL_BRAIN, { recursive: true });
    }

    // Clonar ou pull do repo principal
    if (fs.existsSync(TEMP_DIR)) {
      execSync(`rm -rf ${TEMP_DIR}`);
    }

    log('Clonando principal-brain...');
    execSync(`git clone --depth 1 ${BRAIN_REPO} ${TEMP_DIR}`, { stdio: 'inherit' });

    // Merge: copiar arquivos do remoto que não existem localmente
    log('Sincronizando arquivos...');
    syncDirectories(path.join(TEMP_DIR, '.brain'), LOCAL_BRAIN);

    // Limpar temp
    execSync(`rm -rf ${TEMP_DIR}`);

    log('✅ Sincronização completa!');
  } catch (error) {
    console.error('[BrainSync] ❌ Erro:', error.message);
    process.exit(1);
  }
}

function syncDirectories(source, target) {
  if (!fs.existsSync(source)) return;
  if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });

  const items = fs.readdirSync(source);
  for (const item of items) {
    const srcPath = path.join(source, item);
    const tgtPath = path.join(target, item);
    const stat = fs.statSync(srcPath);

    if (stat.isDirectory()) {
      syncDirectories(srcPath, tgtPath);
    } else {
      // Só copia se o arquivo não existir localmente (preserva modificações locais)
      if (!fs.existsSync(tgtPath)) {
        fs.copyFileSync(srcPath, tgtPath);
        log(`  + ${path.relative(LOCAL_BRAIN, tgtPath)}`);
      }
    }
  }
}

if (require.main === module) {
  main();
}
