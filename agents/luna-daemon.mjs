/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * LUNA DAEMON v10.2 — Serviço Windows Permanente
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Roda o Luna Scheduler como daemon permanente.
 * Se o processo morrer, reinicia automaticamente.
 * Escreve logs rotativos.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const LOG_DIR = path.join(ROOT, 'backend', 'data');
const PID_FILE = path.join(ROOT, 'artifacts', 'luna-daemon.pid');
const SCHEDULER_PATH = path.join(__dirname, 'luna-scheduler.mjs');

function now() { return new Date().toLocaleString('pt-BR', { timeZone: 'Europe/Madrid' }); }

function log(msg) {
  const line = `[${now()}] [DAEMON] ${msg}`;
  console.log(line);
  const logFile = path.join(LOG_DIR, 'luna-daemon.log');
  fs.appendFileSync(logFile, line + '\n');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writePid(pid) {
  ensureDir(path.dirname(PID_FILE));
  fs.writeFileSync(PID_FILE, pid.toString());
}

function readPid() {
  try { return parseInt(fs.readFileSync(PID_FILE, 'utf8').trim()); }
  catch { return null; }
}

function runScheduler() {
  return new Promise((resolve) => {
    log('🚀 Iniciando Luna Scheduler...');
    const args = [SCHEDULER_PATH];
    if (process.argv.includes('--headless')) args.push('--headless');
    
    const child = spawn('node', args, {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    
    writePid(child.pid);
    log(`📌 Scheduler PID: ${child.pid}`);
    
    child.stdout.on('data', (data) => {
      const lines = data.toString().trim().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          // Log do scheduler vai para arquivo separado
          const schedulerLog = path.join(LOG_DIR, 'luna-scheduler.log');
          fs.appendFileSync(schedulerLog, line + '\n');
        }
      }
    });
    
    child.stderr.on('data', (data) => {
      const line = data.toString().trim();
      if (line) {
        log(`⚠️ STDERR: ${line}`);
        const errLog = path.join(LOG_DIR, 'luna-scheduler-errors.log');
        fs.appendFileSync(errLog, `[${now()}] ${line}\n`);
      }
    });
    
    child.on('exit', (code, signal) => {
      log(`💀 Scheduler encerrou (code: ${code}, signal: ${signal})`);
      resolve({ code, signal });
    });
    
    child.on('error', (err) => {
      log(`💥 Erro no scheduler: ${err.message}`);
      resolve({ code: -1, signal: null });
    });
  });
}

async function main() {
  ensureDir(LOG_DIR);
  ensureDir(path.dirname(PID_FILE));
  
  // Verifica se já está rodando
  const existingPid = readPid();
  if (existingPid) {
    try {
      process.kill(existingPid, 0);
      log(`⚠️ Daemon já está rodando (PID: ${existingPid})`);
      process.exit(0);
    } catch {
      log('🧹 PID antigo encontrado, limpando...');
    }
  }
  
  writePid(process.pid);
  log('═══════════════════════════════════════════════════════════════════════');
  log('  🌙 LUNA DAEMON v10.2 INICIADO');
  log('  PID: ' + process.pid);
  log('  Reinicia automático se o scheduler morrer');
  log('═══════════════════════════════════════════════════════════════════════');
  
  let restartCount = 0;
  const MAX_RESTARTS = 10;
  const RESTART_DELAY_MS = 5000;
  
  while (restartCount < MAX_RESTARTS) {
    const result = await runScheduler();
    restartCount++;
    
    if (result.code === 0) {
      log('✅ Scheduler encerrou normalmente');
      break;
    }
    
    log(`🔄 Reiniciando scheduler (${restartCount}/${MAX_RESTARTS}) em ${RESTART_DELAY_MS/1000}s...`);
    await new Promise(r => setTimeout(r, RESTART_DELAY_MS));
  }
  
  if (restartCount >= MAX_RESTARTS) {
    log('❌ Máximo de reinicializações atingido. Daemon encerrando.');
  }
  
  try { fs.unlinkSync(PID_FILE); } catch {}
  process.exit(restartCount >= MAX_RESTARTS ? 1 : 0);
}

// Graceful shutdown
process.on('SIGINT', () => {
  log('🛑 SIGINT recebido. Encerrando daemon...');
  try { fs.unlinkSync(PID_FILE); } catch {}
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('🛑 SIGTERM recebido. Encerrando daemon...');
  try { fs.unlinkSync(PID_FILE); } catch {}
  process.exit(0);
});

main().catch(e => {
  log(`💥 ERRO FATAL: ${e.message}`);
  process.exit(1);
});
