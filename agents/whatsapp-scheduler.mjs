/**
 * NEXO WhatsApp Scheduler v9.0
 * Executa o agente a cada 30 minutos com checkpoint inteligente
 * 
 * NOVO v9.0:
 * - Só envia relatório quando há NOVIDADES
 * - Verifica chat pessoal do Abner para ordens
 * - Notificações push via WhatsApp
 * - Evita spam de relatórios repetidos
 */

import { runAgent } from './nexo-whatsapp-agent-v9.mjs';

const INTERVAL_MS = 30 * 60 * 1000; // 30 minutos

console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║  NEXO WhatsApp Scheduler v9.0                                       ║');
console.log('║  Checkpoint Inteligente — Só reporta novidades                      ║');
console.log('║  Intervalo: 30 minutos                                              ║');
console.log('║  Destino: Abner (34685093192)                                       ║');
console.log('║  Usa o agente v9.0 (nexo-whatsapp-agent-v9.mjs)                      ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');

async function scheduledRun() {
  const now = new Date().toLocaleString('pt-BR', { timeZone: 'Europe/Madrid' });
  console.log(`\n[${now}] ⏰ Executando agente agendado...`);
  
  try {
    const result = await runAgent();
    
    if (result?.status === 'no_news') {
      console.log(`[${now}] ℹ️  Sem novidades. Aguardando próxima verificação.`);
    } else if (result?.status === 'success') {
      console.log(`[${now}] ✅ Novidades detectadas e reportadas!`);
    }
  } catch (e) {
    console.error(`[${now}] ❌ Erro:`, e.message);
  }
  
  const nextRun = new Date(Date.now() + INTERVAL_MS).toLocaleString('pt-BR', { timeZone: 'Europe/Madrid' });
  console.log(`[${now}] 🕐 Próxima execução: ${nextRun}`);
}

// Executa imediatamente
scheduledRun();

// Agenda execuções subsequentes
setInterval(scheduledRun, INTERVAL_MS);

console.log('\n✅ Scheduler v9.0 iniciado. Aguardando novidades...');
