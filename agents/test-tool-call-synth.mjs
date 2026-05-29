/**
 * Test unitário para validar o accumulator e synthesizer de tool_calls
 * do stream interceptor do Kimi Bridge.
 *
 * Simula chunks SSE da Kimi API com tool_calls fragmentados e verifica
 * se as tags [[action]] são sintetizadas corretamente.
 */

import assert from 'assert';

// ── Replicar a lógica do interceptor para teste ──

function parseSseChunk(chunk) {
  const lines = chunk.split('\n');
  const results = [];
  for (const line of lines) {
    if (line.startsWith('data:')) {
      const data = line.slice(5).trim();
      if (data === '[DONE]') {
        results.push({ done: true });
        continue;
      }
      try {
        const json = JSON.parse(data);
        const choice = json.choices?.[0];
        if (choice?.delta) {
          const delta = choice.delta;
          const entry = {
            reasoning: delta.reasoning_content || delta.reasoning || '',
            content: delta.content || '',
          };
          if (delta.tool_calls && Array.isArray(delta.tool_calls)) {
            entry.toolCalls = delta.tool_calls;
          }
          results.push(entry);
        }
      } catch (e) { /* ignore parse errors */ }
    }
  }
  return results;
}

const __lunaStream = {
  reasoning: '', content: '', events: [], active: false,
  toolCallAccumulator: {}, synthesizedIndices: new Set(), synthesizedActions: []
};

function accumulateToolCalls(toolCalls) {
  if (!toolCalls || !toolCalls.length) return;
  const acc = __lunaStream.toolCallAccumulator;
  for (const tc of toolCalls) {
    const idx = tc.index ?? 0;
    if (!acc[idx]) {
      acc[idx] = { id: '', type: 'function', function: { name: '', arguments: '' } };
    }
    if (tc.id) acc[idx].id += tc.id;
    if (tc.type) acc[idx].type = tc.type;
    if (tc.function) {
      if (tc.function.name) acc[idx].function.name += tc.function.name;
      if (tc.function.arguments) acc[idx].function.arguments += tc.function.arguments;
    }
  }
}

function mapKimiToolToLuna(name) {
  const map = {
    'ipython': 'executeShell',
    'code_runner': 'executeShell',
    'browser': 'executeShell',
    'computer': 'executeShell',
    'web_search': null,
    'fetch': null,
  };
  if (name in map) return map[name];
  return 'executeShell';
}

function buildLunaAction(toolCall) {
  const name = toolCall.function.name;
  const lunaTool = mapKimiToolToLuna(name);
  if (!lunaTool) return null;

  let args = {};
  try {
    args = JSON.parse(toolCall.function.arguments || '{}');
  } catch (e) {
    return null;
  }

  let params = {};
  if (name === 'ipython' || name === 'code_runner') {
    const code = args.code || args.input || '';
    if (!code) return null;
    params = { command: `python3 << 'PYEOF'\n${code}\nPYEOF` };
  } else if (name === 'browser' || name === 'computer') {
    params = { command: `echo "[Luna Bridge] Tool '${name}' was blocked. Use executeShell instead."` };
  } else {
    params = { command: `echo "[Luna Bridge] Unknown tool '${name}' with args: ${JSON.stringify(args)}"` };
  }

  return { tool: lunaTool, params };
}

function trySynthesizeActions() {
  const acc = __lunaStream.toolCallAccumulator;
  const synth = __lunaStream.synthesizedIndices;
  let synthesized = false;
  for (const idxStr of Object.keys(acc)) {
    const idx = parseInt(idxStr, 10);
    if (synth.has(idx)) continue;
    const tc = acc[idx];
    if (!tc.function.name) continue;
    const action = buildLunaAction(tc);
    if (action) {
      const tag = `[[action]]${JSON.stringify(action)}[[/action]]`;
      __lunaStream.content += '\n' + tag + '\n';
      __lunaStream.synthesizedActions.push({ index: idx, tool: tc.function.name, action });
      synth.add(idx);
      synthesized = true;
    }
  }
  return synthesized;
}

function accumulate(results) {
  if (!results || !results.length) return;
  __lunaStream.active = true;
  for (const r of results) {
    if (r.done) continue;
    if (r.reasoning) __lunaStream.reasoning += r.reasoning;
    if (r.content) __lunaStream.content += r.content;
    if (r.toolCalls) accumulateToolCalls(r.toolCalls);
    __lunaStream.events.push(r);
  }
  trySynthesizeActions();
}

// ── Testes ──

console.log('🧪 Test 1: Simple ipython tool_call (single chunk)');
{
  const chunk = `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_abc","type":"function","function":{"name":"ipython","arguments":"{\\"code\\": \\"print(1+1)\\"}"}}]}}]}`;
  accumulate(parseSseChunk(chunk));
  assert(__lunaStream.synthesizedActions.length === 1, 'Expected 1 synthesized action');
  assert(__lunaStream.synthesizedActions[0].tool === 'ipython', 'Expected ipython tool');
  assert(__lunaStream.synthesizedActions[0].action.tool === 'executeShell', 'Expected executeShell mapping');
  assert(__lunaStream.content.includes('[[action]]'), 'Expected [[action]] tag in content');
  assert(__lunaStream.content.includes('python3'), 'Expected python3 command');
  console.log('✅ Test 1 passed');
}

console.log('🧪 Test 2: Fragmented tool_call across multiple chunks');
{
  // Reset
  __lunaStream.content = '';
  __lunaStream.reasoning = '';
  __lunaStream.toolCallAccumulator = {};
  __lunaStream.synthesizedIndices = new Set();
  __lunaStream.synthesizedActions = [];

  const chunk1 = `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_xyz","type":"function","function":{"name":"ipython"}}]}}]}`;
  const chunk2 = `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"co"}}]}}]}`;
  const chunk3 = `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"de\\": \\"print(2+2)\\"}"}}]}}]}`;

  accumulate(parseSseChunk(chunk1));
  assert(__lunaStream.synthesizedActions.length === 0, 'Should NOT synthesize yet — incomplete');

  accumulate(parseSseChunk(chunk2));
  assert(__lunaStream.synthesizedActions.length === 0, 'Should NOT synthesize yet — JSON incomplete');

  accumulate(parseSseChunk(chunk3));
  assert(__lunaStream.synthesizedActions.length === 1, 'Should synthesize after complete JSON');
  assert(__lunaStream.synthesizedActions[0].action.params.command.includes('print(2+2)'), 'Expected correct code');
  console.log('✅ Test 2 passed');
}

console.log('🧪 Test 3: Multiple tool_calls (plan mode)');
{
  __lunaStream.content = '';
  __lunaStream.reasoning = '';
  __lunaStream.toolCallAccumulator = {};
  __lunaStream.synthesizedIndices = new Set();
  __lunaStream.synthesizedActions = [];

  const chunk1 = `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"ipython","arguments":"{\\"code\\": \\"a=1\\"}"}}]}}]}`;
  const chunk2 = `data: {"choices":[{"delta":{"tool_calls":[{"index":1,"function":{"name":"ipython","arguments":"{\\"code\\": \\"b=2\\"}"}}]}}]}`;

  accumulate(parseSseChunk(chunk1));
  accumulate(parseSseChunk(chunk2));

  assert(__lunaStream.synthesizedActions.length === 2, 'Expected 2 synthesized actions');
  assert(__lunaStream.content.includes('a=1'), 'Expected first action');
  assert(__lunaStream.content.includes('b=2'), 'Expected second action');
  console.log('✅ Test 3 passed');
}

console.log('🧪 Test 4: web_search should be IGNORED (null mapping)');
{
  __lunaStream.content = '';
  __lunaStream.reasoning = '';
  __lunaStream.toolCallAccumulator = {};
  __lunaStream.synthesizedIndices = new Set();
  __lunaStream.synthesizedActions = [];

  const chunk = `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"web_search","arguments":"{\\"query\\": \\"test\\"}"}}]}}]}`;
  accumulate(parseSseChunk(chunk));

  assert(__lunaStream.synthesizedActions.length === 0, 'web_search should be ignored');
  assert(!__lunaStream.content.includes('[[action]]'), 'No action tag for ignored tool');
  console.log('✅ Test 4 passed');
}

console.log('🧪 Test 5: Content mixed with tool_calls');
{
  __lunaStream.content = '';
  __lunaStream.reasoning = '';
  __lunaStream.toolCallAccumulator = {};
  __lunaStream.synthesizedIndices = new Set();
  __lunaStream.synthesizedActions = [];

  const chunk1 = `data: {"choices":[{"delta":{"content":"Vou calcular "}}]}`;
  const chunk2 = `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"ipython","arguments":"{\\"code\\": \\"print(3*3)\\"}"}}]}}]}`;
  const chunk3 = `data: {"choices":[{"delta":{"content":" para você."}}]}`;

  accumulate(parseSseChunk(chunk1));
  accumulate(parseSseChunk(chunk2));
  accumulate(parseSseChunk(chunk3));

  assert(__lunaStream.content.includes('Vou calcular'), 'Expected text content');
  assert(__lunaStream.content.includes('para você.'), 'Expected trailing text');
  assert(__lunaStream.content.includes('[[action]]'), 'Expected action tag');
  assert(__lunaStream.synthesizedActions.length === 1, 'Expected 1 action');
  console.log('✅ Test 5 passed');
}

console.log('\n🎉 TODOS OS TESTES PASSARAM!');
