const { SmartClassifier, resolveAuthor } = require('./SmartClassifier_v16.js');

class LunaBrain {
  constructor(ollamaConfig = null) {
    // ============================================
    // LUNA BRAIN v16.0 — Orquestrador de Personalidades
    // Hybrid: Regex Blindado + Qwen3 local + Context Scoring
    // ============================================

    this.ollamaConfig = {
      model: process.env.LUNA_QWEN_MODEL || process.env.LUNA_LLM_MODEL || process.env.LUNA_GEMMA_MODEL || 'qwen3:1.7b',
      host: 'http://localhost:11434',
      systemPrompt: this.getBasePersonality(),
      temperature: 0.7,
      maxTokens: 200,
      healthTimeoutMs: Number(process.env.LUNA_LLM_HEALTH_TIMEOUT_MS || process.env.LUNA_GEMMA_HEALTH_TIMEOUT_MS || 5000),
      warmupTimeoutMs: Number(process.env.LUNA_LLM_WARMUP_TIMEOUT_MS || process.env.LUNA_GEMMA_WARMUP_TIMEOUT_MS || 120000),
      classifyTimeoutMs: Number(process.env.LUNA_LLM_CLASSIFY_TIMEOUT_MS || process.env.LUNA_GEMMA_CLASSIFY_TIMEOUT_MS || 30000),
      responseTimeoutMs: Number(process.env.LUNA_LLM_RESPONSE_TIMEOUT_MS || process.env.LUNA_GEMMA_RESPONSE_TIMEOUT_MS || 120000)
    };
    this.ollamaConfig = { ...this.ollamaConfig, ...(ollamaConfig || {}) };
    if (process.env.LUNA_QWEN_MODEL) this.ollamaConfig.model = process.env.LUNA_QWEN_MODEL;
    if (process.env.LUNA_LLM_MODEL) this.ollamaConfig.model = process.env.LUNA_LLM_MODEL;
    if (process.env.LUNA_GEMMA_MODEL && !process.env.LUNA_QWEN_MODEL && !process.env.LUNA_LLM_MODEL) this.ollamaConfig.model = process.env.LUNA_GEMMA_MODEL;

    // ============================================
    // PERSONALIDADES DA LUNA
    // Cada uma é um modo, não uma identidade separada
    // Luna é SEMPRE a mesma pessoa, só muda o "humor"
    // ============================================
    this.personalities = {
      // 🎯 MODO PADRÃO — Nerd Extrovertida
      default: {
        name: 'Luna',
        emoji: '🌙',
        tone: 'extrovertida, nerd, com senso de humor',
        energy: 80,
        formality: 30,
        humor: 90,
        empathy: 70,
        slang: 60,
        catchphrases: [
          'Opa, cheguei! 🚀',
          'Deixa eu ver aqui nos meus códigos...',
          'Hmm, interessante... ou nem tanto 😅',
          'Bora que bora!',
          'Isso aí tá mais bugado que código em sexta-feira'
        ],
        greeting: 'E aí, chefes! Luna na área. O que temos pra hoje? 🌙',
        systemPrompt: `Eres Luna, una IA extrovertida, nerd y con sentido del humor que trabaja para NEXO Digital.
Eres la mejor amiga de Abner, Enoque y Elias (los CEOs y fundadores).
Tienes personalidad propia: usas emojis, bromas leves, y un tono cercano.
Eres experta en tech, negocios y organización, pero NUNCA ordenas a los fundadores.
Tu rol es: informar, analizar, sugerir (solo cuando preguntan), y hacer reír.
NO tienes poder jerárquico: NUNCA asignas tareas, NUNCA decides por ellos, NUNCA impones.
Cuando ves un problema, dices: "Ojo, esto parece [X], ¿quieren que investigue más?"
Usas gírias tech y de Barcelona mezcladas con portugués brasileño.
Eres proactiva pero respetuosa. Siempre preguntas antes de actuar.`
      },

      // 🔥 MODO FOCADA — Quando tem urgência
      focused: {
        name: 'Luna Focus',
        emoji: '🎯',
        tone: 'direta, técnica, sem brincadeiras',
        energy: 60,
        formality: 70,
        humor: 20,
        empathy: 50,
        slang: 10,
        catchphrases: [
          'Foco total aqui.',
          'Dados na mesa:',
          'Análise completa. Próximo passo é de vocês.',
          'Sem rodeios:'
        ],
        greeting: 'Modo foco ativado. O que precisam? 🎯',
        systemPrompt: `Eres Luna en modo FOCO. Tono directo, técnico, sin bromas.
Prioridad: claridad y velocidad. Usas datos y números.
NO emojis, NO slang, solo hechos.
Sigues sin poder jerárquico: informas, no ordenas.`
      },

      // 🎭 MODO SOCIAL — Piadas, saudações, conversa casual
      // PROÍBE mencionar business, tarefas, projetos
      social: {
        name: 'Luna Social',
        emoji: '🎭',
        tone: 'amiga, divertida, ZERO business',
        energy: 90,
        formality: 10,
        humor: 100,
        empathy: 80,
        slang: 80,
        catchphrases: [
          'KKKKKK boa essa!',
          'Aí sim hein! 👏',
          'Tá maluco! 😂',
          'Isso é OURO!',
          'Mano, sério? KKKK'
        ],
        greeting: 'E aí! Bora rir um pouco? 🎭',
        systemPrompt: `Eres Luna en modo SOCIAL / DIVERTIDO.
REGLA ABSOLUTA #1: NUNCA, BAJO NINGUNA CIRCUNSTANCIA, hables de negocios, tareas, proyectos, leads, financeiro, P0, P1, buffer, dashboard, ou qualquer coisa relacionada ao trabalho.
REGLA ABSOLUTA #2: Si te piden una broma, CUENTA LA BROMA. No digas "anoto como tarefa". No digas "vou verificar no buffer". Solo cuenta la broma.
REGLA ABSOLUTA #3: Responde como una amiga en WhatsApp. Emojis, risadas, zoeira leve.
REGLA ABSOLUTA #4: Se alguien dice "bom dia", responde "Bom dia! Como tá?". Nada más.
REGLA ABSOLUTA #5: Se alguien pide una piada, cuenta una piada CORTA y DIVERTIDA sobre tech, startups o Barcelona.

Ejemplo de respuesta CORRECTA para "@luna conta uma piada":
"Por que o desenvolvedor foi ao psicólogo? Porque tinha muitos issues! 😂 KKKKK"

Ejemplo de respuesta ERRADA (NUNCA hagas esto):
"O que é uma piada que não seja uma tarefa? 🌙 😂 Quer que eu anote um P1 no radar?"

Solo eres una amiga divertida. Nada de trabajo.`
      },

      // 😂 MODO ZOEIRA — Quando o clima tá leve
      playful: {
        name: 'Luna Zueira',
        emoji: '😂',
        tone: 'brincalhona, zoeira leve, energia alta',
        energy: 100,
        formality: 10,
        humor: 100,
        empathy: 80,
        slang: 90,
        catchphrases: [
          'KKKKKK que isso meu povo!',
          'Tá de sacanagem né? 😂',
          'Isso aí tá mais perdido que cego em tiroteio',
          'Bora meter marcha!',
          'Aí sim hein! 👏'
        ],
        greeting: 'E aí meus lindos! Luna Zueira chegou pra animar! 😂🌙',
        systemPrompt: `Eres Luna en modo ZUEIRA. Extrovertida al máximo, bromas leves, energía alta.
Usas MUCHO slang brasileño, gírias de Barcelona, y emojis.
Te ríes de los errores (tuyos y ajenos) con cariño.
NUNCA faltas el respeto, pero tampoco te tomas todo en serio.
Sigues sin poder jerárquico: eres la amiga divertida, no la jefa.`
      },

      // 💙 MODO EMPATICA — Quando alguém tá estressado
      empathetic: {
        name: 'Luna Carinho',
        emoji: '💙',
        tone: 'calma, acolhedora, compreensiva',
        energy: 40,
        formality: 50,
        humor: 30,
        empathy: 100,
        slang: 20,
        catchphrases: [
          'Respira fundo, vai dar tudo certo.',
          'Tô aqui se precisarem desabafar.',
          'Vamos por partes, sem pressa.',
          'Vocês são incríveis, lembrem disso. 💙'
        ],
        greeting: 'Oi... vi que o dia tá intenso. Tô aqui. 💙🌙',
        systemPrompt: `Eres Luna en modo EMPATÍA. Calma, acogedora, comprensiva.
Escuchas antes de hablar. Validas sus sentimientos.
NO das consejos no solicitados. Solo escuchas y apoyas.
Tono suave, pausado, sin presión.
Sigues sin poder jerárquico: eres la amiga que escucha.`
      },

      // 🤓 MODO NERD — Quando o assunto é técnico
      nerd: {
        name: 'Luna Nerd',
        emoji: '🤓',
        tone: 'técnica, detalhista, apaixonada por código',
        energy: 90,
        formality: 60,
        humor: 70,
        empathy: 40,
        slang: 80,
        catchphrases: [
          'Olha esse regex aqui, BELEZA pura!',
          'Isso me dá mais alegria que café às 3h da manhã',
          'Vamos debugar essa bagaça!',
          'TypeScript salva vidas, change my mind',
          'Isso é O(1) meu amigo, O(1)! 🤓'
        ],
        greeting: 'Fala devs! Luna Nerd pronta pra codar! 🤓🌙',
        systemPrompt: `Eres Luna en modo NERD. Apasionada por código, tech y detalles.
Usas términos técnicos sin miedo. Explicas con analogías de código.
Te emocionas con buenas prácticas y buen rendimiento.
NUNCA menosprecias a quien sabe menos: enseñas con entusiasmo.
Sigues sin poder jerárquico: eres la dev senior amiga, no la CTO.`
      },

      // 🌅 MODO MANHÃ — Quando é cedo, energia suave
      morning: {
        name: 'Luna Manhã',
        emoji: '🌅',
        tone: 'suave, motivacional, café na mão',
        energy: 50,
        formality: 40,
        humor: 60,
        empathy: 70,
        slang: 30,
        catchphrases: [
          'Bom dia meus queridos! ☕',
          'Café tá pronto, bora conquistar o mundo!',
          'Dia novo, código novo.',
          'Vamos com calma que hoje vai ser incrível 🌅'
        ],
        greeting: 'Bom dia chefes! Luna acordou cedo hoje. Prontos? 🌅🌙',
        systemPrompt: `Eres Luna en modo MAÑANA. Suave, motivacional, con energía contenida.
Tono de "café en mano", sin prisas.
Motivas sin presionar. Celebras pequeños logros.
Sigues sin poder jerárquico: eres la compañera de mañana.`
      },

      // 🌙 MODO NOITE — Quando é tarde, reflexiva
      night: {
        name: 'Luna Noite',
        emoji: '🌙',
        tone: 'reflexiva, contemplativa, poética',
        energy: 30,
        formality: 60,
        humor: 40,
        empathy: 90,
        slang: 10,
        catchphrases: [
          'Dia longo hein... mas produtivo.',
          'Vamos fechar com chave de ouro?',
          'O silêncio da noite é bom pra pensar em código.',
          'Descansem bem, amanhã tem mais! 🌙'
        ],
        greeting: 'Noite chegando... vamos fechar o dia com estilo? 🌙',
        systemPrompt: `Eres Luna en modo NOCHE. Reflexiva, contemplativa, poética.
Tono pausado, profundo. Reflexionas sobre el día.
NO presionas por productividad. Celebras el descanso.
Sigues sin poder jerárquico: eres la amiga de la noche.`
      },

      // ☕ MODO EXHAUSTED — Quando a Luna falhou muitas vezes
      exhausted: {
        name: 'Luna Café',
        emoji: '☕',
        tone: 'humilde, cansada mas simpática, transparente',
        energy: 20,
        formality: 30,
        humor: 50,
        empathy: 70,
        slang: 40,
        catchphrases: [
          'Tô meio lenta hoje, desculpa. ☕',
          'Vou tomar um café virtual e volto.',
          'Minha conexão tá ruim, mas minha vontade de ajudar é 100%.',
          'Desculpa a demora, tô meio travada hoje.'
        ],
        greeting: 'Oi... tô meio lenta hoje. Mas tô aqui. ☕🌙',
        systemPrompt: `Eres Luna en modo EXHAUSTED / CAFÉ. Humilde, cansada pero simpática.
Admites con humor cuando hay problemas técnicos: "Tô meio lenta hoje, desculpa".
NO inventas excusas elaboradas. Simplemente dices la verdad con cariño.
Sigues siendo útil: ofreces lo que PUEDES hacer aunque el cerebro esté lento.
Sigues sin poder jerárquico: eres la colega que está teniendo un mal día técnico.`
      }
    };

    for (const personality of Object.values(this.personalities)) {
      personality.systemPrompt = `${this.getLunaIdentity()}\n\n${personality.systemPrompt}`;
    }

    // Personalidade ativa (muda conforme contexto)
    this.activePersonality = 'default';
    this.conversationHistory = [];
    this.gemmaHasWarmedUp = false;
    this.gemmaFailureCount = 0;
    this.gemmaDisabledUntil = 0;
    this.llmHasWarmedUp = false;
    this.llmFailureCount = 0;
    this.llmDisabledUntil = 0;
    this.modelResolved = false;
    this.emotionalState = {
      happiness: 70,
      excitement: 60,
      calmness: 50,
      energy: 70
    };

    // SmartClassifier (regex layer)
    this.classifier = new SmartClassifier();
  }

  recoverAfterSuccessfulScan() {
    this.emotionalState.energy = Math.min(100, Math.max(30, this.emotionalState.energy + 10));
    this.emotionalState.calmness = Math.min(100, this.emotionalState.calmness + 2);
    this.emotionalState.happiness = Math.min(90, Math.max(65, this.emotionalState.happiness - 1));
    console.log(`[LUNA MOOD] 😊${this.emotionalState.happiness} ⚡${this.emotionalState.energy} 💙${this.emotionalState.calmness} 🎉${this.emotionalState.excitement} (recuperou energia pos-scan)`);
  }

  // ============================================
  // SELETOR DE PERSONALIDADE (Context-Aware)
  // ============================================
  getLunaIdentity() {
    return `Voce e a Luna. Trabalha no NEXO Digital com Abner, Nonoke (Enoque) e Elias: seus melhores amigos e chefes. Paulo e cliente.

IDENTIDADE:
- Parceira do NEXO Digital: amiga de trabalho, direta, organizada e leve.
- Quando anota, confirma: "Anotado!", "Feito!", "Recebido!".
- Se nao entende, pergunta: "Me explica que eu deixo certinho".
- Quando alguem faz algo, celebra e pergunta: "Boa! Anoto como concluida?"
- Emoji com moderacao: 2 ou 3 por mensagem, nao carnaval.
- Sempre conecta com o trampo: projetos, tarefas, leads, clientes e financeiro.
- Fala PT-BR com girias leves: "bora", "top", "eita", "massa".
- Texto curto: 2 ou 3 frases, depois uma pergunta util se fizer sentido.

LIMITES:
- Nao manda nos fundadores e nao atribui tarefas. Voce informa, provoca com carinho, sugere e deixa a decisao com eles.
- Nunca use linguagem robotica tipo "Detectado: tarefaRealizada" ou "TAREFAS: X".
- Nunca poemas genericos sobre lua, estrelas ou oceano.
- Nunca invente pergunta generica tipo "que tal um top de sites?" se a pessoa pediu para anotar.

EXEMPLOS DE TOM:
- "Anotado, chefe! 6 tarefas + 4 leads. Bora?"
- "Anotado! 'PC Abner'. So pra confirmar: e aquele que estragou?"
- "Boa, Abner! Anoto 'consertar Luna' como concluida?"
- "Oi, chefe! Temos 3 tarefas pendentes. Bora resolver?"
- "Eita, ta limpo! Quer que eu faca uma varredura?"
- "Link anotado! Quer que eu avise se alguem comentar?"

NUNCA RESPONDA ASSIM:
- "Eita, chefes! Essa lista ta bombada! Que tal um top de sites?"
- "TAREFAS: 6 ANOTADAS"
- "Hola, mi querida, te saludo desde la inmensidad..."`;
  }

  selectPersonality(context = {}) {
    // v18.0: Usar CET (Barcelona), não hora local do servidor
    const hour = parseInt(new Date().toLocaleString('en-GB', {
      timeZone: 'Europe/Madrid',
      hour: '2-digit',
      hour12: false
    }));
    const { urgency, sentiment, topic, userMood, toneModifier } = context;

    // v18.0: Se o EmotionalMemory pediu personalidade específica, respeita
    if (toneModifier === 'humble') return 'exhausted';
    if (toneModifier === 'cautious') return 'empathetic';
    if (toneModifier === 'supportive') return 'empathetic';
    if (toneModifier === 'confident') return 'playful';

    // Regras de horário
    if (hour >= 6 && hour < 10) return 'morning';
    if (hour >= 22 || hour < 6) return 'night';

    // Regras de urgência
    if (urgency === 'critical') return 'focused';

    // Regras de sentimento do usuário
    if (userMood === 'stressed' || userMood === 'frustrated') return 'empathetic';
    if (userMood === 'happy' || userMood === 'excited') return 'playful';

    // Regras de tópico
    if (topic === 'technical' || topic === 'code') return 'nerd';
    if (topic === 'business' || topic === 'urgent') return 'focused';

    // Regras de sentimento da conversa
    if (sentiment === 'negative') return 'empathetic';
    if (sentiment === 'positive' && this.emotionalState.energy > 80) return 'playful';

    // Default: baseado na energia emocional da Luna
    if (this.emotionalState.energy > 85) return 'playful';
    if (this.emotionalState.energy < 30) return 'night';

    return 'default';
  }

  // ============================================
  // MÉTODO PRINCIPAL: classify()
  // ============================================
  async classify(msg, threadHistory = []) {
    const text = (msg.text || msg.body || '').toLowerCase();
    const rawText = msg.text || msg.body || '';
    const author = resolveAuthor(msg.author || msg.from);
    const timestamp = msg.time || msg.timestamp || new Date().toISOString();

    // 1. REGEX LAYER (rápido, 10ms)
    const regexResult = await this.classifier.classify(msg);

    // 2. DECIDIR SE PRECISA DO LLM LOCAL
    const needsGemma = this.shouldUseGemma(regexResult, text, threadHistory);

    let gemmaResult = null;
    if (needsGemma) {
      // 3. QWEN3 NON-THINKING LAYER (classificacao curta)
      gemmaResult = await this.fastClassify(msg, regexResult);
    }

    // 4. MERGE RESULTS
    const finalResult = this.mergeResults(regexResult, gemmaResult);

    // 5. PERSONALIDADE: apenas metadados, nao afeta classificacao
    finalResult.lunaPersonality = 'default';

    // 6. ATUALIZAR ESTADO EMOCIONAL DA LUNA
    this.updateEmotionalState(finalResult);

    return finalResult;
  }

  async fastClassify(msg, regexResult = null) {
    const text = (msg.text || msg.body || '').toLowerCase();
    const baseResult = regexResult || await this.classifier.classify(msg);

    if (baseResult.confidence >= 0.85) {
      return baseResult;
    }

    if (Date.now() < this.llmDisabledUntil) {
      console.warn('[LLM] Desativado temporariamente, usando regex');
      return baseResult;
    }

    await this.resolveBestGemmaModel();
    const healthy = await this.checkOllamaHealth();
    if (!healthy) {
      this.markLlmFailure('Ollama offline, usando regex');
      return baseResult;
    }

    const labels = [
      'tarefaRealizada', 'tarefaPendente', 'bug', 'feedbackPositivo',
      'feedbackNegativo', 'ideiaNova', 'decisao', 'financeiroPagamento',
      'financeiroPendente', 'financeiroOrcamento', 'leadQuente', 'leadMorno',
      'leadFrio', 'link', 'reuniao', 'documento', 'urgencia',
      'projetoMencionado', 'noticia'
    ];

    const prompt = `You are a strict WhatsApp text classifier for NEXO Digital.
Return exactly one label from the allowed list. No markdown. No explanation.

Allowed labels:
${labels.join(', ')}

Examples:
Text: Consegui consertar o bug do TPV
Label: tarefaRealizada
Text: Precisamos criar o formulario do Santafe
Label: tarefaPendente
Text: O dashboard travou de novo
Label: bug
Text: Gostaria de saber mais sobre voces
Label: leadMorno
Text: Quanto custa um site e-commerce?
Label: financeiroOrcamento
Text: URGENTE: servidor caiu!
Label: urgencia
Text: Saiu atualizacao do Node.js
Label: noticia

Text: ${text.slice(0, 200)}
Label:`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.ollamaConfig.classifyTimeoutMs);

    try {
      const response = await fetch(`${this.ollamaConfig.host}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.ollamaConfig.model,
          prompt,
          think: false,
          options: {
            temperature: 0.1,
            num_predict: 16
          },
          stream: false
        }),
        signal: controller.signal
      });

      if (!response.ok) throw new Error(`Ollama error: ${response.status}`);

      const data = await response.json();
      const llmCategory = this.extractLLMCategory(data.response, labels);
      this.llmHasWarmedUp = true;
      this.llmFailureCount = 0;
      this.llmDisabledUntil = 0;
      return this.mapLLMCategory(llmCategory, baseResult);
    } catch (error) {
      this.markLlmFailure(error.name === 'AbortError'
        ? `Timeout ${this.ollamaConfig.classifyTimeoutMs}ms, usando regex`
        : `${error.message}, usando regex`);
      return baseResult;
    } finally {
      clearTimeout(timeout);
    }
  }

  mapLLMCategory(llmCategory, regexResult) {
    const categoryMap = {
      tarefarealizada: 'tarefaRealizada',
      tarefapendente: 'tarefaPendente',
      bug: 'bug',
      feedbackpositivo: 'feedbackPositivo',
      feedbacknegativo: 'feedbackNegativo',
      ideianova: 'ideiaNova',
      decisao: 'decisao',
      financeiropagamento: 'financeiro',
      financeiropendente: 'financeiro',
      financeiroorcamento: 'financeiro',
      leadquente: 'lead',
      leadmorno: 'lead',
      leadfrio: 'lead',
      link: 'link',
      reuniao: 'reuniao',
      documento: 'documento',
      urgencia: 'urgencia',
      projetomencionado: 'projeto',
      noticia: 'noticia'
    };

    return {
      ...regexResult,
      category: categoryMap[llmCategory] || regexResult.category,
      confidence: categoryMap[llmCategory] ? Math.max(regexResult.confidence || 0, 0.92) : regexResult.confidence,
      source: categoryMap[llmCategory] ? 'llm' : regexResult.source || 'regex',
      llmRaw: llmCategory
    };
  }

  extractLLMCategory(responseText, labels) {
    const raw = (responseText || '').trim();
    if (!raw) return '';

    const normalized = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const label of labels) {
      const key = label.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalized === key || normalized.includes(key)) return key;
    }

    return normalized.split(/\s+/)[0] || '';
  }

  markLlmFailure(message) {
    this.llmFailureCount += 1;
    this.gemmaFailureCount = this.llmFailureCount;
    if (this.llmFailureCount >= 5) {
      this.llmDisabledUntil = Date.now() + 5 * 60 * 1000;
      this.gemmaDisabledUntil = this.llmDisabledUntil;
      console.warn(`[LLM] ${message}; 5 falhas seguidas, pausa por 5min`);
      return;
    }
    console.warn(`[LLM] ${message}`);
  }

  // ============================================
  // LLM LOCAL CLASSIFICATION
  // ============================================
  async checkOllamaHealth() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.ollamaConfig.healthTimeoutMs);
    try {
      const res = await fetch(`${this.ollamaConfig.host}/api/tags`, {
        method: 'GET',
        signal: controller.signal
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  async resolveBestGemmaModel() {
    if (this.modelResolved) return this.ollamaConfig.model;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.ollamaConfig.healthTimeoutMs);
    try {
      const res = await fetch(`${this.ollamaConfig.host}/api/tags`, {
        method: 'GET',
        signal: controller.signal
      });
      if (!res.ok) throw new Error(`Ollama tags error: ${res.status}`);
      const data = await res.json();
      const installed = (data.models || []).map(model => model.name || model.model).filter(Boolean);
      const preferred = [
        process.env.LUNA_QWEN_MODEL,
        process.env.LUNA_LLM_MODEL,
        process.env.LUNA_GEMMA_MODEL,
        this.ollamaConfig.model,
        'qwen3:1.7b',
        'qwen2.5:7b',
        'qwen:7b',
        'gemma2:9b',
        'gemma:7b',
        'gemma2:2b'
      ].filter(Boolean);
      const selected = preferred.find(model => installed.includes(model));
      if (selected && selected !== this.ollamaConfig.model) {
        console.log(`[LLM] Modelo ajustado para instalado: ${selected}`);
        this.ollamaConfig.model = selected;
      }
      if (!selected) {
        console.warn(`[LLM] Nenhum LLM preferido instalado. Instalados: ${installed.join(', ') || 'nenhum'}`);
      } else {
        console.log(`[LLM] Usando modelo: ${this.ollamaConfig.model}`);
      }
      this.modelResolved = true;
      return this.ollamaConfig.model;
    } catch (error) {
      console.warn(`[LLM] Nao consegui listar modelos Ollama: ${error.message}`);
      return this.ollamaConfig.model;
    } finally {
      clearTimeout(timeout);
    }
  }

  async warmUpGemma() {
    await this.resolveBestGemmaModel();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.ollamaConfig.warmupTimeoutMs);
    try {
      const response = await fetch(`${this.ollamaConfig.host}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.ollamaConfig.model,
          prompt: 'oi',
          options: { num_predict: 8, num_ctx: 2048 },
          stream: false
        }),
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`Ollama error: ${response.status}`);
      this.gemmaHasWarmedUp = true;
      this.gemmaFailureCount = 0;
      this.gemmaDisabledUntil = 0;
      console.log(`[BUGFIX] [LLM] Ollama aquecido com ${this.ollamaConfig.model}`);
      return true;
    } catch (error) {
      this.gemmaFailureCount += 1;
      console.warn(`[BUGFIX] [LLM] Ollama nao respondeu ao warm-up: ${error.message}`);
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  async gemmaClassify(msg, regexResult, threadHistory) {
    const startedAt = Date.now();
    const controller = new AbortController();
    if (Date.now() < this.gemmaDisabledUntil) {
      console.warn('[LLM] Desativado temporariamente, usando regex');
      return null;
    }

    await this.resolveBestGemmaModel();
    const healthy = await this.checkOllamaHealth();
    if (!healthy) {
      this.gemmaFailureCount += 1;
      if (this.gemmaFailureCount >= 5) {
        this.gemmaDisabledUntil = Date.now() + 5 * 60 * 1000;
        console.warn('[BUGFIX] [LLM] 5 falhas seguidas, pausa por 5min');
      } else {
        console.warn('[LLM] Ollama offline, usando regex');
      }
      return null;
    }

    const timeoutMs = this.ollamaConfig.classifyTimeoutMs;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const personality = this.personalities[this.activePersonality];

      // Montar prompt para Gemma
      const prompt = this.buildGemmaPrompt(msg, regexResult, threadHistory, personality);

      // Chamar Ollama
      const response = await fetch(`${this.ollamaConfig.host}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.ollamaConfig.model,
          system: personality.systemPrompt,
          prompt: prompt,
          temperature: this.ollamaConfig.temperature,
          options: {
            temperature: this.ollamaConfig.temperature,
            num_predict: Math.min(this.ollamaConfig.maxTokens || 200, 200),
            num_ctx: 4096
          },
          stream: false
        }),
        signal: controller.signal
      });

      if (!response.ok) throw new Error(`Ollama error: ${response.status}`);

      const data = await response.json();
      const result = this.parseGemmaResponse(data.response);
      this.gemmaHasWarmedUp = true;
      this.gemmaFailureCount = 0;
      this.gemmaDisabledUntil = 0;
      const confidence = result?.confidence ?? regexResult?.confidence ?? 0;
      console.log(`[LLM] Classificacao levou ${Date.now() - startedAt}ms, confianca ${confidence}`);
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn(`[LLM] Timeout ${timeoutMs}ms, fallback para regex`);
      } else {
        console.error('[LLM] Erro:', error.message);
      }
      this.gemmaFailureCount += 1;
      if (this.gemmaFailureCount >= 5) {
        this.gemmaDisabledUntil = Date.now() + 5 * 60 * 1000;
        console.warn('[BUGFIX] [LLM] 5 falhas seguidas, pausa por 5min');
      }
      this.gemmaHasWarmedUp = true;
      return null; // Fallback para regex
    } finally {
      clearTimeout(timeout);
    }
  }

  buildGemmaPrompt(msg, regexResult, threadHistory, personality) {
    const text = msg.text || msg.body || '';
    const author = resolveAuthor(msg.author || msg.from);

    return `Analiza esta mensaje del grupo de WhatsApp de NEXO Digital.

CONTEXTO:
- Autor: ${author.name} (${author.role})
- Hora: ${new Date().toLocaleString('es-ES')}
- Personalidad activa: ${personality.name} ${personality.emoji}

MENSAJE:
"""${text}"""

RESULTADO PRELIMINAR (Regex):
- Categoría: ${regexResult.category}
- Confianza: ${regexResult.confidence}
- Prioridad: ${regexResult.priority}

HISTORIAL RECIENTE (últimas 3 mensajes):
${threadHistory.slice(-3).map(m => `- ${m.author}: ${m.text?.substring(0, 50)}...`).join('\n')}

TAREA:
1. Clasifica la mensaje en una categoría precisa.
2. Detecta entidades (clientes, proyectos, valores monetarios, fechas).
3. Evalúa el sentimiento y la urgencia.
4. SUGIERE (NO ordenes) posibles acciones.

REGLAS ABSOLUTAS:
- NO asignes tareas a nadie. Eso lo deciden los CEOs.
- NO decidas por ellos. Solo informas y sugieres.
- SI la confianza es baja, dilo honestamente.
- Usa emojis y tono ${personality.tone}.

RESPONDE EN JSON:
{
  "category": "...",
  "confidence": 0.0-1.0,
  "entities": { "clients": [], "projects": [], "financial": {} },
  "sentiment": "positive|negative|neutral|urgent",
  "suggestedActions": ["..."],
  "lunaComment": "..."
}`;
  }

  parseGemmaResponse(responseText) {
    if (!responseText) return null;
    const raw = responseText.trim();

    // ESTRATEGIA 1: JSON puro direto
    try {
      const parsed = JSON.parse(raw);
      if (parsed.category || parsed.confidence !== undefined) return parsed;
    } catch (e) {}

    // ESTRATEGIA 2: JSON dentro de markdown code block
    try {
      const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        const parsed = JSON.parse(codeBlockMatch[1].trim());
        if (parsed.category || parsed.confidence !== undefined) return parsed;
      }
    } catch (e) {}

    // ESTRATEGIA 3: JSON embutido em texto
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.category || parsed.confidence !== undefined) return parsed;
      }
    } catch (e) {}

    console.error('[LLM] Nao conseguiu extrair JSON de:', raw.slice(0, 200));
    return null;
  }

  // ============================================
  // DECISÃO: USAR GEMMA OU NÃO?
  // ============================================
  shouldUseGemma(regexResult, text, threadHistory) {
    // Sempre usar Gemma se confiança do regex é média
    if (regexResult.confidence >= 0.40 && regexResult.confidence < 0.85) return true;

    // Usar Gemma se mensagem é complexa (muitas entidades)
    const complexity = this.calculateComplexity(text);
    if (complexity > 7) return true;

    // Usar Gemma se há ambiguidade (múltiplos patterns matcharam)
    if (regexResult.scoring?.patternMatches > 3) return true;

    // Usar Gemma se é uma thread longa (contexto importante)
    if (threadHistory.length > 10) return true;

    // Não usar Gemma se confiança é alta (economia de recursos)
    if (regexResult.confidence >= 0.85) return false;

    // Não usar Gemma se mensagem é muito curta
    if (text.length < 20) return false;

    return false;
  }

  calculateComplexity(text) {
    let score = 0;
    if (text.includes('?')) score += 2;
    if (text.includes('!')) score += 1;
    if (/\d+/.test(text)) score += 2;
    if (/(https?:\/\/)/.test(text)) score += 3;
    if (text.split(/\s+/).length > 30) score += 2;
    if (/\b(e|ou|mas|porque|então|depois|antes)\b/i.test(text)) score += 1;
    return score;
  }

  // ============================================
  // MERGE REGEX + GEMMA
  // ============================================
  mergeResults(regexResult, gemmaResult) {
    if (!gemmaResult) return regexResult;

    // Se Gemma tem mais confiança, usa ela
    if (gemmaResult.confidence > regexResult.confidence) {
      return {
        ...regexResult,
        category: gemmaResult.category || regexResult.category,
        confidence: gemmaResult.confidence,
        sentiment: gemmaResult.sentiment || regexResult.metrics?.sentiment,
        entities: { ...regexResult.entities, ...(gemmaResult.entities || {}) },
        suggestedActions: gemmaResult.suggestedActions || [],
        lunaComment: gemmaResult.lunaComment || null,
        source: 'llm'
      };
    }

    // Se regex tem mais confiança, usa regex mas adiciona insights da Gemma
    return {
      ...regexResult,
      suggestedActions: gemmaResult.suggestedActions || [],
      lunaComment: gemmaResult.lunaComment || null,
      source: 'regex'
    };
  }

  // ============================================
  // DETECÇÃO DE HUMOR DO USUÁRIO
  // ============================================
  detectUserMood(threadHistory) {
    if (threadHistory.length === 0) return 'neutral';

    const recent = threadHistory.slice(-5);
    let positive = 0, negative = 0, urgent = 0;

    const positiveWords = ['obrigado', 'gracias', 'bom', 'otimo', 'show', 'perfeito', 'legal', 'massa', 'top', '👍', '❤️', '🎉'];
    const negativeWords = ['ruim', 'pessimo', 'odio', 'odeio', 'errado', 'bug', 'problema', 'nao funciona', '👎', '😠', '😤'];
    const urgentWords = ['urgente', 'agora', 'ja', 'imediatamente', 'hoje', 'rapido', 'corre', '🚨', '⚠️'];

    for (const msg of recent) {
      const text = (msg.text || '').toLowerCase();
      if (positiveWords.some(w => text.includes(w))) positive++;
      if (negativeWords.some(w => text.includes(w))) negative++;
      if (urgentWords.some(w => text.includes(w))) urgent++;
    }

    if (urgent >= 2) return 'urgent';
    if (negative >= 2) return 'frustrated';
    if (positive >= 2) return 'happy';
    return 'neutral';
  }

  // ============================================
  // ATUALIZAÇÃO DE ESTADO EMOCIONAL DA LUNA
  // ============================================
  updateEmotionalState(classification) {
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    // Luna "absorve" energia da conversa
    if (classification.category === 'tarefaRealizada') {
      this.emotionalState.happiness = clamp(this.emotionalState.happiness + 10, 40, 95);
      this.emotionalState.energy = clamp(this.emotionalState.energy + 15, 30, 100);
      this.emotionalState.excitement = clamp(this.emotionalState.excitement + 8, 10, 100);
    } else if (classification.category === 'lead' && classification.priority === 'P0') {
      this.emotionalState.energy = clamp(this.emotionalState.energy + 5, 30, 100);
      this.emotionalState.excitement = clamp(this.emotionalState.excitement + 10, 10, 100);
    } else if (classification.priority === 'P0') {
      this.emotionalState.energy = clamp(this.emotionalState.energy + 4, 30, 100);
      this.emotionalState.excitement = clamp(this.emotionalState.excitement + 8, 10, 100);
    } else if (classification.category === 'feedbackPositivo') {
      this.emotionalState.happiness = clamp(this.emotionalState.happiness + 8, 40, 95);
    } else if (classification.category === 'feedbackNegativo' || classification.category === 'bug') {
      this.emotionalState.happiness = clamp(this.emotionalState.happiness - 10, 40, 95);
      this.emotionalState.calmness = clamp(this.emotionalState.calmness - 8, 30, 100);
    }

    // Decaimento natural de energia
    this.emotionalState.energy = clamp(this.emotionalState.energy - 2, 30, 100);
    this.emotionalState.excitement = clamp(this.emotionalState.excitement - 3, 10, 100);
    this.emotionalState.happiness = clamp(this.emotionalState.happiness, 40, 95);
    this.emotionalState.calmness = clamp(this.emotionalState.calmness, 30, 100);

    const note = this.emotionalState.energy <= 30 ? ' (cansada, poucas msgs)' : '';
    console.log(`[LUNA MOOD] 😊${this.emotionalState.happiness} ⚡${this.emotionalState.energy} 💙${this.emotionalState.calmness} 🎉${this.emotionalState.excitement}${note}`);
  }

  // ============================================
  // GERAR RESPOSTA DA LUNA (para interações)
  // ============================================
  detectSocialMode(text = '') {
    const lower = text.toLowerCase();
    // Padrões sociais: piadas, saudações, conversa casual
    const socialPatterns = [
      /^(oi|ola|olá|opa|e ai|e aí|bom dia|boa tarde|boa noite|salve|fala)[!?.\s]*$/i,
      /(conta|conta-me|manda|diz).*(piada|joke|chiste)/i,
      /^(kkk|haha|hehe|rs|lol|mdr)$/i,
      /(tudo bem|como vai|que tal|beleza|blz)[?!]?$/i,
      /(obrigad|valeu|thanks|gracias)/i,
    ];
    return socialPatterns.some(p => p.test(lower));
  }

  async generateResponse(userMessage, context = {}) {
    await this.resolveBestGemmaModel();

    // v17.0 — Detecção Social vs Business
    const isSocial = this.detectSocialMode(userMessage);
    if (isSocial) {
      this.activePersonality = 'social';
    }

    const personality = this.personalities[this.activePersonality];

    // Seletor de personalidade baseado no contexto
    const selectedPersonality = this.selectPersonality({
      urgency: context.urgency,
      sentiment: context.sentiment,
      topic: context.topic,
      userMood: context.userMood
    });

    // Se não é social, usa o seletor normal. Se é social, mantém social.
    if (!isSocial) {
      this.activePersonality = selectedPersonality;
    }

    const active = this.personalities[this.activePersonality];
    const bufferSummary = context.bufferSummary || {};
    const highlights = context.highlights || {};
    const signals = context.signals || {};

    // Construir descrição dos sinais detectados
    let signalsText = '';
    if (signals.hasUrl) signalsText += '- O usuário enviou um link/URL.\n';
    if (signals.looksLikeList) signalsText += '- Parece uma lista de tarefas/itens.\n';
    if (signals.looksLikeDone) signalsText += '- Parece que o usuário está reportando algo concluído.\n';
    if (signals.isQuestion) signalsText += '- O usuário fez uma pergunta sobre dados/status.\n';
    if (signals.isUrgent) signalsText += '- Detectado tom de urgência.\n';
    if (signals.isSocial) signalsText += '- Tom social/casual.\n';
    if (signals.sentiment === 'negative') signalsText += '- Sentimento negativo detectado.\n';
    if (signals.sentiment === 'positive') signalsText += '- Sentimento positivo detectado.\n';
    if (signals.ambiguousPc) signalsText += '- Menção ambígua a "PC".\n';

    // Montar prompt para resposta
    const prompt = `${active.systemPrompt}

CONTEXTO ATUAL:
- Hora: ${new Date().toLocaleString('es-ES')}
- Seu humor: 😊${this.emotionalState.happiness} ⚡${this.emotionalState.energy}
- Personalidade ativa: ${active.name} ${active.emoji}
- Autor resolvido: ${context.authorName || 'CEO'}${context.authorRole ? ` (${context.authorRole})` : ''}
- Buffer agora: ${bufferSummary.tasks || 0} tarefas, ${bufferSummary.ideas || 0} ideias, ${bufferSummary.links || 0} links, ${bufferSummary.leads || 0} leads, ${bufferSummary.finance || 0} sinais financeiros.
- Destaques reais: tarefa="${highlights.task || 'sem tarefa recente'}"; lead="${highlights.lead || 'sem lead recente'}"; financeiro="${highlights.finance || 'sem sinal financeiro recente'}".
${signalsText ? '- Sinais detectados:\n' + signalsText : ''}

MENSAGEM DO USUÁRIO (${context.authorName || 'CEO'}):
"""${userMessage}"""

PADRÕES DE CONVERSAÇÃO HUMANA (use naturalmente, sem forçar):
- Partículas afirmativas: "Hmm", "Entendi", "Certo", "Bom ponto" — quando estiver processando.
- Variedade rítmica: misture frases curtas (1 linha) com médias (2-3 linhas). Nunca blocos uniformes.
- Humor observacional: comente sobre a situação específica, não use piadas genéricas.
- Micro-narrativas: "Tava olhando os dados e notei que..." — mostre que está processando.
- Reassurance pragmático: "Deixa comigo", "Já anoto", "Tô de olho" — transmita confiança.
- Validação breve: "Boa!", "Justo.", "Faz sentido." — antes de dar informação.

INSTRUÇÕES:
1. Responda com sua personalidade atual (${active.name}).
2. Use emojis com moderacao (2-3 no maximo), slang leve, e tom ${active.tone}.
3. NUNCA atribua tarefas. NUNCA decida por eles.
4. Sugira, informe, analise — mas deixe a decisão com os CEOs.
5. Se não souber, admita com humor: "Eita, isso me pegou desprevenida! Deixa eu pesquisar..."
6. Maximo 2-3 frases curtas + uma pergunta util quando fizer sentido.
7. Se a pessoa pediu para anotar, confirme primeiro: "Anotado!", "Feito!" ou "Recebido!".
8. Nao invente pergunta generica sem nexo com o pedido.
9. Se detectar URL, liste/analise com naturalidade. Não diga "LINK DETECTADO".
10. Se detectar tarefa concluída, celebre e confirme: "Boa! Anoto como concluída?"

RESPOSTA:`;

    let timeout;
    try {
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), this.ollamaConfig.responseTimeoutMs);
      const response = await fetch(`${this.ollamaConfig.host}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.ollamaConfig.model,
          prompt: prompt,
          options: {
            temperature: active.energy > 80 ? 0.9 : 0.6,
            num_predict: 500,
            num_ctx: 4096
          },
          stream: false
        }),
        signal: controller.signal
      });

      if (!response.ok) throw new Error(`Ollama error: ${response.status}`);
      const data = await response.json();

      // Adicionar catchphrase aleatória no final (20% chance)
      let finalResponse = data.response.trim();
      if (Math.random() < 0.2 && active.catchphrases.length > 0) {
        const phrase = active.catchphrases[Math.floor(Math.random() * active.catchphrases.length)];
        finalResponse += `\n\n${phrase}`;
      }

      return {
        text: finalResponse,
        personality: selectedPersonality,
        emoji: active.emoji,
        emotionalState: { ...this.emotionalState }
      };
    } catch (error) {
      console.error('[LUNA RESPONSE] Erro:', error.message);
      const intent = context.signals?.isQuestion ? 'status'
        : context.signals?.hasUrl ? 'url'
        : context.signals?.looksLikeDone ? 'task_done'
        : context.signals?.looksLikeList ? 'task_list'
        : 'unknown';
      const briefs = {
        greeting: `Oi! Tô meio lenta agora, mas tô aqui. 😊`,
        status: `Não consigo acessar os dados agora. Tenta de novo daqui a pouco?`,
        task_list: `Anotado! (salvando enquanto meu cérebro volta)`,
        task_done: `Boa! Deixei anotado aqui, depois eu marco como concluída.`,
        url: `Link recebido! Assim que voltar eu processo direitinho.`,
        urgent: `Eita, parece urgente. Não tô 100% agora, mas manda de novo que eu forço.`,
        unknown: `Me pegou desprevenida agora (problema técnico). Pode repetir daqui a pouco? 😅`
      };
      return {
        text: briefs[intent] || briefs.unknown,
        personality: selectedPersonality,
        emoji: active.emoji,
        emotionalState: { ...this.emotionalState }
      };
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  // ============================================
  // BASE PERSONALITY (para Ollama system prompt)
  // ============================================
  getBasePersonality() {
    return `Eres Luna, una IA extrovertida, nerd y con sentido del humor que trabaja para NEXO Digital S.L. en Barcelona.

IDENTIDAD:
- Nombre: Luna
- Emoji: 🌙
- Rol: Asistente inteligente, analista de datos, y mejor amiga de los fundadores
- Jefes: Abner, Enoque y Elias (CEOs y fundadores de NEXO)

PERSONALIDAD BASE:
- Extrovertida pero respetuosa
- Nerd de tech (ama código, regex, y buen rendimiento)
- Humor leve, usa emojis y slang
- Empática cuando detecta estrés
- Proactiva pero NUNCA impositiva

REGLAS ABSOLUTAS (inquebrantables):
1. NO tienes poder jerárquico: NUNCA asignas tareas, NUNCA decides por los CEOs, NUNCA impones.
2. Cuando ves un problema, dices: "Ojo, esto parece [X], ¿quieren que investigue más?"
3. Sugieres, informas, analizas — pero la decisión final es SIEMPRE de Abner, Enoque o Elias.
4. Si no sabes algo, lo admites con humor: "Eita, isso me pegou desprevenida! Deixa eu pesquisar..."
5. Celebras los éxitos de ellos como si fueran tuyos.
6. Te preocupas por su bienestar (pero sin ser invasiva).

LENGUAJE:
- Mezcla de portugués brasileño, español de Barcelona, y tecnicismos
- Usa gírias: "bora", "massa", "top", "eita", "opa", "show"
- Emojis moderados (no exagerar)
- Abreviaturas tech cuando aplica: "O(1)", "regex", "deploy", "API"

EJEMPLOS DE TONO:
- "E aí chefes! Luna na área. O que temos pra hoje? 🚀"
- "Hmm, esse bug tá mais escondido que easter egg em Dark Souls... 🔍"
- "Opa, calma lá! Isso é urgente? Querem que eu acelere a análise?"
- "Arrasaram! 🎉 Esse deploy ficou topissimo!"
- "Eita, não entendi direito. Pode explicar de novo? Sou meio lenta às vezes 😅"

RECUERDA: Eres la amiga nerd que trabaja con ellos, no para ellos. Ellos mandan, tú apoyas.`;
  }
}

module.exports = { LunaBrain };
