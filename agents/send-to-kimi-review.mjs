/**
 * Send the architectural plan to Kimi Web for critical review.
 * Uses multiple personas: Architect + Analyst + Engineer.
 */

import { KimiBridge } from './kimi-bridge.cjs';
import fs from 'fs';

const bridge = new KimiBridge({ cdpUrl: 'http://127.0.0.1:9222' });

async function send() {
  await bridge.connect();

  const plan = fs.readFileSync('/home/jhin/.kimi/plans/jay-garrick-black-canary-sentry.md', 'utf8');

  const prompt = `Você é uma equipe de revisão técnica composta por 3 especialistas:

🧠 ARQUITETO DE SOFTWARE:
- Revisa a arquitetura geral
- Identifica falhas estruturais
- Sugere melhorias de design
- Avalia escalabilidade

🔍 ANALISTA DE SEGURANÇA:
- Identifica brechas de segurança
- Avalia riscos de execução remota
- Verifica proteções contra injeção
- Analisa permissões e sandbox

⚙️ ENGENHEIRO DE SISTEMAS:
- Identifica falhas de implementação
- Avalia performance e latência
- Verifica edge cases
- Sugere otimizações

=== PLANO ARQUITETURAL PARA REVISÃO ===

${plan}

=== INSTRUÇÕES ===

Cada especialista deve analisar o plano e responder:

1. **APROVADO** ou **REPROVADO** (com justificativa)
2. **3 falhas críticas** que você encontrou
3. **3 melhorias** que você sugere
4. **1 brecha de segurança** que precisa ser endereçada
5. **1 edge case** que não foi considerado

Seja EXTREMAMENTE crítico. Não poupe palavras. Se algo é ruim, diga. Se algo é bom, reconheça. O objetivo é um sistema à prova de balas.`;

  console.log('📤 Enviando plano para Kimi Web...');
  console.log(`📄 Tamanho: ${prompt.length} caracteres`);

  const result = await bridge.sendMessage('luna-plan-review', prompt, { mode: 'thinking' });

  console.log('\n=== RESPOSTA DA KIMI WEB ===\n');
  console.log(result.response);

  // Save response
  fs.writeFileSync('/home/jhin/NEXO_DASHBOARD_PRO/agents/KIMI-REVIEW-v3.3.md', result.response);
  console.log('\n✅ Review salvo em: KIMI-REVIEW-v3.3.md');

  await bridge.disconnect();
}

send().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
