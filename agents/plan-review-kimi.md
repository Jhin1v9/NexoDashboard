# Análise do Kimi Web — Luna Workspace Agent Plan

**Tempo:** 122.5s

---

## BRECHAS E MELHORIAS IDENTIFICADAS PELO KIMI WEB

| Padrão | Por que falta | Impacto |
|--------|---------------|---------|
| **Retry com backoff** | Se grep/readFile falhar por I/O lock, o plano não tenta novamente | Falha esporádica em repos grandes |
| **Circuit breaker** | Se o LLM entrar em loop pedindo o mesmo arquivo 3x, não há interrupção | Gasto de tokens infinito |
| **Idempotency keys** | replaceInFile no mesmo arquivo 2x aplica a mudança 2x (duplica código) | Código quebrado |
| **Schema validation** | O JSON de ações do LLM não é validado contra JSON Schema antes de executar | Path traversal, tool inexistente |
| **Timeout nas tool calls** | npm test pode travar por 10 minutos | Sessão congelada |
| **Checksum de arquivo antes de editar** | Se o usuário editou o arquivo fora do agente entre readFile e replaceInFile, o agente sobrescreve com base em conteúdo stale | Perda de trabalho humano |
| **Checkpoint / Savepoint** | Não há como reverter para o estado do plano no step 3 (só /undo tudo) | Iteração lenta |

---

## Análise do Kimi

O plano é sólido mas tem 7 gaps sérios que os grandes do mercado já resolveram:

1. **Aider** usa git como savepoint implícito (cada tool = commit) — mas não dá rollback parcial de step
2. **Claude Code** tem pre-tool hooks que validam paths e tool names antes de executar
3. **Cursor Composer** tem timeout hard em tool calls (30s para shell, 5s para read)
4. **Kimi CLI** tem retry automático em tool calls de filesystem (3 tentativas)
5. **Todos** usam checksum/hash antes de apply edit para detectar drift

Recomendação: adicionar esses 7 padrões antes do MVP.
