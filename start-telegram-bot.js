#!/usr/bin/env node
/**
 * LUNA Telegram Bot — Standalone Launcher
 * Roda independente do server.js para 24/7 uptime
 */
const { startAgent, stopAgent } = require('./agents/telegram-luna-agent.cjs');

async function main() {
  const started = await startAgent();
  if (!started) {
    console.error('❌ Falha ao iniciar bot do Telegram');
    process.exit(1);
  }
  console.log('🤖 Bot do Telegram iniciado em modo standalone');
}

main();

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT recebido, parando bot...');
  stopAgent();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM recebido, parando bot...');
  stopAgent();
  process.exit(0);
});
