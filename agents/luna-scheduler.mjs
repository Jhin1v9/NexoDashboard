/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * LUNA SCHEDULER v10.2 — Adaptativo
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * REGRAS:
 * • SCAN: A cada 10 minutos → extrai mensagens, guarda no buffer, NÃO envia
 * • RELATÓRIO: A cada 30 minutos → junta TODAS as novidades e envia no grupo
 * • Se não há novidades → envia 1x "sem novidades", depois SILÊNCIO
 * • Só volta a enviar quando detectar novas mensagens
 */

import { runAgent } from './luna-cto-agent.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

const SCAN_INTERVAL_MS = 10 * 60 * 1000;      // 10 minutos
const REPORT_INTERVAL_MS = 30 * 60 * 1000;     // 30 minutos

const LOG_FILE = path.join(__dirname, '..', 'backend', 'data', 'luna-scheduler.log');
const PID_FILE = path.join(__dirname, '..', 'artifacts', 'luna-scheduler.pid');

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITÁRIOS
// ═══════════════════════════════════════════════════════════════════════════════

function now() { return new Date().toLocaleString('pt-BR', { timeZone: 'Europe/Madrid' }); }
function nowTime() { return new Date().toLocaleTimeString('pt-BR', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' }); }

function log(msg) {
  const line = `[${now()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULER
// ═══════════════════════════════════════════════════════════════════════════════

async function runScan() {
  log('🔍 INICIANDO SCAN (10min)');
  try {
    const result = await runAgent(false); // isReportTime = false
    log(`✅ Scan completo: ${result.status} | buffered: ${result.buffered || 0}`);
    return result;
  } catch (e) {
    log(`❌ Erro no scan: ${e.message}`);
    return { status: 'error', hasNews: false };
  }
}

async function runReport() {
  log('📋 INICIANDO RELATÓRIO (30min)');
  try {
    const result = await runAgent(true); // isReportTime = true
    log(`✅ Relatório: ${result.status} | hasNews: ${result.hasNews}`);
    return result;
  } catch (e) {
    log(`❌ Erro no relatório: ${e.message}`);
    return { status: 'error', hasNews: false };
  }
}

async function main() {
  ensureDir(path.dirname(LOG_FILE));
  ensureDir(path.dirname(PID_FILE));
  fs.writeFileSync(PID_FILE, process.pid.toString());
  
  log('═══════════════════════════════════════════════════════════════════════');
  log('  🌙 LUNA SCHEDULER v10.2 INICIADO');
  log('  SCAN: 10min | RELATÓRIO: 30min');
  log('  Só envia no grupo Production | Silêncio quando não há novidades');
  log('═══════════════════════════════════════════════════════════════════════');
  
  let lastReportTime = 0;
  let scanCount = 0;
  
  while (true) {
    const now = Date.now();
    const timeSinceLastReport = now - lastReportTime;
    const isReportTime = timeSinceLastReport >= REPORT_INTERVAL_MS;
    
    if (isReportTime) {
      // ═══ HORA DO RELATÓRIO ═══
      log(`\n📋 RODADA #${scanCount + 1} — HORA DO RELATÓRIO!`);
      const result = await runReport();
      lastReportTime = Date.now();
      scanCount = 0;
      
      log(`\n⏰ Próximo relatório em 30 minutos`);
      log(`   Próximo scan em 10 minutos`);
      
    } else {
      // ═══ APENAS SCAN ═══
      scanCount++;
      log(`\n🔍 RODADA #${scanCount} — SCAN RÁPIDO`);
      const result = await runScan();
      
      const nextReportIn = Math.ceil((REPORT_INTERVAL_MS - (Date.now() - lastReportTime)) / 60000);
      log(`   Próximo scan: 10 min | Próximo relatório: ${nextReportIn} min`);
    }
    
    // Aguarda 10 minutos
    log(`⏳ Aguardando ${SCAN_INTERVAL_MS / 60000} minutos...\n`);
    await sleep(SCAN_INTERVAL_MS);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXECUÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

main().catch(e => {
  log(`💥 ERRO FATAL: ${e.message}`);
  process.exit(1);
});
