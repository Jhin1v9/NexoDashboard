#!/usr/bin/env node
/**
 * Usa a Kimi Web para gerar código completo para v3.3
 * A Kimi atua como engenheira de código — gera o arquivo, nós salvamos.
 */

import { KimiBridge } from './kimi-bridge.cjs';
import fs from 'fs';
import path from 'path';
import os from 'os';

const STORE_DIR = path.join(os.homedir(), '.luna', 'store');

async function askKimiToGenerate(prompt, outputFile) {
  const bridge = new KimiBridge({ storeDir: STORE_DIR, cdpUrl: 'http://127.0.0.1:9222' });
  const userId = 'code-gen-' + Date.now();

  console.log(`🚀 Enviando prompt para Kimi Web gerar: ${outputFile}`);
  console.log(`📄 Prompt: ${prompt.slice(0, 120)}...`);

  try {
    await bridge.connect();
    const result = await bridge.sendMessage(userId, prompt, { mode: 'thinking' });

    // Extract code blocks from response
    const response = result.response || '';
    const codeBlockMatch = response.match(/```(?:javascript|js|cjs)?\n([\s\S]*?)```/);

    if (codeBlockMatch) {
      const code = codeBlockMatch[1].trim();
      fs.writeFileSync(outputFile, code);
      console.log(`✅ Código gerado e salvo em: ${outputFile}`);
      console.log(`📊 Tamanho: ${code.length} chars`);
      return code;
    } else {
      // Save full response if no code block found
      fs.writeFileSync(outputFile + '.txt', response);
      console.log(`⚠️ Nenhum bloco de código encontrado. Resposta salva em: ${outputFile}.txt`);
      return response;
    }
  } catch (err) {
    console.error('❌ Erro:', err.message);
    throw err;
  } finally {
    await bridge.disconnect();
  }
}

// ============================================================
// PROMPT 1: _handleAction completo com mapeamento v3.3
// ============================================================

const PROMPT_HANDLE_ACTION = `Você é um engenheiro sênior de JavaScript/Node.js.

Gere o método COMPLETO \_handleAction para uma classe LunaSoul em Node.js.

REQUISITOS:
1. O método recebe: parsedAction (com .tool e .params), sessionId, options
2. Deve suportar TODAS as ferramentas Luna: readFile, writeFile, replaceInFile, appendFile, deleteFile, moveFile, copyFile, getFileInfo, listFiles, viewDirectory, createDirectory, removeDirectory, searchFiles, grep, glob, searchWeb, fetchURL, executeShell, runTests, checkSyntax, installPackages, gitStatus, gitDiff, gitLog, gitCommit, applyPatch, downloadFile, clipboardRead, clipboardWrite, readMediaFile, think, getCurrentDirectory
3. Deve suportar ferramentas nativas da Kimi mapeadas:
   - ipython → extrair params.code, validar segurança (deny-list de imports perigosos: os.system, subprocess, __import__, eval, exec), executar via executeShell com heredoc
   - browser → extrair params.url, executar via fetchURL
   - computer → extrair params.action, mapear para engine.executeSingle({ type: action, params })
4. Deve usar ToolGuard (guard.execute) quando disponível
5. Deve usar engine.executeSingle para ferramentas desktop: shell, click, type, keypress, hotkey, screenshot, scroll, wait, open_app, ocr
6. Deve ter auto-commit git após operações de modificação de arquivo
7. Deve retornar { success, result, tool, error? }

CONTEXTO DO CÓDIGO ATUAL:
- lunaTools é importado de './luna-tools.cjs'
- ToolGuard é importado de './luna-tool-guard.cjs'
- ComputerUseEngine é importado de './computer-use-engine.cjs'
- O engine tem método executeSingle(action)
- O toolGuard tem método execute(toolName, params, toolFn)
- lunaGit é opcional (pode ser null)

Gere APENAS o método \_handleAction completo, em JavaScript (CommonJS), pronto para copiar e colar no arquivo luna-soul.cjs.

Use formato de código:
\`\`\`javascript
async _handleAction(parsedAction, sessionId, options = {}) {
  // ... código completo ...
}
\`\`\``;

// ============================================================
// PROMPT 2: _extractIpythonMirrorFromDOM completo v3.3
// ============================================================

const PROMPT_EXTRACT_DOM = `Você é um engenheiro sênior de JavaScript/Node.js especialista em Playwright e DOM scraping.

Gere o método COMPLETO \_extractToolMirrorFromDOM para uma classe KimiBridge em Node.js usando Playwright.

REQUISITOS:
1. O método recebe: page (Playwright Page object)
2. Deve extrair de TODOS os tipos de tool calls do Kimi Web:
   - .toolcall-container.default.toolcall-ipython
   - .toolcall-container.default.toolcall-web_search
   - .toolcall-container.default.toolcall-browser
   - .toolcall-container.default.toolcall-computer
   - .segment-code (text-only code blocks, fallback)
3. Para cada tool call extrair:
   - tool name (ipython, web_search, browser, computer, ou language do segment-code)
   - code/arguments (texto do código ou argumentos)
   - result (stdout/resultado da execução no sandbox)
   - images (array de { src, alt })
   - sequence number (de data-luna-seq attribute)
   - detectedAt timestamp (de data-luna-detected-at attribute)
   - sandboxExecution (true para .toolcall-container, false para .segment-code)
4. Validar parent chain: o node deve estar DENTRO de .segment-assistant ou .message-assistant (não pode ser injetado por usuário)
5. Retornar array ordenado por data-luna-seq (ou por posição DOM se não tiver seq)
6. Cada item do array: { code, result, images, language, source, sandboxExecution, tool, seq, detectedAt }

CONTEXTO:
- O método roda dentro de page.evaluate(() => { ... })
- Deve usar TreeWalker para extrair texto de resultado
- Deve filtrar imagens de avatar (avatar.moonshot.cn, statics.moonshot.cn)
- Deve retornar array vazio se nenhuma tool call for encontrada

Gere APENAS o método \_extractToolMirrorFromDOM completo, em JavaScript (CommonJS), pronto para copiar e colar.

Use formato de código:
\`\`\`javascript
async _extractToolMirrorFromDOM(page) {
  // ... código completo ...
}
\`\`\``;

// ============================================================
// EXECUÇÃO
// ============================================================

const args = process.argv.slice(2);
const target = args[0] || 'all';

async function main() {
  if (target === 'handleAction' || target === 'all') {
    await askKimiToGenerate(
      PROMPT_HANDLE_ACTION,
      '/home/jhin/NEXO_DASHBOARD_PRO/agents/generated/_handleAction.js'
    );
  }

  if (target === 'extractDOM' || target === 'all') {
    await askKimiToGenerate(
      PROMPT_EXTRACT_DOM,
      '/home/jhin/NEXO_DASHBOARD_PRO/agents/generated/_extractToolMirrorFromDOM.js'
    );
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
