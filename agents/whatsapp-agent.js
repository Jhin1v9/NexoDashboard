/**
 * NEXO WhatsApp Agent
 * Automação WhatsApp via Playwright
 */

const { chromium } = require('playwright');
const axios = require('axios');

const CONFIG = {
  groupName: 'Production 2026',
  apiUrl: 'http://127.0.0.1:3456/api/whatsapp',
  dataDir: '../data/whatsapp-profile',
};

async function extractTasks(text) {
  // Regex para detectar tarefas em português
  const patterns = [
    /(fazer|faz|fazemos|precisamos|tem que|temos que)\s+(.+)/i,
    /(tarefa|task|todo):?\s*(.+)/i,
    /(bug|erro|problema):?\s*(.+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[2].trim();
  }
  return null;
}

async function run() {
  console.log('📱 WhatsApp Agent iniciando...');
  
  const browser = await chromium.launchPersistentContext(CONFIG.dataDir, {
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  
  const page = await browser.newPage();
  await page.goto('https://web.whatsapp.com');
  
  console.log('   Aguardando QR code scan...');
  
  // Aguarda chat list carregar
  await page.waitForSelector('[data-testid="chat-list"]', { timeout: 120000 }).catch(() => {
    console.log('   Timeout aguardando login');
  });
  
  console.log('   Conectado! Monitorando grupo:', CONFIG.groupName);
  
  // Loop de monitoramento
  // (Simplificado - em produção usar observer/mutation)
}

if (require.main === module) {
  run().catch(console.error);
}

module.exports = { extractTasks };
