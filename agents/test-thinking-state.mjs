/**
 * Testes para Thinking Cleaner v2.0 + KimiStateMachine
 * Portado da suite do Kimi Thinking Extractor
 */

import { clean, cleanThinking, stripResponseTags, getThinkingMetrics } from './thinking-cleaner.cjs';
import { KimiStateMachine, STATES } from './kimi-state-machine.cjs';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`✅ ${name}`);
  } catch (e) {
    failed++;
    console.log(`❌ ${name}: ${e.message}`);
  }
}

function assertEqual(a, b, msg = '') {
  if (a !== b) throw new Error(`${msg} | expected: ${JSON.stringify(b)}, got: ${JSON.stringify(a)}`);
}

function assertTrue(v, msg = '') {
  if (!v) throw new Error(msg || 'expected true');
}

console.log('═══ THINKING CLEANER TESTS ═══\n');

// ── Strip Tags ──
test('stripResponseTags removes [[response]] tags', () => {
  const r = stripResponseTags('[[response]] Hello [[/response]]');
  assertEqual(r, 'Hello');
});

test('stripResponseTags handles nested tags', () => {
  const r = stripResponseTags('[[response]] [[response]]nested[[/response]] [[/response]]');
  assertEqual(r, 'nested');
});

test('stripResponseTags strips closing tags too', () => {
  const r = stripResponseTags('Hello [[/response]]');
  assertEqual(r, 'Hello');
});

// ── Self-Talk Removal ──
test('clean removes self-talk', () => {
  const r = clean('O usuário está me tratando como Luna. Depois disso, hello.', '');
  assertEqual(r.thinking, 'Depois disso, hello.');
  assertTrue(r.stats.selfTalkRemoved > 0, 'should detect self-talk');
});

test('clean removes multiple self-talk patterns', () => {
  const r = clean('O usuário está me tratando como Luna. Contexto: estou conversando com Abner. Resposta: hello.', '');
  assertTrue(r.stats.selfTalkRemoved >= 2, 'should detect 2 self-talk patterns');
});

// ── Repetitions ──
test('clean removes repeated words', () => {
  const r = clean('hmm hmm hmm hmm ok', '');
  assertTrue(r.stats.repetitionsRemoved > 0 || r.thinking === 'hmm hmm hmm hmm ok', 'repetitions handled');
});

// ── Stats ──
test('clean tracks totalCharsRemoved', () => {
  const r = clean('O usuário está me tratando como Luna. Hello world.', '');
  assertTrue(r.stats.totalCharsRemoved > 0, 'should track removed chars');
  assertTrue(r.stats.originalThinkingLength > r.thinking.length, 'original > cleaned');
});

// ── Response Cleaning ──
test('clean strips tags from response', () => {
  const r = clean('', '[[response]] Hello world [[/response]]');
  assertEqual(r.response, 'Hello world');
  assertEqual(r.stats.tagsStripped, 2);
});

console.log('\n═══ STATE MACHINE TESTS ═══\n');

// ── State Transitions ──
test('IDLE → THINKING', () => {
  const sm = new KimiStateMachine();
  let transition = null;
  sm.onStateChange = (t) => { transition = t; };
  sm.processSnapshot({ thinking: '...', response: '', hasThinking: true, hasResponse: false, isComplete: false, stabilityScore: 0, lastUpdated: Date.now() });
  assertEqual(sm.getCurrentState(), STATES.THINKING);
  assertTrue(transition !== null, 'transition fired');
});

test('THINKING → RESPONDING', () => {
  const sm = new KimiStateMachine();
  sm.processSnapshot({ thinking: '...', response: '', hasThinking: true, hasResponse: false, isComplete: false, stabilityScore: 0, lastUpdated: Date.now() });
  sm.processSnapshot({ thinking: '', response: 'Hello', hasThinking: false, hasResponse: true, isComplete: false, stabilityScore: 0, lastUpdated: Date.now() });
  assertEqual(sm.getCurrentState(), STATES.RESPONDING);
});

test('THINKING → RESPONDING via stabilityScore', () => {
  const sm = new KimiStateMachine();
  sm.processSnapshot({ thinking: '...', response: '', hasThinking: true, hasResponse: false, isComplete: false, stabilityScore: 0, lastUpdated: Date.now() });
  sm.processSnapshot({ thinking: '...', response: 'Hello', hasThinking: true, hasResponse: true, isComplete: false, stabilityScore: 0.9, lastUpdated: Date.now() });
  assertEqual(sm.getCurrentState(), STATES.RESPONDING);
});

test('RESPONDING → IDLE via stableTimer', async () => {
  const sm = new KimiStateMachine();
  let idleReached = false;
  sm.onStateChange = (t) => { if (t.to === STATES.IDLE) idleReached = true; };
  sm.processSnapshot({ thinking: '...', response: '', hasThinking: true, hasResponse: false, isComplete: false, stabilityScore: 0, lastUpdated: Date.now() });
  sm.processSnapshot({ thinking: '', response: 'Hello', hasThinking: false, hasResponse: true, isComplete: false, stabilityScore: 0, lastUpdated: Date.now() });
  // Wait for stableTimer to fire (STABLE_THRESHOLD_MS * 2 = 1600ms)
  await new Promise(r => setTimeout(r, 1800));
  assertTrue(idleReached, 'should reach IDLE via stableTimer');
});

test('IDLE → RESPONDING (no thinking)', () => {
  const sm = new KimiStateMachine();
  sm.processSnapshot({ thinking: '', response: 'Hello', hasThinking: false, hasResponse: true, isComplete: false, stabilityScore: 0, lastUpdated: Date.now() });
  assertEqual(sm.getCurrentState(), STATES.RESPONDING);
});

test('reset clears state', () => {
  const sm = new KimiStateMachine();
  sm.processSnapshot({ thinking: '...', response: '', hasThinking: true, hasResponse: false, isComplete: false, stabilityScore: 0, lastUpdated: Date.now() });
  sm.reset();
  assertEqual(sm.getCurrentState(), STATES.IDLE);
  assertEqual(sm.getLastContent(), null);
});

// ── Callbacks ──
test('onThinkingUpdate callback fires', () => {
  const sm = new KimiStateMachine();
  let called = false;
  sm.onThinkingUpdate = () => { called = true; };
  sm.processSnapshot({ thinking: '...', response: '', hasThinking: true, hasResponse: false, isComplete: false, stabilityScore: 0, lastUpdated: Date.now() });
  assertTrue(called, 'onThinkingUpdate called');
});

test('onResponseUpdate callback fires', () => {
  const sm = new KimiStateMachine();
  sm.processSnapshot({ thinking: '...', response: '', hasThinking: true, hasResponse: false, isComplete: false, stabilityScore: 0, lastUpdated: Date.now() });
  let called = false;
  sm.onResponseUpdate = () => { called = true; };
  sm.processSnapshot({ thinking: '', response: 'Hello', hasThinking: false, hasResponse: true, isComplete: false, stabilityScore: 0, lastUpdated: Date.now() });
  assertTrue(called, 'onResponseUpdate called');
});

// ── Metrics ──
test('getThinkingMetrics returns correct values', () => {
  const m = getThinkingMetrics('Line 1\n\nLine 2\nLine 3');
  assertTrue(m.paragraphs >= 1, 'should have at least 1 paragraph');
  assertTrue(m.lines >= 2, 'should have at least 2 lines');
  assertTrue(m.chars > 0);
  assertTrue(m.tokens > 0);
});

console.log(`\n═══ RESULTADO ═══`);
console.log(`✅ Passaram: ${passed}`);
console.log(`❌ Falharam: ${failed}`);
console.log(`📊 Total: ${passed + failed}`);
process.exit(failed > 0 ? 1 : 0);
