# Relatório: Migração Luna CLI v3.1 — JSON → Double-Bracket Delimiters

**Data:** 2026-05-26
**Duração:** ~90 minutos
**Status:** ✅ Concluído

---

## Resumo Executivo

Migramos o formato de resposta do Luna CLI de **JSON puro** para **delimitadores double-bracket** (`[[response]]...[[/response]]`, `[[action]]...[[/action]]`, etc.). Isso resolve o bug crítico de JSON parse falhando devido a newlines reais no DOM, elimina a exibição de JSON cru durante o streaming, e melhora significativamente a UX.

---

## Antes vs Depois

| Aspecto | Antes (JSON) | Depois (Double-Bracket) |
|---------|-------------|------------------------|
| Stream real-time | `{"mode":"CHAT","res...` visível | Texto limpo visível |
| Parse final | 7 estratégias JSON, falha com newlines | Regex simples, tolera qualquer conteúdo |
| Actions | JSON aninhado no campo `response` | `[[action]]{"tool":"..."}[[/action]]` isolado |
| Modelo aprendizado | Complexo (8 formatos JSON) | Simples (4 delimitadores) |
| Fallback | JSON cru na tela | Texto plano amigável |

---

## Mudanças Implementadas

### 1. Novo Parser: `parseTagResponse()` (luna-soul.cjs)
- **Strategies:**
  - A: `[[response]]...[[/response]]` (non-greedy)
  - B: `[[response]]...` (unclosed — extract everything after)
  - C: `[[action]]...[[/action]]` — ACTION mode
  - D: Múltiplos `[[action]]` — PLAN mode
  - E: `[[meta]]...[[/meta]]` — META mode
  - F: `[[suggest]]...[[/suggest]]` — SUGGEST mode
  - G: Backward compatibility — fallback to `parseKimiResponse()` for old JSON
- **Robustez:** Invalid JSON inside delimiters is silently ignored (doesn't break parsing)
- **Linhas:** ~100 linhas novas

### 2. System Prompt Atualizado (buildSystemPrompt)
- Regra #1 mudou de "RESPOND ONLY IN JSON" → "Use double-bracket delimiters"
- Seção OUTPUT FORMATS mostra exemplos com `[[response]]`, `[[action]]`, `[[meta]]`, `[[suggest]]`
- FINAL REMINDER reforça o formato no final do prompt (onde o modelo presta mais atenção)

### 3. Mini-Reminder Atualizado (_buildContext)
- Inclui exemplo EXATO: `[[response]]Oi! Como posso ajudar?[[/response]]`
- Formato condensado para mensagens subsequentes
- Prompt final: "Responda usando XML tags:" → "Responda usando delimitadores:"

### 4. Integração no Fluxo Principal
- 3 call sites atualizados:
  - `processMessage()`
  - `processMessageStream()`
  - `continueSession()`
- Pattern: `parseTagResponse(raw) || parseKimiResponse(raw)`
- Backward compatibility 100% garantida

---

## Testes

### Unit Tests: 20/20 passando ✅
Arquivo: `test-tag-parser.mjs`

| # | Teste | Resultado |
|---|-------|-----------|
| 1 | CHAT simples | ✅ |
| 2 | ACTION | ✅ |
| 3 | PLAN 2 actions | ✅ |
| 4 | META | ✅ |
| 5 | SUGGEST | ✅ |
| 6 | Response com newlines | ✅ |
| 7 | Response com emoji | ✅ |
| 8 | Fallback JSON antigo | ✅ |
| 9 | Fallback texto cru | ✅ |
| 10 | Action JSON com newlines | ✅ |
| 11 | DONE implícito | ✅ |
| 12 | Response vazio | ✅ |
| 13 | Action sem response | ✅ |
| 14 | Texto extra ignorado | ✅ |
| 15 | Fallback JSON ACTION | ✅ |
| 16 | Unclosed `[[response]]` | ✅ |
| 17 | Response with trailing text | ✅ |
| 18 | Action com escaped quotes | ✅ |
| 19 | Suggest malformado (texto livre) | ✅ |
| 20 | Mixed valid/invalid delimiters | ✅ |

### E2E Tests: Kimi Web Real ✅
- **CHAT:** 3/3 mensagens respondidas corretamente com texto limpo
- **Resposta do modelo:** `[[response]]Oi, Abner! 🌙 Luna aqui...[[/response]]`
- **Parse:** Extraiu corretamente o conteúdo interno
- **JSON cru visível:** ❌ NÃO
- **ACTION:** Modelo ainda usa `ipython` (tool Kimi Web) em vez de `readFile` Luna — necessita ajuste fino no system prompt ou treinamento do modelo

---

## Métricas

| Métrica | Valor |
|---------|-------|
| Arquivos modificados | 1 (`luna-soul.cjs`) |
| Arquivos novos | 3 (`test-tag-parser.mjs`, `test-e2e-tags.mjs`, `test-e2e-debug.mjs`) |
| Linhas alteradas | +177, -30 |
| Testes unitários | 20/20 |
| Testes E2E | 3/3 CHAT ✅ |
| Tempo total | ~90 min |
| Backward compatibility | ✅ 100% |

---

## Riscos Mitigados

| Risco | Mitigação | Status |
|-------|-----------|--------|
| Kimi Web filtra tags HTML (`<response>`) | Mudamos para `[[response]]` — não é HTML | ✅ Resolvido |
| Modelo gera JSON antigo | Fallback `parseKimiResponse` sempre ativo | ✅ Resolvido |
| Delimitadores malformados | Parser leniente (unclosed tags, mixed valid/invalid) | ✅ Resolvido |
| JSON inválido dentro de delimitadores | `tryParseDelimiterJson` — silently ignores invalid | ✅ Resolvido |
| Conversas antigas no histórico | Fallback JSON mantém compatibilidade | ✅ Resolvido |

---

## Próximos Passos Recomendados

1. **Ajuste fino ACTION:** O modelo ainda usa `ipython` (tool interna do Kimi Web). Adicionar regra mais forte no system prompt: "NEVER use ipython. Use ONLY Luna tools: readFile, writeFile, etc."
2. **Strip de delimitadores no stream:** Opcional — remover `[[response]]`/`[[/response]]` em tempo real na TUI para UX ainda mais limpa
3. **Monitoramento:** Observar se o modelo mantém o formato após múltiplas interações
4. **Documentação:** Atualizar README/AGENTS.md com o novo formato

---

## Conclusão

A migração para double-bracket delimiters resolve o bug raiz de stream contamination, melhora a experiência do usuário, e mantém total backward compatibility. O sistema está pronto para uso em produção para modo CHAT. O modo ACTION requer ajuste fino no system prompt para que o modelo use as ferramentas Luna corretamente.
