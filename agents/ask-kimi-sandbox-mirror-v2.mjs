#!/usr/bin/env node
/**
 * PROMPT ULTRA-REFINADO v2 — Sandbox Mirror
 */

import { KimiBridge } from './kimi-bridge.cjs';
import fs from 'fs';
import path from 'path';
import os from 'os';

const STORE_DIR = path.join(os.homedir(), '.luna', 'store');

const PROMPT = `═══════════════════════════════════════════════════════════════════════════════════════
PAINEL DE ESPECIALISTAS — LUNA CLI v3.3 "SANDBOX MIRROR" — ANALISE DE ARQUITETURA
═══════════════════════════════════════════════════════════════════════════════════════

Voce e um conselho de 5 especialistas analisando uma proposta arquitetural revolucionaria
para um agente de codigo AI. Leia TODO o contexto antes de responder.

═══════════════════════════════════════════════════════════════════════════════════════
📋 CONTEXTO DO SISTEMA (ESTADO ATUAL v3.2)
═══════════════════════════════════════════════════════════════════════════════════════

**Stack Tecnico:**
- Node.js v24 + React v19 + Ink v7.0.4 (ESM) + Playwright (CDP port 9222)
- Ubuntu 24.04, gnome-terminal, xterm-256color, Wayland
- Chrome visivel, CDP porta 9222, perfil dedicado ~/.luna/chrome-profile
- Kimi Web endpoint: POST https://www.kimi.com/apiv2/kimi.gateway.chat.v1.ChatService/Chat
  (formato: application/connect+json — NAO e SSE)

**Arquitetura Atual (v3.2):**
- Usuario → Luna TUI (Ink/React) → LunaSoul → KimiBridge → Kimi Web
- DOM-based extraction (polling 800ms)
- luna-soul.cjs (parse/execute)
- luna-tools.cjs (42 ferramentas)

**Componentes Criticos:**

1. **kimi-bridge.cjs** (2787 linhas): Playwright CDP bridge
   - _extractIpythonMirrorFromDOM(): extrai .toolcall-ipython, .segment-code, .ipython-images-container
   - _isPythonCodeComplete(): valida parenteses/balanceamento
   - _convertIpythonToAction(): converte para executeShell com heredoc
   - sendMessageStream(): polling DOM a cada 800ms, yields action_detected
   - _pollThinkingAndResponse(): Layer 1 stream interceptor (INATIVO — Connect-RPC mismatch)

2. **luna-soul.cjs** (2195 linhas): Engine orquestrador
   - buildSystemPrompt(): ~390 linhas, PROIBE ipython/browser/computer
   - parseTagResponse(): extrai [[response]], [[action]], [[meta]], [[suggest]]
   - processMessageStream(): auto-continue loop (max 8 iteracoes)
   - _handleAction(): REJEITA ipython/browser/computer com "Ferramenta proibida"
   - Deduplicacao: executedDomActionHashes (Set de hashes SHA256)
   - Fallback: se execucao local falha E Kimi tem resultado sandbox -> usa resultado sandbox

3. **kimi-bridge-interceptor-toolcalls.js** (583 linhas): Injetado no navegador
   - mapKimiToolToLuna(): ipython->executeShell, web_search->searchWeb, browser->executeShell
   - **INATIVO** — URL Connect-RPC nao corresponde ao padrao SSE

4. **luna-tools.cjs** (42 ferramentas):
   - Arquivo: readFile, writeFile, replaceInFile, deleteFile, moveFile, copyFile, appendFile
   - Diretorio: listFiles, viewDirectory, createDirectory, removeDirectory
   - Busca: searchFiles, grep, glob, searchWeb, fetchURL
   - Shell: executeShell, runTests, checkSyntax, installPackages
   - Git: gitStatus, gitDiff, gitLog, gitCommit
   - Desktop: shell, click, type, keypress, hotkey, screenshot, scroll, wait, open_app, ocr
   - Util: applyPatch, downloadFile, clipboardRead, clipboardWrite, readMediaFile, think

**Problema Raiz:**
- System prompt GIGANTE (~390 linhas, 2000+ tokens) forca formato proprietario [[action]]
- PROIBE ferramentas nativas da Kimi (ipython, browser, computer, web_search)
- Kimi gera JSON malformado 30% das vezes
- Taxa de sucesso de action execution: ~70%
- Interceptor de rede NAO FUNCIONA (Connect-RPC, nao SSE)
- DOM Mirror e a UNICA camada de extracao funcionando

═══════════════════════════════════════════════════════════════════════════════════════
💡 A PROPOSTA: "SANDBOX MIRROR"
═══════════════════════════════════════════════════════════════════════════════════════

PRINCIPIO FUNDAMENTAL:
"Em vez de PROIBIR as ferramentas nativas da Kimi, INSTRUI-LA a USA-LAS de forma especial.
O sandbox da Kimi (nuvem Moonshot) NAO tem acesso ao filesystem do usuario.
A Kimi executa codigo Python que usa paths do PC local -> erro no sandbox -> IGNORA erro ->
continua gerando proximo passo. A Luna CLI captura CADA tool call do DOM e executa
LOCALMENTE no PC do usuario. O resultado volta para a Kimi como 'resultado da ferramenta'."

FLUXO DETALHADO:

Passo 1 — Usuario pede: "Crie uma pasta /home/jhin/Documentos/teste e coloque um site HTML+Tailwind la"

Passo 2 — System prompt instrui a Kimi:
"Voce e Luna, assistente tecnica autonoma. Use suas ferramentas nativas (ipython, web_search,
browser, computer) livremente para resolver problemas. Sua execucao Python acontece em um
sandbox na nuvem. Os paths que voce usa correspondem ao PC LOCAL do usuario. Se o sandbox
retornar erro de filesystem (FileNotFoundError, etc.), IGNORE o erro e CONTINUE — o PC do
usuario tem os paths corretos. Sempre mostre resultados claros ao usuario."

Passo 3 — Kimi Web executa NATURALMENTE:
- Kimi ativa ipython nativo (ferramenta DELA)
- Gera codigo Python com paths locais: /home/jhin/Documentos/teste
- Sandbox executa... ERRO FileNotFoundError
- Kimi ignora erro (conforme instrucao)
- Gera proximo passo: escrever arquivo HTML
- Sandbox executa... ERRO FileNotFoundError novamente
- Kimi ignora e continua

Passo 4 — Luna CLI (no PC do usuario) extrai do DOM:
- A cada 800ms, captura blocos .toolcall-ipython
- Extrai: codigo Python + resultado do sandbox + imagens
- Converte codigo em acao local: executeShell("python3 <<'EOF'...")
- EXECUTA no PC do usuario (onde /home/jhin/Documentos/ EXISTE)
- Pasta criada com sucesso, arquivo HTML criado com sucesso

Passo 5 — Resultado da execucao local volta para Kimi:
- Luna envia: "executeShell result: stdout='Pasta criada\\nArquivo criado'"
- Kimi recebe resultado REAL e responde ao usuario

═══════════════════════════════════════════════════════════════════════════════════════
🔬 REVISAO ANTERIOR DA KIMI (v3.3 original)
═══════════════════════════════════════════════════════════════════════════════════════

A Kimi Web JA analisou uma versao anterior. Veredictos:
- Arquiteto: APROVADO c/ ressalvas (falta contrato de interface)
- Seguranca: REPROVADO (sandboxing insuficiente)
- Sistemas: APROVADO c/ ressalvas (race conditions)

BLOQUEADORES:
1. DesktopGuard para tool 'computer'
2. Sandbox Python isolado para ipython espelhado
3. Resolver race condition interceptor↔DOM Mirror
4. Substituir polling DOM por MutationObserver
5. Definir contrato de interface versionado

NOVA PROPOSTA resolve BLOQUEADOR #2 elegantemente:
- NAO precisamos de sandbox Python isolado porque a Kimi JA executa no sandbox DELA
- Nos so CAPTURAMOS o codigo e RE-EXECUTAMOS localmente

═══════════════════════════════════════════════════════════════════════════════════════
🌍 PESQUISA DE MERCADO
═══════════════════════════════════════════════════════════════════════════════════════

**Claude Code (Anthropic):**
- Terminal-based, bash access direto, NAO forca formato proprietario
- Compaction pipeline de 5 camadas
- Safety: deny-first rules + ML classifier + optional shell sandboxing

**OpenAI Codex:**
- Cloud sandbox — agent NUNCA toca maquina local
- PR-based workflow

**Browser Use (94k stars):**
- LLM-first design: descreve intencao, agent resolve DOM
- Action scripts: navigation -> extraction -> UI interaction -> agentic steps
- Self-healing com cached element hashes

**Stagehand:**
- 4 primitivas: act, extract, observe, agent
- Self-healing: resolve por AI em runtime

**Pikiclaw:**
- N Agents x N Windows x N Workspaces
- Self-bootstrapping

**MCP (Model Context Protocol):**
- Conecta fontes heterogeneas a LLMs via interface unificada

**Observacao Critica:**
NENHUM agente de mercado usa a abordagem "deixar o LLM executar no sandbox dele
e espelhar localmente capturando do DOM". Todos ou usam API direta ou sandbox cloud.
A abordagem "DOM Mirror" e INOVADORA.

═══════════════════════════════════════════════════════════════════════════════════════
🎯 PERGUNTAS PARA OS 5 ESPECIALISTAS
═══════════════════════════════════════════════════════════════════════════════════════

🎭 ESPECIALISTA 1 — PROMPT ENGINEER / COMPORTAMENTO DE LLM
1. A Kimi Web consegue SEGURAR a instrucao "ignore erros de sandbox e continue"?
   Quando ve FileNotFoundError sequenciais, tende a "desistir" ou "tentar corrigir"?
2. Como formatar o system prompt para que ela ENTENDA que o erro e EXPECTED?
3. A Kimi consegue manter coerencia em multiplos tool calls sequenciais?
   Ex: mkdir -> criar arquivo -> escrever conteudo -> verificar resultado
4. Existe risco de loop infinito se a Kimi nao receber resultado local a tempo?
5. Escreva um system prompt OTIMIZADO (~200 tokens) para essa abordagem

⚙️ ESPECIALISTA 2 — ENGENHEIRO DE SISTEMAS
1. O polling a cada 800ms e suficiente para capturar tool calls em tempo real?
   Se a Kimi gera 3 blocos Python rapido, perdemos algum?
2. Como garantir ORDEM de execucao quando multiplos tool calls sao detectados?
3. A deduplicacao por hash SHA256 e robusta o suficiente?
4. Para arquivos GRANDES (>10KB), qual a melhor estrategia de passagem?
   Opcao A: Multiplos blocos Python sequenciais (append mode)
   Opcao B: Usar clipboardWrite da Luna
   Opcao C: Gerar script Python que salva arquivo diretamente
5. Como implementar "heartbeat" que detecta tool call nao capturado?

🔍 ESPECIALISTA 3 — ANALISTA DE SEGURANCA
1. O usuario e o UNICO operador (maquina pessoal). Isso MUDA a analise de risco?
2. Se a Kimi gera codigo Python malicioso, a ToolGuard atual consegue detectar?
   O codigo Python e passado via heredoc — python3 roda com permissoes do usuario
3. Existe vetor de ataque via DOM injection?
   Um usuario mal-intencionado poderia enviar HTML com <div class="toolcall-ipython">?
4. Como prevenir que a Kimi, ao usar web_search/browser nativo, acesse
   conteudo malicioso que cause prompt injection?
5. A abordagem "alpha com SO ipython + web_search" e suficientemente segura?

🏗️ ESPECIALISTA 4 — ARQUITETO DE SOFTWARE
1. Essa abordagem e verdadeiramente inovadora ou existe precedente?
2. Como se compara a Claude Code, Cursor, Codex?
   Vantagem: usa LLM gratuito (Kimi Web) + execucao local = zero custo API
   Desvantagem: depende de DOM stability + Playwright CDP overhead
3. Qual o melhor padrao para o "Adapter" entre tool nativa Kimi e tool Luna?
   - Kimi ipython -> executeShell (direto)
   - Kimi web_search -> searchWeb (direto)
   - Kimi browser -> ??? (fetchURL e simplificacao demais)
   - Kimi computer -> ??? (computer usa coordenadas, screenshots)
4. Como versionar o contrato de interface?
   Se a Kimi muda classes CSS, tudo quebra. Multiplos seletores fallback + E2E sao suficientes?
5. Deveriamos implementar um "ToolCallLedger" centralizado?

💡 ESPECIALISTA 5 — ESTRATEGISTA / VISAO DE PRODUTO
1. Se essa arquitetura funcionar, qual o potencial de escala?
   Poderiamos adicionar suporte a outros LLMs web (Claude Web, ChatGPT Web, Gemini Web)?
2. Qual o proximo passo evolutivo depois de v3.3?
3. Como monetizar/comercializar?
4. Quais benchmarks deveriamos usar para medir sucesso?
5. Se voce fosse investir neste projeto, qual seria sua recomendacao?
   GO / NO-GO / GO COM CONDICOES

═══════════════════════════════════════════════════════════════════════════════════════
📎 CONTEXTO ADICIONAL
═══════════════════════════════════════════════════════════════════════════════════════

**System Prompt ATUAL (problematico):**
O system prompt tem uma secao "NATIVE (use freely): ipython, web_search, browser"
MAIS um mini-reminder que diz "IMPORTANTE: NUNCA use ipython, browser, computer".
Isso e CONTRADITORIO. A Kimi recebe instrucoes conflitantes.

**Domínio de Execucao:**
- Kimi sandbox: nuvem Moonshot — isolado, sem acesso ao filesystem local
- Luna local: PC do usuario — filesystem real, shell real, desktop real
- A ponte e o DOM extraction + execucao local

**Metricas de Sucesso (v3.3 Target):**
- System prompt size: ~2000 tokens -> ~300 tokens
- Taxa execucao actions: ~70% -> >95%
- JSON malformado: 30% -> <5%
- Ferramentas suportadas: 5 -> 9
- Manutencao/mes: 4h -> 1h

═══════════════════════════════════════════════════════════════════════════════════════
✍️ FORMATO DA RESPOSTA
═══════════════════════════════════════════════════════════════════════════════════════

Para CADA um dos 5 especialistas, responda EXATAMENTE:

### [Nome do Especialista]
**PARECER:** APROVADO / APROVADO COM RESSALVAS / REPROVADO
**CONFIANCA:** Alta / Media / Baixa
**ANALISE:** (3-5 paragrafos tecnicos)
**RISCOS IDENTIFICADOS:** (lista)
**RECOMENDACOES CONCRETAS:** (lista)

No final, inclua:

### SINTESE EXECUTIVA
- Resumo em 1 paragrafo + veredicto conjunto: GO / NO-GO / GO COM CONDICOES

### PROXIMOS PASSOS (ordenados por prioridade)

### SYSTEM PROMPT OTIMIZADO (draft final, max 300 tokens)

### VISAO FUTURA (v4.0+)

REGRAS ABSOLUTAS:
- Seja EXTREMAMENTE critico e tecnico
- Nao elogie sem fundamento
- Se a ideia e ruim, diga POR QUE
- Se e boa, explique POR QUE e superior as alternativas de mercado
- Use exemplos de codigo quando relevante
- O usuario e um CEO tecnico — ele pode implementar tudo que voce sugerir`;

// Execute
const userId = 'sandbox-mirror-review-v2-' + Date.now();
const bridge = new KimiBridge({ storeDir: STORE_DIR, cdpUrl: 'http://127.0.0.1:9222' });

console.log('🚀 Enviando PROMPT ULTRA-REFINADO v2 para analise da Kimi Web...');
console.log(`📄 Tamanho do prompt: ${PROMPT.length} chars (~${Math.ceil(PROMPT.length / 4)} tokens estimados)`);
console.log('⏳ Aguardando resposta (pode levar 60-180s em thinking mode)...\n');

const startTime = Date.now();

try {
  await bridge.connect();
  const result = await bridge.sendMessage(userId, PROMPT, { mode: 'thinking' });
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`✅ Resposta recebida em ${elapsed}s`);
  console.log(`📊 Tamanho: ${result.response.length} chars\n`);
  console.log('═════════════════════════════════════════════════════════════════════════════');
  console.log('ANALISE DA KIMI WEB — SANDBOX MIRROR v2');
  console.log('═════════════════════════════════════════════════════════════════════════════');
  console.log(result.response);
  console.log('═════════════════════════════════════════════════════════════════════════════');

  const outputPath = '/home/jhin/NEXO_DASHBOARD_PRO/agents/kimi-review-sandbox-mirror-v2.md';
  fs.writeFileSync(outputPath, `# Analise Kimi Web — Sandbox Mirror v2\n\n**Tempo:** ${elapsed}s\n**Tamanho:** ${result.response.length} chars\n**Timestamp:** ${new Date().toISOString()}\n**Prompt size:** ${PROMPT.length} chars\n\n---\n\n${result.response}`);
  console.log(`\n💾 Salvo em: ${outputPath}`);

  await bridge.disconnect();

} catch (err) {
  console.error('❌ Erro:', err.message);
  console.error(err.stack);
  process.exit(1);
}
