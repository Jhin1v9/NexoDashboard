# LLM OFFLINE ARCHITECTURE PROPOSAL

## 1. Executive Summary

A NEXO Digital opera um ERP interno (NEXO Dashboard PRO v16) cuja assistente virtual — **Luna** — está atualmente cega e muda quando a API Gemini é revogada ou atinge quota. A arquitetura proposta elimina 100% da dependência de APIs cloud de LLM, migrando todo o pipeline de NLU/NLG para infraestrutura local, mantendo (e em muitos casos superando) a qualidade atual de entendimento em português, espanhol e catalão.

### Por que esta proposta é viável AGORA

O projeto **já possui 70% dos tijolos** necessários:

| Componente | Estado Atual | O que falta |
|------------|-------------|-------------|
| `luna-nlu.js` (node-nlp) | ✅ 100% offline, treinado para PT/ES/CA | Integrar como camada primária no chat |
| `luna-semantic-nlu.js` | ✅ Usa `@xenova/transformers` (embeddings 384d) | Conectar no fluxo do `IntentParser` |
| `LunaSemanticMemory.js` | ✅ Já tenta Ollama + fallback keyword | Consolidar como única fonte de RAG |
| `LunaBrain_v16.js` | ✅ Já tem código Ollama (`gemma2:2b`) | Ativar no caminho crítico do `/api/luna/chat` |
| `IntentParser.js` | ❌ Usa Gemini API no LLM path | Substituir `callGemini` por `callOllama` |
| `server.js` (fallback social) | ❌ Usa Gemini API direto | Substituir por `LunaBrain.generateResponse` |

### Visão geral da solução

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FLUXO DE CHAT 100% OFFLINE                           │
└─────────────────────────────────────────────────────────────────────────────┘

  Mensagem do usuário (PT/ES/EN)
           │
           ▼
  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
  │  1. NLU Layer   │────▶│ 2. Regex Fast   │────▶│ 3. Ollama LLM   │
  │  (node-nlp)     │     │    Path         │     │    Intent       │
  │  score ≥ 0.5?   │     │  score ≥ 0.8?   │     │  Classification │
  └─────────────────┘     └─────────────────┘     └─────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
    [Conhecido]              [Conhecido]              [Conhecido]
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  ▼
                    ┌─────────────────────────┐
                    │   ActionExecutor        │
                    │   (executa no PG/SQLite)│
                    └─────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
         [Ação requer confirmação?]      [Resposta direta]
                    │                           │
                    ▼                           ▼
         Preview Editável                 Ollama Chat Model
         (task_edit, payment_edit)        (resposta humanizada)
                    │                           │
                    └─────────────┬─────────────┘
                                  ▼
                         Resposta para o usuário
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
         [Se Ollama cai]             [Se tudo falha]
                    │                           │
         Regex + Fallback           "Não entendi, tente de outra forma"
         (25% coverage)             (sempre educativa, nunca vazia)
```

---

## 2. Model Selection (Tabela Comparativa)

### 2.1 Recomendação por camada

A arquitetura adota um **padrão Dual-Model**: um modelo leve e rápido para classificação de intenções (baixa latência, JSON estruturado) e um modelo maior para geração de respostas naturais (qualidade de conversa).

| Camada | Modelo Recomendado | Alternativa | Uso |
|--------|-------------------|-------------|-----|
| **Intent (classificação)** | `gemma4:4b` (Q4_K_M, ~5GB RAM) | `qwen3:4b` ou `phi4:3.8b` | Extrair JSON de intenção a partir do texto do usuário. Temperatura 0.1, max_tokens 512. |
| **Chat (geração)** | `gemma4:12b` (Q4_K_M, ~8GB RAM) | `mistral:7b` ou `llama4:scout` | Respostas humanizadas, briefing proativo, conversa social. Temperatura 0.7, streaming. |
| **Embeddings** | `nomic-embed-text` via Ollama (~274MB) | `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (já no projeto) | RAG, busca semântica em memória de conversas, similaridade de intenções. |

### 2.2 Matriz de hardware × modelo

| Hardware | Intent Model | Chat Model | Embeddings | Tokens/s estimado (Intent) |
|----------|-------------|------------|------------|---------------------------|
| **16 GB RAM, CPU-only** (baseline) | `gemma4:4b` | `gemma4:4b` (mesmo modelo, troca de prompt) | `nomic-embed-text` | 25–40 tok/s |
| **16 GB RAM + 8 GB VRAM** (RTX 4060) | `gemma4:4b` (GPU) | `gemma4:12b` (GPU) | `nomic-embed-text` (GPU) | 60–85 tok/s |
| **32 GB RAM + 12 GB VRAM** (RTX 3060) | `gemma4:4b` (GPU) | `gemma4:12b` ou `llama4:scout` (GPU) | `nomic-embed-text` | 70–100 tok/s |
| **32 GB RAM, CPU-only** | `gemma4:4b` | `gemma4:12b` (CPU, lento mas funcional) | `nomic-embed-text` | 15–25 tok/s |

> **Nota crítica**: Ollama faz automaticamente o offload de camadas para GPU quando detecta VRAM disponível. Em CPU-only, o desempenho depende de AVX2/AVX-512 e número de cores. Um Ryzen 7 5800X consegue ~25 tok/s com `gemma4:4b`.

### 2.3 Por que não node-llama-cpp?

| Critério | Ollama | node-llama-cpp |
|----------|--------|----------------|
| **Setup** | `curl -fsSL https://ollama.com/install.sh \| sh` | Compilação nativa de bindings C++ (pode quebrar entre Node versions) |
| **API** | REST nativa + OpenAI-compatible `/v1` | Bindings diretos, API própria |
| **Model management** | `ollama pull`, cache automático, updates | Download manual de GGUF, gestão de arquivos |
| **Multi-model** | Um daemon serve N modelos | Uma instância por modelo, gerenciamento manual |
| **Streaming** | SSE nativo via `/api/generate` | Suporte via callbacks |
| **Observabilidade** | Logs estruturados, métricas built-in | Manual |

**Veredicto**: O projeto já tem código Ollama espalhado (`LunaBrain_v16.js`, `LunaSemanticMemory.js`). Consolidar em Ollama é o caminho de menor resistência e maior manutenibilidade.

---

## 3. Integration Architecture

### 3.1 Diagrama de componentes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              NEXO BACKEND (Node.js)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  /api/luna  │  │ IntentParser│  │  NLU Layer  │  │   LunaBrain (v17)   │ │
│  │    /chat    │──│  (refactor) │──│ (node-nlp)  │──│  (Ollama client)    │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│         │                  │                  │                  │          │
│         ▼                  ▼                  ▼                  ▼          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      ActionExecutor (existente)                     │   │
│  │   PG/SQLite  ←  tarefas, leads, pagamentos, despesas, emails       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     LunaSemanticMemory v19                          │   │
│  │   better-sqlite3  +  Ollama embeddings  +  Keyword fallback        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                              HTTP localhost:11434
                                     │
┌─────────────────────────────────────────────────────────────────────────────┐
│                              OLLAMA DAEMON                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │  gemma4:4b      │  │  gemma4:12b     │  │  nomic-embed-text           │  │
│  │  (Intent/Chat   │  │  (Chat/Reasoning)│  │  (768d embeddings)          │  │
│  │   fallback)     │  │                 │  │                             │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Interface com Ollama

Ollama expõe dois endpoints relevantes:

- **Nativo**: `POST /api/generate` — streaming por SSE, controle total de parâmetros
- **OpenAI-compatible**: `POST /v1/chat/completions` — drop-in replacement para código que hoje usa OpenAI SDK

Recomendação: usar o **endpoint nativo** para o IntentParser (precisamos de controle fino de temperatura e parser de JSON) e o **endpoint `/v1/chat/completions`** para o chat social (já existe estrutura de mensagens no frontend que pode consumir SSE facilmente).

### 3.3 Estrutura de serviço wrapper

Criar `backend/services/ollama-client.js` (wrapper unificado):

```js
/**
 * Ollama Unified Client
 * Abstrai chamadas ao daemon Ollama com circuit breaker e retry.
 */
class OllamaClient {
  constructor(config = {}) {
    this.host = config.host || process.env.OLLAMA_HOST || 'http://localhost:11434';
    this.intentModel = config.intentModel || 'gemma4:4b';
    this.chatModel = config.chatModel || 'gemma4:12b';
    this.embeddingModel = config.embeddingModel || 'nomic-embed-text';
    this.timeout = config.timeout || 15000;
    this.retries = config.retries || 2;
    this.circuitBreaker = { open: false, failCount: 0, threshold: 5, resetMs: 30000 };
  }

  async generate(prompt, { model, system, temperature = 0.7, maxTokens = 1024, stream = false } = {}) {
    if (this.circuitBreaker.open) {
      throw new Error('OLLAMA_CIRCUIT_OPEN');
    }
    // ... chamada fetch com retry e atualização do circuit breaker
  }

  async chat(messages, { model, temperature = 0.7, maxTokens = 1024, stream = false } = {}) {
    // Usa /v1/chat/completions para compatibilidade com estrutura existente
  }

  async embed(text) {
    // Usa /api/embeddings ou /v1/embeddings
  }
}
```

---

## 4. IntentParser Refactor

### 4.1 Nova arquitetura do IntentParser

O `IntentParser.parse()` passa a ter 4 camadas em cascata:

```
1. NLU (node-nlp)       → score ≥ 0.5 → retorna imediatamente
2. Regex Fast Path      → score ≥ 0.8 → retorna imediatamente
3. Semantic NLU         → score ≥ 0.75 → retorna (usando @xenova/transformers)
4. Ollama Intent Model  → sempre tenta se 1-3 falharem
   └─ Se Ollama cai → Regex (mesmo que score < 0.8)
   └─ Se Regex não match → Unknown com mensagem amigável
```

### 4.2 Código exemplo: `IntentParser.js` (refatorado)

```js
// ============================================================
// INTENT PARSER v20.0 — MODO CONCIERGE 100% OFFLINE
// ============================================================

const fs = require('fs');

// ── LRU Cache simples com TTL ──
class LRUCache {
  constructor(maxSize = 50, ttlMs = 300000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.cache = new Map();
  }
  // ... (mantém implementação atual)
}

// ── Ollama Client wrapper ──
class OllamaIntentClient {
  constructor(host = 'http://localhost:11434', model = 'gemma4:4b') {
    this.host = host;
    this.model = model;
    this.timeout = 10000;
  }

  async classify(text, context = {}) {
    const prompt = this.buildPrompt(text, context);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(`${this.host}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt,
          system: this.getSystemPrompt(),
          temperature: 0.1,
          max_tokens: 512,
          stream: false,
          format: 'json'  // Ollama força JSON válido quando suportado
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
      const data = await res.json();
      return this.parseResponse(data.response);
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  getSystemPrompt() {
    return `Você é o classificador de intenções da Luna (NEXO Digital).
Regras:
- Responda APENAS em JSON válido, sem markdown, sem explicações.
- O usuário fala em português, espanhol ou inglês.
- "social" = conversa casual, curiosidades, saudações.
- "consultar_status" = APENAS quando pedir dados do sistema NEXO.
- Extraia valores monetários, nomes de pessoas (Abner, Nonoke, Elias), prioridades (P0/P1/P2).`;
  }

  buildPrompt(text, context) {
    const author = context.authorName || 'CEO';
    return `Autor: ${author}
Mensagem: """${text}"""

Classifique no formato:
{
  "intent": "nome_da_intencao",
  "actions": [{"type": "acao", "params": {...}, "confidence": 0.95}],
  "needsConfirmation": true/false,
  "confidence": 0.0-1.0,
  "explanation": "breve"
}`;
  }

  parseResponse(raw) {
    // Extrai JSON mesmo que o modelo envolva em ```json ... ```
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('JSON não encontrado na resposta');
    return JSON.parse(match[0]);
  }
}

class IntentParser {
  constructor(config = {}) {
    this.ollama = new OllamaIntentClient(
      config.ollamaHost,
      config.intentModel || 'gemma4:4b'
    );
    this.confidenceThreshold = config.confidenceThreshold || 0.75;
    this.cache = new LRUCache(config.cacheSize || 50, config.cacheTTL || 300000);

    // Injeção do NLU existente (node-nlp)
    this.nlu = config.nlu || null;
    // Injeção do Semantic NLU existente (@xenova/transformers)
    this.semanticNLU = config.semanticNLU || null;

    // Regex patterns (mantidos intactos)
    this.patterns = { /* ... regex atual ... */ };
  }

  async parse(text, context = {}) {
    const clean = text.replace(/@luna|@kimi|@kimiclaw/gi, '').trim();
    if (!clean) return { intent: 'vazio', actions: [], confidence: 1, needsConfirmation: false };

    // 1. CACHE
    const cached = this.cache.get(clean, context);
    if (cached) return { ...cached, note: (cached.note || '') + ' cached' };

    // 2. NLU LAYER (node-nlp) — 100% offline, treinado
    if (this.nlu) {
      try {
        const nluResult = await this.nlu.process(clean, 'pt');
        if (nluResult?.score >= 0.5 && nluResult.intent !== 'None') {
          const { mapNLUResults } = require('./NLUActionMapper');
          const mapped = mapNLUResults(nluResult, clean);
          if (mapped?.actions.length > 0) {
            this.cache.set(clean, context, mapped);
            return { ...mapped, source: 'nlu' };
          }
        }
      } catch (e) {
        console.warn('[IntentParser] NLU error:', e.message);
      }
    }

    // 3. FAST PATH: Regex
    const fast = this.fastParse(clean);
    if (fast && fast.confidence >= 0.85) {
      this.cache.set(clean, context, fast);
      return fast;
    }

    // 4. SEMANTIC NLU (@xenova/transformers)
    if (this.semanticNLU) {
      try {
        const semResult = await this.semanticNLU.classify(clean, context);
        if (semResult?.score >= 0.75 && semResult.intent !== 'None') {
          const mapped = {
            intent: semResult.intent,
            actions: [{ type: semResult.action || semResult.intent, params: semResult.entities || {}, confidence: semResult.score, source: 'semantic' }],
            confidence: semResult.score,
            needsConfirmation: this.shouldConfirm([{ type: semResult.action }]),
            source: 'semantic'
          };
          this.cache.set(clean, context, mapped);
          return mapped;
        }
      } catch (e) {
        console.warn('[IntentParser] SemanticNLU error:', e.message);
      }
    }

    // 5. OLLAMA INTENT MODEL
    try {
      const llmResult = await this.ollama.classify(clean, context);
      // Merge: se regex deu algo e LLM deu baixa confiança, prioriza regex
      if (fast && llmResult.confidence < this.confidenceThreshold) {
        const result = { ...fast, llmConfidence: llmResult.confidence, note: 'fallback_regex' };
        this.cache.set(clean, context, result);
        return result;
      }
      const normalized = this.normalizeLLMResult(llmResult, clean);
      this.cache.set(clean, context, normalized);
      return normalized;
    } catch (err) {
      // 6. CIRCUIT BREAKER FALLBACK
      console.warn('[IntentParser] Ollama indisponível:', err.message);
      if (fast) return { ...fast, note: 'ollama_error_fallback' };
      return {
        intent: 'unknown',
        actions: [],
        confidence: 0.3,
        needsConfirmation: false,
        reply: "🌙 Hmm, não entendi direito. Pode reformular? Tipo: 'criar tarefa X pra Y' ou 'quais leads novos?'"
      };
    }
  }

  normalizeLLMResult(parsed, originalText) {
    const actions = (parsed.actions || []).map(a => ({
      type: a.type || 'unknown',
      params: a.params || {},
      confidence: Math.min(Math.max(a.confidence || parsed.confidence || 0.7, 0), 1),
      source: 'ollama'
    }));
    return {
      intent: parsed.intent || 'unknown',
      actions,
      confidence: Math.min(Math.max(parsed.confidence || 0.7, 0), 1),
      needsConfirmation: parsed.needsConfirmation ?? this.shouldConfirm(actions),
      explanation: parsed.explanation || '',
      source: 'ollama'
    };
  }

  // ... fastParse, shouldConfirm mantidos do código atual ...
}

module.exports = { IntentParser };
```

### 4.3 Estrutura do prompt de classificação

O prompt foi otimizado para modelos de 4B params (que têm janela de contexto menor e são mais sensíveis a instruções claras):

```
SYSTEM:
Você é o classificador de intenções da Luna, assistente da NEXO Digital.
Regras absolutas:
1. Responda APENAS com JSON válido. Nenhum texto fora do JSON.
2. Idiomas aceitos: português (PT), espanhol (ES), inglês (EN).
3. "social" = saudações, despedidas, curiosidades gerais, piadas.
4. "consultar_status" = APENAS quando o usuário pedir dados do NEXO (tarefas, leads, caixa).
5. Extraia: valor monetário (ex: 1500,50), pessoas (Abner, Nonoke, Elias), prioridade (P0/P1/P2).

USER:
Autor: {author}
Tarefas pendentes: {bufferSummary.tasks}
Leads novos: {bufferSummary.leads}

Mensagem: """{text}"""

Responda no formato JSON:
{
  "intent": "nome_da_intencao",
  "actions": [
    { "type": "acao", "params": { ... }, "confidence": 0.0-1.0 }
  ],
  "needsConfirmation": true/false,
  "confidence": 0.0-1.0,
  "explanation": "breve"
}
```

> **Dica de performance**: Para `gemma4:4b` em CPU, usar `format: 'json'` na API do Ollama (quando suportado) reduz em ~30% a taxa de respostas malformadas, eliminando a necessidade de regex de extração de JSON.

---

## 5. RAG Local (Como indexar dados do NEXO)

### 5.1 Visão geral do RAG

O sistema precisa responder perguntas como:
- *"Quanto o cliente Santa Fé pagou no total?"*
- *"Qual tarefa o Elias deixou pendente de ontem?"*
- *"Resuma os emails não lidos do Paulo"*

Isso exige **recuperação semântica** sobre dados estruturados (PG/SQLite) + não-estruturados (emails, mensagens WhatsApp).

### 5.2 Arquitetura de indexação

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RAG PIPELINE LOCAL                                  │
└─────────────────────────────────────────────────────────────────────────────┘

  Dados do NEXO (fontes):
  ├── PostgreSQL / SQLite
  │   ├── tarefas (título, descrição, responsável, status, prazo)
  │   ├── leads (nome, email, telefone, status, notas)
  │   ├── pagamentos (valor, cliente, descrição, data)
  │   ├── despesas (valor, descrição, categoria, data)
  │   ├── emails (assunto, remetente, preview, data)
  │   └── clientes (nome, projeto, contato)
  ├── WhatsApp Messages (buffer, menções)
  └── Links salvos (URL, título, descrição, tags)

           │
           ▼
  ┌─────────────────────────────┐
  │    NEXODataIndexer          │
  │  (job periódico ou trigger) │
  └─────────────────────────────┘
           │
           ▼
  ┌─────────────────────────────┐
  │  Chunking + Enrichment      │
  │  - Cada registro vira 1-3   │
  │    chunks de texto natural  │
  │  - Enriquece com metadados  │
  │    (tipo, data, autor)      │
  └─────────────────────────────┘
           │
           ▼
  ┌─────────────────────────────┐
  │  Embedding (batch)          │
  │  nomic-embed-text (Ollama)  │
  │  ou Xenova transformers     │
  │  → vetor 768d               │
  └─────────────────────────────┘
           │
           ▼
  ┌─────────────────────────────┐
  │  Vector Store Local         │
  │  better-sqlite3 + tabela    │
  │  'rag_chunks' com coluna    │
  │  'embedding' (JSON array)   │
  └─────────────────────────────┘
           │
           ▼
  ┌─────────────────────────────┐
  │  Retrieval no chat          │
  │  1. Query do usuário → embedding
  │  2. Cosine similarity top-K │
  │  3. Re-rank por recência    │
  │  4. Injetar no prompt do LLM│
  └─────────────────────────────┘
```

### 5.3 Esquema de banco para RAG

```sql
-- Tabela principal de chunks vetorizados
CREATE TABLE IF NOT EXISTS rag_chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_table TEXT NOT NULL,        -- 'tasks', 'leads', 'payments', 'emails', 'whatsapp'
  source_id TEXT NOT NULL,           -- ID original no PG/SQLite
  chunk_text TEXT NOT NULL,          -- Texto natural do chunk
  chunk_type TEXT,                   -- 'summary', 'detail', 'conversation'
  metadata TEXT,                     -- JSON: {author, date, priority, status, ...}
  embedding TEXT,                    -- JSON array de floats (768 dims)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_rag_source ON rag_chunks(source_table, source_id);
CREATE INDEX idx_rag_type ON rag_chunks(chunk_type);
CREATE INDEX idx_rag_updated ON rag_chunks(updated_at);

-- Full-text search fallback (SQLite FTS5)
CREATE VIRTUAL TABLE IF NOT EXISTS rag_chunks_fts USING fts5(
  chunk_text,
  content='rag_chunks',
  content_rowid='id'
);
```

### 5.4 Exemplo de chunking por domínio

```js
// Tarefas → chunks
function chunkTask(task) {
  const chunks = [];
  chunks.push({
    text: `Tarefa "${task.title}" criada por ${task.author}. Status: ${task.status}. Responsável: ${task.assignee}. Prazo: ${task.dueDate}.`,
    type: 'summary',
    metadata: { table: 'tasks', id: task.id, priority: task.priority, status: task.status }
  });
  if (task.description) {
    chunks.push({
      text: `Descrição da tarefa "${task.title}": ${task.description}`,
      type: 'detail',
      metadata: { table: 'tasks', id: task.id }
    });
  }
  return chunks;
}

// Pagamentos → chunks
function chunkPayment(payment) {
  return [{
    text: `Pagamento de €${payment.amount} recebido de ${payment.client} em ${payment.date}. Descrição: ${payment.description}.`,
    type: 'summary',
    metadata: { table: 'payments', id: payment.id, amount: payment.amount, client: payment.client }
  }];
}
```

### 5.5 Serviço de retrieval

```js
class LocalRAG {
  constructor(db, embedder) {
    this.db = db;             // better-sqlite3 instance
    this.embedder = embedder; // OllamaClient.embed ou Xenova pipeline
  }

  async retrieve(query, { topK = 5, filters = {} } = {}) {
    const queryVector = await this.embedder(query);

    // Busca por similaridade (cosine) — executa em memória para vetores pequenos
    const stmt = this.db.prepare(`
      SELECT id, source_table, source_id, chunk_text, metadata, embedding
      FROM rag_chunks
      WHERE chunk_text IS NOT NULL
      ORDER BY updated_at DESC
      LIMIT 500
    `);
    const rows = stmt.all();

    const scored = rows.map(r => {
      const vec = JSON.parse(r.embedding);
      const score = cosineSimilarity(queryVector, vec);
      // Boost por recência (últimos 7 dias)
      const daysOld = (Date.now() - new Date(r.updated_at)) / 86400000;
      const recencyBoost = Math.max(0, 1 - daysOld / 7) * 0.15;
      return { ...r, score: score + recencyBoost };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  buildContext(chunks) {
    return chunks.map((c, i) =>
      `[${i + 1}] ${c.chunk_text} (fonte: ${c.source_table} #${c.source_id})`
    ).join('\n');
  }
}
```

### 5.6 Integração no chat

No fallback de conversa social (hoje feito por Gemini), injetar contexto RAG no prompt do Ollama:

```js
async function generateChatResponse(userMessage, context, rag) {
  const relevantChunks = await rag.retrieve(userMessage, { topK: 3 });
  const ragContext = relevantChunks.length > 0
    ? `DADOS RELEVANTES DO NEXO:\n${rag.buildContext(relevantChunks)}\n\n`
    : '';

  const systemPrompt = `Você é a Luna, assistente da NEXO Digital...
${ragContext}
Responda com base NOS DADOS ACIMA. Se não houver dados relevantes, admita com humor.`;

  return await ollama.chat([
    { role: 'system', content: systemPrompt },
    ...context.slice(-5).map(c => ({ role: c.role, content: c.text })),
    { role: 'user', content: userMessage }
  ], { model: 'gemma4:12b', temperature: 0.7, stream: true });
}
```

---

## 6. Circuit Breaker & Fallback

### 6.1 Estado atual vs desejado

| Cenário | Comportamento Atual | Comportamento Proposto |
|---------|---------------------|------------------------|
| Gemini quota esgotada | Fallback regex (~25% coverage) + mensagem de erro | Nenhuma dependência de Gemini |
| Ollama offline | N/A (não é usado no chat principal) | Regex + NLU → sempre funcional |
| Ollama lento (>15s) | N/A | Timeout + fallback para regex |
| Regex não matcha | "unknown" | Mensagem amigável sugerindo padrões |
| NLU (node-nlp) não treinado para intent | Cai no Gemini | Cai no Ollama Intent Model |
| Todos os LLMs offline | Erro genérico | Resposta do Regex + sugestão de reformulação |

### 6.2 Implementação do Circuit Breaker

```js
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000;
    this.halfOpenMaxCalls = options.halfOpenMaxCalls || 2;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.lastFailureTime = null;
    this.halfOpenCalls = 0;
  }

  async execute(fn, fallbackFn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.halfOpenCalls = 0;
        console.log('[CircuitBreaker] HALF_OPEN: testando Ollama...');
      } else {
        return fallbackFn();
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      return fallbackFn();
    }
  }

  onSuccess() {
    this.failures = 0;
    if (this.state === 'HALF_OPEN') {
      this.halfOpenCalls++;
      if (this.halfOpenCalls >= this.halfOpenMaxCalls) {
        console.log('[CircuitBreaker] CLOSED: Ollama recuperado');
        this.state = 'CLOSED';
      }
    }
  }

  onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.failureThreshold || this.state === 'HALF_OPEN') {
      console.warn('[CircuitBreaker] OPEN: Ollama indisponível');
      this.state = 'OPEN';
    }
  }
}
```

### 6.3 Fluxo completo de fallback

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CIRCUIT BREAKER STATE MACHINE                            │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────┐
  │  CLOSED │ ◄─────────────────────────────────────────┐
  │ (normal)│                                         │
  └────┬────┘                                         │
       │ execute() sucesso                            │
       │                                              │
       │ execute() falha                              │
       ▼                                              │
  ┌─────────┐     failures < threshold                │
  │ HALF_OPEN│ ◄──────────────────────────────┐      │
  │ (testando)│                                │      │
  └────┬────┘     failures >= threshold       │      │
       │ execute() falha                      │      │
       ▼                                      │      │
  ┌─────────┐                                │      │
  │  OPEN   │ ◄────────────────────────────────      │
  │ (fallback)│                                   │
  └────┬────┘     timeout expirado (30s)          │
       └────────────────────────────────────────────┘

No estado OPEN:
  - IntentParser → usa Regex + Semantic NLU
  - Chat social → usa respostas template + contexto do ActionExecutor
  - O usuário NUNCA fica sem resposta
```

### 6.4 Mensagens de fallback amigáveis

```js
const FALLBACK_REPLIES = {
  regexOnly: [
    "🌙 Entendi parte! Só me fala mais direto, tipo: 'criar tarefa X pro Elias P0'.",
    "Quase lá! Tenta: 'registrar pagamento 1500 do cliente Y'.",
    "Hmm, essa foi complexa demais pro meu modo offline. Pode simplificar?"
  ],
  ollamaDown: [
    "🌙 Meus neurônios locais estão descansando, mas ainda consigo fazer tarefas básicas!",
    "Modo econômico ativado. Consigo criar tarefas, leads e registrar pagamentos normalmente."
  ],
  unknown: [
    "Não entendi direito 😅. Posso ajudar com: tarefas, leads, pagamentos, despesas, emails e WhatsApp.",
    "Eita, essa me pegou. Tenta perguntar sobre o dashboard ou pedir pra criar algo!"
  ]
};
```

---

## 7. Implementation Roadmap (Fases)

### Fase 0: Preparação (1 dia)
- [ ] Instalar Ollama no servidor de produção/dev
- [ ] `ollama pull gemma4:4b`
- [ ] `ollama pull nomic-embed-text`
- [ ] Verificar conectividade: `curl http://localhost:11434/api/tags`
- [ ] Adicionar `OLLAMA_HOST` e `OLLAMA_INTENT_MODEL` no `.env`

### Fase 1: IntentParser Offline (2 dias)
- [ ] Criar `backend/services/ollama-client.js` (wrapper unificado)
- [ ] Refatorar `IntentParser.js`:
  - [ ] Substituir `callGemini` por `callOllama`
  - [ ] Injetar `lunaNLU` e `lunaSemanticNLU` no construtor
  - [ ] Implementar cascata: NLU → Regex → Semantic → Ollama → Fallback
- [ ] Testar com suite de comandos PT/ES/EN (mínimo 50 utterances)
- [ ] Ajustar prompt de classificação para JSON confiável em 4B params

### Fase 2: Chat Social Offline (2 dias)
- [ ] Refatorar `LunaBrain_v16.js`:
  - [ ] Atualizar modelo padrão para `gemma4:4b` ou `gemma4:12b`
  - [ ] Adicionar suporte a streaming SSE
- [ ] Modificar `server.js` (`/api/luna/chat`):
  - [ ] Substituir chamada direta `genAI.models.generateContent` por `LunaBrain.generateResponse`
  - [ ] Adicionar endpoint SSE opcional: `GET /api/luna/chat/stream`
- [ ] Implementar circuit breaker no wrapper Ollama

### Fase 3: RAG Local (3 dias)
- [ ] Criar `backend/services/nexo-rag-indexer.js`
  - [ ] Job periódico (a cada 5 min ou via trigger) que indexa PG/SQLite
  - [ ] Chunking por domínio (tarefas, leads, pagamentos, emails, WhatsApp)
- [ ] Estender `LunaSemanticMemory.js` ou criar `LocalRAG` service
  - [ ] Tabela `rag_chunks` com embeddings
  - [ ] Busca por similaridade + re-rank por recência
- [ ] Integrar RAG no prompt do chat social
- [ ] Testar perguntas complexas: *"Quanto pagou o cliente X no total em 2025?"*

### Fase 4: Performance & Polish (2 dias)
- [ ] Implementar streaming SSE no frontend (React)
- [ ] Adicionar cache de respostas frequentes (Redis ou memory LRU)
- [ ] Otimizar quantização: testar `gemma4:4b-q4_0` vs `q4_K_M` para latência
- [ ] Adicionar métricas: tempo de resposta por camada (NLU, Regex, Ollama)
- [ ] Documentar variáveis de ambiente no `.env.example`

### Fase 5: Remoção da Gemini (1 dia)
- [ ] Remover dependência `@google/genai` do `package.json` (ou manter como opcional)
- [ ] Remover `gemini-client.js` (ou arquivar como `gemini-client.js.deprecated`)
- [ ] Limpar variáveis `GEMINI_API_KEY` do ambiente
- [ ] Atualizar health check (`/api/status`) para reportar status do Ollama

**Total estimado: 11 dias de trabalho (2 semanas com testes)**

---

## 8. Hardware Requirements

### 8.1 Configuração mínima (baseline)

| Recurso | Especificação |
|---------|--------------|
| **RAM** | 16 GB DDR4 |
| **CPU** | 4 cores / 8 threads (AVX2 obrigatório) |
| **Disco** | 10 GB livres para modelos (~5 GB para `gemma4:4b` + ~5 GB para `gemma4:12b`) |
| **GPU** | Nenhuma (CPU-only) |
| **SO** | Ubuntu 22.04 LTS ou superior / Debian 12 |
| **Rede** | Apenas loopback (100% offline possível) |

**Desempenho esperado:**
- Classificação de intenção (`gemma4:4b`): **1.5–3s** para resposta JSON
- Chat social (`gemma4:4b`): **2–4s** para resposta completa
- Embeddings (`nomic-embed-text`): **<500ms** por chunk

### 8.2 Configuração recomendada

| Recurso | Especificação |
|---------|--------------|
| **RAM** | 32 GB DDR4/DDR5 |
| **CPU** | 6+ cores modernos (Ryzen 5 5600X ou equivalente) |
| **GPU** | NVIDIA RTX 3060 12 GB ou RTX 4060 Ti 16 GB |
| **Disco** | SSD NVMe 20 GB livres |
| **SO** | Ubuntu 24.04 LTS |

**Desempenho esperado:**
- Classificação de intenção (`gemma4:4b` na GPU): **<800ms**
- Chat social (`gemma4:12b` na GPU): **1.5–2.5s**
- Streaming: **15–25 tokens/segundo** visíveis ao usuário

### 8.3 Ollama + Docker (opcional)

Para ambientes containerizados:

```yaml
# docker-compose.yml (exemplo)
services:
  ollama:
    image: ollama/ollama:latest
    volumes:
      - ollama-models:/root/.ollama
    ports:
      - "11434:11434"
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    # Para CPU-only, remova a seção 'deploy'

  nexo-backend:
    build: ./backend
    environment:
      - OLLAMA_HOST=http://ollama:11434
      - OLLAMA_INTENT_MODEL=gemma4:4b
      - OLLAMA_CHAT_MODEL=gemma4:12b
    depends_on:
      - ollama
      - postgres

volumes:
  ollama-models:
```

### 8.4 Instalação rápida (script)

```bash
#!/bin/bash
# install-ollama-nexo.sh

curl -fsSL https://ollama.com/install.sh | sh

# Aguardar serviço
sleep 2

# Pull dos modelos recomendados
ollama pull gemma4:4b
ollama pull gemma4:12b
ollama pull nomic-embed-text

# Verificar
echo "=== Modelos instalados ==="
ollama list

echo "=== Teste de saúde ==="
curl -s http://localhost:11434/api/tags | jq '.models[].name'
```

---

## Apêndice A: Checklist de migração

- [ ] Ollama instalado e rodando (`systemctl status ollama`)
- [ ] Modelos baixados (`ollama list` mostra `gemma4:4b`, `nomic-embed-text`)
- [ ] Variáveis de ambiente configuradas (`OLLAMA_HOST`, `OLLAMA_INTENT_MODEL`)
- [ ] `IntentParser.js` usa `OllamaIntentClient` em vez de `GoogleGenAI`
- [ ] `server.js` usa `LunaBrain.generateResponse` em vez de `genAI.models.generateContent`
- [ ] NLU (node-nlp) é camada primária no chat
- [ ] Semantic NLU (`@xenova/transformers`) é camada secundária
- [ ] Regex patterns são camada terciária
- [ ] Circuit breaker implementado e testado (simular `systemctl stop ollama`)
- [ ] RAG indexa dados do PG/SQLite periodicamente
- [ ] Streaming SSE funciona no frontend
- [ ] Removida ou deprecada a dependência `@google/genai`
- [ ] Health check reporta status Ollama (não Gemini)
- [ ] Documentação atualizada (`AGENTS.md`, `.env.example`)

---

## Apêndice B: Riscos e mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Ollama não suporta bem PT/ES em modelos 4B | Baixa | Alto | Testar extensivamente na Fase 1; fallback para NLU node-nlp que já é multilíngue |
| Latência >5s em CPU-only irrita usuários | Média | Médio | Usar `gemma4:4b` para tudo no baseline; upgrade para GPU na Fase 4 |
| JSON malformado do modelo 4B | Média | Médio | Usar `format: 'json'` do Ollama; parser robusto com regex de extração |
| Consumo de RAM sobe muito com RAG | Baixa | Médio | Limitar índice a 500 chunks mais recentes; paginação na query |
| Modelo Ollama corrompido ou atualizações quebram compatibilidade | Baixa | Alto | Pin de versão no `ollama pull` (ex: `gemma4:4b-v1.2`); backup de `~/.ollama` |

---

---

## Apêndice C: Implementação Realizada (2026-05-22)

### Arquivos modificados/criados

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `backend/services/ollama-client.js` | **Criado** | Cliente unificado Ollama com circuit breaker, retry, `classifyIntent()`, `chatStream()`, `embed()`, `keep_alive` |
| `agents/core/IntentParser.js` | **Modificado** | Integração Ollama no fallback chain; novos regex patterns; fix BUG-001 (email overlap) |
| `backend/server.js` | **Modificado** | Instancia `OllamaClient`; chat social usa Ollama primeiro; fallback Ollama quando Gemini falha |

### Decisões de arquitetura tomadas

1. **Modelo único `gemma2:2b`** em vez de dual-model — RAM insuficiente (5.7GB) para manter 2 modelos carregados
2. **Regex é rei** — ~90% dos comandos comuns capturados em <5ms sem LLM
3. **Prompt Q&A simples** para `classifyIntent()` — `gemma2:2b` não lida bem com JSON complexo + system message
4. **Ollama `keep_alive: 300`** (5min) para evitar cold starts frequentes em CPU-only

### Performance medida (CPU-only, 8 threads)

| Operação | Latência (modelo carregado) | Latência (cold start) |
|----------|----------------------------|----------------------|
| Regex fast-path | 0-5ms | — |
| Intent classification (Ollama) | ~1.5s | ~6s |
| Chat social (Ollama) | ~3s | ~7s |
| Streaming chat (Ollama) | ~3.4s | ~7s |

### Testes de integração

- ✅ "oi luna" → saudação instantânea (regex)
- ✅ "previsão do tempo" → `social` via regex, resposta Ollama
- ✅ "criar tarefa X pro Elias" → `criar_tarefa` via regex
- ✅ "responder ao email do Juan" → `responder_email` via regex (BUG-001 fix)
- ✅ "enviar email para Maria" → `enviar_email` via regex
- ✅ "status do sistema" → `verificar_stack` via regex
- ✅ "listar projetos" → `listar_projetos` via regex

### Bugs fixados nesta sessão

- **BUG-001**: `query_email` regex separado de `send_email`/`reply_email` com negative lookbehind
- **BUG-011** (novo): `status do sistema` dava `multi_acao` (`consultar_status` + `verificar_stack`) — fix com negative lookahead
- **BUG-012** (novo): `gemma2:2b` retornava vazio com prompts JSON complexos — fix com formato "Pick ONE intent"

*Documento atualizado em 2026-05-22 — Arquitetura implementada e operacional.*
