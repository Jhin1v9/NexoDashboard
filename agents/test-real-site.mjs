#!/usr/bin/env node
/**
 * Teste REAL com site ao vivo — verifica separação thinking/response
 * Usa o kimi-bridge diretamente (sem TUI) para analisar https://example.com
 */

import { KimiBridge } from './kimi-bridge.cjs';
import path from 'path';
import os from 'os';

const TEST_SITE = 'https://example.com';
const PROMPT = `Analise o site ${TEST_SITE} e me diga em 2-3 parágrafos: o que é esse site, qual a tecnologia provável por trás, e se tem algum problema de segurança óbvio. Responda em português.`;

const userId = 'test-real-site-' + Date.now();
const STORE_DIR = path.join(os.homedir(), '.luna', 'store');

const bridge = new KimiBridge({ storeDir: STORE_DIR });

const events = [];
const thinkingDeltas = [];
const responseDeltas = [];
let finalResponse = '';
let finalThinking = '';
let sources = new Set();

console.log('🚀 Iniciando teste real...');
console.log(`🌐 Site: ${TEST_SITE}`);
console.log(`💬 Prompt: ${PROMPT.slice(0, 80)}...`);
console.log('');

const startTime = Date.now();

try {
  const stream = bridge.sendMessageStream(userId, PROMPT, { mode: 'thinking' });

  for await (const event of stream) {
    events.push(event);

    switch (event.type) {
      case 'thinking_delta':
        thinkingDeltas.push(event.text);
        process.stdout.write('\r🧠 Thinking... ' + thinkingDeltas.join('').length + ' chars');
        break;

      case 'response_delta':
        responseDeltas.push(event.text);
        process.stdout.write('\r💬 Response... ' + responseDeltas.join('').length + ' chars');
        break;

      case 'can_steer':
        // ignore
        break;

      case 'waiting':
        process.stdout.write(`\r⏳ ${event.message}`);
        break;

      case 'done':
        finalResponse = event.response || '';
        finalThinking = event.thinking || '';
        process.stdout.write('\r');
        break;
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // ── Analysis ──
  const accumulatedResponse = responseDeltas.join('');
  const accumulatedThinking = thinkingDeltas.join('');

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('RESULTADO DO TESTE REAL');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`⏱️  Tempo total: ${elapsed}s`);
  console.log('');
  console.log('📊 DURANTE O STREAMING (deltas acumulados):');
  console.log(`   Thinking deltas: ${accumulatedThinking.length} chars (${thinkingDeltas.length} eventos)`);
  console.log(`   Response deltas: ${accumulatedResponse.length} chars (${responseDeltas.length} eventos)`);
  console.log('');
  console.log('📊 FINAL (evento done):');
  console.log(`   Final thinking:  ${finalThinking.length} chars`);
  console.log(`   Final response:  ${finalResponse.length} chars`);
  console.log('');

  // Check for thinking bleed
  const thinkingInResponse = finalThinking && finalResponse.includes(finalThinking.slice(0, 100));
  const responseLooksLikeThinking = /^\s*(O usuário|Vou |Agora |Preciso |Primeiro |Vamos |Então |Deixa |Hmm |Ok |Okay |Let me |I need |I'll |First |Now |So |The user)/i.test(finalResponse);
  const responseHasCodeBlock = finalResponse.includes('```');

  console.log('🔍 ANÁLISE DE SEPARAÇÃO:');
  console.log(`   Thinking vazou para response? ${thinkingInResponse ? '⚠️ SIM' : '✅ NÃO'}`);
  console.log(`   Response parece thinking?     ${responseLooksLikeThinking ? '⚠️ SIM' : '✅ NÃO'}`);
  console.log(`   Response tem code blocks?     ${responseHasCodeBlock ? '✅ SIM' : '⚠️ NÃO'}`);
  console.log('');

  // Check if interceptor worked
  const page = await bridge._getOrCreateUserPage(userId);
  const intercepted = await page.evaluate(() => {
    const s = window.__lunaStream;
    return s ? { active: s.active, reasoningLen: s.reasoning.length, contentLen: s.content.length, eventCount: s.events.length } : null;
  });

  console.log('🔌 STREAM INTERCEPTOR:');
  if (intercepted && intercepted.active) {
    console.log(`   ✅ Ativo! reasoning=${intercepted.reasoningLen}, content=${intercepted.contentLen}, events=${intercepted.eventCount}`);
  } else {
    console.log(`   ⚠️ Não capturou. Fallback para DOM.`);
  }
  console.log('');

  // Show previews
  console.log('📝 PREVIEW FINAL RESPONSE (primeiros 400 chars):');
  console.log('─'.repeat(60));
  console.log(finalResponse.slice(0, 400));
  console.log('─'.repeat(60));
  console.log('');

  if (finalThinking) {
    console.log('🧠 PREVIEW FINAL THINKING (primeiros 400 chars):');
    console.log('─'.repeat(60));
    console.log(finalThinking.slice(0, 400));
    console.log('─'.repeat(60));
  }

  // Verdict
  const isClean = !thinkingInResponse && !responseLooksLikeThinking && finalResponse.length > 100;
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(isClean ? '✅ TESTE PASSOU — Thinking/response separados corretamente' : '❌ TESTE FALHOU — Thinking vazou para response');
  console.log('═══════════════════════════════════════════════════════════════');

  process.exit(isClean ? 0 : 1);

} catch (err) {
  console.error('\n❌ Erro no teste:', err.message);
  console.error(err.stack);
  process.exit(1);
}
