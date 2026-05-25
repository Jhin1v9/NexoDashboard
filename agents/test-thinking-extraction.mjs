#!/usr/bin/env node
/**
 * Teste unitário para validar as 4 camadas de extração thinking/response
 * do kimi-bridge.cjs + modo compacto do TUI.
 * Sem dependências externas — mocks manuais de DOM.
 */

// ── Simular funções do bridge para teste ──

function isChatUrl(url) {
  if (typeof url !== 'string') return false;
  return url.includes('/chat/completions') ||
         url.includes('/api/chat') ||
         url.includes('/api/conversation') ||
         url.includes('/v1/chat') ||
         url.includes('/api/v1/chat') ||
         url.includes('/stream');
}

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
          results.push({
            reasoning: choice.delta.reasoning_content || choice.delta.reasoning || '',
            content: choice.delta.content || '',
          });
        } else if (choice?.message) {
          results.push({
            reasoning: choice.message.reasoning_content || choice.message.reasoning || '',
            content: choice.message.content || '',
          });
        }
      } catch (e) { /* ignore parse errors */ }
    }
  }
  return results;
}

function accumulate(results, stream) {
  if (!results || !results.length) return;
  stream.active = true;
  for (const r of results) {
    if (r.done) continue;
    if (r.reasoning) stream.reasoning += r.reasoning;
    if (r.content) stream.content += r.content;
    stream.events.push(r);
  }
}

// ── Mock DOM utilities ──

function createMockElement(tag, attrs = {}, children = []) {
  const el = {
    tagName: tag.toUpperCase(),
    className: attrs.class || '',
    classList: {
      contains: (c) => (attrs.class || '').split(' ').includes(c),
    },
    style: attrs.style || {},
    textContent: attrs.textContent || '',
    innerText: attrs.textContent || '',
    innerHTML: attrs.innerHTML || '',
    parentElement: null,
    children: [],
    __reactFiber$test: attrs.__reactFiber$ || null,
    querySelectorAll: function(sel) {
      const results = [];
      const collect = (node) => {
        if (node.matches && node.matches(sel)) results.push(node);
        for (const c of node.children) collect(c);
      };
      collect(this);
      return results;
    },
    querySelector: function(sel) {
      return this.querySelectorAll(sel)[0] || null;
    },
    matches: function(sel) {
      if (sel.startsWith('.')) return this.classList.contains(sel.slice(1));
      if (sel.startsWith('#')) return (attrs.id || '') === sel.slice(1);
      if (sel.startsWith('[')) {
        const key = sel.slice(1, -1);
        return this._fiber && (this._fiber.memoizedProps || {})[key];
      }
      return this.tagName.toLowerCase() === sel;
    },
  };
  for (const c of children) {
    c.parentElement = el;
    el.children.push(c);
  }
  return el;
}

// ── Testes ──

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// Test 1: Stream interceptor SSE parsing
test('parseSseChunk extrai reasoning_content e content separadamente', () => {
  const sse = `data: {"choices":[{"delta":{"reasoning_content":"Primeiro passo: ","content":""}}]}\n\ndata: {"choices":[{"delta":{"reasoning_content":"analisar dados","content":""}}]}\n\ndata: {"choices":[{"delta":{"reasoning_content":"","content":"Resposta final"}}]}\n\ndata: [DONE]`;
  
  const results = parseSseChunk(sse);
  const stream = { reasoning: '', content: '', events: [], active: false };
  accumulate(results, stream);
  
  if (stream.reasoning !== 'Primeiro passo: analisar dados') {
    throw new Error(`Reasoning mismatch: "${stream.reasoning}"`);
  }
  if (stream.content !== 'Resposta final') {
    throw new Error(`Content mismatch: "${stream.content}"`);
  }
  if (!stream.active) {
    throw new Error('Stream deveria estar ativo');
  }
  if (stream.events.length !== 3) {
    throw new Error(`Esperado 3 eventos, got ${stream.events.length}`);
  }
});

// Test 2: isChatUrl detection
test('isChatUrl detecta endpoints de chat corretamente', () => {
  const urls = [
    { url: 'https://kimi.com/api/chat', expected: true },
    { url: 'https://api.kimi.com/v1/chat/completions', expected: true },
    { url: 'https://kimi.com/api/conversation/stream', expected: true },
    { url: 'https://kimi.com/static/logo.png', expected: false },
    { url: 'https://kimi.com/api/user/profile', expected: false },
    { url: null, expected: false },
    { url: 123, expected: false },
  ];
  for (const { url, expected } of urls) {
    const result = isChatUrl(url);
    if (result !== expected) {
      throw new Error(`isChatUrl("${url}") = ${result}, esperado ${expected}`);
    }
  }
});

// Test 3: React Fiber extraction via mock DOM
test('Extração DOM: React Fiber encontra message.reasoning_content', () => {
  const msgNode = createMockElement('div', {
    __reactFiber$: {
      memoizedProps: {
        message: {
          reasoning_content: 'Pensamento do React',
          content: 'Resposta do React',
        }
      }
    }
  });
  
  function getReactFiber(domEl) {
    const key = Object.keys(domEl).find(k =>
      k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')
    );
    return key ? domEl[key] : null;
  }
  
  function findMessageFiber(fiber) {
    let node = fiber;
    while (node) {
      const props = node.memoizedProps || node.pendingProps;
      if (props && (props.message || props.msg || props.data?.message)) return node;
      node = node.return;
    }
    return null;
  }
  
  // Para o teste, o fiber está no próprio elemento
  const fiber = getReactFiber(msgNode);
  if (!fiber) throw new Error('Fiber não encontrado');
  
  const msgFiber = findMessageFiber(fiber);
  if (!msgFiber) throw new Error('MessageFiber não encontrado');
  
  const msg = msgFiber.memoizedProps?.message;
  if (msg.reasoning_content !== 'Pensamento do React') {
    throw new Error(`reasoning_content mismatch: ${msg.reasoning_content}`);
  }
  if (msg.content !== 'Resposta do React') {
    throw new Error(`content mismatch: ${msg.content}`);
  }
});

// Test 4: DOM fallback — separação por classe thinking
test('Extração DOM fallback separa thinking de response por classe', () => {
  const thinkingBlock = createMockElement('div', { class: 'thinking-container', textContent: 'Este é o pensamento interno do modelo' });
  const responseBlock = createMockElement('div', { class: 'markdown-container', textContent: 'Esta é a resposta final para o usuário' });
  const assistant = createMockElement('div', { class: 'segment-assistant' }, [thinkingBlock, responseBlock]);
  
  // Simular lógica do bridge
  let thinking = '';
  const thinkSelectors = ['.thinking-container', '.think-block', '[class*="thinking"]'];
  for (const sel of thinkSelectors) {
    const els = assistant.querySelectorAll(sel);
    if (els.length) {
      const lastThink = els[els.length - 1];
      const text = lastThink.innerText?.trim();
      if (text && text.length > 5) { thinking = text; break; }
    }
  }
  
  let response = '';
  const mdContainers = assistant.querySelectorAll('.markdown-container');
  for (let i = mdContainers.length - 1; i >= 0; i--) {
    const md = mdContainers[i];
    let parent = md.parentElement;
    let isInsideThink = false;
    while (parent && parent !== assistant) {
      const pc = (parent.className || '').toLowerCase();
      if (pc.includes('think') || pc.includes('thinking')) { isInsideThink = true; break; }
      parent = parent.parentElement;
    }
    if (!isInsideThink) {
      const text = md.innerText?.trim();
      if (text) { response = text; break; }
    }
  }
  
  if (thinking !== 'Este é o pensamento interno do modelo') {
    throw new Error(`Thinking mismatch: "${thinking}"`);
  }
  if (response !== 'Esta é a resposta final para o usuário') {
    throw new Error(`Response mismatch: "${response}"`);
  }
});

// Test 5: Heurística de estilo (grey + italic = thinking)
test('Heurística de estilo detecta thinking por classe .think', () => {
  const thinkEl = createMockElement('p', { class: 'think', style: { color: 'rgb(128,128,128)', fontStyle: 'italic' } });
  const respEl = createMockElement('p', { class: 'resp', style: { color: 'rgb(255,255,255)', fontStyle: 'normal' } });
  
  function isThinkingByStyle(el) {
    if (el.classList.contains('think')) return true;
    return false;
  }
  
  if (!isThinkingByStyle(thinkEl)) {
    throw new Error('Deveria detectar .think como thinking');
  }
  if (isThinkingByStyle(respEl)) {
    throw new Error('Não deveria detectar .resp como thinking');
  }
});

// Test 6: TUI compact mode — estimateTokens
test('estimateTokens calcula corretamente', () => {
  function estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }
  
  if (estimateTokens('abcd') !== 1) throw new Error('4 chars = 1 token');
  if (estimateTokens('abcdefghijklmnop') !== 4) throw new Error('16 chars = 4 tokens');
  if (estimateTokens('') !== 0) throw new Error('empty = 0');
});

// Test 7: Delta calculation — simula sendMessageStream
test('sendMessageStream: delta calculation funciona com texto acumulado', () => {
  const polls = [
    { thinking: 'Ol', response: '' },
    { thinking: 'Olá', response: '' },
    { thinking: 'Olá ', response: '' },
    { thinking: 'Olá mu', response: '' },
    { thinking: 'Olá mundo', response: 'R' },
    { thinking: 'Olá mundo', response: 'Res' },
    { thinking: 'Olá mundo', response: 'Resposta' },
  ];
  
  let lastThinking = '';
  let lastResponse = '';
  const thinkingDeltas = [];
  const responseDeltas = [];
  
  for (const poll of polls) {
    if (poll.thinking && poll.thinking !== lastThinking) {
      const delta = poll.thinking.slice(lastThinking.length);
      if (delta) thinkingDeltas.push(delta);
      else if (poll.thinking.length < lastThinking.length) thinkingDeltas.push(poll.thinking);
      lastThinking = poll.thinking;
    }
    if (poll.response && poll.response !== lastResponse) {
      const delta = poll.response.slice(lastResponse.length);
      if (delta) responseDeltas.push(delta);
      else if (poll.response.length < lastResponse.length) responseDeltas.push(poll.response);
      lastResponse = poll.response;
    }
  }
  
  const fullThinking = thinkingDeltas.join('');
  const fullResponse = responseDeltas.join('');
  
  if (fullThinking !== 'Olá mundo') {
    throw new Error(`Full thinking mismatch: "${fullThinking}"`);
  }
  if (fullResponse !== 'Resposta') {
    throw new Error(`Full response mismatch: "${fullResponse}"`);
  }
});

// Test 8: Interceptor accumulation over multiple chunks
test('Stream interceptor acumula múltiplos chunks corretamente', () => {
  const stream = { reasoning: '', content: '', events: [], active: false };
  
  const chunk1 = parseSseChunk('data: {"choices":[{"delta":{"reasoning_content":"A","content":""}}]}');
  accumulate(chunk1, stream);
  
  const chunk2 = parseSseChunk('data: {"choices":[{"delta":{"reasoning_content":"B","content":"X"}}]}');
  accumulate(chunk2, stream);
  
  const chunk3 = parseSseChunk('data: {"choices":[{"delta":{"reasoning_content":"","content":"Y"}}]}');
  accumulate(chunk3, stream);
  
  if (stream.reasoning !== 'AB') throw new Error(`Expected "AB", got "${stream.reasoning}"`);
  if (stream.content !== 'XY') throw new Error(`Expected "XY", got "${stream.content}"`);
  if (stream.events.length !== 3) throw new Error(`Expected 3 events, got ${stream.events.length}`);
});

// Test 9: [DONE] signal doesn't add content
test('parseSseChunk ignora [DONE] no accumulation', () => {
  const chunk = parseSseChunk('data: [DONE]');
  if (chunk.length !== 1) throw new Error('Expected 1 result');
  if (!chunk[0].done) throw new Error('Expected done=true');
});

// Test 10: Empty or malformed SSE lines
test('parseSseChunk lida com linhas vazias e malformadas', () => {
  const sse = '\n\ndata: not-json\n\ndata: {"invalid":true}\n\n';
  const results = parseSseChunk(sse);
  if (results.length !== 0) throw new Error(`Expected 0 parsed results, got ${results.length}`);
});

// Test 11: XPath-like parent walk — nested thinking
test('isInsideThinkContainer detecta nesting profundo', () => {
  const inner = createMockElement('p', { textContent: 'Texto interno' });
  const thinkWrapper = createMockElement('div', { class: 'thinking-block' }, [inner]);
  const assistant = createMockElement('div', { class: 'segment-assistant' }, [thinkWrapper]);
  
  function isInsideThinkContainer(el, boundary) {
    let parent = el.parentElement;
    while (parent && parent !== boundary) {
      const pc = (parent.className || '').toLowerCase();
      if (pc.includes('think') || pc.includes('thinking') || pc.includes('reasoning')) return true;
      parent = parent.parentElement;
    }
    return false;
  }
  
  if (!isInsideThinkContainer(inner, assistant)) {
    throw new Error('Deveria detectar elemento dentro de thinking-block');
  }
  if (isInsideThinkContainer(thinkWrapper, assistant)) {
    throw new Error('thinkWrapper é o próprio container, não deveria ser "dentro" de si mesmo');
  }
});

// Test 12: Content-pattern heuristic separates thinking from response when no DOM classes available
test('Heurística de padrão de conteúdo separa thinking de response', () => {
  const mixedText = `O usuário está pedindo para eu consertar um erro de TypeScript no projeto. Vou analisar o tsconfig.json e verificar os path aliases.

Primeiro, preciso entender a estrutura do projeto. O erro parece estar relacionado ao alias @/lib/utils não sendo resolvido corretamente.

Vamos verificar o tsconfig.json para ver se o paths está configurado corretamente.

\`\`\`json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
\`\`\`

Aqui está a correção do tsconfig.json.`;

  // Simulate the heuristic from Strategy D
  function splitThinkingResponse(text) {
    const thinkStarters = /^(O usuário|Vou |Agora |Preciso |Primeiro |Vamos |Então |Deixa |Hmm |Ok |Okay |Let me |I need |I'll |First |Now |So |The user |Hmm |Okay )/i;
    const codeBlockIdx = text.indexOf('```');
    const jsonStartIdx = text.search(/\{\s*"/);
    const mdHeaderIdx = text.search(/\n#{1,3}\s/);
    const transitionIdx = codeBlockIdx > 50 ? codeBlockIdx
      : (jsonStartIdx > 50 ? jsonStartIdx
      : (mdHeaderIdx > 50 ? mdHeaderIdx : -1));
    if (transitionIdx > 100 && thinkStarters.test(text)) {
      return {
        thinking: text.slice(0, transitionIdx).trim(),
        response: text.slice(transitionIdx).trim(),
      };
    }
    return { thinking: '', response: text };
  }

  const result = splitThinkingResponse(mixedText);
  if (!result.thinking) {
    throw new Error('Deveria ter extraído thinking');
  }
  if (!result.response.startsWith('```')) {
    throw new Error(`Response deveria começar com code block, mas começa com: ${result.response.slice(0, 30)}`);
  }
  if (result.thinking.includes('```')) {
    throw new Error('Thinking não deveria conter code blocks');
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
  
  console.log('\n✅ Todos os testes passaram!');
}

run().catch(err => {
  console.error('Erro no runner:', err);
  process.exit(1);
});
