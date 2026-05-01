# PLANO: Prompt Master v4 Definitivo — NEXO Dashboard PRO

## SEGREDOS DE SUCESSO EXTRAIDOS DA PESQUISA

### 1. AGENTS.md — Padrao Universal
- Adotado por OpenAI, Google, Cursor, Anthropic, GitHub
- 20.000+ repos usando
- Complementa o README (humanos leem README, AIs leem AGENTS.md)

### 2. Curva de Atencao em U
- LLMs prestam MAIS atencao no INICIO e no FIM do prompt
- O MEIO eh esquecido ("Lost in the Middle")
- **Estrategia:** Identity + Safety no topo; Core Workflow no meio-superior; Reminders no final

### 3. Tamanho Enxuto
- **< 150 linhas por arquivo de regras**
- Prompts >15KB perdem eficacia
- Comece com 20-30 linhas, adicione so quando o agente repetir erros

### 4. Principios > Procedimentos
- Dizer O QUE eh bom, nao COMO chegar la passo a passo
- "Minimal changes" vs "Primeiro faca A, depois B, depois C"

### 5. Exemplos Concretos
- Codigo de exemplo eh 3x mais efetivo que regras abstratas
- Mostrar ✅ e ❌ patterns

### 6. Referencia > Copia
- Apontar para arquivos do projeto em vez de copiar conteudo
- `@userService.ts` em vez de colar a estrutura

### 7. Validacao Explicita
- Comandos de teste/build apos mudancas
- "Run `npm test` before marking complete"

### 8. Escopo Explicito
- Definir o que esta FORA do escopo eh tao importante quanto o que esta dentro
- "Nao modifique `supabase/migrations/*`"

### 9. Hierarquia de Contexto
- Global → Repo → Path → Task → In-task
- Regras mais especificas sobrescrevem mais genericas

### 10. Versionar Regras
- Tratar regras como codigo — git, review, rollback
- `.cursorrules`, `CLAUDE.md`, `AGENTS.md` no repo

---

## FASES DE IMPLEMENTACAO

### FASE 1: Estrutura Base (AGENTS.md)
- Criar AGENTS.md na raiz (padrao universal)
- Identity + Role + Goal (topo — curva U)
- Core Workflow (meio-superior)
- Reminders criticos (final — curva U)
- Tamanho alvo: < 150 linhas

### FASE 2: Regras de Codigo (.cursor/ + .clinerules)
- .cursor/index.mdc — Regras principais Cursor
- .cursor/rules/backend.mdc — Regras backend
- .cursor/rules/frontend.mdc — Regras frontend
- .clinerules — Regras Cline (Kimi Code compativel)
- Coding standards, naming, architecture

### FASE 3: Contexto do Projeto (docs/)
- docs/NEXO-CONTEXT.md — Dados dinamicos da empresa
- docs/CONVENTIONS.md — Convencoes de codigo
- docs/WORKFLOW.md — Fluxo de desenvolvimento
- docs/ARCHITECTURE.md — Arquitetura do sistema

### FASE 4: Skills e Templates (docs/skills/)
- docs/skills/CREATE-API.md — Como criar nova API
- docs/skills/CREATE-PAGE.md — Como criar nova pagina
- docs/skills/DEBUG.md — Como debugar problemas
- docs/skills/DEPLOY.md — Como fazer deploy
- docs/skills/REFACTOR.md — Como refatorar codigo

### FASE 5: Auto-Pilot Integrado
- Integrar modo automatico ao prompt principal
- Sistema de decisao: quando perguntar vs quando agir
- Templates de perguntas no formato correto
- Regras de comunicacao (tom, linguagem, formato)

### FASE 6: Validacao e Teste
- Testar o prompt com tarefas reais
- Verificar se o agente segue as regras
- Ajustar conforme necessario
- Versionar no git

---

## ESTRUTURA DE ARQUIVOS FINAL

```
NEXO_DASHBOARD_PRO/
|
|-- AGENTS.md                          [~100 linhas] Padrao universal
|-- .cursor/
|   |-- index.mdc                        [~80 linhas] Regras principais Cursor
|   |-- rules/
|   |   |-- backend.mdc                  [~60 linhas] Regras backend
|   |   |-- frontend.mdc                 [~60 linhas] Regras frontend
|   |   |-- whatsapp.mdc                 [~40 linhas] Regras WhatsApp agent
|   |   |-- finance.mdc                  [~40 linhas] Regras financeiro
|-- .clinerules                          [~100 linhas] Regras Cline/Kimi Code
|
|-- docs/
|   |-- NEXO-CONTEXT.md                  [~50 linhas] Dados dinamicos empresa
|   |-- CONVENTIONS.md                   [~80 linhas] Convencoes codigo
|   |-- WORKFLOW.md                      [~60 linhas] Fluxo desenvolvimento
|   |-- ARCHITECTURE.md                  [~50 linhas] Arquitetura sistema
|   |-- PROMPT-MASTER-v4.md              [Documentacao do prompt]
|   |
|   |-- skills/
|   |   |-- CREATE-API.md                [~30 linhas]
|   |   |-- CREATE-PAGE.md               [~30 linhas]
|   |   |-- DEBUG.md                     [~30 linhas]
|   |   |-- DEPLOY.md                    [~30 linhas]
|   |   |-- REFACTOR.md                  [~30 linhas]
|   |   |-- ADD-FEATURE.md               [~30 linhas]
|   |   |-- TEST.md                      [~30 linhas]
|   |
|   |-- auto-pilot/
|   |   |-- AUTO-PILOT.md                [Ja existe — atualizar]
|   |   |-- auto-config.json             [Ja existe — atualizar]
|   |   |-- templates/
|   |   |   |-- payment.md               Template pergunta pagamento
|   |   |   |-- expense.md               Template pergunta despesa
|   |   |   |-- task.md                  Template pergunta tarefa
|   |   |   |-- lead.md                  Template pergunta lead
|   |   |   |-- confirmation.md          Template confirmacao update
|
|-- PROMPT_MASTER_v4.md                  [LEGADO — manter como referencia]
|-- PROMPT_MASTER_v4_KIMI_CODE.md        [LEGADO — manter como referencia]
```

---

## SCORE ALVO

| Criterio | Atual | Alvo |
|----------|-------|------|
| Tamanho/Concisao | 2/10 | 9/10 |
| Estrutura/Organizacao | 3/10 | 9/10 |
| Instrucoes de Codigo | 1/10 | 9/10 |
| Workflow Definido | 2/10 | 9/10 |
| Sistema de Decisao | 1/10 | 9/10 |
| Memoria/Contexto | 2/10 | 8/10 |
| Qualidade/Testes | 1/10 | 9/10 |
| Comunicacao | 3/10 | 8/10 |
| Exemplos | 0/10 | 8/10 |
| **TOTAL** | **1.75/10** | **8.8/10** |
