// ============================================================
// INTENT PARSER v19.0 — MODO CONCIERGE
// Entende comandos naturais em PT-BR usando LLM local (3B params)
// Retorna JSON estruturado com ações a executar
// ============================================================

const fs = require('fs');

// Mapeia nomes dos CEOs para IDs do sistema
function mapResponsavel(name) {
  if (!name) return null;
  const n = name.toLowerCase().trim();
  if (n === 'abner') return 'abner';
  if (n === 'nonoke' || n === 'enoque') return 'nonoke';
  if (n === 'elias') return 'elias';
  return n;
}

class IntentParser {
  constructor(config = {}) {
    this.ollamaHost = config.ollamaHost || 'http://localhost:11434';
    this.model = config.model || 'gemma2:2b';
    this.fallbackModel = config.fallbackModel || 'qwen3:1.7b';
    this.timeout = config.timeout || 15000;
    this.confidenceThreshold = config.confidenceThreshold || 0.75;

    // Regex de fallback para comandos óbvios (rápido, sem LLM)
    this.patterns = {
      task: {
        regex: /\b(anota|cria(?:r)?|adiciona(?:r)?|bota|coloca|faz)\s+(?:uma?\s+)?tarefa\b/i,
        action: 'criar_tarefa',
        extract: (text) => {
          // Limpa a frase removendo prefixos comuns
          let cleaned = text.replace(/\b(luna[,!]?\s*|cria(?:r)?\s+|anota(?:r)?\s+|faz(?:er)?\s+|bota\s+|coloca\s+|adiciona(?:r)?\s+)\b/gi, ' ').trim();
          cleaned = cleaned.replace(/\b(?:uma?\s+)?tarefa\s*[:\-]?\s*/i, ' ').trim();

          // Extrair responsável: "pro Elias", "pra Nonoke", "para o Abner"
          const respPatterns = [
            /\b(?:pro|pra)\s+([A-Za-zÀ-ÿ]+)/i,
            /\bpara\s+(?:o\s+|a\s+)?([A-Za-zÀ-ÿ]+)/i,
            /\batribuir\s+(?:ao|à|a)\s+([A-Za-zÀ-ÿ]+)/i
          ];
          let responsavel = null;
          for (const pat of respPatterns) {
            const m = text.match(pat);
            if (m) { responsavel = mapResponsavel(m[1]); break; }
          }

          // Remove a parte do responsável do título (incluindo qualquer pontuação depois)
          if (responsavel) {
            cleaned = cleaned.replace(/\b(?:pro|pra|para(?:\s+(?:o|a))?)\s+[A-Za-zÀ-ÿ]+\s*[:\-]?\s*/i, ' ').trim();
            cleaned = cleaned.replace(/\batribuir\s+(?:ao|à|a)\s+[A-Za-zÀ-ÿ]+\s*[:\-]?\s*/i, ' ').trim();
          }

          const titulo = cleaned || text;
          const prioridade = /P0|urgente|cr[ií]tica/i.test(text) ? 'P0' : /P1/i.test(text) ? 'P1' : 'P2';
          return { titulo, prioridade, responsavel };
        }
      },
      lead: {
        regex: /\b(novo\s+cliente|novo\s+lead|lead\s+(?:do|da|de)|cliente\s+(?:novo|potencial)|potencial\s+cliente)\b/i,
        action: 'criar_lead',
        extract: (text) => {
          const m = text.match(/(?:cliente|lead)\s*:?\s*([^,]+?)(?:\s*(?:telefone|tel|email|@|,|$))/i);
          return { nome: m?.[1]?.trim() || 'Lead não identificado', contexto: text };
        }
      },
      payment: {
        regex: /\b(pagou|recebeu|recebi|entrada\s+de|depositou|transferiu)\s+.*?\b(\d+[\.,]?\d*)\b/i,
        action: 'registrar_pagamento',
        extract: (text) => {
          const valorMatch = text.match(/(?:pagou|recebeu|recebi|entrada|depositou|transferiu).*?(\d+[\.,]?\d*)/i);
          const deMatch = text.match(/(?:pagou|recebeu|recebi|entrada|depositou|transferiu).*?(?:de|do|da|do cliente)\s+([A-Za-zÀ-ÿ\s]+?)(?:\s+(?:valor|no\s+dia|em|pela|por|$))/i);
          const descMatch = text.match(/(?:por|referente\s+a|pela|de)\s+(.+?)(?:\s*(?:valor|no dia|$))/i);
          return {
            valor: parseFloat((valorMatch?.[1] || '0').replace(',', '.')),
            de: deMatch?.[1]?.trim() || 'Não identificado',
            descricao: descMatch?.[1]?.trim() || 'Pagamento registrado via Luna',
            tipo: /reforma|obra|serviço|projeto/i.test(text) ? 'servico' : 'outro'
          };
        }
      },
      expense: {
        regex: /\b(pagamos|gastou|despesa|saida|saída|compramos)\s+.*?\b(\d+[\.,]?\d*)\b/i,
        action: 'registrar_despesa',
        extract: (text) => {
          const valorMatch = text.match(/(?:pagamos|pagou|gastou|despesa).*?(\d+[\.,]?\d*)/i);
          return {
            valor: parseFloat((valorMatch?.[1] || '0').replace(',', '.')),
            descricao: text,
            tipo: 'despesa'
          };
        }
      },
      done: {
        regex: /\b(consegui|fiz|terminei|finalizei|consertei|corrigi|resolvi|subi|publiquei|atualizei|acabei)\b/i,
        action: 'confirmar_tarefa',
        extract: (text) => {
          const m = text.match(/(?:consegui|fiz|terminei|finalizei|consertei|corrigi|resolvi|subi|publiquei|atualizei|acabei)\s+(?:com\s+|a\s+|o\s+)?(.+)/i);
          return { titulo: m?.[1]?.trim() || text };
        }
      },
      status: {
        regex: /\b(?:status|resumo|como\s+anda|o\s+que\s+tem|quais\s+as|me\s+(?:manda|dá|da)\s+(?:o\s+)?resumo)\b/i,
        action: 'consultar_status',
        extract: () => ({ filtro: 'geral' })
      },
      greeting: {
        regex: /\b(oi|olá|ola|opa|e aí|e ai|bom dia|boa tarde|boa noite)\b/i,
        action: 'social',
        extract: () => ({ tipo: 'saudacao' })
      },
      comment: {
        regex: /\b(comenta(?:r)?(?:\s+na)?(?:\s+tarefa)?|adiciona(?:r)?\s+coment[áa]rio(?:\s+na)?(?:\s+tarefa)?)\b/i,
        action: 'adicionar_comentario',
        extract: (text) => {
          const m1 = text.match(/(?:comenta(?:r)?\s+na\s+tarefa|adiciona(?:r)?\s+coment[áa]rio\s+na\s+tarefa)\s+(.+?)\s*:\s*(.+)/i);
          if (m1) return { taskTitle: m1[1].trim(), commentText: m1[2].trim() };
          const m2 = text.match(/comenta(?:r)?\s+(.+?)\s*:\s*(.+)/i);
          if (m2) return { taskTitle: m2[1].trim(), commentText: m2[2].trim() };
          const m3 = text.match(/(?:adiciona(?:r)?\s+coment[áa]rio\s+na\s+tarefa|comenta(?:r)?\s+na\s+tarefa)\s+(.+)/i);
          if (m3) return { taskTitle: m3[1].trim(), commentText: '' };
          return { taskTitle: text, commentText: '' };
        }
      },
      update_status: {
        regex: /\b(marca(?:r)?\s+tarefa|coloca(?:r)?\s+tarefa|tarefa\s+(?:est[áa]|ficou)|pend[êe]ncia\s+(?:da\s+)?tarefa)\b/i,
        action: 'atualizar_status',
        extract: (text) => {
          let status = 'pending';
          if (/\b(conclu[íi]da|finalizada|pronta|feita)\b/i.test(text)) status = 'completed';
          else if (/\b(andamento|em\s+progresso)\b/i.test(text)) status = 'in_progress';
          else if (/\b(pendente|pend[êe]ncia)\b/i.test(text)) status = 'pending';
          const m = text.match(/(?:marca(?:r)?|coloca(?:r)?)\s+tarefa\s+(.+?)\s+(?:como|em)\s+/i) ||
                    text.match(/tarefa\s+(.+?)\s+(?:est[áa]|ficou)\s+/i) ||
                    text.match(/pend[êe]ncia\s+(?:da\s+)?tarefa\s+(.+)/i);
          return { taskTitle: m?.[1]?.trim() || text, status };
        }
      }
    };
  }

  // ============================================================
  // API PÚBLICA: parse()
  // Recebe texto + contexto, retorna intenções estruturadas
  // ============================================================
  async parse(text, context = {}) {
    const clean = text.replace(/@luna|@kimi|@kimiclaw/gi, '').trim();
    if (!clean) return { intent: 'vazio', actions: [], confidence: 1, needsConfirmation: false };

    // 1. FAST PATH: Regex para comandos óbvios
    const fast = this.fastParse(clean);
    if (fast && fast.confidence >= 0.8) {
      return fast;
    }

    // 2. LLM PATH: Modelo local para entender contexto
    try {
      const llmResult = await this.llmParse(clean, context);
      // Merge: se regex deu algo e LLM deu algo, prioriza LLM mas mantém regex como fallback
      if (fast && llmResult.confidence < this.confidenceThreshold) {
        return { ...fast, llmConfidence: llmResult.confidence, note: 'fallback_regex' };
      }
      return llmResult;
    } catch (err) {
      // 3. FALLBACK: Regex ou unknown
      if (fast) return { ...fast, note: 'llm_error_fallback' };
      return { intent: 'unknown', actions: [], confidence: 0.3, needsConfirmation: false, error: err.message };
    }
  }

  // ============================================================
  // FAST PATH: Regex patterns
  // ============================================================
  fastParse(text) {
    const actions = [];
    let intent = 'unknown';
    let maxConfidence = 0;

    for (const [key, pattern] of Object.entries(this.patterns)) {
      if (pattern.regex.test(text)) {
        const params = pattern.extract(text);
        const confidence = key === 'greeting' ? 0.98 : 0.85;
        actions.push({ type: pattern.action, params, confidence, source: 'regex' });
        if (confidence > maxConfidence) {
          maxConfidence = confidence;
          intent = pattern.action;
        }
      }
    }

    if (actions.length === 0) return null;

    // Se múltiplas ações, intent = 'multi_acao'
    if (actions.length > 1) intent = 'multi_acao';

    return {
      intent,
      actions,
      confidence: maxConfidence,
      needsConfirmation: actions.some(a => ['registrar_pagamento', 'registrar_despesa', 'confirmar_tarefa', 'criar_tarefa', 'criar_lead', 'adicionar_comentario', 'atualizar_status'].includes(a.type)),
      source: 'regex'
    };
  }

  // ============================================================
  // LLM PATH: Ollama local para entendimento profundo
  // ============================================================
  async llmParse(text, context = {}) {
    const prompt = this.buildPrompt(text, context);
    const response = await this.callOllama(prompt);
    return this.parseLLMResponse(response, text);
  }

  buildPrompt(text, context) {
    const author = context.authorName || 'CEO';
    const bufferSummary = context.bufferSummary || {};

    return `Você é o módulo de interpretação de comandos da Luna, assistente da NEXO Digital.
Sua única função é analisar o que o usuário quer e retornar um JSON válido.

CONTEXTO ATUAL:
- Autor: ${author}
- Tarefas pendentes: ${bufferSummary.tasks || 0}
- Leads novos: ${bufferSummary.leads || 0}
- Sinais financeiros: ${bufferSummary.finance || 0}

TEXTO DO USUÁRIO:
"""${text}"""

INSTRUÇÕES:
1. Identifique a intenção principal e quaisquer ações secundárias.
2. Extraia todos os parâmetros relevantes (nome, valor, descrição, prioridade).
3. Se o texto for apenas conversa social, use "social".
4. Se for apenas pedido de informação, use "consulta".
5. Para pagamentos/despesas: sempre extraia o valor numérico.
6. Para tarefas: extraia o título/descrição.
7. Para leads: extraia o nome do cliente e contexto.

REGRAS DE PRIORIDADE:
- "P0" = urgente/crítico
- "P1" = importante
- "P2" = normal (padrão)

AÇÕES SUPORTADAS:
- criar_tarefa: { titulo, descricao?, prioridade?, responsavel? }
- criar_lead: { nome, contexto, telefone?, email?, prioridade? }
- registrar_pagamento: { valor, de, descricao, tipo? }
- registrar_despesa: { valor, para, descricao, tipo? }
- confirmar_tarefa: { titulo, tarefa_id? }
- consultar_status: { filtro? }
- social: { tipo }
- ideia: { texto }
- link: { url, contexto? }

FORMATO DE RESPOSTA (JSON puro, sem markdown):
{
  "intent": "nome_da_intencao",
  "actions": [
    { "type": "acao", "params": { ... }, "confidence": 0.95 }
  ],
  "needsConfirmation": true/false,
  "confidence": 0.0-1.0,
  "explanation": "breve explicação do que entendeu"
}

JSON:`;
  }

  async callOllama(prompt) {
    const models = [this.model, this.fallbackModel];
    let lastError = null;

    for (const model of models) {
      try {
        const fetchPromise = fetch(`${this.ollamaHost}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            prompt,
            system: 'Você é um parser de comandos. Responda APENAS com JSON válido. Não use markdown, não explique, apenas JSON.',
            temperature: 0.1,
            max_tokens: 1024,
            stream: false
          })
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), this.timeout)
        );

        const res = await Promise.race([fetchPromise, timeoutPromise]);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data.response || '';
      } catch (err) {
        lastError = err;
        continue;
      }
    }

    throw lastError || new Error('Todos os modelos falharam');
  }

  parseLLMResponse(response, originalText) {
    if (!response) {
      return { intent: 'unknown', actions: [], confidence: 0, needsConfirmation: false };
    }

    // Extrair JSON da resposta
    let jsonStr = response.trim();
    const codeBlockMatch = jsonStr.match(/```json\s*([\s\S]*?)```/);
    if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();
    else {
      const firstBrace = jsonStr.indexOf('{');
      const lastBrace = jsonStr.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
      }
    }

    try {
      const parsed = JSON.parse(jsonStr);

      // Validar e normalizar
      const actions = (parsed.actions || []).map(a => ({
        type: a.type || 'unknown',
        params: a.params || {},
        confidence: Math.min(Math.max(a.confidence || parsed.confidence || 0.7, 0), 1),
        source: 'llm'
      }));

      // Se o LLM não retornou ações mas tem intent, converte
      if (actions.length === 0 && parsed.intent && parsed.intent !== 'unknown' && parsed.intent !== 'social' && parsed.intent !== 'consulta') {
        actions.push({ type: parsed.intent, params: {}, confidence: parsed.confidence || 0.6, source: 'llm' });
      }

      const confidence = Math.min(Math.max(parsed.confidence || 0.7, 0), 1);

      return {
        intent: parsed.intent || 'unknown',
        actions,
        confidence,
        needsConfirmation: parsed.needsConfirmation ?? this.shouldConfirm(actions),
        explanation: parsed.explanation || '',
        source: 'llm'
      };
    } catch (err) {
      // Se não conseguiu parsear JSON, tenta fallback regex
      const fast = this.fastParse(originalText);
      if (fast) return { ...fast, note: 'llm_parse_error', llmRaw: response.slice(0, 200) };

      return {
        intent: 'unknown',
        actions: [],
        confidence: 0.2,
        needsConfirmation: false,
        error: `JSON parse: ${err.message}`,
        llmRaw: response.slice(0, 200)
      };
    }
  }

  shouldConfirm(actions) {
    const criticalActions = ['registrar_pagamento', 'registrar_despesa', 'confirmar_tarefa', 'excluir_tarefa', 'excluir_lead', 'criar_tarefa', 'criar_lead', 'adicionar_comentario', 'atualizar_status'];
    return actions.some(a => criticalActions.includes(a.type));
  }

  // ============================================================
  // UTILIDADE: Detectar se o texto merece processamento LLM
  // ============================================================
  isComplexCommand(text) {
    const indicators = [
      /\be\s+/i,                    // múltiplas ações com "e"
      /\btamb[eé]m\b/i,             // "também"
      /\b(dividir|split|parte\s+de)\b/i,
      /\b(\d+[\.,]?\d*\s*(?:euro|eur|€))\b/i,
      /\b(?:anota|cria|registra).*\be\s+(?:anota|cria|registra|depois|também)\b/i,
      /\b(pagou|recebeu).*\be\s+.*\b(pagou|recebeu|anota|lead)\b/i
    ];
    return indicators.some(r => r.test(text));
  }
}

module.exports = { IntentParser };
