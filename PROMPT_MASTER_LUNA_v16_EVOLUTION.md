═══════════════════════════════════════════════════════════════════════════════
  PROMPT MASTER — LUNA v16.0 EVOLUTION (Gemma2B + Dashboard + Histórico)
  Para: Codex / Kimi Code / Kimi Claw
  Projeto: NEXO Dashboard Pro — agents/luna-cto-agent.cjs
═══════════════════════════════════════════════════════════════════════════════

CONTEXTO ATUAL (v15.1 -> v16.0):
O agente Luna já foi corrigido pelo fix v8.1/v8.2. Agora está funcional com:
- Playwright CDP híbrido (porta 9223)
- SmartClassifier v16 com regex blindado
- LunaBrain v16 com Gemma2B via Ollama
- Schema loader global
- HandleMention com IA (Gemma)
- Buffer seguro, threadHistory, resolveAuthor
- Comandos em PT/ES

MISSÃO: Evoluir para v16.0 com as 3 features abaixo.

═══════════════════════════════════════════════════════════════════════════════
ATUALIZAÇÃO OPERACIONAL — STATUS REAL DO AGENT (v16.1) — 2026-05-06
═══════════════════════════════════════════════════════════════════════════════

Validação feita diretamente no código atual:

✅ JÁ IMPLEMENTADO
- `saveToHistory(messages)` existe em `agents/luna-cto-agent.cjs`
- Arquivo `backend/data/whatsapp-history.json` existe e está em uso no projeto
- Fallback de texto no frontend já existe em pontos da UI (`m.text || m.message || '(sem texto)'`)
- Fallback de contagem (`totalMessages`) já existe em `frontend/src/pages/WhatsApp.jsx`

⚠️ IMPLEMENTADO PARCIALMENTE / A VALIDAR
- `@luna + mensagem marcada`: estrutura existe, mas o fluxo completo com `quotedBody` na resposta da IA ainda precisa validação funcional ponta a ponta

❌ AINDA PENDENTE NO CÓDIGO ATUAL
- Chamada de `saveToHistory(...)` dentro de `runFullExtract()` e `runOnce()`
- Timeout de 5s + log de performance `[GEMMA]` em `LunaBrain_v16.js` (atualmente o `gemmaClassify()` não aplica timeout explícito)
- Endpoint `GET /api/whatsapp/history?limit=&chat=`
- Endpoints de revisão:
  - `GET /api/classifications/review`
  - `POST /api/classifications/:id/correct`
  - `GET /api/classifications/stats`
- `/ajuda` ainda está no formato antigo (v15.1) e sem variação `/ayuda` no bloco atual

PRIORIDADE DE EXECUÇÃO (1 arquivo por vez)
1) `agents/LunaBrain_v16.js` — timeout + métricas Gemma
2) `agents/luna-cto-agent.cjs` — chamar `saveToHistory` nos pontos corretos
3) `backend/server.js` — endpoints de histórico e revisão
4) `frontend/src/pages/WhatsApp.jsx` — ajustes finais de exibição/normalização (se necessário após backend)

═══════════════════════════════════════════════════════════════════════════════
FEATURE 1: GEMMA2B INTEGRADO — Classificação Inteligente Real
═══════════════════════════════════════════════════════════════════════════════

OBJETIVO: A LunaBrain.classify() JÁ chama Gemma2B quando a confiança do regex 
é média (0.40-0.85). Mas precisamos que isso funcione 100%.

O QUE JÁ EXISTE (não reescrever, só ajustar):
- LunaBrain_v16.js tem: gemmaClassify(), parseGemmaResponse(), shouldUseGemma()
- Ollama roda em http://localhost:11434 com modelo gemma2:2b
- O prompt para Gemma já está montado em buildGemmaPrompt()

O QUE PRECISA SER FEITO:
1. Garantir que o fetch para Ollama funcione (usar node-fetch ou https nativo)
2. parseGemmaResponse() JÁ foi corrigido no fix v8.1 (3 estratégias de parse)
3. Adicionar timeout de 5 segundos no fetch da Gemma (não pode travar o agente)
4. Se Gemma falhar, fallback imediato para regex (já existe, só garantir)
5. Logar no console: [GEMMA] Classificação levou Xms, confiança Y

CÓDIGO DE REFERÊNCIA (já existe em LunaBrain_v16.js):
```javascript
async gemmaClassify(msg, regexResult, threadHistory) {
  try {
    const personality = this.personalities[this.activePersonality];
    const prompt = this.buildGemmaPrompt(msg, regexResult, threadHistory, personality);

    // TODO: Adicionar timeout de 5000ms aqui
    const response = await fetch(`${this.ollamaConfig.host}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.ollamaConfig.model,
        system: personality.systemPrompt,
        prompt: prompt,
        temperature: this.ollamaConfig.temperature,
        max_tokens: this.ollamaConfig.maxTokens,
        stream: false
      })
    });

    if (!response.ok) throw new Error(`Ollama error: ${response.status}`);
    const data = await response.json();
    return this.parseGemmaResponse(data.response); // Já corrigido no v8.1
  } catch (error) {
    console.error('[GEMMA] Erro:', error.message);
    return null; // Fallback para regex
  }
}
```

═══════════════════════════════════════════════════════════════════════════════
FEATURE 2: HISTÓRICO WHATSAPP PERSISTENTE — whatsapp-history.json
═══════════════════════════════════════════════════════════════════════════════

OBJETIVO: Salvar TODAS as mensagens classificadas em um arquivo JSON persistente,
com alias de nomes resolvidos, para consulta futura e análise de padrões.

O QUE JÁ FOI FEITO no fix v8.1:
- Constante WHATSAPP_HISTORY_FILE adicionada à CONFIG
- Método saveToHistory() adicionado à classe LunaAgent
- Alias map: Abner->Abner Gabriel, Nonoke->Enoque G. Santos, Elias->Elias Mendes
- Limite de 5000 entradas (FIFO)

O QUE PRECISA SER FEITO:
1. Chamar this.saveToHistory(messages) após cada classificação em:
   - runFullExtract() — após classificar todas as mensagens
   - runOnce() — após classificar mensagens novas
2. Formato do histórico (já definido no saveToHistory):
```json
{
  "id": "uuid",
  "author": "Abner Gabriel",
  "originalAuthor": "Abner",
  "text": "conteúdo da mensagem",
  "chat": "Production",
  "timestamp": "2026-05-06T12:00:00Z",
  "classification": { "category": "tarefaPendente", "priority": "P1", ... }
}
```
3. Criar endpoint no server.js: GET /api/whatsapp/history?limit=50&chat=Production
   - Retorna as últimas N mensagens do whatsapp-history.json
   - Filtro opcional por chat (Production, Paulo, etc.)
   - Ordenado por timestamp DESC

═══════════════════════════════════════════════════════════════════════════════
FEATURE 3: DASHBOARD DE CLASSIFICAÇÕES — Visualização Humana
═══════════════════════════════════════════════════════════════════════════════

OBJETIVO: Criar uma página HTML simples (ou endpoint JSON) que mostre as 
classificações da Luna para revisão humana. O classificador NÃO precisa ser 
100% perfeito — só bom o suficiente para revisão rápida.

FLUXO:
1. Luna classifica mensagem -> salva em whatsapp-history.json
2. Humano acessa dashboard -> vê classificações com opção de "corrigir"
3. Correção humana -> salva em luna-learning.json (feedback loop)
4. Próxima classificação usa os pesos aprendidos

O QUE JÁ EXISTE:
- SmartClassifier já tem learning engine: learnFromCorrection(), loadLearning(), saveLearning()
- Arquivo: backend/data/runtime/luna-learning.json
- Método: learnFromCorrection(messageId, correctCategory, previousCategory)

O QUE PRECISA SER FEITO:
1. Endpoint no server.js: GET /api/classifications/review
   - Retorna últimas 50 mensagens não revisadas do whatsapp-history.json
   - Inclui: id, text, author, classification atual, timestamp

2. Endpoint no server.js: POST /api/classifications/:id/correct
   - Body: { correctCategory: "tarefaRealizada", notes: "opcional" }
   - Chama smartClassifier.learnFromCorrection(id, correctCategory, oldCategory)
   - Atualiza a mensagem no histórico com "reviewed": true, "correctedCategory": ...

3. Endpoint no server.js: GET /api/classifications/stats
   - Retorna estatísticas: total classificado, por categoria, taxa de correção, etc.

═══════════════════════════════════════════════════════════════════════════════
REGRAS ABSOLUTAS
═══════════════════════════════════════════════════════════════════════════════

1. NUNCA reescrever o arquivo inteiro. Só adicionar/modificar funções específicas.
2. Sempre manter o keep-alive (process.on uncaughtException/unhandledRejection)
3. NUNCA remover funcionalidades existentes que funcionam
4. Usar async/await, não callbacks
5. Todo novo endpoint do server.js precisa de try/catch
6. Logs no formato: [FEATURE] descrição (ex: [GEMMA] Classificação levou 1200ms)
7. Se não souber como fazer algo, deixe um TODO comentado, não quebre o código

═══════════════════════════════════════════════════════════════════════════════
ESTRUTURA DE ARQUIVOS DO PROJETO
═══════════════════════════════════════════════════════════════════════════════

C:\Users\Administrator\Documents\NEXO DIGITAL\01_ATIVOS\NEXO_DASHBOARD_PRO\
├── agents/
│   ├── luna-cto-agent.cjs      <- MODIFICAR (chamar saveToHistory, Gemma timeout)
│   ├── SmartClassifier_v16.js  <- JÁ OK (só usar learnFromCorrection se necessário)
│   ├── LunaBrain_v16.js        <- MODIFICAR (timeout Gemma, log performance)
│   └── luna-scheduler.mjs      <- JÁ OK
├── backend/
│   ├── server.js               <- MODIFICAR (novos endpoints /api/classifications/*, /api/whatsapp/history)
│   └── data/
│       ├── whatsapp-history.json    <- CRIAR SE NÃO EXISTIR (array vazio)
│       ├── runtime/
│       │   └── luna-learning.json   <- JÁ EXISTE (ou criar com {})
│       └── ...
└── ...

═══════════════════════════════════════════════════════════════════════════════
COMANDOS PARA TESTAR
═══════════════════════════════════════════════════════════════════════════════

Após implementar:
1. node -c agents/luna-cto-agent.cjs
2. node -c agents/LunaBrain_v16.js
3. node backend/server.js
4. curl http://localhost:3456/api/whatsapp/history?limit=10
5. curl http://localhost:3456/api/classifications/stats

═══════════════════════════════════════════════════════════════════════════════
ENTREGÁVEIS ESPERADOS
═══════════════════════════════════════════════════════════════════════════════

1. LunaBrain_v16.js modificado (timeout Gemma, log performance)
2. luna-cto-agent.cjs modificado (chamar saveToHistory nos pontos certos)
3. server.js modificado (3 novos endpoints)
4. Arquivo whatsapp-history.json criado (se não existir)
5. Teste: curl nos endpoints funcionando

═══════════════════════════════════════════════════════════════════════════════
  FIM DO PROMPT MASTER
═══════════════════════════════════════════════════════════════════════════════
