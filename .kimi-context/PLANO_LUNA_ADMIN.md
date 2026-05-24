# PLANO LUNA ADMINISTRADORA — Contexto Ativo

## Visão
Luna deve administrar o DASHBOARD, não o PC. Assistente real que antecipa, sugere, confirma com contexto, opera em massa, detecta padrões e reporta problemas.

## Status
- System Admin do PC: IGNORADO (não expor na NLU)
- Discord webhook: JÁ EXISTE (funciona pra menções)
- Foco: Dashboard interno

## Fases Revisadas (com análise crítica aplicada)

### Fase 1A: Preview Contextual + Confirmação (ATUAL)
- Expandir LunaInlinePreview pra contexto antes de ações destrutivas
- Criar previewText() pra cada ação crítica
- NLU: treinar confirmação/negacão

### Fase 1B: Undo/Redo
- UndoService com persistência em arquivo + TTL 24h
- Endpoints /api/luna/undo, /api/luna/redo
- NLU: desfazer, refazer

### Fase 1C: BatchActions
- BatchActionService com validação, rate limit 50, permissões
- Tipo mensagem batch_preview com items selecionáveis
- Frontend: cards com toggle + botões
- NLU: detectar plural e contexto de massa

### Fase 2: Tutorial & Help
- KnowledgeBaseService com geração dinâmica
- Detecção de usuário perdido (semântica)
- FAQ com auto-aprendizado

### Fase 3: Health Monitor
- HealthCheck com backoff adaptativo
- Ações corretivas automáticas
- Discord embeds

### Fase 4+: Ações Administrativas Extraordinárias
- Tarefas, Leads, Financeiro, Email, WhatsApp, Clientes

## Princípios
1. Unitário → Massa → Inteligente
2. Confirmação contextual (mostrar O QUE vai acontecer)
3. Undo com persistência (24h TTL)
4. Preview antes (operações em massa mostram amostra)
5. Detecção proativa
6. Tutorial contextual
7. Cascata inteligente com compensação

## Decisões
- Batch limit: 50 itens
- Undo: persistir em arquivo, TTL 24h
- NLU backup antes de re-treinar
- Permissões: verificar role em ações destrutivas
- Tutorial: gerar dinamicamente dos endpoints
- System Admin PC: não expor na NLU
