# ANALISE CRITICA — Prompts Master v4 Atuais

## PROBLEMAS IDENTIFICADOS

### 1. TAMANHO EXCESSIVO (18.475 bytes)
**Severidade: CRITICA**
- Prompts muito longos (>15KB) causam "lost in the middle" — o LLM perde instrucoes no meio
- Estudos da Anthropic mostram que LLMs priorizam INICIO e FIM do prompt, esquecendo o meio
- Solucao: Dividir em arquivos separados (contexto vs instrucoes vs regras)

### 2. DUPLICACAO TOTAL
**Severidade: CRITICA**  
- PROMPT_MASTER_v4.md e PROMPT_MASTER_v4_KIMI_CODE.md sao 95% identicos
- Diferenca: apenas o header inicial ("INSTRUCAO INICIAL")
- Nao faz sentido ter 2 prompts iguais — confunde o usuario
- Solucao: Um prompt unico com variacoes de contexto

### 3. SEM ESTRUTURA DE DECISAO
**Severidade: CRITICA**
- O agente nao sabe QUANDO perguntar vs QUANDO agir sozinho
- Nao ha regras de autonomia (ex: "se o valor for < €100, decida sozinho")
- Nao ha niveis de permissao (read-only vs edit vs create vs delete)
- Solucao: Matriz de decisao clara

### 4. SEM INSTRUCOES DE ESTILO DE CODIGO
**Severidade: ALTA**
- Zero regras sobre nomenclatura (camelCase? PascalCase? snake_case?)
- Zero regras sobre organizacao de arquivos
- Zero padroes de arquitetura (MVC? Feature-based? Atomic Design?)
- Zero regras sobre imports, exports, componentes
- Solucao: Secao dedicada a coding standards

### 5. SEM WORKFLOW DE DESENVOLVIMENTO
**Severidade: ALTA**
- Nao ha instrucoes sobre: analise -> plano -> implementacao -> teste -> deploy
- Nao ha checklist de qualidade antes de commit
- Nao ha instrucoes sobre quando usar git commit/push
- Nao ha regras sobre branches (main? develop? feature/)
- Solucao: Workflow step-by-step definido

### 6. CONTEXTO MISTURADO COM INSTRUCOES
**Severidade: MEDIA**
- Dados da empresa (clientes, valores, split) estao no mesmo arquivo das instrucoes tecnicas
- Isso dificulta atualizacao — toda vez que muda um valor, muda o prompt
- Solucao: Separar em CONTEXT.md (dados dinamicos) vs INSTRUCTIONS.md (regras estaticas)

### 7. SEM SISTEMA DE MEMORIA
**Severidade: MEDIA**
- Nao ha instrucoes sobre como manter contexto entre sessoes
- Nao ha arquivo de memoria (o que ja foi feito, o que esta pendente)
- Nao ha handoff entre sessoes ("na ultima sessao fizemos X, agora facamos Y")
- Solucao: Arquivo de memoria persistente

### 8. SEM REGRAS DE QUALIDADE
**Severidade: MEDIA**
- Nao ha checklist de qualidade antes de entregar
- Nao ha instrucoes sobre testes (quando testar? como testar?)
- Nao ha regras sobre review de codigo
- Nao ha metricas de sucesso ("o codigo deve compilar", "todos os testes passam")
- Solucao: Quality gates definidas

### 9. AUTO-PILOT DESCONECTADO
**Severidade: MEDIA**
- O modo automatico esta em arquivos separados (AUTO-PILOT.md, auto-config.json)
- Nao esta integrado ao prompt principal
- O agente nao sabe quando entrar em modo auto vs modo manual
- Solucao: Integrar ao prompt principal com flags

### 10. FALTA DE EXEMPLOS FEW-SHOT
**Severidade: MEDIA**
- Nao ha exemplos de como o agente DEVE responder
- Nao ha exemplos de como o agente NAO DEVE responder
- Few-shot examples sao provados como altamente eficazes em prompt engineering
- Solucao: Adicionar exemplos positivos e negativos

### 11. SEM INSTRUCOES DE COMUNICACAO
**Severidade: BAIXA**
- Nao ha regras sobre tom de voz (formal? informal? tecnico?)
- Nao ha regras sobre linguagem (portugues? ingles? misto?)
- Nao ha regras sobre formato de resposta (markdown? plain text? code blocks?)
- Solucao: Communication style guide

### 12. SEM HANDLING DE ERROS
**Severidade: BAIXA**
- Nao ha instrucoes sobre o que fazer quando algo da errado
- Nao ha regras sobre rollback (como desfazer mudancas?)
- Nao ha instrucoes sobre debugging (como diagnosticar problemas?)
- Solucao: Error handling playbook

## SCORE ATUAL

| Criterio | Nota (0-10) | Peso | Pontuacao |
|----------|-------------|------|-----------|
| Tamanho/Concisao | 2 | 15% | 0.3 |
| Estrutura/Organizacao | 3 | 15% | 0.45 |
| Instrucoes de Codigo | 1 | 15% | 0.15 |
| Workflow Definido | 2 | 15% | 0.3 |
| Sistema de Decisao | 1 | 10% | 0.1 |
| Memoria/Contexto | 2 | 10% | 0.2 |
| Qualidade/Testes | 1 | 10% | 0.1 |
| Comunicacao | 3 | 5% | 0.15 |
| Exemplos | 0 | 5% | 0.0 |
| **TOTAL** | | | **1.75 / 10** |

## META PARA v4 DEFINITIVO
**Score alvo: 9.0+**
