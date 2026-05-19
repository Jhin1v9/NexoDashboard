# KIMI.MD — NEXO Dashboard Pro

> Este arquivo é contexto operacional, NÃO documentação. Carrega no início de toda sessão. Mantenha curto, opinado e atualizado.
> 
> **🧠 Sistema de persistência:** Este projeto usa `.kimi-context/` para manter contexto entre sessões. LEIA `.kimi-context/handoff.md` e `.kimi-context/index.json` antes de agir.

---

## 0. Princípio Fundamental

> **FOCO É QUALIDADE, NÃO VELOCIDADE.**
>
> O usuário quer escolher a melhor solução de uma vez e não ficar mudando depois.
> SEMPRE priorizar qualidade, robustez e manutenibilidade sobre rapidez de implementação.
> NUNCA sugerir "começar rápido e evoluir depois" sem que o usuário peça explicitamente.
> **NUNCA regredir** — não remover funcionalidades que já funcionam.

---

## 0. Instance Identity

```yaml
active_instance: kimi-10a71fc7
signature: KIMI-10A71FC7 🟡
context_system: .kimi-context/ (v1)
last_updated: 2026-05-19T18:45:00+02:00
```

**Regra para múltiplas instâncias Kimi:**
- Cada instância deve gerar seu próprio `kimi-XXXXXXXX` ID
- NUNCA sobrescreva trabalho de outra instância sem confirmar com o usuário
- Se `index.json` mostrar outra instância como `active`, pergunte antes de continuar

---

## 1. Project Identity

**NEXO Dashboard Pro** — ERP interno da NEXO Digital (empresa de 3 founders: Abner, Nonoke, Elias). Stack Node.js + React. Todos os dados em JSON files (sem banco de dados). Deploy na Render.com free tier.

**Propósito:** Centralizar clientes, projetos, tarefas, WhatsApp (Luna agent), financeiro, leads, pipeline de vendas, **IDEIAS** (brainstorm com IA Gemini), e agora **EMAIL HUB** (integração Gmail + IA).

**Repo GitHub:** `github.com/Jhin1v9/NexoDashboard` (único — `NexoDashboard/` local antigo foi desvinculado do remote)

**Branch de trabalho:** `codex/initial-nexo-dashboard-pro-v16`

---

## 2. Current Focus

### 🎯 Sprint Ativo: Luna v20.0 — NLU Unificado + Fluxo Floating Button

**Status:** ✅ Concluído — build passando, commits até `039ee00` enviados

#### NLU Unificado (LunaFloatingButton ↔ Página /luna) ✅
- [x] **Fluxo dual:** SmartFormModal para intents com formulário + fallback `/api/luna/chat` para consultas
- [x] **Mesmo backend:** Ambos usam NLU (NLP.js) → ActionExecutor → resposta
- [x] **Intents novos:** `social`, `financeiro.listar_pagamentos`, `financeiro.listar_despesas`, `sistema.ajuda`, `sistema.navegar`
- [x] **Saudações:** NLU reconhece "oi luna", "bom dia", "como vai" com score 1.0
- [x] **Corpus expandido:** 30+ novos intents adicionados aos DOMAINS do NLU

#### ActionExecutor v19+ ✅
- [x] **Novas ações:** `ajuda` (mensagem de ajuda completa), `navigate` (redirect)
- [x] **Correção `completeTask`:** Retorna erro quando não acha tarefa (não cria vazia)
- [x] **Correção `buildSummary`:** Fallback `'desconhecida'` para task_done, cases help/navigate
- [x] **`buildConciergeReply`:** Suporta help, navigate, task_done com erro

#### Botão Flutuante (Produção) ✅
- [x] **Sem limitação por página:** Sugestões são globais (5 comandos fixos)
- [x] **Sem debug:** Removido badge `currentModule` do botão e do header
- [x] **Estilo produção:** Gradiente purple, ícone `Wand2`, glow shadow
- [x] **Contexto enviado:** `currentModule` vai pro NLU (melhora precisão sem limitar)

#### Changelog Recuperado ✅
- [x] **18 entradas** recuperadas (tinham sido apagadas, reduzidas para 3)
- [x] **3 entradas novas** mantidas (Workspace v1, Active Learning, Fluxo Unificado)

#### Deploy/Repo ✅
- [x] **NexoDashboard local antigo:** Remote removido (não empurra mais pro GitHub)
- [x] **NEXO_DASHBOARD_PRO:** Único projeto com acesso ao remote
- [x] **Todos os commits enviados:** `039ee00` é o HEAD atual

---

## 3. Arquitetura Crítica

### Backend (Node.js, CommonJS, ~7100 linhas)
- `backend/server.js` — Monolito Express. Endpoint `/api/luna/chat` com NLU → ActionExecutor
- `backend/services/luna-nlu.js` — Motor NLP.js (node-nlp). Corpus PT/ES/CA. Modelo em `backend/data/luna-model.nlp`
- `agents/core/ActionExecutor.js` — 113+ ações. Executa tarefas, pagamentos, emails, etc.
- `agents/core/NLUActionMapper.js` — Mapeia intents NLU → ações do ActionExecutor
- `agents/core/IntentParser.js` — Regex fallback quando NLU não reconhece

### Frontend (React 18, Vite, Tailwind)
- `frontend/src/pages/LunaControl.jsx` — Página `/luna` (terminal + chat + comandos)
- `frontend/src/components/luna/LunaFloatingButton.jsx` — Botão flutuante global (mini-chat)
- `frontend/src/components/luna/SmartFormModal.jsx` — Modal de formulário para intents com fields
- `frontend/src/components/luna/LunaIntentSchemas.js` — Schemas de formulário por intent
- `frontend/src/components/luna/LunaModuleSuggestions.js` — Sugestões globais (não mais por página)

### NLU Flow (prioridade)
1. **NLU** (`node-nlp`) — Score ≥0.5 → executa direto
2. **Regex** (`IntentParser`) — Fallback para padrões conhecidos
3. **LLM** (Gemini) — Fallback social/conversação (API revogada, offline)

---

## 4. Estado Conhecido de Problemas

| Problema | Severidade | Status |
|----------|-----------|--------|
| API Gemini revogada (`AIzaSyCRgGWJemoesHA2V2NlQ2l46ooy0qO7R9g`) | 🔴 Alta | NLU offline cobre 100% dos comandos operacionais |
| `criar rascunho de email` score NLU baixo (0.68) | 🟢 Baixa | Funciona, mas precisa de mais exemplos |
| Email params (`para`, `assunto`) não extraídos de frases naturais | 🟡 Média | `extractEmail()` e `extractAfterKeyword()` existem mas são básicos |
| `concluir tarefa` sem match → avisa "desconhecida" | 🟢 Baixa | Poderia sugerir tarefas similares no futuro |
| Modelo NLU `.nlp` não salvo em disco (treinado em memória) | 🟡 Média | Deleta `backend/data/luna-model.nlp` no deploy para forçar retreinamento |

---

## 5. Decisões de Design (NÃO mude sem confirmar)

1. **SmartFormModal NUNCA deve ser removido** — é a UX principal para criação/edição. Fallback chat só para consultas.
2. **LunaFloatingButton e página `/luna` compartilham o MESMO backend** (`/api/luna/chat`) mas têm UX diferentes.
3. **Nomes dos CEOs:** abner, nonoke (enoque), elias — todos admin. Senha padrão: `7741`.
4. **Dados em JSON files** — NUNCA adicionar banco de dados sem conversar com o usuário.
5. **Qualidade > velocidade** — O usuário odeia retrabalho. Pense duas vezes antes de mudar.

---

## 6. Comandos Úteis

```bash
# Build frontend
cd frontend && npm run build

# Restart backend
kill $(ss -tlnp | grep 3456 | awk '{print $6}' | cut -d',' -f2 | cut -d'=' -f2)
cd backend && nohup node server.js > server.log 2>&1 &

# Login para testes
curl -s -X POST http://localhost:3456/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"abner","password":"7741"}'

# Forçar retreinamento NLU
rm backend/data/luna-model.nlp && restart backend

# Status git
git log --oneline -5 && git status
```

---

## 7. Links Rápidos

- **Render Dashboard:** `dashboard.render.com/web/srv-d85gqt...`
- **App em produção:** `nexodashboard.onrender.com`
- **Repo GitHub:** `github.com/Jhin1v9/NexoDashboard`
- **Branch:** `codex/initial-nexo-dashboard-pro-v16`
