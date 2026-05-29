#!/usr/bin/env node
/**
 * Envia a proposta de "Sandbox Mirror" para a Kimi Web analisar.
 * Abordagem: Kimi usa ipython nativo, código escrito para filesystem do usuário,
 * sandbox falha mas ignora, Luna captura do DOM e executa localmente.
 */

import { KimiBridge } from './kimi-bridge.cjs';
import fs from 'fs';
import path from 'path';
import os from 'os';

const STORE_DIR = path.join(os.homedir(), '.luna', 'store');

// ═══════════════════════════════════════════════════════════════════════════
// PROMPT MULTI-PERSONALIDADE — PROPOSTA SANDBOX MIRROR
// ═══════════════════════════════════════════════════════════════════════════

const PROMPT = `Você é um painel de especialistas técnicos analisando uma proposta arquitetural inovadora para um agente de código AI (Luna CLI v3.3). Leia atentamente e responda como cada especialista.

═════════════════════════════════════════════════════════════════════════════
🎯 CONTEXTO DA ARQUITETURA ATUAL
═════════════════════════════════════════════════════════════════════════════

Luna CLI é um agente autônomo que:
- Roda no PC do usuário (Ubuntu 24.04, Node.js v24)
- Se conecta à Kimi Web (kimi.com) via Playwright CDP (porta 9222)
- Envia mensagens do usuário para a Kimi Web via API interna
- Extrai respostas do DOM (não intercepta rede — usa Connect-RPC)
- Possui ferramentas locais: executeShell, writeFile, readFile, etc.

PROBLEMA ATUAL:
O system prompt instrui a Kimi a NÃO usar ipython/browser/computer nativos. Em vez disso, força ela a emitir [[action]] tags com JSON. Isso é:
- Contra-intuitivo para a Kimi (ela quer usar ferramentas nativas)
- Frágil (parsing de JSON malformado é complexo)
- Lento (a Kimi hesita, gera código errado)

═════════════════════════════════════════════════════════════════════════════
💡 A PROPOSTA: "SANDBOX MIRROR" (Espelho de Sandbox)
═════════════════════════════════════════════════════════════════════════════

IDEIA CENTRAL:
Em vez de PROIBIR as ferramentas nativas da Kimi, INSTRUÍMOS a Kimi a USÁ-LAS — mas de uma forma especial.

FLUXO COMPLETO:

1. O usuário pede: "Crie uma pasta /home/jhin/Documentos/teste e coloque um site HTML+Tailwind lá"

2. O SYSTEM PROMPT instrui a Kimi:
   - "Você tem acesso a ferramentas nativas (ipython, web_search, browser). USE-AS livremente."
   - "Sua execução Python acontece em um sandbox na nuvem. Ignore erros de filesystem — o PC do usuário tem os paths corretos."
   - "Escreva o código Python COMO SE estivesse executando no PC do usuário. Use os paths reais."
   - "Mesmo que o sandbox retorne erro (FileNotFoundError, etc.), CONTINUE. O erro é esperado."

3. A Kimi Web recebe o pedido e executa NATURALMENTE:
   - Ela pensa: "Preciso criar pasta e arquivos"
   - Ela ativa ipython (ferramenta nativa dela)
   - Ela gera código Python:
     \`\`\`python
     import os
     os.makedirs('/home/jhin/Documentos/teste', exist_ok=True)
     print("Pasta criada")
     \`\`\`
   - O sandbox da Kimi executa... ❌ FileNotFoundError (o sandbox não tem /home/jhin/)
   - A Kimi ignora o erro (conforme instrução do system prompt)
   - Ela continua e gera o próximo passo:
     \`\`\`python
     html = '''<!DOCTYPE html>...'''
     with open('/home/jhin/Documentos/teste/index.html', 'w') as f:
         f.write(html)
     print("Arquivo criado")
     \`\`\`
   - Sandbox executa... ❌ FileNotFoundError novamente
   - Kimi ignora e continua

4. A LUNA CLI (no PC do usuário) está observando o DOM:
   - A cada 800ms, extrai blocos .toolcall-ipython do DOM
   - Captura: código Python + resultado do sandbox (geralmente erro)
   - Converte o código em ação local: executeShell("python3 <<'EOF'...")
   - EXECUTA no PC do usuário (onde /home/jhin/Documentos/ EXISTE)
   - ✅ Pasta criada com sucesso
   - ✅ Arquivo HTML criado com sucesso

5. O RESULTADO da execução local volta para a Kimi:
   - Luna envia de volta: "executeShell result: stdout='Pasta criada\\nArquivo criado'"
   - Kimi recebe o resultado real e responde ao usuário: "Pronto! Criei a pasta e o site."

═════════════════════════════════════════════════════════════════════════════
📋 DETALHES TÉCNICOS
═════════════════════════════════════════════════════════════════════════════

EXTRAÇÃO DO DOM (já implementado):
\`\`\`
// Extrai de .toolcall-container.default.toolcall-ipython
// Código: de pre/code dentro .toolcall-content
// Resultado: via TreeWalker de text nodes
// Imagens: de img tags (filtra avatares)
// Deduplicação: hash SHA256 do código
\`\`\`

CONVERSÃO PARA AÇÃO LOCAL:
\`\`\`
// Python → executeShell com heredoc
command = \`python3 <<'PYEOF_123'
${codigo_da_kimi}
PYEOF_123\`

// Bash → executeShell direto
// JavaScript → node -e
\`\`\`

FALLBACK INTELIGENTE:
- Se execução local falha E Kimi tem resultado do sandbox → usa resultado do sandbox
- Isso cobre casos onde a operação não precisa de filesystem (ex: cálculos matemáticos)

PARA ARQUIVOS GRANDES:
- Se o conteúdo for muito grande para um bloco de código, a Kimi pode:
  a) Quebrar em múltiplos blocos Python sequenciais (append mode)
  b) Usar a ferramenta clipboardWrite da Luna para passar conteúdo grande
  c) Gerar um script Python que cria o arquivo, e a Luna executa

═════════════════════════════════════════════════════════════════════════════
🧠 PERGUNTAS PARA OS ESPECIALISTAS
═════════════════════════════════════════════════════════════════════════════

🎭 ARQUITETO DE IA / PROMPT ENGINEER:
1. A Kimi Web consegue seguir instruções do tipo "ignore erros do sandbox e continue"?
2. Qual o melhor formato de system prompt para incentivar esse comportamento?
3. A Kimi tende a desistir quando vê erros sequenciais? Como mitigar?
4. Existe risco da Kimi entrar em loop infinito de "tentar de novo"?

⚙️ ENGENHEIRO DE SISTEMAS:
1. A extração a cada 800ms é suficiente? Deveria ser mais rápida?
2. Como garantir que não perdemos toolcalls intermediários (race condition)?
3. A deduplicação por hash SHA256 é robusta o suficiente?
4. Qual a melhor estratégia para toolcalls que dependem umas das outras (sequenciais)?

🔍 ANALISTA DE SEGURANÇA:
1. Existe risco de execução remota não-intencional?
2. O usuário é o único operador — isso muda a análise de risco?
3. Como prevenir que código malicioso (se houver) execute localmente?
4. A extração do DOM pode ser manipulada por scripts maliciosos na página?

💡 INOVADOR / ESTRATEGISTA:
1. Essa abordagem é verdadeiramente inovadora ou já existe algo similar?
2. Quais vantagens competitivas isso traz vs. Cursor, Claude Code, Aider?
3. Como escalar isso para múltiplos usuários?
4. Qual o próximo passo evolutivo dessa arquitetura?

═════════════════════════════════════════════════════════════════════════════
📎 CONTEXTO ADICIONAL
═════════════════════════════════════════════════════════════════════════════

- A Kimi Web usa Connect-RPC (application/connect+json), não SSE
- O interceptor de rede NÃO funciona (URL não corresponde)
- A extração é 100% DOM-based
- O usuário é Abner Gabriel, CEO da NEXO DIGITAL S.L., Barcelona
- O sistema roda em Ubuntu 24.04 com Node.js v24
- A UI é terminal-based (Ink v7 + React 19)

═════════════════════════════════════════════════════════════════════════════
✍️ FORMATO DA RESPOSTA
═════════════════════════════════════════════════════════════════════════════

Para CADA especialista, responda:
1. **PARECER**: APROVADO / APROVADO COM RESSALVAS / REPROVADO
2. **ANÁLISE**: 3-5 parágrafos com sua avaliação técnica
3. **RISCOS**: Lista dos principais riscos identificados
4. **RECOMENDAÇÕES**: Lista de ações concretas para implementar

No final, inclua:
- **SÍNTESE EXECUTIVA**: Resumo das conclusões
- **PRÓXIMOS PASSOS**: O que implementar primeiro, em ordem de prioridade
- **SYSTEM PROMPT RECOMENDADO**: Um draft do system prompt otimizado para essa abordagem

Seja EXTREMAMENTE crítico e técnico. Não elogie sem fundamento. Se a ideia é ruim, diga. Se é boa, explique POR QUÊ.`;

// ═══════════════════════════════════════════════════════════════════════════
// EXECUÇÃO
// ═══════════════════════════════════════════════════════════════════════════

const userId = 'sandbox-mirror-review-' + Date.now();
const bridge = new KimiBridge({ storeDir: STORE_DIR, cdpUrl: 'http://127.0.0.1:9222' });

console.log('🚀 Enviando proposta "Sandbox Mirror" para análise da Kimi Web...');
console.log(`📄 Tamanho do prompt: ${PROMPT.length} chars`);
console.log('⏳ Aguardando resposta (pode levar 60-120s em thinking mode)...\n');

const startTime = Date.now();

try {
  await bridge.connect();
  const result = await bridge.sendMessage(userId, PROMPT, { mode: 'thinking' });
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`✅ Resposta recebida em ${elapsed}s`);
  console.log(`📊 Tamanho: ${result.response.length} chars\n`);
  console.log('═════════════════════════════════════════════════════════════════════════════');
  console.log('ANÁLISE DA KIMI WEB — SANDBOX MIRROR');
  console.log('═════════════════════════════════════════════════════════════════════════════');
  console.log(result.response);
  console.log('═════════════════════════════════════════════════════════════════════════════');

  // Save to file
  const outputPath = '/home/jhin/NEXO_DASHBOARD_PRO/agents/kimi-review-sandbox-mirror.md';
  fs.writeFileSync(outputPath, `# Análise Kimi Web — Proposta Sandbox Mirror v3.3\n\n**Tempo:** ${elapsed}s\n**Tamanho:** ${result.response.length} chars\n**Timestamp:** ${new Date().toISOString()}\n\n---\n\n${result.response}`);
  console.log(`\n💾 Salvo em: ${outputPath}`);

  await bridge.disconnect();

} catch (err) {
  console.error('❌ Erro:', err.message);
  console.error(err.stack);
  process.exit(1);
}
`;

// Write and execute
fs.writeFileSync('/home/jhin/NEXO_DASHBOARD_PRO/agents/ask-kimi-sandbox-mirror.mjs', scriptContent);
console.log('📝 Script criado: ask-kimi-sandbox-mirror.mjs');
