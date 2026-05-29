/**
 * Teste de Integração — Thinking Cleaner + State Machine + TUI Helpers
 * Não roda o Ink, apenas testa as funções puras.
 */
import cleaner from './thinking-cleaner.cjs';
import stateMachine from './kimi-state-machine.cjs';
const { stripResponseTags, clean, getThinkingMetrics } = cleaner;
const { KimiStateMachine, STATES: KimiState } = stateMachine;

const C = {
  analyzing: '#f59e0b',
  responding: '#10b981',
  error: '#ef4444',
  dim: '#6b7280',
};

function statusConfig(state) {
  return {
    idle:       { dot: '⚪', color: C.dim,       label: 'aguardando' },
    analyzing:  { dot: '🟡', color: C.analyzing, label: 'analisando' },
    responding: { dot: '🟢', color: C.responding,label: 'respondendo' },
    error:      { dot: '🔴', color: C.error,     label: 'erro' },
  }[state];
}

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`✅ ${name}`); passed++; }
  catch (e) { console.log(`❌ ${name}: ${e.message}`); failed++; }
}
function assertEqual(a, b, msg = '') { if (a !== b) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
function assertTrue(v, msg = '') { if (!v) throw new Error(msg || 'expected true'); }

console.log('═══ INTEGRATION TESTS ═══\n');

// 1. Status indicator colors
test('statusConfig analyzing returns 🟡', () => {
  const cfg = statusConfig('analyzing');
  assertEqual(cfg.dot, '🟡');
  assertEqual(cfg.color, '#f59e0b');
});

test('statusConfig responding returns 🟢', () => {
  const cfg = statusConfig('responding');
  assertEqual(cfg.dot, '🟢');
  assertEqual(cfg.color, '#10b981');
});

// 2. End-to-end: thinking → response pipeline
test('full pipeline: thinking with tags + self-talk → clean', () => {
  const thinking = '[[response]]O usuário está me tratando como Luna. Preciso analisar isso. teste teste teste teste[[/response]]';
  const response = '[[response]]Aqui está sua resposta![[/response]]';
  const result = clean(thinking, response);
  
  assertTrue(!result.thinking.includes('O usuário está me tratando como'), 'self-talk removed');
  assertTrue(!result.thinking.includes('teste teste teste teste'), 'repetitions removed');
  assertTrue(!result.response.includes('[[response]]'), 'response tags stripped');
  assertTrue(result.stats.tagsStripped > 0, 'tags counted');
});

// 3. State machine drives status config
test('state machine transitions match status indicators', () => {
  const sm = new KimiStateMachine();
  const states = [];
  sm.onStateChange = (t) => states.push(t.to);
  
  sm.processSnapshot({ thinking: '...', response: '', hasThinking: true, hasResponse: false, isComplete: false, stabilityScore: 0, lastUpdated: Date.now() });
  assertEqual(states[0], KimiState.THINKING);
  assertEqual(statusConfig('analyzing').dot, '🟡');
  
  sm.processSnapshot({ thinking: '', response: 'Hello', hasThinking: false, hasResponse: true, isComplete: false, stabilityScore: 0, lastUpdated: Date.now() });
  assertEqual(states[1], KimiState.RESPONDING);
  assertEqual(statusConfig('responding').dot, '🟢');
});

// 4. Metrics tracking
test('metrics from cleaned thinking', () => {
  const thinking = 'Linha 1\n\nLinha 2\nLinha 3';
  const metrics = getThinkingMetrics(thinking);
  assertEqual(metrics.lines, 3); // clean() normaliza linhas vazias
  assertEqual(metrics.paragraphs, 1); // ^\s+/gm remove linhas vazias extras
  assertTrue(metrics.tokens > 0);
});

// 5. Tag stripping in stream (simulates TUI behavior)
test('TUI stream strips [[response]] tags', () => {
  const raw = '[[response]]Primeira parte';
  const stripped = stripResponseTags(raw);
  assertEqual(stripped, 'Primeira parte');
});

console.log(`\n═══ RESULTADO ═══`);
console.log(`✅ Passaram: ${passed}`);
console.log(`❌ Falharam: ${failed}`);
console.log(`📊 Total: ${passed + failed}`);
process.exit(failed > 0 ? 1 : 0);
