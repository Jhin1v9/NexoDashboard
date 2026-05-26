#!/usr/bin/env node
/**
 * Testes unitários para parseTagResponse (double-bracket delimiters)
 * 18 casos cobrindo todos os modos + edge cases + backward compatibility
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { parseTagResponse, parseKimiResponse } = require('./luna-soul.cjs');

let passed = 0;
let failed = 0;

function test(name, input, expected) {
  const result = parseTagResponse(input);
  let ok = true;
  for (const key of Object.keys(expected)) {
    const a = JSON.stringify(result?.[key]);
    const b = JSON.stringify(expected[key]);
    if (a !== b) {
      ok = false;
      console.error(`  ❌ ${name} — key "${key}": got ${a}, expected ${b}`);
    }
  }
  if (ok) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.error(`     input: ${JSON.stringify(input).slice(0, 120)}`);
  }
}

function testMode(name, input, expectedMode) {
  const result = parseTagResponse(input);
  if (result?.mode === expectedMode) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.error(`  ❌ ${name} — mode: got "${result?.mode}", expected "${expectedMode}"`);
    console.error(`     input: ${JSON.stringify(input).slice(0, 120)}`);
  }
}

console.log('🧪 parseTagResponse — Unit Tests (Double-Bracket Delimiters)\n');

// 1. CHAT simples
test('CHAT simples', '[[response]]Oi![[/response]]', { mode: 'CHAT', response: 'Oi!' });

// 2. ACTION com response
test('ACTION', '[[response]]Feito![[/response]]\n[[action]]{"tool":"readFile","params":{"path":"x"}}[[/action]]', {
  mode: 'ACTION', response: 'Feito!', tool: 'readFile', params: { path: 'x' }
});

// 3. PLAN com 2 actions
test('PLAN 2 actions', '[[response]]Vou fazer 2 coisas[[/response]]\n[[action]]{"tool":"a","params":{"x":1}}[[/action]]\n[[action]]{"tool":"b","params":{"y":2}}[[/action]]', {
  mode: 'PLAN', response: 'Vou fazer 2 coisas', steps: [{ tool: 'a', params: { x: 1 } }, { tool: 'b', params: { y: 2 } }]
});

// 4. META
test('META', '[[response]]Criando tool...[[/response]]\n[[meta]]{"action":"create_tool","params":{"name":"foo"}}[[/meta]]', {
  mode: 'META', response: 'Criando tool...', meta_action: 'create_tool', params: { name: 'foo' }
});

// 5. SUGGEST
test('SUGGEST', '[[response]]Sugiro...[[/response]]\n[[suggest]]{"type":"persona","target":"surgeon"}[[/suggest]]', {
  mode: 'SUGGEST', response: 'Sugiro...', suggestion: { type: 'persona', target: 'surgeon' }
});

// 6. Response com newlines reais
test('Response com newlines', '[[response]]Linha1\nLinha2[[/response]]', { mode: 'CHAT', response: 'Linha1\nLinha2' });

// 7. Response com emojis
test('Response com emoji', '[[response]]🌙 Oi![[/response]]', { mode: 'CHAT', response: '🌙 Oi!' });

// 8. Backward compatibility — JSON antigo
test('Fallback JSON antigo', '{"mode":"CHAT","response":"Oi"}', { mode: 'CHAT', response: 'Oi' });

// 9. Fallback texto cru sem delimiters
test('Fallback texto cru', 'Oi sem tags', { mode: 'CHAT', response: 'Oi sem tags' });

// 10. Action com JSON quebrado (newlines reais dentro)
test('Action JSON com newlines', '[[response]]Ok[[/response]]\n[[action]]{\n  "tool": "x",\n  "params": {"a": 1}\n}[[/action]]', {
  mode: 'ACTION', response: 'Ok', tool: 'x', params: { a: 1 }
});

// 11. DONE implícito (CHAT sem tags extras)
testMode('DONE implícito (CHAT)', '[[response]]Task complete![[/response]]', 'CHAT');

// 12. Response vazio
test('Response vazio', '[[response]][[/response]]', { mode: 'CHAT', response: '' });

// 13. Action sem response
test('Action sem response', '[[action]]{"tool":"x","params":{}}[[/action]]', {
  mode: 'ACTION', response: '', tool: 'x', params: {}
});

// 14. Texto antes/depois dos delimiters (deve ignorar)
test('Texto extra ignorado', 'bla bla [[response]]oi[[/response]] mais bla', { mode: 'CHAT', response: 'oi' });

// 15. Fallback JSON ACTION backward compat
test('Fallback JSON ACTION', '{"mode":"ACTION","tool":"readFile","params":{"path":"x"}}', {
  mode: 'ACTION', tool: 'readFile', params: { path: 'x' }
});

// 16. Unclosed [[response]] (sem closing tag)
test('Unclosed [[response]]', '[[response]]Oi, tudo bem?', { mode: 'CHAT', response: 'Oi, tudo bem?' });

// 17. Response com trailing text
test('Response with trailing text', '[[response]]oi[[/response]] bla bla', { mode: 'CHAT', response: 'oi' });

// 18. JSON dentro de [[action]] com quotes escapados
test('Action com escaped quotes', '[[response]]Done[[/response]][[action]]{"tool":"writeFile","params":{"path":"x","content":"line1\\nline2"}}[[/action]]', {
  mode: 'ACTION', response: 'Done', tool: 'writeFile', params: { path: 'x', content: 'line1\nline2' }
});

// 19. [[suggest]] com texto livre (não JSON) — deve ignorar e tratar como CHAT
test('Suggest malformado (texto livre)', '[[response]]Oi![[/response]]\n[[suggest]]Opção A | Opção B | Opção C[[/suggest]]', {
  mode: 'CHAT', response: 'Oi!'
});

// 20. Múltiplos delimitadores inválidos + um válido
test('Mixed valid/invalid delimiters', '[[response]]Ok[[/response]]\n[[action]]invalid json[[/action]]\n[[action]]{"tool":"x","params":{}}[[/action]]', {
  mode: 'ACTION', response: 'Ok', tool: 'x', params: {}
});

console.log(`\n📊 Resultado: ${passed} passaram, ${failed} falharam`);
process.exit(failed > 0 ? 1 : 0);
