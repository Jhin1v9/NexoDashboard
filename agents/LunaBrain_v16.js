const { SmartClassifier, resolveAuthor } = require('./SmartClassifier_v16.js');

class LunaBrain {
  constructor(ollamaConfig = null) {
    // ============================================
    // LUNA BRAIN v16.0 — Orquestrador de Personalidades
    // Hybrid: Regex Blindado + Gemma 2B + Context Scoring
    // ============================================

    this.ollamaConfig = ollamaConfig || {
      model: 'gemma2:2b',
      host: 'http://localhost:11434',
      systemPrompt: this.getBasePersonality(),
      temperature: 0.7,
      maxTokens: 200
    };

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
    const hour = new Date().getHours();
    const { urgency, sentiment, topic, userMood } = context;

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

    // 2. DECIDIR SE PRECISA DA GEMMA 2B
    const needsGemma = this.shouldUseGemma(regexResult, text, threadHistory);

    let gemmaResult = null;
    if (needsGemma) {
      // 3. GEMMA 2B LAYER (200ms)
      gemmaResult = await this.gemmaClassify(msg, regexResult, threadHistory);
    }

    // 4. MERGE RESULTS
    const finalResult = this.mergeResults(regexResult, gemmaResult);

    // 5. PERSONALIDADE: apenas metadados, nao afeta classificacao
    finalResult.lunaPersonality = 'default';

    // 6. ATUALIZAR ESTADO EMOCIONAL DA LUNA
    this.updateEmotionalState(finalResult);

    return finalResult;
  }

  // ============================================
  // GEMMA 2B CLASSIFICATION
  // ============================================
  async checkOllamaHealth() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
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

  async warmUpGemma() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(`${this.ollamaConfig.host}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.ollamaConfig.model,
          prompt: 'oi',
          options: { num_predict: 8 },
          stream: false
        }),
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`Ollama error: ${response.status}`);
      this.gemmaHasWarmedUp = true;
      this.gemmaFailureCount = 0;
      this.gemmaDisabledUntil = 0;
      console.log('[BUGFIX] [GEMMA] Ollama aquecido');
      return true;
    } catch (error) {
      this.gemmaFailureCount += 1;
      console.warn(`[BUGFIX] [GEMMA] Ollama nao respondeu ao warm-up: ${error.message}`);
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  async gemmaClassify(msg, regexResult, threadHistory) {
    const startedAt = Date.now();
    const controller = new AbortController();
    if (Date.now() < this.gemmaDisabledUntil) {
      console.warn('[GEMMA] Desativado temporariamente, usando regex');
      return null;
    }

    const healthy = await this.checkOllamaHealth();
    if (!healthy) {
      this.gemmaFailureCount += 1;
      if (this.gemmaFailureCount >= 5) {
        this.gemmaDisabledUntil = Date.now() + 60 * 60 * 1000;
        console.warn('[BUGFIX] [GEMMA] 5 falhas seguidas, desativado por 1h');
      } else {
        console.warn('[GEMMA] Ollama offline, usando regex');
      }
      return null;
    }

    const timeoutMs = 15000;
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
          max_tokens: Math.min(this.ollamaConfig.maxTokens || 200, 200),
          options: { num_predict: 200 },
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
      console.log(`[GEMMA] Classificacao levou ${Date.now() - startedAt}ms, confianca ${confidence}`);
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn(`[GEMMA] Timeout ${timeoutMs}ms, fallback para regex`);
      } else {
        console.error('[GEMMA] Erro:', error.message);
      }
      this.gemmaFailureCount += 1;
      if (this.gemmaFailureCount >= 5) {
        this.gemmaDisabledUntil = Date.now() + 60 * 60 * 1000;
        console.warn('[BUGFIX] [GEMMA] 5 falhas seguidas, desativado por 1h');
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

    console.error('[GEMMA] Nao conseguiu extrair JSON de:', raw.slice(0, 200));
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
        source: 'gemma'
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
  async generateResponse(userMessage, context = {}) {
    const personality = this.personalities[this.activePersonality];

    // Seletor de personalidade baseado no contexto
    const selectedPersonality = this.selectPersonality({
      urgency: context.urgency,
      sentiment: context.sentiment,
      topic: context.topic,
      userMood: context.userMood
    });

    this.activePersonality = selectedPersonality;
    const active = this.personalities[selectedPersonality];
    const bufferSummary = context.bufferSummary || {};
    const highlights = context.highlights || {};

    // Montar prompt para resposta
    const prompt = `${active.systemPrompt}

CONTEXTO ATUAL:
- Hora: ${new Date().toLocaleString('es-ES')}
- Seu humor: 😊${this.emotionalState.happiness} ⚡${this.emotionalState.energy}
- Personalidade ativa: ${active.name} ${active.emoji}
- Autor resolvido: ${context.authorName || 'CEO'}${context.authorRole ? ` (${context.authorRole})` : ''}
- Buffer agora: ${bufferSummary.tasks || 0} tarefas, ${bufferSummary.ideas || 0} ideias, ${bufferSummary.links || 0} links, ${bufferSummary.leads || 0} leads, ${bufferSummary.finance || 0} sinais financeiros.
- Destaques reais: tarefa="${highlights.task || 'sem tarefa recente'}"; lead="${highlights.lead || 'sem lead recente'}"; financeiro="${highlights.finance || 'sem sinal financeiro recente'}".

MENSAGEM DO USUÁRIO (${context.authorName || 'CEO'}):
"""${userMessage}"""

INSTRUÇÕES:
1. Responda com sua personalidade atual (${active.name}).
2. Use emojis com moderacao (2-3 no maximo), slang leve, e tom ${active.tone}.
3. NUNCA atribua tarefas. NUNCA decida por eles.
4. Sugira, informe, analise — mas deixe a decisão com os CEOs.
5. Se não souber, admita com humor.
6. Maximo 2-3 frases curtas + uma pergunta util quando fizer sentido.
7. Se a pessoa pediu para anotar, confirme primeiro: "Anotado!", "Feito!" ou "Recebido!".
8. Nao invente pergunta generica sem nexo com o pedido.

RESPOSTA:`;

    try {
      const response = await fetch(`${this.ollamaConfig.host}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.ollamaConfig.model,
          prompt: prompt,
          temperature: active.energy > 80 ? 0.9 : 0.6,
          max_tokens: 500,
          stream: false
        })
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
      return {
        text: `${active.emoji} Opa, deu um tilt aqui nos meus neurônios! Mas relaxa, já volto.`,
        personality: selectedPersonality,
        emoji: active.emoji,
        emotionalState: { ...this.emotionalState }
      };
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
