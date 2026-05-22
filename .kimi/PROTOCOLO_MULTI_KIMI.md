# PROTOCOLO MULTI-KIMI — NEXO DASHBOARD PRO
## Arquitetura de Comunicacao entre Agentes Kimi CLI

### Problema
Cada aba do Kimi CLI eh uma sessao isolada. Nao existe socket nativo entre instancias.

### Solucao God Level: FILESYSTEM SHARED STATE + TIMESTAMP SEMAPHORES

#### Diretorio Compartilhado
```
.kimi/
├── PROTOCOLO_MULTI_KIMI.md      <- Este arquivo (regras fixas)
├── AGENT_MASTER.md              <- Estado do orchestrator
├── AGENT_ANALYST_1.md           <- Estado do analista frontend
├── AGENT_ANALYST_2.md           <- Estado do analista backend
├── AGENT_TESTER.md              <- Estado do tester E2E
├── SHARED_FINDINGS.md           <- Descobertas consolidadas (append-only)
├── TASK_QUEUE.md                <- Fila de tarefas com atribuicao
├── BLOCKERS.md                  <- Bloqueios que precisam de ajuda
└── DECISION_LOG.md              <- Log de decisoes tomadas
```

#### Regras de Comunicacao
1. **LEITURA OBRIGATORIA**: Antes de responder qualquer coisa, o agente DEVE ler SHARED_FINDINGS.md e TASK_QUEUE.md
2. **ESCRITA OBRIGATORIA**: Depois de responder, o agente DEVE atualizar seu AGENT_{ID}.md
3. **APPEND-ONLY**: SHARED_FINDINGS.md nunca eh sobrescrito, so acrescentado no final
4. **TIMESTAMP**: Toda mensagem deve ter `#@LAST_UPDATE:ISO8601`
5. **STATUS**: Todo agente deve declarar `#@STATUS:[IDLE|IN_PROGRESS|BLOCKED|DONE]`

#### Formato de Estado do Agente
```markdown
#@AGENT:Analyst-1
#@ROLE:Frontend_UI_UX_Deep_Dive
#@STATUS:IN_PROGRESS
#@TASK:Analise_Completa_ChangelogBadge_ClickMap
#@LAST_UPDATE:2026-05-22T23:00:00+02:00
#@BLOCKING:false

## PROGRESSO
- [x] Ler componente ChangelogBadge.jsx
- [x] Identificar handlers de clique
- [ ] Mapear fluxo de dados (props -> hook -> API)
- [ ] Testar com Playwright

## BLOQUEIOS
Nenhum.

## PROXIMA ACAO
Mapear LunaFloatingButton drag vs click.

## FINDINGS_NOVOS
- Finding 1: onClick duplo em ChangelogBadge linha 210
- Finding 2: ...
```

#### Protocolo de Coordenacao
```
ORCHESTRATOR (Master Kimi):
  1. Le todos os AGENT_*.md
  2. Verifica TASK_QUEUE.md
  3. Distribui novas tarefas em AGENT_*.md
  4. Resolve conflitos em BLOCKERS.md
  5. Consolida findings em SHARED_FINDINGS.md

AGENTES (Analyst 1, Analyst 2, Tester):
  1. Leem seu proprio AGENT_{ID}.md
  2. Leem SHARED_FINDINGS.md
  3. Executam a proxima tarefa
  4. Escrevem findings em SHARED_FINDINGS.md (append)
  5. Atualizam seu AGENT_{ID}.md
```

#### Vantagens
- Funciona com qualquer numero de abas do Kimi CLI
- Estado persiste entre sessoes (arquivos no disco)
- Auditavel (git diff mostra tudo)
- Sem dependencia de rede ou APIs externas

#### Desvantagens
- Latencia: agentes so sincronizam quando "acordam" e leem arquivos
- Conflitos de escrita: dois agentes podem escrever ao mesmo tempo
- Mitigacao: usar timestamps e aceitar ultimo write wins, ou usar locks simples

### Alternativa: SINGLE ORCHESTRATOR + SUBAGENTS
Se o usuario preferir usar apenas ESTA aba do Kimi, o orchestrator (esta sessao) pode:
1. Usar a ferramenta AGENT para criar subagentes
2. Cada subagente recebe prompt completo + contexto
3. O orchestrator consolida resultados
4. Nao precisa de arquivos de sincronizacao

### Recomendacao para NEXO
Para analise profunda atual, usar **SINGLE ORCHESTRATOR + 3 SUBAGENTS**:
- Subagente A: Frontend Audit (Changelog, Luna UI, Click Maps)
- Subagente B: Backend Audit (APIs, Datastore, Security)
- Subagente C: E2E Test Automation (Playwright traces)

Para desenvolvimento continuo no futuro, implementar **MULTI-KIMI FILESYSTEM PROTOCOL**.
