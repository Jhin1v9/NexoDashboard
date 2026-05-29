#!/usr/bin/env node
/**
 * Luna Self-Consult — usa o bridge logado do usuário (luna-cli)
 * Cria novo chat e envia prompt completo para análise da Kimi.
 */

import { KimiBridge } from './kimi-bridge.cjs';
import { readFileSync } from 'fs';

const USER_ID = 'luna-cli';
const bridge = new KimiBridge({ headless: false });

// Lê os arquivos modificados para contexto completo
const bridgeCode = readFileSync('./kimi-bridge.cjs', 'utf-8');
const tuiCode = readFileSync('./luna-tui.mjs', 'utf-8');

const prompt = `🧠 CODE REVIEW — Luna CLI v3.2 Critical Fixes

Você é engenheira sênior revisando mudanças em um bridge Playwright CDP + Node.js que orquestra você (Kimi Web).

=== ARQUIVO MODIFICADO: kimi-bridge.cjs ===

[Contexto completo do arquivo está anexado. As mudanças principais são:]

1. REMOVIDO INACTIVITY_TIMEOUT (60s). O loop de stream agora é while(!isComplete) — sem timeout.
   - Motivo: quando você usa python/fetch interno, fica 2-5min sem gerar texto. Isso é atividade válida.

2. NOVO: detecção de fim robusta. Só marca done quando:
   - buttonsVisible === true
   - isGenerating === false
   - texto estável por 3s (textStableSince)
   - _hasActiveLoadingIndicators() === false
   - Double-check após 500ms para evitar race conditions

3. NOVO: _hasActiveLoadingIndicators(page):
   - Detecta spinners (loading-spinner, animate-spin, svg[class*="spin"])
   - Detecta thinking blocks abertos com texto ativo (Pensando, Thinking, Analisando...)
   - Detecta cursor blink / typing indicators
   - Detecta code execution "running"
   - Retorna false em erro de eval (não bloqueia pra sempre)

4. NOVO: abortGeneration(userId):
   - Clica no botão stop da UI com múltiplos fallbacks de seletor

5. NOVO: anonymousConsult(prompt):
   - Cria browser.newContext() incognito
   - Vai pra kimi.com sem login
   - Usa a mesma lógica de polling robusta
   - Retorna { response, thinking, length }
   - Sempre fecha context no finally

=== ARQUIVO MODIFICADO: luna-tui.mjs ===

[Contexto completo do arquivo está anexado. As mudanças principais são:]

1. FIX case 'error':
   - setIsProcessing(false) — libera input imediatamente
   - Limpa streamingText, thinkingText, statusText
   - Reseta activeToolCalls, activeAgents, canSteer

2. FIX scroll:
   - Quando followMode=false e nova mensagem chega:
     scrollOffset incrementa em 1 (mantém posição visual)
   - Antes: novas mensagens eram cortadas inesperadamente

3. NOVO: Ctrl+C durante processing:
   - Aborta operação em vez de sair do programa
   - Chama bridge.abortGeneration()
   - Mostra "⏹ Operação abortada pelo usuário."
   - shouldAbortRef no loop for-await ignora eventos restantes

=== PERGUNTAS TÉCNICAS ===

Q1: O while(!isComplete) pode travar para sempre? Edge cases?
   (ex: isGenerating preso em true, botões nunca aparecem, DOM crasha)

Q2: _hasActiveLoadingIndicators usa seletores CSS frágeis. Alternativa semântica/robusta?

Q3: anonymousConsult cria newContext() por chamada. Memory/performance impact?

Q4: Risco de memory leak no polling loop (page.evaluate() a cada 800ms)?

Q5: Scroll fix: incrementar scrollOffset em 1 é correto ou melhor tracking por message index?

Responda em português com análise profunda.`;

async function main() {
  try {
    console.log('🔌 Connecting...');
    await bridge.connect();
    console.log('✅ Connected');

    // Get or create user's page
    const page = await bridge._getOrCreateUserPage(USER_ID);
    console.log('📄 User page ready');

    // Create NEW chat so we don't pollute user's current conversation
    console.log('🆕 Creating new chat...');
    await page.goto('https://kimi.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    console.log('⌨️  Sending FULL prompt...');
    // Use the bridge's own sendMessageStream — it handles fill/type, events, everything
    const stream = bridge.sendMessageStream(USER_ID, prompt, { mode: 'thinking' });

    let responseText = '';
    let thinkingText = '';
    let done = false;

    for await (const ev of stream) {
      if (ev.type === 'thinking_delta') {
        thinkingText += ev.text || '';
        if (thinkingText.length % 500 < 10) process.stdout.write('🧠');
      } else if (ev.type === 'response_delta') {
        responseText += ev.text || '';
        if (responseText.length % 500 < 10) process.stdout.write('💬');
      } else if (ev.type === 'waiting') {
        process.stdout.write('⏳');
      } else if (ev.type === 'done') {
        responseText = ev.response || responseText;
        thinkingText = ev.thinking || thinkingText;
        done = true;
      }
    }

    console.log('\n');
    if (!done) console.log('⚠️ Stream ended without done event');

    console.log('='.repeat(60));
    console.log('RESPONSE:');
    console.log('='.repeat(60));
    console.log(responseText);
    console.log('='.repeat(60));
    console.log(`\n📊 Response: ${responseText.length} chars | Thinking: ${thinkingText.length} chars`);

    const fs = await import('fs');
    fs.writeFileSync('/tmp/luna-self-consult.md',
      `# Kimi Consult Response\n\n## Thinking (${thinkingText.length})\n${thinkingText}\n\n## Response (${responseText.length})\n${responseText}\n`
    );
    console.log('💾 Saved to /tmp/luna-self-consult.md');

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
  } finally {
    await bridge.disconnect();
    console.log('🔌 Disconnected');
  }
}

main();
