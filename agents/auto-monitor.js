/**
 * NEXO Auto-Monitor
 * Verifica health dos projetos periodicamente
 */

const axios = require('axios');
const cron = require('node-cron');

const CONFIG = {
  apiUrl: 'http://127.0.0.1:3456/api/state',
  checkInterval: '0 * * * *', // Every hour
};

async function check() {
  try {
    const res = await axios.get(CONFIG.apiUrl);
    const { clients, predictions } = res.data;
    
    console.log(`[${new Date().toISOString()}] Monitor check`);
    console.log(`  Clientes: ${clients.length}`);
    console.log(`  Predições: ${predictions.length}`);
    
    if (predictions.length > 0) {
      console.log('  ⚠️ Alertas:');
      predictions.forEach(p => console.log(`    - ${p.msg}`));
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Monitor error:`, err.message);
  }
}

// Run immediately
check();

// Schedule
cron.schedule(CONFIG.checkInterval, check);

console.log('🔍 NEXO Auto-Monitor iniciado');
console.log(`   Intervalo: ${CONFIG.checkInterval}`);
