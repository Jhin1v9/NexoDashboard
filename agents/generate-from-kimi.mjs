#!/usr/bin/env node
/**
 * Envia prompts para Kimi Web, copia resposta via clipboard, extrai código, salva.
 * Qualidade > rapidez. A Kimi Web atua como engenheira de código.
 */

import pkg from './kimi-bridge.cjs';
const { KimiBridge } = pkg;
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const STORE_DIR = path.join(os.homedir(), '.luna', 'store');
const PROMPTS_DIR = '/home/jhin/NEXO_DASHBOARD_PRO/agents/prompts-v33';
const OUTPUT_DIR = '/home/jhin/NEXO_DASHBOARD_PRO/agents/generated';

function readClipboard() {
  try {
    return execSync('xclip -o -selection clipboard', { encoding: 'utf8', timeout: 2000 });
  } catch {
    try {
      return execSync('wl-paste', { encoding: 'utf8', timeout: 2000 });
    } catch {
      return '';
    }
  }
}

function extractCodeBlock(text) {
  // Try to extract code from markdown code block
  const jsMatch = text.match(/```(?:javascript|js|cjs)?\n([\s\S]*?)```/);
  if (jsMatch) return jsMatch[1].trim();
  const genericMatch = text.match(/```\n([\s\S]*?)```/);
  if (genericMatch) return genericMatch[1].trim();
  return text.trim();
}

async function sendAndCopy(bridge, userId, prompt, outputFile) {
  console.log(`\n🚀 [${outputFile}] Enviando prompt para Kimi Web...`);
  console.log(`📄 Prompt size: ${prompt.length} chars`);

  try {
    // Send message
    const result = await bridge.sendMessage(userId, prompt, { mode: 'thinking' });
    const response = result.response || '';
    console.log(`✅ Resposta recebida: ${response.length} chars`);

    // Try to click copy button on the last assistant message
    const page = (await bridge.userSessions.get(userId))?.page;
    if (page && !page.isClosed()) {
      try {
        // Find the last assistant message's copy button
        const copyBtn = page.locator('.segment-assistant-actions .icon-button, [class*="copy"], button[aria-label*="copy" i]').last();
        if (await copyBtn.count() > 0) {
          await copyBtn.click({ timeout: 3000 });
          await new Promise(r => setTimeout(r, 500));
          console.log('📋 Botão de copiar clicado');
        }
      } catch (e) {
        console.log(`⚠️ Não consegui clicar no botão de copiar: ${e.message}`);
      }
    }

    // Try clipboard
    let clipboardText = '';
    for (let i = 0; i < 3; i++) {
      await new Promise(r => setTimeout(r, 300));
      clipboardText = readClipboard();
      if (clipboardText.length > 100) break;
    }

    // Use clipboard if substantial, otherwise use DOM response
    const sourceText = clipboardText.length > response.length * 0.8 ? clipboardText : response;
    console.log(`📋 Fonte usada: ${clipboardText.length > response.length * 0.8 ? 'clipboard' : 'DOM'} (${sourceText.length} chars)`);

    // Extract code
    const code = extractCodeBlock(sourceText);
    if (!code || code.length < 50) {
      fs.writeFileSync(outputFile + '.raw.txt', sourceText);
      console.log(`⚠️ Código não extraído. Resposta bruta salva em: ${outputFile}.raw.txt`);
      return false;
    }

    // Save
    fs.writeFileSync(outputFile, code);
    console.log(`✅ Código salvo: ${outputFile} (${code.length} chars)`);
    return true;

  } catch (err) {
    console.error(`❌ Erro: ${err.message}`);
    return false;
  }
}

async function main() {
  const bridge = new KimiBridge({ storeDir: STORE_DIR, cdpUrl: 'http://127.0.0.1:9222' });
  await bridge.connect();

  const prompts = [
    { file: 'prompt_handleaction.txt', output: '_handleAction.js' },
    { file: 'prompt_extractdom.txt', output: '_extractToolMirrorFromDOM.js' },
    { file: 'prompt_toolguard.txt', output: 'ToolGuard.js' },
  ];

  for (const { file, output } of prompts) {
    const promptPath = path.join(PROMPTS_DIR, file);
    if (!fs.existsSync(promptPath)) {
      console.log(`❌ Prompt não encontrado: ${promptPath}`);
      continue;
    }

    const prompt = fs.readFileSync(promptPath, 'utf8');
    const userId = `codegen-${Date.now()}`;
    const outputPath = path.join(OUTPUT_DIR, output);

    const success = await sendAndCopy(bridge, userId, prompt, outputPath);

    // Short delay between prompts
    if (success) {
      console.log('⏳ Aguardando 5s antes do próximo prompt...');
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  await bridge.disconnect();
  console.log('\n🏁 Todas as gerações concluídas!');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
