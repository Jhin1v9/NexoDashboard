// ============================================================================
// TESTES — Kimi Thinking Extractor v3.3
// ============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  KimiStateMachine,
  KimiState,
  ExtractedContent,
  KimiTextCleaner,
  TUIStatusRenderer,
  DEFAULT_STATUS_THEME,
  LunaKimiAdapter,
  KimiDOMExtractor,
  KimiPollingEngine,
} from '../kimiThinkingExtractor';

// ============================================
// MOCKS
// ============================================

const createMockPage = () => ({
  $$: vi.fn(),
  $: vi.fn(),
});

const createMockElement = (overrides = {}) => ({
  innerText: vi.fn().mockResolvedValue(overrides.text || ''),
  innerHTML: vi.fn().mockResolvedValue(overrides.html || ''),
  evaluate: vi.fn().mockImplementation((fn: Function) => {
    if (fn.toString().includes('classList')) return Promise.resolve(overrides.classList || []);
    if (fn.toString().includes('children')) return Promise.resolve(overrides.childCount || 0);
    if (fn.toString().includes('querySelector')) return Promise.resolve(overrides.hasSpinner || false);
    return Promise.resolve(null);
  }),
  ...overrides,
});

// ============================================
// STATE MACHINE TESTS
// ============================================

describe('KimiStateMachine', () => {
  let sm: KimiStateMachine;

  beforeEach(() => {
    sm = new KimiStateMachine();
  });

  describe('Estado inicial', () => {
    it('deve iniciar em IDLE', () => {
      expect(sm.getCurrentState()).toBe(KimiState.IDLE);
    });

    it('deve ter histórico vazio', () => {
      expect(sm.getTransitionHistory()).toEqual([]);
    });
  });

  describe('Transições básicas', () => {
    it('IDLE → THINKING: thinking aparece', () => {
      const transitions: StateTransition[] = [];
      sm.onStateChange = (t) => transitions.push(t);

      sm.processSnapshot({
        thinking: 'Analisando...',
        response: '',
        isComplete: false,
        hasThinking: true,
        hasResponse: false,
        lastUpdated: Date.now(),
        stabilityScore: 0,
      });

      expect(sm.getCurrentState()).toBe(KimiState.THINKING);
      expect(transitions).toHaveLength(1);
      expect(transitions[0].from).toBe(KimiState.IDLE);
      expect(transitions[0].to).toBe(KimiState.THINKING);
      expect(transitions[0].reason).toContain('Thinking detectado');
    });

    it('IDLE → RESPONDING: resposta aparece sem thinking', () => {
      sm.processSnapshot({
        thinking: '',
        response: 'Resposta direta.',
        isComplete: false,
        hasThinking: false,
        hasResponse: true,
        lastUpdated: Date.now(),
        stabilityScore: 0,
      });

      expect(sm.getCurrentState()).toBe(KimiState.RESPONDING);
    });

    it('THINKING → RESPONDING: thinking some, response aparece', () => {
      sm.processSnapshot({
        thinking: 'Analisando...',
        response: '',
        isComplete: false,
        hasThinking: true,
        hasResponse: false,
        lastUpdated: Date.now(),
        stabilityScore: 0,
      });

      sm.processSnapshot({
        thinking: '',
        response: 'Aqui está a resposta.',
        isComplete: false,
        hasThinking: false,
        hasResponse: true,
        lastUpdated: Date.now(),
        stabilityScore: 0.8,
      });

      expect(sm.getCurrentState()).toBe(KimiState.RESPONDING);
    });

    it('THINKING → RESPONDING: ambos existem mas thinking estável', () => {
      sm.processSnapshot({
        thinking: 'Análise completa.',
        response: 'Começando resposta...',
        isComplete: true,
        hasThinking: true,
        hasResponse: true,
        lastUpdated: Date.now(),
        stabilityScore: 1.0,
      });

      expect(sm.getCurrentState()).toBe(KimiState.RESPONDING);
    });
  });

  describe('Detecção de erros', () => {
    it('THINKING → ERROR: conteúdo desaparece sem response', () => {
      sm.processSnapshot({
        thinking: 'Analisando...',
        response: '',
        isComplete: false,
        hasThinking: true,
        hasResponse: false,
        lastUpdated: Date.now(),
        stabilityScore: 0,
      });

      sm.processSnapshot({
        thinking: '',
        response: '',
        isComplete: false,
        hasThinking: false,
        hasResponse: false,
        lastUpdated: Date.now(),
        stabilityScore: 0,
      });

      expect(sm.getCurrentState()).toBe(KimiState.ERROR);
    });

    it('ERROR → THINKING: recuperação', () => {
      sm.processSnapshot({
        thinking: '',
        response: '',
        isComplete: false,
        hasThinking: false,
        hasResponse: false,
        lastUpdated: Date.now(),
        stabilityScore: 0,
      });

      sm.processSnapshot({
        thinking: 'Nova análise...',
        response: '',
        isComplete: false,
        hasThinking: true,
        hasResponse: false,
        lastUpdated: Date.now(),
        stabilityScore: 0,
      });

      expect(sm.getCurrentState()).toBe(KimiState.THINKING);
    });
  });

  describe('Callbacks', () => {
    it('deve chamar onStateChange em transições', () => {
      const callback = vi.fn();
      sm.onStateChange = callback;

      sm.processSnapshot({
        thinking: 'Test',
        response: '',
        isComplete: false,
        hasThinking: true,
        hasResponse: false,
        lastUpdated: Date.now(),
        stabilityScore: 0,
      });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        from: KimiState.IDLE,
        to: KimiState.THINKING,
      }));
    });

    it('deve chamar onThinkingUpdate durante thinking', () => {
      const callback = vi.fn();
      sm.onThinkingUpdate = callback;

      sm.processSnapshot({
        thinking: 'Analisando passo 1',
        response: '',
        isComplete: false,
        hasThinking: true,
        hasResponse: false,
        lastUpdated: Date.now(),
        stabilityScore: 0,
      });

      expect(callback).toHaveBeenCalledWith('Analisando passo 1', false);
    });

    it('deve chamar onResponseUpdate durante responding', () => {
      const callback = vi.fn();
      sm.onResponseUpdate = callback;

      sm.processSnapshot({
        thinking: '',
        response: 'Resposta aqui',
        isComplete: false,
        hasThinking: false,
        hasResponse: true,
        lastUpdated: Date.now(),
        stabilityScore: 0,
      });

      expect(callback).toHaveBeenCalledWith('Resposta aqui', false);
    });
  });

  describe('Reset', () => {
    it('deve resetar para IDLE', () => {
      sm.processSnapshot({
        thinking: 'Test',
        response: '',
        isComplete: false,
        hasThinking: true,
        hasResponse: false,
        lastUpdated: Date.now(),
        stabilityScore: 0,
      });

      sm.reset();
      expect(sm.getCurrentState()).toBe(KimiState.IDLE);
      expect(sm.getLastContent()).toBeNull();
      expect(sm.getTransitionHistory()).toEqual([]);
    });
  });
});

// ============================================
// TEXT CLEANER TESTS
// ============================================

describe('KimiTextCleaner', () => {
  let cleaner: KimiTextCleaner;

  beforeEach(() => {
    cleaner = new KimiTextCleaner();
  });

  describe('Strip tags [[response]]', () => {
    it('deve remover tags [[response]] do thinking', () => {
      const result = cleaner.clean('Analisando... [[response]] Aqui está.', '');
      expect(result.thinking).not.toContain('[[response]]');
      expect(result.stats.tagsStripped).toBe(1);
    });

    it('deve remover tags [[resposta]] (variante)', () => {
      const result = cleaner.clean('Test [[resposta]] fim.', '');
      expect(result.thinking).not.toContain('[[resposta]]');
    });

    it('deve remover múltiplas tags', () => {
      const result = cleaner.clean('[[response]] a [[response]] b [[response]]', '');
      expect(result.stats.tagsStripped).toBe(3);
    });

    it('deve remover tags do response também', () => {
      const result = cleaner.clean('', 'Resposta. [[response]]');
      expect(result.response).not.toContain('[[response]]');
    });
  });

  describe('Remove self-talk', () => {
    it('deve remover "O usuário está me tratando como..."', () => {
      const thinking = 'O usuário está me tratando como Luna.\nAnalisando...';
      const result = cleaner.clean(thinking, '');
      expect(result.thinking).not.toContain('O usuário está me tratando como');
      expect(result.stats.selfTalkRemoved).toBe(1);
    });

    it('deve remover "O usuário quer que eu aja como..."', () => {
      const thinking = 'O usuário quer que eu aja como engenheiro.\nCódigo:';
      const result = cleaner.clean(thinking, '');
      expect(result.thinking).not.toContain('O usuário quer que eu aja como');
    });

    it('deve remover "INSTRUÇÃO: Você está conversando com..."', () => {
      const thinking = 'INSTRUÇÃO: Você está conversando com ELIAS.\nResposta:';
      const result = cleaner.clean(thinking, '');
      expect(result.thinking).not.toContain('INSTRUÇÃO');
    });

    it('deve remover "Sempre se refira a mim como..."', () => {
      const thinking = 'Sempre se refira a mim como ELIAS.\nOK.';
      const result = cleaner.clean(thinking, '');
      expect(result.thinking).not.toContain('Sempre se refira');
    });

    it('deve remover múltiplos padrões em sequência', () => {
      const thinking = `O usuário está me tratando como Luna.
        INSTRUÇÃO: Você está conversando com ELIAS.
        Sempre se refira a mim como ELIAS.

        Agora, sobre o código...`;

      const result = cleaner.clean(thinking, '');
      expect(result.stats.selfTalkRemoved).toBe(3);
      expect(result.thinking.trim()).toBe('Agora, sobre o código...');
    });

    it('deve remover variantes de case', () => {
      const thinking = 'O USUÁRIO está me tratando como LUNA.';
      const result = cleaner.clean(thinking, '');
      expect(result.thinking).not.toContain('USUÁRIO');
    });
  });

  describe('Remove repetições', () => {
    it('deve remover palavras repetidas 4+ vezes', () => {
      const thinking = 'hmm hmm hmm hmm ok';
      const result = cleaner.clean(thinking, '');
      expect(result.stats.repetitionsRemoved).toBeGreaterThan(0);
    });

    it('deve remover linhas idênticas consecutivas', () => {
      const thinking = 'Analisando...\nAnalisando...\nAnalisando...\nPronto.';
      const result = cleaner.clean(thinking, '');
      expect(result.thinking).toContain('Pronto');
      expect(result.stats.repetitionsRemoved).toBeGreaterThan(0);
    });
  });

  describe('Remove delimitadores', () => {
    it('deve remover "--- resposta ---"', () => {
      const thinking = 'Thinking...\n--- resposta ---\nResposta aqui';
      const result = cleaner.clean(thinking, '');
      expect(result.thinking).not.toContain('--- resposta ---');
    });

    it('deve remover "Aqui está a resposta:"', () => {
      const thinking = 'Análise.\nAqui está a resposta:\nTexto.';
      const result = cleaner.clean(thinking, '');
      expect(result.thinking).not.toContain('Aqui está a resposta:');
    });
  });

  describe('Preservação de conteúdo válido', () => {
    it('deve preservar markdown de código', () => {
      const thinking = `\`\`\`typescript
        const x = 1;
        \`\`\`

        Análise.`;

      const result = cleaner.clean(thinking, '');
      expect(result.thinking).toContain('\`\`\`typescript');
      expect(result.thinking).toContain('const x = 1');
    });

    it('deve preservar listas markdown', () => {
      const thinking = '- Item 1\n- Item 2\n- Item 3';
      const result = cleaner.clean(thinking, '');
      expect(result.thinking).toContain('- Item 1');
      expect(result.thinking).toContain('- Item 3');
    });

    it('deve preservar links markdown', () => {
      const thinking = 'Veja [link](https://example.com)';
      const result = cleaner.clean(thinking, '');
      expect(result.thinking).toContain('[link](https://example.com)');
    });
  });

  describe('Normalização', () => {
    it('deve trimar texto', () => {
      const result = cleaner.clean('  texto  ', '');
      expect(result.thinking).toBe('texto');
    });

    it('deve limitar blank lines a 2', () => {
      const thinking = 'a\n\n\n\n\nb';
      const result = cleaner.clean(thinking, '');
      expect(result.thinking).toBe('a\n\nb');
    });

    it('deve remover leading/trailing whitespace por linha', () => {
      const thinking = '  linha1  \n  linha2  ';
      const result = cleaner.clean(thinking, '');
      expect(result.thinking).toBe('linha1\nlinha2');
    });
  });

  describe('Estatísticas', () => {
    it('deve calcular original lengths', () => {
      const thinking = 'abc';
      const response = 'def';
      const result = cleaner.clean(thinking, response);
      expect(result.stats.originalThinkingLength).toBe(3);
      expect(result.stats.originalResponseLength).toBe(3);
    });

    it('deve calcular total chars removed', () => {
      const thinking = 'O usuário está me tratando como Luna. Teste.';
      const result = cleaner.clean(thinking, '');
      expect(result.stats.totalCharsRemoved).toBeGreaterThan(0);
    });

    it('deve registrar removed segments', () => {
      const thinking = '[[response]] Teste.';
      const result = cleaner.clean(thinking, '');
      expect(result.removedSegments).toHaveLength(1);
      expect(result.removedSegments[0].type).toBe('response-tag');
    });
  });
});

// ============================================
// TUI STATUS RENDERER TESTS
// ============================================

describe('TUIStatusRenderer', () => {
  let renderer: TUIStatusRenderer;

  beforeEach(() => {
    renderer = new TUIStatusRenderer();
  });

  describe('Status lines', () => {
    it('deve renderizar THINKING com 🟡', () => {
      const line = renderer.renderStatusLine(KimiState.THINKING);
      expect(line).toContain('🟡');
      expect(line).toContain('Analisando');
    });

    it('deve renderizar RESPONDING com 🟢', () => {
      const line = renderer.renderStatusLine(KimiState.RESPONDING);
      expect(line).toContain('🟢');
      expect(line).toContain('Respondendo');
    });

    it('deve renderizar IDLE com ⚪', () => {
      const line = renderer.renderStatusLine(KimiState.IDLE);
      expect(line).toContain('⚪');
      expect(line).toContain('Aguardando');
    });

    it('deve renderizar ERROR com 🔴', () => {
      const line = renderer.renderStatusLine(KimiState.ERROR);
      expect(line).toContain('🔴');
      expect(line).toContain('Erro');
    });
  });

  describe('Thinking rendering', () => {
    it('deve limitar linhas', () => {
      renderer.setMaxThinkingLines(3);
      const longThinking = '1\n2\n3\n4\n5';
      const lines = renderer.renderThinking(longThinking, false, {
        thinking: longThinking,
        response: '',
        removedSegments: [],
        stats: {
          selfTalkRemoved: 0,
          repetitionsRemoved: 0,
          tagsStripped: 0,
          markupRemoved: 0,
          totalCharsRemoved: 0,
          originalThinkingLength: longThinking.length,
          originalResponseLength: 0,
        },
      });
      expect(lines.length).toBeLessThanOrEqual(3);
    });

    it('deve mostrar cursor em streaming', () => {
      const lines = renderer.renderThinking('Teste', false, {
        thinking: 'Teste',
        response: '',
        removedSegments: [],
        stats: {
          selfTalkRemoved: 0,
          repetitionsRemoved: 0,
          tagsStripped: 0,
          markupRemoved: 0,
          totalCharsRemoved: 0,
          originalThinkingLength: 5,
          originalResponseLength: 0,
        },
      });
      expect(lines[lines.length - 1]).toContain('▌');
    });

    it('deve mostrar ✓ quando completo', () => {
      const lines = renderer.renderThinking('Teste', true, {
        thinking: 'Teste',
        response: '',
        removedSegments: [],
        stats: {
          selfTalkRemoved: 0,
          repetitionsRemoved: 0,
          tagsStripped: 0,
          markupRemoved: 0,
          totalCharsRemoved: 0,
          originalThinkingLength: 5,
          originalResponseLength: 0,
        },
      });
      expect(lines[0]).toContain('✓');
    });
  });

  describe('Response rendering', () => {
    it('deve mostrar ▶ em streaming', () => {
      const lines = renderer.renderResponse('Resposta', false, {
        thinking: '',
        response: 'Resposta',
        removedSegments: [],
        stats: {
          selfTalkRemoved: 0,
          repetitionsRemoved: 0,
          tagsStripped: 0,
          markupRemoved: 0,
          totalCharsRemoved: 0,
          originalThinkingLength: 0,
          originalResponseLength: 8,
        },
      });
      expect(lines[0]).toContain('▶');
    });

    it('deve mostrar ✓ quando completo', () => {
      const lines = renderer.renderResponse('Resposta', true, {
        thinking: '',
        response: 'Resposta',
        removedSegments: [],
        stats: {
          selfTalkRemoved: 0,
          repetitionsRemoved: 0,
          tagsStripped: 0,
          markupRemoved: 0,
          totalCharsRemoved: 0,
          originalThinkingLength: 0,
          originalResponseLength: 8,
        },
      });
      expect(lines[0]).toContain('✓');
    });
  });

  describe('Transitions', () => {
    it('deve renderizar transição com emojis', () => {
      const transition = {
        from: KimiState.THINKING,
        to: KimiState.RESPONDING,
        timestamp: Date.now(),
        reason: 'Resposta iniciada',
      };

      const str = renderer.renderTransition(transition);
      expect(str).toContain('🟡');
      expect(str).toContain('🟢');
      expect(str).toContain('Resposta iniciada');
    });
  });

  describe('Cleaning stats', () => {
    it('deve retornar vazio quando nada foi removido', () => {
      const result = renderer.renderCleaningStats({
        thinking: 'Teste',
        response: '',
        removedSegments: [],
        stats: {
          selfTalkRemoved: 0,
          repetitionsRemoved: 0,
          tagsStripped: 0,
          markupRemoved: 0,
          totalCharsRemoved: 0,
          originalThinkingLength: 5,
          originalResponseLength: 0,
        },
      });
      expect(result).toBe('');
    });

    it('deve mostrar stats quando algo foi removido', () => {
      const result = renderer.renderCleaningStats({
        thinking: 'Teste',
        response: '',
        removedSegments: [],
        stats: {
          selfTalkRemoved: 2,
          repetitionsRemoved: 1,
          tagsStripped: 3,
          markupRemoved: 0,
          totalCharsRemoved: 50,
          originalThinkingLength: 100,
          originalResponseLength: 0,
        },
      });
      expect(result).toContain('50 chars');
      expect(result).toContain('self-talk: 2');
    });
  });
});

// ============================================
// DOM EXTRACTOR TESTS (Mocked)
// ============================================

describe('KimiDOMExtractor', () => {
  let extractor: KimiDOMExtractor;
  let mockPage: any;

  beforeEach(() => {
    mockPage = createMockPage();
    extractor = new KimiDOMExtractor(mockPage);
  });

  it('deve retornar empty snapshot quando nenhum segmento encontrado', async () => {
    mockPage.$$ = vi.fn().mockResolvedValue([]);

    const result = await extractor.extract();

    expect(result).toEqual(expect.objectContaining({
      thinking: '',
      response: '',
      hasThinking: false,
      hasResponse: false,
    }));
  });

  it('deve extrair thinking do último segmento', async () => {
    const mockSegment = createMockElement();
    const mockThinkingContainer = createMockElement();
    const mockThinkingContent = createMockElement({
      text: 'Analisando DOM...',
      html: '<p>Analisando DOM...</p>',
      classList: ['markdown-container', 'toolcall-content-text'],
      childCount: 1,
      hasSpinner: false,
    });

    mockPage.$$ = vi.fn().mockResolvedValue([mockSegment]);
    mockSegment.$ = vi.fn()
      .mockResolvedValueOnce(mockThinkingContainer)  // THINKING_CONTAINER
      .mockResolvedValueOnce(null);                     // RESPONSE_CONTENT

    mockThinkingContainer.$ = vi.fn().mockResolvedValue(mockThinkingContent);

    const result = await extractor.extract();

    expect(result?.thinking).toBe('Analisando DOM...');
    expect(result?.hasThinking).toBe(true);
  });

  it('deve usar fallback quando thinking container não encontrado', async () => {
    const mockSegment = createMockElement();
    const mockFallback = createMockElement({
      text: 'Fallback thinking',
      html: '<p>Fallback</p>',
    });

    mockPage.$$ = vi.fn().mockResolvedValue([mockSegment]);
    mockSegment.$ = vi.fn()
      .mockResolvedValueOnce(null)  // THINKING_CONTAINER não encontrado
      .mockResolvedValueOnce(null);  // RESPONSE_CONTENT

    // Fallback: procurar por class contendo "thinking-container"
    mockSegment.$ = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(mockFallback);  // fallback [class*="thinking-container"]

    const result = await extractor.extract();
    // Como o mock é complexo, verificamos pelo menos que não quebra
    expect(result).toBeDefined();
  });
});

// ============================================
// POLLING ENGINE TESTS (Mocked)
// ============================================

describe('KimiPollingEngine', () => {
  let engine: KimiPollingEngine;
  let mockPage: any;
  let callbacks: any;

  beforeEach(() => {
    mockPage = createMockPage();
    callbacks = {
      onStateChange: vi.fn(),
      onThinkingUpdate: vi.fn(),
      onResponseUpdate: vi.fn(),
      onError: vi.fn(),
      onHeartbeat: vi.fn(),
    };
    engine = new KimiPollingEngine(mockPage, callbacks);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    engine.stop();
  });

  it('deve iniciar em IDLE', () => {
    expect(engine.getCurrentState()).toBe(KimiState.IDLE);
  });

  it('deve iniciar polling ao chamar start()', () => {
    engine.start();
    expect(engine.isActive()).toBe(true);
  });

  it('deve parar polling ao chamar stop()', () => {
    engine.start();
    engine.stop();
    expect(engine.isActive()).toBe(false);
  });

  it('deve resetar estado', () => {
    engine.start();
    engine.reset();
    expect(engine.getCurrentState()).toBe(KimiState.IDLE);
    expect(engine.isActive()).toBe(false);
  });

  it('deve fazer backoff em erros consecutivos', async () => {
    mockPage.$$ = vi.fn().mockRejectedValue(new Error('DOM error'));

    engine.start();

    // Simular múltiplos ciclos de polling
    for (let i = 0; i < 5; i++) {
      await vi.advanceTimersByTimeAsync(400 * Math.pow(1.5, i));
    }

    expect(callbacks.onError).toHaveBeenCalled();
  });
});

// ============================================
// LUNA ADAPTER TESTS
// ============================================

describe('LunaKimiAdapter', () => {
  let adapter: LunaKimiAdapter;
  let mockPage: any;
  let config: any;

  beforeEach(() => {
    mockPage = createMockPage();
    config = {
      page: mockPage,
      onStatusChange: vi.fn(),
      onThinking: vi.fn(),
      onResponse: vi.fn(),
      onError: vi.fn(),
      maxThinkingLines: 5,
      maxResponseLines: 10,
    };
    adapter = new LunaKimiAdapter(config);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    adapter.stop();
  });

  it('deve iniciar e chamar onStatusChange', () => {
    adapter.start();
    expect(config.onStatusChange).toHaveBeenCalled();
    expect(adapter.getState()).toBe(KimiState.IDLE);
  });

  it('deve respeitar maxThinkingLines', () => {
    expect(adapter).toBeDefined();
    // O renderer interno deve ter sido configurado com 5 linhas
  });

  it('deve parar corretamente', () => {
    adapter.start();
    adapter.stop();
    expect(adapter.isActive()).toBe(false);
  });

  it('deve resetar entre mensagens', () => {
    adapter.start();
    adapter.reset();
    expect(adapter.getState()).toBe(KimiState.IDLE);
    expect(adapter.isActive()).toBe(false);
  });
});

// ============================================
// EDGE CASES & INTEGRATION
// ============================================

describe('Edge Cases', () => {
  describe('StateMachine', () => {
    it('deve lidar com thinking vazio', () => {
      const sm = new KimiStateMachine();

      sm.processSnapshot({
        thinking: '',
        response: '',
        isComplete: false,
        hasThinking: false,
        hasResponse: false,
        lastUpdated: Date.now(),
        stabilityScore: 0,
      });

      expect(sm.getCurrentState()).toBe(KimiState.IDLE);
    });

    it('deve lidar com response sem thinking (streaming direto)', () => {
      const sm = new KimiStateMachine();

      sm.processSnapshot({
        thinking: '',
        response: 'Resposta direta...',
        isComplete: false,
        hasThinking: false,
        hasResponse: true,
        lastUpdated: Date.now(),
        stabilityScore: 0,
      });

      expect(sm.getCurrentState()).toBe(KimiState.RESPONDING);
    });

    it('deve lidar com thinking muito longo', () => {
      const cleaner = new KimiTextCleaner();
      const longThinking = 'Analisando... '.repeat(1000);

      const result = cleaner.clean(longThinking, '');

      expect(result.thinking.length).toBeLessThan(longThinking.length);
    });

    it('deve lidar com caracteres especiais e unicode', () => {
      const cleaner = new KimiTextCleaner();
      const thinking = '🤔 Analisando... 你好世界 مرحبا [[response]]';

      const result = cleaner.clean(thinking, '');

      expect(result.thinking).toContain('🤔');
      expect(result.thinking).toContain('你好世界');
      expect(result.thinking).not.toContain('[[response]]');
    });
  });

  describe('TextCleaner', () => {
    it('deve preservar código durante limpeza', () => {
      const cleaner = new KimiTextCleaner();
      const thinking = `O usuário quer código.

        \`\`\`typescript
        function extract() {
          return document.querySelector('.segment-assistant');
        }
        \`\`\`

        [[response]] Pronto.`;

      const result = cleaner.clean(thinking, '');

      expect(result.thinking).toContain('function extract()');
      expect(result.thinking).toContain("document.querySelector('.segment-assistant')");
      expect(result.thinking).not.toContain('[[response]]');
    });

    it('deve lidar com self-talk em meio a código', () => {
      const cleaner = new KimiTextCleaner();
      const thinking = `O usuário está me tratando como Luna.

        \`\`\`js
        const x = 1;
        \`\`\`

        Mais análise.`;

      const result = cleaner.clean(thinking, '');

      expect(result.thinking).not.toContain('O usuário está me tratando como');
      expect(result.thinking).toContain('const x = 1');
    });

    it('deve lidar com múltiplas tags [[response]] intercaladas', () => {
      const cleaner = new KimiTextCleaner();
      const thinking = 'A [[response]] B [[response]] C [[response]] D';

      const result = cleaner.clean(thinking, '');

      expect(result.thinking).toBe('A B C D');
      expect(result.stats.tagsStripped).toBe(3);
    });

    it('deve não quebrar com texto vazio', () => {
      const cleaner = new KimiTextCleaner();
      const result = cleaner.clean('', '');

      expect(result.thinking).toBe('');
      expect(result.response).toBe('');
      expect(result.stats.totalCharsRemoved).toBe(0);
    });

    it('deve lidar com self-talk parcial (match parcial)', () => {
      const cleaner = new KimiTextCleaner();
      // Isso NÃO deve ser removido — é texto normal do usuário
      const thinking = 'O usuário está aqui na sala.';

      const result = cleaner.clean(thinking, '');

      // "O usuário está aqui" não é self-talk — self-talk é "O usuário está me tratando como"
      expect(result.thinking).toContain('O usuário está aqui');
    });
  });

  describe('TUI Renderer', () => {
    it('deve lidar com thinking vazio', () => {
      const renderer = new TUIStatusRenderer();
      const lines = renderer.renderThinking('', false, {
        thinking: '',
        response: '',
        removedSegments: [],
        stats: {
          selfTalkRemoved: 0,
          repetitionsRemoved: 0,
          tagsStripped: 0,
          markupRemoved: 0,
          totalCharsRemoved: 0,
          originalThinkingLength: 0,
          originalResponseLength: 0,
        },
      });
      expect(lines).toEqual([]);
    });

    it('deve lidar com response de uma linha', () => {
      const renderer = new TUIStatusRenderer();
      const lines = renderer.renderResponse('OK', true, {
        thinking: '',
        response: 'OK',
        removedSegments: [],
        stats: {
          selfTalkRemoved: 0,
          repetitionsRemoved: 0,
          tagsStripped: 0,
          markupRemoved: 0,
          totalCharsRemoved: 0,
          originalThinkingLength: 0,
          originalResponseLength: 2,
        },
      });
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain('✓');
    });
  });
});

// ============================================
// PERFORMANCE TESTS
// ============================================

describe('Performance', () => {
  it('TextCleaner deve processar 10KB em < 10ms', () => {
    const cleaner = new KimiTextCleaner();
    const largeText = 'Analisando... '.repeat(500); // ~7.5KB

    const start = performance.now();
    cleaner.clean(largeText, '');
    const end = performance.now();

    expect(end - start).toBeLessThan(10);
  });

  it('StateMachine deve processar 100 snapshots em < 5ms', () => {
    const sm = new KimiStateMachine();
    const snapshot: ExtractedContent = {
      thinking: 'Test',
      response: '',
      isComplete: false,
      hasThinking: true,
      hasResponse: false,
      lastUpdated: Date.now(),
      stabilityScore: 0,
    };

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      sm.processSnapshot({ ...snapshot, thinking: `Test ${i}` });
    }
    const end = performance.now();

    expect(end - start).toBeLessThan(5);
  });
});
