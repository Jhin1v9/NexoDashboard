# 📊 ANÁLISE MASSIVA DE GAPS — NLU da Luna

> **⚠️ ATUALIZAÇÃO:** Expansão concluída em 2026-05-18. Ver commit `920c182`.
>
> Data original: 2026-05-19 | Instância: kimi-10a71fc7

## Resumo Executivo

| Métrica | Antes | Depois | Status |
|---------|-------|--------|--------|
| Intents no NLU | **36** | **137** | ✅ Resolvido |
| Ações no ActionExecutor | **198** | **198** | — |
| Endpoints da API | **120+** | **120+** | — |
| Páginas do Frontend | **29** | **29** | — |
| Domínios cobertos pelo NLU | **9 de 20** | **15 de 20** | ✅ Expandido |
| Schemas no SmartFormModal | **16** | **137** | ✅ Completo |
| **GAP TOTAL estimado** | **~120+ intents faltando** | **0** | ✅ Fechado |

---

## 1. EMAIL 📧 (NLU: 10 intents | ActionExecutor: 25+ ações | GAP: ENORME)

### ✅ Já existe no NLU:
- `email.responder` — Responder email
- `email.resumir` — Resumir thread
- `email.analisar` — Análise de segurança
- `email.criar_rascunho` — Criar rascunho
- `email.enviar` — Enviar email
- `email.arquivar` — Arquivar
- `email.mover_lixeira` — Mover para lixeira
- `email.listar_nao_lidos` — Listar não lidos
- `email.marcar_lido` — Marcar como lido
- `email.sincronizar` — Sincronizar Gmail

### 🔴 FALTANDO (só existe no ActionExecutor/API):
| Intent | Por quê falta |
|--------|---------------|
| `email.listar_rascunhos` | **Você acabou de descobrir esse!** "rascunhos pendentes" |
| `email.aprovar_rascunho` | Aprovar draft da Luna |
| `email.rejeitar_rascunho` | Rejeitar draft |
| `email.marcar_nao_lido` | Opção inversa do marcar lido |
| `email.favoritar` | Dar estrela |
| `email.desfavoritar` | Tirar estrela |
| `email.marcar_spam` | Spam |
| `email.restaurar_lixeira` | Tirar da lixeira |
| `email.listar_arquivados` | Emails arquivados |
| `email.listar_lixeira` | Lixeira |
| `email.listar_enviados` | Sent |
| `email.listar_com_estrela` | Starred |
| `email.sugerir_resposta` | IA sugerir reply (usa Gemini) |
| `email.resumir_com_ai` | Resumo com action items (usa Gemini) |
| `email.draft_com_ai` | Gerar rascunho com instruções (usa Gemini) |
| `email.analisar_com_ai` | Análise de segurança com IA |
| `email.action_items_para_tarefas` | Converter action items → tarefas |
| `email.configurar` | Configurar Gmail OAuth |
| `email.revogar_auth` | Revogar acesso Gmail |

---

## 2. TAREFAS 📋 (NLU: 5 intents | ActionExecutor: 15+ ações | GAP: GRANDE)

### ✅ Já existe:
- `tarefa.criar` — Criar tarefa
- `tarefa.listar` — Listar tarefas
- `tarefa.concluir` — Concluir tarefa
- `tarefa.atribuir` — Atribuir tarefa

### 🔴 FALTANDO:
| Intent | Descrição |
|--------|-----------|
| `tarefa.excluir` | "excluir tarefa X" |
| `tarefa.atualizar` | "atualizar prioridade da tarefa X" |
| `tarefa.adicionar_comentario` | "comentar na tarefa X" |
| `tarefa.minhas` | "minhas tarefas" |
| `tarefa.p0` | "tarefas P0" / "tarefas críticas" |
| `tarefa.p1` | "tarefas P1" |
| `tarefa.atrasadas` | "tarefas atrasadas" |
| `tarefa.por_projeto` | "tarefas do projeto X" |
| `tarefa.por_responsavel` | "tarefas do Abner" |
| `tarefa.confirmar` | "confirmar tarefa X" (do WhatsApp) |
| `tarefa.concluidas` | "tarefas concluídas" |

---

## 3. FINANCEIRO 💰 (NLU: 5 intents | ActionExecutor: 20+ ações | GAP: GRANDE)

### ✅ Já existe:
- `financeiro.consultar_caixa` — Saldo do caixa
- `financeiro.adicionar_receita` — Registrar pagamento
- `financeiro.adicionar_despesa` — Registrar despesa
- `financeiro.listar_pagamentos` — Listar receitas
- `financeiro.listar_despesas` — Listar despesas

### 🔴 FALTANDO:
| Intent | Descrição |
|--------|-----------|
| `financeiro.extrato` | "extrato financeiro" |
| `financeiro.gastos_do_mes` | "gastos do mês" |
| `financeiro.receitas_do_mes` | "receitas do mês" |
| `financeiro.balanco` | "balanço do mês" |
| `financeiro.projecao` | "projeção de caixa" |
| `financeiro.historico_caixa` | "histórico do caixa" |
| `financeiro.reconciliar` | "reconciliar caixa" |
| `financeiro.ajustar_caixa` | "ajustar caixa" |
| `financeiro.pagar_despesa` | "pagar despesa X" |
| `financeiro.split` | "receber split da despesa X" |
| `financeiro.despesa_com_split` | "registrar despesa com split" |
| `financeiro.receita_com_split` | "registrar pagamento com split" |
| `financeiro.excluir_despesa` | "excluir despesa X" |
| `financeiro.excluir_pagamento` | "excluir pagamento X" |
| `financeiro.atualizar_despesa` | "atualizar despesa X" |
| `financeiro.atualizar_pagamento` | "atualizar pagamento X" |
| `financeiro.template_despesa` | "criar template de despesa" |
| `financeiro.divisao_founders` | "quanto cada founder deve receber" |
| `financeiro.orcamentos` | "listar orçamentos" |
| `financeiro.criar_orcamento` | "criar orçamento" |

---

## 4. WHATSAPP 📱 (NLU: 3 intents | ActionExecutor: 10+ ações | GAP: MÉDIO)

### ✅ Já existe:
- `whatsapp.enviar_mensagem` — Enviar mensagem
- `whatsapp.responder_cliente` — Responder cliente
- `whatsapp.verificar_mencoes` — Verificar menções

### 🔴 FALTANDO:
| Intent | Descrição |
|--------|-----------|
| `whatsapp.mensagens_recentes` | "mensagens recentes" |
| `whatsapp.scan` | "scan do whatsapp" |
| `whatsapp.classificar` | "classificar mensagens" |
| `whatsapp.relatorio` | "relatório do grupo" |
| `whatsapp.limpar_buffer` | "limpar buffer" |
| `whatsapp.historico` | "histórico do whatsapp" |
| `whatsapp.checkpoint` | "checkpoint do whatsapp" |
| `whatsapp.configurar` | "configurar whatsapp" |
| `whatsapp.tarefas_detectadas` | "tarefas do whatsapp" |

---

## 5. LEADS 🎣 (NLU: 0 intents!!! | ActionExecutor: 8 ações | GAP: CRÍTICO)

### 🔴 ZERO COBERTURA. Tudo falta:
| Intent | Descrição |
|--------|-----------|
| `lead.listar` | "listar leads" |
| `lead.novos` | "leads novos" |
| `lead.em_negociacao` | "leads em negociação" |
| `lead.adicionar` | "adicionar lead" |
| `lead.atualizar` | "atualizar lead X" |
| `lead.excluir` | "excluir lead X" |
| `lead.converter` | "converter lead X em cliente" |
| `lead.pipeline` | "pipeline de vendas" |
| `lead.proposta_enviada` | "leads com proposta enviada" |
| `lead.valor_pipeline` | "valor total do pipeline" |

---

## 6. CLIENTES 👥 (NLU: 0 intents!!! | ActionExecutor: 6 ações | GAP: CRÍTICO)

### 🔴 ZERO COBERTURA:
| Intent | Descrição |
|--------|-----------|
| `cliente.listar` | "listar clientes" |
| `cliente.dados` | "dados do cliente X" |
| `cliente.adicionar` | "adicionar cliente" |
| `cliente.atualizar` | "atualizar cliente X" |
| `cliente.excluir` | "excluir cliente X" |
| `cliente.orcamentos` | "orçamentos do cliente X" |
| `cliente.projetos` | "projetos do cliente X" |
| `cliente.contato` | "contato do cliente X" |

---

## 7. WORKSPACE 💻 (NLU: 0 intents!!! | ActionExecutor: 5 ações | GAP: CRÍTICO)

### 🔴 ZERO COBERTURA:
| Intent | Descrição |
|--------|-----------|
| `workspace.listar_clientes` | "listar clientes do workspace" |
| `workspace.abrir` | "abrir workspace do cliente X" |
| `workspace.criar_cliente` | "criar cliente no workspace" |
| `workspace.criar_pasta` | "criar pasta" |
| `workspace.upload` | "fazer upload de arquivo" |
| `workspace.servidores` | "status dos servidores de demo" |
| `workspace.iniciar_demo` | "iniciar servidor de demo" |
| `workspace.parar_demo` | "parar servidor de demo" |
| `workspace.logs` | "ver logs do servidor" |
| `workspace.arquivos` | "listar arquivos do cliente X" |

---

## 8. PROJETOS 🚀 (NLU: 2 intents | ActionExecutor: 8 ações | GAP: MÉDIO)

### ✅ Já existe:
- `projeto.listar` — Listar projetos
- `projeto.criar` — Criar projeto

### 🔴 FALTANDO:
| Intent | Descrição |
|--------|-----------|
| `projeto.status` | "status do projeto X" |
| `projeto.atualizar` | "atualizar projeto X" |
| `projeto.excluir` | "excluir projeto X" |
| `projeto.github` | "repos do projeto no github" |
| `projeto.vercel` | "deploys na vercel" |
| `projeto.demos` | "abrir demo do projeto" |

---

## 9. ORÇAMENTOS 📄 (NLU: 2 intents | ActionExecutor: 6 ações | GAP: MÉDIO)

### ✅ Já existe:
- `orcamento.criar` — Criar orçamento
- `orcamento.enviar_cliente` — Enviar para cliente

### 🔴 FALTANDO:
| Intent | Descrição |
|--------|-----------|
| `orcamento.listar` | "listar orçamentos" |
| `orcamento.pendentes` | "orçamentos pendentes" |
| `orcamento.aprovar` | "aprovar orçamento X" |
| `orcamento.excluir` | "excluir orçamento X" |
| `orcamento.atualizar` | "atualizar orçamento X" |
| `orcamento.valor_total` | "valor total de orçamentos" |

---

## 10. IDEIAS 💡 (NLU: 2 intents | ActionExecutor: 6 ações | GAP: MÉDIO)

### ✅ Já existe:
- `ideia.listar` — Listar ideias
- `ideia.criar` — Criar ideia

### 🔴 FALTANDO:
| Intent | Descrição |
|--------|-----------|
| `ideia.minhas` | "minhas ideias" |
| `ideia.por_categoria` | "ideias de marketing" |
| `ideia.brainstorm` | "brainstorm com IA" |
| `ideia.converter_tarefa` | "converter ideia em tarefa" |
| `ideia.comentar` | "comentar na ideia X" |
| `ideia.templates` | "templates de ideias" |
| `ideia.excluir` | "excluir ideia X" |
| `ideia.atualizar` | "atualizar ideia X" |

---

## 11. LINKS 🔗 (NLU: 2 intents | ActionExecutor: 5 ações | GAP: PEQUENO)

### ✅ Já existe:
- `link.listar` — Listar links
- `link.adicionar` — Adicionar link

### 🔴 FALTANDO:
| Intent | Descrição |
|--------|-----------|
| `link.excluir` | "excluir link X" |
| `link.enriquecer` | "enriquecer link X" |
| `link.sincronizar` | "sincronizar links" |

---

## 12. SISTEMA ⚙️ (NLU: 3 intents | ActionExecutor: 10+ ações | GAP: GRANDE)

### ✅ Já existe:
- `sistema.ajuda` — Ajuda
- `sistema.status` — Status do sistema
- `sistema.notificacoes` — Notificações

### 🔴 FALTANDO:
| Intent | Descrição |
|--------|-----------|
| `sistema.navegar` | "ir para página X" |
| `sistema.notificacoes_lidas` | "marcar todas notificações como lidas" |
| `sistema.configuracoes` | "abrir configurações" |
| `sistema.trocar_usuario` | "trocar de usuário" |
| `sistema.alterar_senha` | "alterar senha" |
| `sistema.usuarios` | "listar usuários" |
| `sistema.changelog` | "ver changelog" |
| `sistema.relatorios_bug` | "relatórios de bug" |
| `sistema.auto_fix` | "verificar auto-fix" |
| `sistema.controlar_servico` | "iniciar/parar serviço" |

---

## 13. INSTAGRAM 📸 (NLU: 0 intents!!! | ActionExecutor: 3 ações | GAP: CRÍTICO)

### 🔴 ZERO COBERTURA:
| Intent | Descrição |
|--------|-----------|
| `instagram.importar` | "importar mensagens do instagram" |
| `instagram.mensagens` | "listar mensagens do instagram" |
| `instagram.configurar` | "configurar instagram" |

---

## 14. GITHUB 🐙 (NLU: 0 intents!!! | ActionExecutor: 2 ações | GAP: CRÍTICO)

### 🔴 ZERO COBERTURA:
| Intent | Descrição |
|--------|-----------|
| `github.repos` | "listar repos" |
| `github.git_push` | "fazer git push" |
| `github.status` | "status do github" |

---

## 15. VERCEL ▲ (NLU: 0 intents!!! | ActionExecutor: 1 ação | GAP: CRÍTICO)

### 🔴 ZERO COBERTURA:
| Intent | Descrição |
|--------|-----------|
| `vercel.projetos` | "listar projetos na vercel" |
| `vercel.status` | "status dos deploys" |

---

## 16. SEGURANÇA 🔒 (NLU: 0 intents!!! | ActionExecutor: 4 ações | GAP: CRÍTICO)

### 🔴 ZERO COBERTURA:
| Intent | Descrição |
|--------|-----------|
| `seguranca.configuracoes` | "configurações de segurança" |
| `seguranca.logs` | "logs de segurança" |
| `seguranca.testar_whatsapp` | "testar alerta whatsapp" |
| `seguranca.alerta` | "criar alerta de segurança" |

---

## 17. OPERAÇÕES 🏭 (NLU: 0 intents!!! | ActionExecutor: 4 ações | GAP: CRÍTICO)

### 🔴 ZERO COBERTURA:
| Intent | Descrição |
|--------|-----------|
| `operacao.alerta` | "criar alerta de operação" |
| `operacao.excluir_alerta` | "excluir alerta" |
| `operacao.mudanca` | "registrar mudança" |
| `operacao.status` | "status das operações" |

---

## 18. SOCIAL 💬 (NLU: 0? | ActionExecutor: 0 | GAP: ???)

O domínio `social` existe no NLU mas sem intents mapeados. Serve para saudações.

---

## 19. CHAVE DE PROBLEMAS ESPECÍFICOS

### ❌ Intents que existem mas com POUCOS EXEMPLOS de treinamento (~5-10 por idioma):
- Todos os intents atuais precisam de **50-100 exemplos** cada (hoje têm ~25)
- `sistema.ajuda` só tem exemplos genéricos, não contextualizados por página
- `whatsapp.enviar_mensagem` não tem variações de "manda zap", "envia msg", etc.

### ❌ Intents que existem mas NÃO TÊM SCHEMA no frontend:
- `email.listar_nao_lidos` — existe no NLU mas não tem formulário/redirect
- `email.sincronizar` — existe no NLU mas não tem ação no frontend
- `tarefa.atribuir` — existe no NLU mas schema incompleto
- `financeiro.listar_pagamentos` — existe no NLU mas sem schema
- `financeiro.listar_despesas` — existe no NLU mas sem schema

### ❌ Intents no NLU que NÃO EXISTEM no ActionExecutor (desencontro):
- `whatsapp.responder_cliente` — existe no NLU mas ActionExecutor não tem essa ação específica

---

## 20. RESUMO DOS DOMÍNIOS CRÍTICOS (0 intents no NLU)

| Domínio | Ações no ActionExecutor | Impacto |
|---------|------------------------|---------|
| Leads | 8 | 🚨 CRÍTICO — pipeline de vendas inacessível por voz |
| Clientes | 6 | 🚨 CRÍTICO — CRM inacessível |
| Workspace | 5 | 🚨 CRÍTICO — filesystem inacessível |
| Instagram | 3 | 🔴 ALTO — integração social |
| GitHub | 2 | 🔴 ALTO — DevOps inacessível |
| Vercel | 1 | 🔴 ALTO — deploys inacessíveis |
| Segurança | 4 | 🔴 ALTO — alertas inacessíveis |
| Operações | 4 | 🔴 ALTO — ops center inacessível |

---

## 21. RECOMENDAÇÃO DE PRIORIDADE

### FASE A — CRÍTICO (domínios com 0 intents):
1. Leads (8 intents)
2. Clientes (6 intents)
3. Workspace (8 intents)
4. Tarefas (expandir de 5 para 15)

### FASE B — ALTO (gaps médios):
5. Email (expandir de 10 para 25+)
6. Financeiro (expandir de 5 para 20)
7. Sistema (expandir de 3 para 10)

### FASE C — MÉDIO (domínios incompletos):
8. Projetos (expandir de 2 para 7)
9. Orçamentos (expandir de 2 para 7)
10. Ideias (expandir de 2 para 8)
11. WhatsApp (expandir de 3 para 9)

### FASE D — BAIXO (domínios menores):
12. Instagram, GitHub, Vercel, Segurança, Operações

---

## TOTAL ESTIMADO DE INTENTS FALTANDO: ~120+

**Pergunta:** Quer que eu implemente tudo? Ou prefere escolher uma fase específica?
