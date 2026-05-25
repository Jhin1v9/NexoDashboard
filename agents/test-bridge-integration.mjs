#!/usr/bin/env node
/**
 * Teste de integração para o KimiBridge — simula _pollThinkingAndResponse
 * com mocks de page.evaluate para validar as 4 camadas de extração.
 */

import { KimiBridge } from './kimi-bridge.cjs';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// Helper: cria um mock de page que retorna valores controlados
function createMockPage(evaluateFn) {
  return {
    evaluate: async (fn) => evaluateFn(fn),
    url: () => 'https://kimi.com/chat/123',
    isClosed: () => false,
    removeAllListeners: () => {},
    on: () => {},
    goto: async () => {},
    waitForTimeout: async () => {},
    bringToFront: async () => {},
    locator: () => ({
      count: async () => 0,
      textContent: async () => '',
      innerText: async () => '',
      fill: async () => {},
      type: async () => {},
      press: async () => {},
      first: () => ({ count: async () => 0 }),
      last: () => ({ count: async () => 0 }),
    }),
    keyboard: { press: async () => {} },
    addInitScript: async () => {},
  };
}

test('_pollThinkingAndResponse usa Layer 1 (stream interceptor) quando disponível', async () => {
  const bridge = new KimiBridge({ debug: false });
  
  const mockPage = createMockPage(async (fn) => {
    // Simula window.__lunaStream com dados do interceptor
    if (typeof fn === 'function') {
      const window = {
        __lunaStream: {
          active: true,
          reasoning: 'Pensamento interceptado',
          content: 'Resposta interceptada',
        }
      };
      // A função fn é executada no contexto do browser, mas aqui simulamos
      // verificando se ela acessa __lunaStream
      const fnStr = fn.toString();
      if (fnStr.includes('__lunaStream')) {
        return {
          thinking: window.__lunaStream.reasoning,
          response: window.__lunaStream.content,
          source: 'intercept',
        };
      }
    }
    return { thinking: '', response: '', canSteer: false, isGenerating: false };
  });
  
  const result = await bridge._pollThinkingAndResponse(mockPage);
  
  if (result.thinking !== 'Pensamento interceptado') {
    throw new Error(`Expected thinking="Pensamento interceptado", got "${result.thinking}"`);
  }
  if (result.response !== 'Resposta interceptada') {
    throw new Error(`Expected response="Resposta interceptada", got "${result.response}"`);
  }
  if (result.source !== 'intercept') {
    throw new Error(`Expected source="intercept", got "${result.source}"`);
  }
});

test('_pollThinkingAndResponse faz fallback para Layer 4 (DOM) quando interceptor vazio', async () => {
  const bridge = new KimiBridge({ debug: false });
  
  const mockPage = createMockPage(async (fn) => {
    if (typeof fn === 'function') {
      const fnStr = fn.toString();
      // Primeira chamada: __lunaStream vazio (Layer 1)
      if (fnStr.includes('__lunaStream')) {
        return null; // Não tem dados interceptados
      }
      // Segunda chamada: DOM extraction (Layer 2-4)
      if (fnStr.includes('segment-assistant') || fnStr.includes('assistantSelectors')) {
        return {
          thinking: 'Pensamento DOM',
          response: 'Resposta DOM',
          source: 'dom-fallback',
        };
      }
    }
    return { thinking: '', response: '', canSteer: false, isGenerating: false };
  });
  
  const result = await bridge._pollThinkingAndResponse(mockPage);
  
  if (result.thinking !== 'Pensamento DOM') {
    throw new Error(`Expected thinking="Pensamento DOM", got "${result.thinking}"`);
  }
  if (result.response !== 'Resposta DOM') {
    throw new Error(`Expected response="Resposta DOM", got "${result.response}"`);
  }
  if (result.source !== 'dom-fallback') {
    throw new Error(`Expected source="dom-fallback", got "${result.source}"`);
  }
});

test('_detectUiState detecta canSteer e isGenerating corretamente', async () => {
  const bridge = new KimiBridge({ debug: false });
  
  const mockPage = createMockPage(async (fn) => {
    if (typeof fn === 'function') {
      const fnStr = fn.toString();
      if (fnStr.includes('send-button-container') || fnStr.includes('stop-button-container')) {
        return {
          canSteer: true,
          isGenerating: false,
        };
      }
    }
    return { canSteer: false, isGenerating: false };
  });
  
  const result = await bridge._detectUiState(mockPage);
  
  if (result.canSteer !== true) {
    throw new Error(`Expected canSteer=true, got ${result.canSteer}`);
  }
  if (result.isGenerating !== false) {
    throw new Error(`Expected isGenerating=false, got ${result.isGenerating}`);
  }
});

test('_extractResponse prioriza stream interceptor', async () => {
  const bridge = new KimiBridge({ debug: false });
  
  const mockPage = createMockPage(async (fn) => {
    if (typeof fn === 'function') {
      const fnStr = fn.toString();
      if (fnStr.includes('__lunaStream')) {
        return 'Resposta do interceptor';
      }
    }
    return '';
  });
  
  const result = await bridge._extractResponse(mockPage);
  
  if (result !== 'Resposta do interceptor') {
    throw new Error(`Expected "Resposta do interceptor", got "${result}"`);
  }
});

// ── Runner ──

async function run() {
  let passed = 0;
  let failed = 0;
  const failures = [];
  
  for (const { name, fn } of tests) {
    try {
      await fn();
      passed++;
      console.log(`✅ ${name}`);
    } catch (err) {
      failed++;
      failures.push({ name, error: err.message });
      console.log(`❌ ${name}`);
      console.log(`   ${err.message}`);
    }
  }
  
  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`Resultado: ${passed} passaram, ${failed} falharam de ${tests.length} testes`);
  console.log(`═══════════════════════════════════════════════════════════════`);
  
  if (failed > 0) {
    console.log('\nFalhas:');
    for (const f of failures) {
      console.log(`  • ${f.name}: ${f.error}`);
    }
    process.exit(1);
  }
  
  console.log('\n✅ Todos os testes de integração passaram!');
}

run().catch(err => {
  console.error('Erro no runner:', err);
  process.exit(1);
});
