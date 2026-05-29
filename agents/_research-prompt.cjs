#!/usr/bin/env node
/**
 * Script temporário: envia prompt de pesquisa para Kimi Web
 * Versão robusta: detecta thinking state, espera resposta real
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PROMPT = `Você é um arquiteto de software sênior. Preciso projetar um agente LLM multi-canal (terminal + Telegram + web) que executa tanto ações locais no PC (ler/escrever arquivos, shell) quanto ações em um dashboard via API REST (criar tarefas, leads, registrar pagamentos).

CONTEXTO ATUAL:
- Temos um agente que roda no terminal (TUI com React/Ink) e conecta ao Kimi Web via Playwright/CDP
- O agente já consegue criar arquivos, executar shell, etc. via tool calling
- Temos um backend dashboard com API REST: /api/tasks, /api/leads, /api/finance
- Temos um bot Telegram separado que usa NLU + wizard, mas falha muito

PERGUNTAS:
1. Qual a melhor arquitetura para unificar terminal + Telegram em um único kernel de agente?
2. Como estruturar o "Tool Registry" para que o LLM veja ferramentas de PC e de Dashboard como um conjunto unificado?
3. Como implementar "multi-persona routing" — o agente assume personalidades diferentes (engenheiro de software, product manager, arquiteto) baseado no contexto da tarefa?
4. Quais são os anti-patterns mais comuns em agentes multi-canal e como evitá-los?
5. Recomende bibliotecas/padrões específicos para Node.js (ou cite referências de projetos como OpenCode, Claude Code, etc.)

Responda de forma técnica e estruturada. Cite fontes quando possível.`;

async function main() {
  try {
    console.log('🔌 Conectando ao Chrome visível via CDP...');
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const context = browser.contexts()[0];
    let page = context.pages()[0];
    if (!page) {
      console.error('❌ Nenhuma página encontrada');
      process.exit(1);
    }

    console.log(`📄 Página atual: ${page.url()}`);

    // Navegar para o chat do Kimi
    if (!page.url().includes('/chat/')) {
      console.log('🌐 Navegando para kimi.com/chat/...');
      await page.goto('https://www.kimi.com/?chat_enter_method=new_chat', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForTimeout(5000);
    }

    console.log(`📄 URL: ${page.url()}`);

    // Encontrar o input
    const input = page.locator('[contenteditable="true"]').first();
    await input.waitFor({ state: 'visible', timeout: 15000 });

    console.log('📤 Enviando prompt...');
    await input.fill(PROMPT);
    await input.press('Enter');

    console.log('⏳ Aguardando resposta (até 300s)...');

    const startTime = Date.now();
    const MAX_WAIT = 300000;
    let phase = 'thinking'; // 'thinking' → 'responding' → 'done'
    let lastText = '';
    let stableCount = 0;

    while (Date.now() - startTime < MAX_WAIT) {
      await page.waitForTimeout(5000);

      const state = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        // Detect thinking indicators
        const isThinking = /Thinking|Pensando|思考中|K2\.6/.test(bodyText);
        // Find last assistant message
        const bubbles = document.querySelectorAll('[data-testid="assistant-message"], .assistant-message, [class*="assistant"], [class*="model"], [class*="message-item"]');
        let lastMsg = '';
        if (bubbles.length > 0) {
          lastMsg = bubbles[bubbles.length - 1].innerText;
        }
        return { isThinking, lastMsg, bodyTextLength: bodyText.length };
      });

      process.stdout.write('.');

      if (phase === 'thinking') {
        if (!state.isThinking && state.lastMsg.length > 50) {
          console.log('\n📝 Resposta começou a aparecer');
          phase = 'responding';
          lastText = state.lastMsg;
          stableCount = 0;
          continue;
        }
        // Still thinking, keep waiting
        continue;
      }

      if (phase === 'responding') {
        if (state.lastMsg !== lastText) {
          lastText = state.lastMsg;
          stableCount = 0;
        } else {
          stableCount++;
        }

        if (stableCount >= 4) {
          console.log('\n✅ Resposta estável detectada');
          phase = 'done';
          break;
        }
      }
    }

    if (phase !== 'done') {
      console.log('\n⏱️ Timeout — salvando o que temos até agora');
    }

    // Extract final clean text
    const finalText = await page.evaluate(() => {
      const bubbles = document.querySelectorAll('[data-testid="assistant-message"], .assistant-message, [class*="assistant"], [class*="model"], [class*="message-item"]');
      if (bubbles.length > 0) {
        return bubbles[bubbles.length - 1].innerText;
      }
      return '';
    });

    const outputPath = path.join(__dirname, '..', 'ARTIFACTS', 'kimi-research-response.md');
    const content = `# Resposta da Kimi Web — Pesquisa Arquitetural
## Timestamp: ${new Date().toISOString()}
## URL: ${page.url()}
## Phase: ${phase}

---

${finalText || lastText}

---
`;
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, content, 'utf8');

    console.log(`✅ Resposta salva em: ${outputPath}`);
    console.log(`📊 Tamanho: ${(finalText || lastText).length} caracteres`);

    await browser.close();
  } catch (e) {
    console.error('❌ Erro:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
}

main();
