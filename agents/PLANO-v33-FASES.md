# Plano de Execução: Luna CLI v3.3 "Espelho Completo"

> Criado: 2026-05-26
> Objetivo: Finalizar v3.3 do início ao fim, fase por fase, com testes e análises.

---

## FASE 1: Foundation (Base)
**Arquivos:** `luna-soul.cjs`, `kimi-bridge-interceptor-toolcalls.js`

- [x] System prompt simplificado (~300 tokens, incentiva nativas)
- [x] Parser warning atualizado (built-in tools = esperado, não erro)
- [x] Interceptor comentários atualizados (browser/computer não mais proibidos)

**Testes:** Unidade do parser, unidade do system prompt
**Análise:** Verificar se backward-compat [[action]] ainda funciona

---

## FASE 2: Core Engine (Motor)
**Arquivos:** `luna-soul.cjs`, `kimi-bridge.cjs`

- [x] `_handleAction`: ban removido, mapeamentos ipython→executeShell, browser→fetchURL, computer→desktop
- [x] DOM Mirror renomeado e expandido (4 tool types: ipython, web_search, browser, computer)
- [x] FIFO ordering por seq/timestamp
- [x] Tool result echo com [LUNA-MIRROR] semântica estável

**Testes:** _handleAction isolado para cada tool, DOM Mirror em página real
**Análise:** Verificar se execução local produz resultados corretos

---

## FASE 3: Security Hardening (Segurança)
**Arquivos:** `luna-tool-guard.cjs`, `luna-soul.cjs`

- [x] Schemas nativos no TOOL_SCHEMAS (ipython, browser, computer)
- [x] Python sandbox AST-light (deny-list imports/builtins)
- [x] Destructive ops confirmation gate (rm, chmod, curl -F, sudo, ~/.ssh)
- [x] clipboardWrite fix (spawn detached para xclip)

**Testes:** validatePythonCode, checkDestructivePattern, ToolGuard.execute com cada tool
**Análise:** Verificar se operações destrutivas são bloqueadas/canceladas

---

## FASE 4: Advanced Architecture (Arquitetura Avançada)
**Arquivos:** NOVOS — `kimi-tool-adapter.cjs`, `tool-call-ledger.cjs`

- [ ] KimiToolAdapter: contrato de interface versionado para mapeamento nativo→Luna
- [ ] ToolCallLedger: deduplicação por ID + estados de ciclo de vida (pending→executing→completed→retry)
- [ ] MutationObserver como fonte primária (polling reduzido para heartbeat apenas)

**Testes:** Adapter para cada tool nativa, Ledger com race conditions simuladas
**Análise:** Verificar se não há execução duplicada nem race conditions

---

## FASE 5: Full E2E Test Suite (Testes Fim-a-Fim)
**Arquivos:** `test-e2e-*.mjs`

- [ ] E2E: "Calcule 2+2 com Python" → ipython detectado → resultado 4
- [ ] E2E: "Pesquise preço do Bitcoin" → web_search detectado → searchWeb local
- [ ] E2E: "Abra github.com e me diga o título" → browser detectado → fetchURL
- [ ] E2E: "Leia o README.md" → [[action]] readFile (backward compat)
- [ ] Regressão: double-bracket, deduplicação, fallback JSON, código incompleto

**Testes:** Todos os cenários E2E + regressão
**Análise:** Taxa de sucesso deve ser >95%

---

## FASE 6: Documentation & Final Report (Documentação)
**Arquivos:** `CHANGELOG.md`, `README-LUNA.md`, relatório final

- [ ] CHANGELOG.md com todas as mudanças v3.3
- [ ] README-LUNA.md atualizado para v3.3
- [ ] Relatório final consolidado

**Testes:** N/A (documentação)
**Análise:** Revisar métricas de sucesso do plano original
