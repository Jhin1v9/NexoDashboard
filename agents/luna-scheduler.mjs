/**
 * LUNA Scheduler — Adaptativo
 * 
 * Modo Normal: 30 minutos (quando há novidades)
 * Modo Acelerado: 10 minutos (quando não há novidades)
 * 
 * Sempre envia relatório para 685093192 (Abner)
 */

import { runAgent } from './luna-cto-agent.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHECKPOINT_FILE = path.join(__dirname, '..', 'backend', 'data', 'luna-checkpoint.json');

function readJSON(file, defaultVal = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return defaultVal; }
}

function nowBR() {
  return new Date().toLocaleString('pt-BR', { timeZone: 'Europe/Madrid' });
}

const MODE_NORMAL = 30 * 60 * 1000;      // 30 minutos
const MODE_ACCELERATED = 10 * 60 * 1000;  // 10 minutos

let currentTimer = null;
let isRunning = false;

console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║  🌙 LUNA Scheduler — Modo Adaptativo                                ║');
console.log('║                                                                     ║');
console.log('║  📭 Sem novidades → 10 minutos (acelerado)                          ║');
console.log('║  🎉 Com novidades → 30 minutos (normal)                             ║');
console.log('║                                                                     ║');
console.log('║  📱 Relatório SEMPRE enviado para 34685093192                       ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');

async function runCycle() {
  if (isRunning) {
    console.log(`[${nowBR()}] ⏳ Ciclo anterior ainda em execução. Aguardando...`);
    return;
  }
  
  isRunning = true;
  const now = nowBR();
  console.log(`\n[${now}] 🌙 Executando ciclo Luna...`);
  
  try {
    const result = await runAgent();
    
    // Determina próximo intervalo baseado no resultado
    let nextInterval;
    let modeLabel;
    
    if (result?.hasNews) {
      // Novidades detectadas → modo normal (30min)
      nextInterval = MODE_NORMAL;
      modeLabel = 'NORMAL (30min)';
      console.log(`[${now}] 🎉 Novidades! Próximo ciclo em 30 minutos.`);
    } else {
      // Sem novidades → modo acelerado (10min)
      nextInterval = MODE_ACCELERATED;
      modeLabel = 'ACELERADO (10min)';
      console.log(`[${now}] 📭 Sem novidades. Próximo ciclo em 10 minutos.`);
    }
    
    // Agenda próximo ciclo
    if (currentTimer) clearTimeout(currentTimer);
    currentTimer = setTimeout(runCycle, nextInterval);
    
    const nextRun = new Date(Date.now() + nextInterval).toLocaleString('pt-BR', { timeZone: 'Europe/Madrid' });
    console.log(`[${now}] 🕐 Próximo ciclo: ${nextRun} [${modeLabel}]`);
    
  } catch (e) {
    console.error(`[${now}] ❌ Erro no ciclo:`, e.message);
    
    // Em caso de erro, tenta novamente em 5 minutos
    if (currentTimer) clearTimeout(currentTimer);
    currentTimer = setTimeout(runCycle, 5 * 60 * 1000);
    console.log(`[${now}] 🔄 Tentando novamente em 5 minutos...`);
    
  } finally {
    isRunning = false;
  }
}

// Executa imediatamente
runCycle();

// Mantém o processo vivo
process.on('SIGINT', () => {
  console.log('\n🌙 Luna encerrando...');
  if (currentTimer) clearTimeout(currentTimer);
  process.exit(0);
});

console.log('\n✅ Luna iniciada. Aguardando ciclos...');
