#!/usr/bin/env node
/**
 * Envia proposta de UI/UX pro Kimi Web para feedback
 */

import { KimiBridge } from './kimi-bridge.cjs';
import fs from 'fs';
import path from 'path';
import os from 'os';

const STORE_DIR = path.join(os.homedir(), '.luna', 'store');

const PROMPT = `Voce e um UX designer sênior especialista em terminal applications (CLI/TUI). Analise a proposta abaixo de melhorias de UI/UX para um AI coding assistant que roda no terminal.

## PROBLEMAS ATUAIS
1. Quando o agente executa tool calls (readFile, executeShell, grep), mostra JSON cru feio no terminal
2. O scroll da TUI puxa pra cima sem parar durante streaming — impossível ler histórico
3. Nao ha distincao visual entre tool call em execucao, sucesso e erro

## PESQUISA REALIZADA (Claude Code, Aider, Ink docs, GitHub issues)

### Scroll Fix
O Ink (React pra terminal) redesenha TUDO do zero a cada frame, movendo o cursor pra cima. Isso puxa o scroll do terminal junto. Confirmado em issues do Claude Code e Qwen Code.

**Solucoes encontradas:**
A. Alternate Screen Buffer (vim-style): \\x1b[?1049h / \\x1b[?1049l — Claude Code usa isso no modo fullscreen
B. ink-scroll-view: controle manual de scroll com PgUp/PgDn + follow mode
C. Scroll regions (DECSTBM): so parte da tela scrolla, input bar fica fixa

Qual voce recomenda pra um TUI de chat AI?

### Tool Call Animations (proposta final)
Cada tool call tem 3 estados:

**Executando:**
\`\`\`
⠋ read_file("src/auth.js") ...
\`\`\`
- Spinner Braille (⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏) — suave, sem flicker
- Cor: ciano

**Sucesso:**
\`\`\`
✓ read_file("src/auth.js") — 45 lines, 2.3KB
\`\`\`
- Cor: verde

**Erro:**
\`\`\`
✗ read_file("src/auth.js") — ENOENT: file not found
\`\`\`
- Cor: vermelho

**File reads:** Só mostrar metadata (45 lines, 2.3KB). NUNCA dump completo no chat.
**Shell:** Mostrar comando + tempo decorrido + exit code + preview (ultimas 3 linhas).
**Grouping:** Se 2+ tools rodam juntas, agrupar:
\`\`\`
▸ Running 3 tools
│ ├─ ⠋ read_file package.json
│ ├─ ⠋ read_file tsconfig.json
│ └─ ⠋ grep "import"
\`\`\`

### File Preview
**Proposta A (compacto — recomendado):**
\`\`\`
📄 src/auth.js — 45 lines, 2.3KB
\`\`\`
**Proposta B (preview inline):**
\`\`\`
📄 src/auth.js (45 lines)
  01 │ import bcrypt from 'bcrypt';
  02 │ import jwt from 'jsonwebtoken';
  03 │ ...
\`\`\`

## PERGUNTAS
1. Qual solucao de scroll voce recomenda (A, B, C) e por que?
2. A Proposta A de file preview (só metadata) é suficiente ou usuarios vao querer ver conteudo?
3. O grouping de tool calls é overkill ou essencial?
4. Se voce tivesse que priorizar so 2 melhorias, quais seriam?
5. Tem alguma ideia que nos nao pensamos?

Responda em portugues, seja direto e critico. Nao elogie sem razao.`;

const bridge = new KimiBridge({ storeDir: STORE_DIR });
const userId = 'ui-feedback-' + Date.now();

console.log('🚀 Enviando proposta de UI/UX para o Kimi Web...');
console.log('⏳ Aguardando resposta...\n');

const start = Date.now();
try {
  const response = await bridge.sendMessage(userId, PROMPT, { mode: 'thinking' });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  const text = typeof response === 'string' ? response : (response.response || JSON.stringify(response));
  console.log(`✅ Resposta em ${elapsed}s\n`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('FEEDBACK DO KIMI WEB SOBRE UI/UX');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(text);
  console.log('═══════════════════════════════════════════════════════════════');

  fs.writeFileSync('/home/jhin/NEXO_DASHBOARD_PRO/agents/ui-feedback-kimi.md',
    `# Feedback do Kimi Web — UI/UX Proposta\n\n**Tempo:** ${elapsed}s\n\n---\n\n${text}`
  );
  console.log('\n💾 Salvo em: agents/ui-feedback-kimi.md');
} catch (err) {
  console.error('❌ Erro:', err.message);
}
