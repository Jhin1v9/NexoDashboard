#!/usr/bin/env node
/**
 * Envia o plano pro Kimi Web para análise de brechas e melhorias
 */

import { KimiBridge } from './kimi-bridge.cjs';
import fs from 'fs';
import path from 'path';
import os from 'os';

const PLAN_PATH = '/home/jhin/.kimi/plans/wildcat-gorgon-ravager.md';
const STORE_DIR = path.join(os.homedir(), '.luna', 'store');

const planContent = fs.readFileSync(PLAN_PATH, 'utf8');

const PROMPT = `Você é um engenheiro sênior de software especialista em arquitetura de agentes de código (AI coding agents). 

Analise criticamente o seguinte plano técnico e identifique:
1. BRECHAS de segurança, performance ou arquitetura
2. MELHORIAS que poderiam ser feitas
3. Padrões que faltam (ex: retry logic, circuit breaker, idempotency)
4. Sugestões de simplificação
5. O que os grandes do mercado (Claude Code, Aider, Cursor, Kimi CLI) fazem melhor nesse ponto

Seja direto, técnico e prático. Não elogie sem razão. Aponte problemas reais.

---

PLANO:

${planContent.slice(0, 12000)}  // Cap em ~12K pra não estourar tokens

---

Responda em português, estruturado por seções.`;

const userId = 'plan-review-' + Date.now();
const bridge = new KimiBridge({ storeDir: STORE_DIR });

console.log('🚀 Enviando plano para análise do Kimi Web...');
console.log(`📄 Tamanho do prompt: ${PROMPT.length} chars`);
console.log('⏳ Aguardando resposta (pode levar 30-60s)...\n');

const startTime = Date.now();

try {
  const response = await bridge.sendMessage(userId, PROMPT, { mode: 'thinking' });
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`✅ Resposta recebida em ${elapsed}s`);
  console.log(`📊 Tamanho: ${response.length} chars\n`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('ANÁLISE DO KIMI WEB');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(response);
  console.log('═══════════════════════════════════════════════════════════════');

  // Save to file
  const outputPath = '/home/jhin/NEXO_DASHBOARD_PRO/agents/plan-review-kimi.md';
  fs.writeFileSync(outputPath, `# Análise do Kimi Web — Luna Workspace Agent Plan\n\n**Tempo:** ${elapsed}s\n**Tamanho:** ${response.length} chars\n\n---\n\n${response}`);
  console.log(`\n💾 Salvo em: ${outputPath}`);

} catch (err) {
  console.error('❌ Erro:', err.message);
  process.exit(1);
}
