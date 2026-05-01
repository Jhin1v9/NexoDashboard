/**
 * NEXO WhatsApp Scheduler
 * Executa o agente a cada 30 minutos e envia relatório para Abner
 * 
 * Configuração:
 * - Intervalo: 30 minutos
 * - Destino: Abner (34685093192)
 * - Perfil: Luna (porta 9223)
 */

import { runAgent } from './nexo-whatsapp-agent-v8.mjs';

const INTERVAL_MS = 30 * 60 * 1000; // 30 minutos

console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║  NEXO WhatsApp Scheduler                                            ║');
console.log('║  Intervalo: 30 minutos                                              ║');
console.log('║  Destino: Abner (34685093192)                                       ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');

async function scheduledRun() {
  const now = new Date().toLocaleString('pt-BR', { timeZone: 'Europe/Madrid' });
  console.log(`\n[${now}] ⏰ Executando agente agendado...`);
  
  try {
    await runAgent();
  } catch (e) {
    console.error(`[${now}] ❌ Erro na execução:`, e.message);
  }
  
  const nextRun = new Date(Date.now() + INTERVAL_MS).toLocaleString('pt-BR', { timeZone: 'Europe/Madrid' });
  console.log(`[${now}] ✅ Concluído. Próxima execução: ${nextRun}`);
}

// Executa imediatamente na primeira vez
scheduledRun();

// Agenda execuções subsequentes
setInterval(scheduledRun, INTERVAL_MS);

console.log('\n✅ Scheduler iniciado. Aguardando próximas execuções...');
