# ═══════════════════════════════════════════════════════════════════
# AGENTS.md — NEXO DASHBOARD PRO v16.0
# Documento de contexto para agentes de IA
# Data: 2026-05-05
# Último commit: e7d3986 (main)
# ═══════════════════════════════════════════════════════════════════

## 🏢 EMPRESA

**NEXO DIGITAL S.L.** — Barcelona, Espanha
- **Abner Gabriel Mendes** — CEO & Co-Founder — 34685093192
- **Enoque G Santos Clemente** — CEO & Co-Founder — 34689135159
- **Elias Mendes** — CEO & Co-Founder — 34672953062 (pessoal) / 34624529442 (empresarial/Superclim)

Ownership: 25% cada + 25% reinvestimento NEXO. Todos fullstack.

---

## 🚀 O QUE FOI CONSTRUÍDO HOJE (2026-05-05)

### Backend (server.js)
| # | Feature | Status |
|---|---------|--------|
| 1 | BOM-safe `readJSON()` | ✅ Corrigido — remove BOM automaticamente |
| 2 | Schema APIs v16.0 (8 endpoints) | ✅ `/api/schema/*`, `/api/config/*`, `/api/nexo-state` |
| 3 | Quotes fix | ✅ `QUOTES_FILE` declarado, orçamentos aparecem |
| 4 | Proxy Vite fix | ✅ Sem espaço na URL |
| 5 | `whatsapp-history.json` | ✅ Persistente — acumula TODAS as mensagens |

### Agente Luna (luna-cto-agent.cjs)
| # | Feature | Status |
|---|---------|--------|
| 1 | SmartClassifier v16.0 | ✅ 16 categorias, scoring dinâmico, learning engine |
| 2 | LunaBrain v16.0 | ✅ 7 personalidades, Gemma 2B, estado emocional |
| 3 | `resolveAuthor()` | ✅ Movido para SmartClassifier, exportado/importado |
| 4 | Log de menção com nome real | ✅ Usa `resolveAuthor()` em vez de ID do grupo |
| 5 | @luna vazio — sem ghost entry | ✅ Ignora buffer se mensagem vazia |
| 6 | @luna + msg marcada | ✅ Detecta `msg.quotedMsg` (mas ainda não inclui na resposta) |
| 7 | `authorName`/`authorRole` no buffer | ✅ Salva nome resolvido no buffer |
| 8 | `/ajuda` | ⚠️ PRECISA VERIFICAR — Copilot deveria ter adicionado 15+ comandos |

### Arquivos Novos
- `agents/SmartClassifier_v16.js` (650 linhas)
- `agents/LunaBrain_v16.js` (611 linhas)
- `backend/data/whatsapp-history.json` (persistente)

---

## 📁 ESTRUTURA DE ARQUIVOS CRÍTICA

```
NEXO_DASHBOARD_PRO/
├── backend/
│   ├── server.js                    ← MODIFICADO (BOM-safe, 8 APIs schema, /api/whatsapp lê history)
│   ├── data/
│   │   ├── luna-buffer.json         ← Agente salva AQUI (3.7KB, tem dados)
│   │   ├── whatsapp-history.json    ← NOVO — histórico persistente de TODAS as mensagens
│   │   ├── whatsapp-agent-data.json ← Dados do agente
│   │   ├── schema/                  ← 7 schemas v16.0 (contacts, clients, projects, groups, version)
│   │   ├── config/                  ← 3 configs (integrations, dashboard, commands)
│   │   └── runtime/                 ← Arquivos gerados pelo agente (NÃO usar luna-buffer.json daqui)
│   └── fix-bom.js                   ← Script de remoção de BOM + backup
├── agents/
│   ├── luna-cto-agent.cjs           ← MODIFICADO (LunaBrain, SmartClassifier, resolveAuthor)
│   ├── SmartClassifier_v16.js       ← NOVO (class SmartClassifier + resolveAuthor)
│   ├── LunaBrain_v16.js             ← NOVO (class LunaBrain — 7 personalidades)
│   └── luna-cto-agent.mjs           ← Wrapper (10 linhas, importa .cjs)
├── frontend/
│   └── src/pages/
│       ├── WhatsApp.jsx             ← MOSTRA IDs esquisitos, "(sem texto)", WHATSAPP=0
│       └── ...                      ← Outras páginas funcionando
└── docs/
    └── AGENTS_v16_ATUALIZADO.md     ← Contexto anterior
```

---

## ⚠️ PROBLEMAS CONHECIDOS (PENDENTES)

| # | Problema | Severidade | Onde corrigir |
|---|----------|-----------|---------------|
| 1 | **Dashboard WhatsApp mostra IDs** (`41433717305344@lid`) | 🔴 Alta | Frontend WhatsApp.jsx — usar `authorName` em vez de `author` |
| 2 | **"(sem texto)" no dashboard** | 🔴 Alta | Frontend — campo `body` vs `text` não alinhado |
| 3 | **WHATSAPP = 0 no dashboard** | 🔴 Alta | Frontend — espera `totalMessages` mas API retorna estrutura nova |
| 4 | **Atividade Recente sem texto** | 🔴 Alta | Frontend — mesmo problema do item 2 |
| 5 | **Gemma 2B dando erro** (`fetch failed`, JSON parse error) | 🟡 Média | Ollama pode estar offline ou Gemma 2B não carregada |
| 6 | **Scan error: Cannot read properties of undefined (reading '0')** | 🟡 Média | Possivelmente array vazio sendo acessado sem proteção |
| 7 | **@luna + msg marcada — não inclui quotedBody na resposta** | 🟡 Média | LunaBrain.generateResponse() não recebe quotedBody |
| 8 | **/ajuda — verificar se mostra 20+ comandos** | 🟡 Média | Testar no grupo WhatsApp |
| 9 | **Alertas (0) no dashboard** | 🟢 Baixa | Não implementado ainda |
| 10 | **Caixa €0 no dashboard** | 🟢 Baixa | Dados mockados/hardcoded no frontend |

---

## 🔧 REGRAS ABSOLUTAS PARA O AGENTE

1. **NUNCA reescreva arquivos inteiros** — use patches cirúrgicos (apply_patch)
2. **NUNCA apague código que funciona** — só adicione/modifique
3. **NUNCA crie código genérico** — baseie-se nos schemas reais do projeto
4. **NUNCA atribua tarefas/decisões** — só os 3 CEOs têm poder hierárquico
5. **SEMPRE valide cruzado** com os 7 schemas antes de entregar
6. **SEMPRE teste** após cada modificação — 1 problema por vez
7. **SEMPRE commit + push** após cada fase funcionando
8. **Idioma da UI: Espanhol** (labels, botões, textos)
9. **Código/variáveis: Inglês** (TypeScript, nomes de funções)
10. **Um arquivo por vez** — revisão brutal (5x) antes de próximo

---

## 🎯 PRÓXIMOS PASSOS RECOMENDADOS

### FASE 1: Frontend WhatsApp (URGENTE)
1. Corrigir WhatsApp.jsx para usar `authorName` em vez de `author`
2. Corrigir campo de texto — usar `body` em vez de `text` (ou ambos)
3. Corrigir WHATSAPP count — alinhar com API `/api/whatsapp`
4. Corrigir Atividade Recente — mesmo fix do item 2

### FASE 2: Gemma 2B / Ollama
5. Verificar se Ollama está rodando (`http://localhost:11434`)
6. Verificar se modelo `gemma2:2b` está carregado
7. Adicionar fallback quando Gemma falhar (usar regex-only)

### FASE 3: Respostas Inteligentes
8. Incluir `quotedBody` no contexto da resposta da Luna
9. Testar @luna + mensagem marcada

### FASE 4: Novas Páginas
10. Configurações do Luna (`/config/luna`)
11. Grupos WhatsApp (`/config/grupos`)
12. Pipeline de Leads (Kanban)

---

## 🤖 ARQUITETURA ATUAL

```
Mensagem WhatsApp
    ↓
Agente Luna (Playwright CDP)
    ↓
SmartClassifier.regex (10ms) — 16 categorias, scoring 40-100
    ↓
├─ Confiança >= 0.85? → Classifica sozinho ✅
├─ Confiança 0.40-0.84? → LunaBrain.gemmaClassify() (200ms)
│   Gemma 2B @ localhost:11434
│   Personalidade ativa (default/focused/playful/nerd/empathetic/morning/night)
└─ Confiança < 0.40? → Fallback genérico
    ↓
Salva em:
  • backend/data/luna-buffer.json (dados do scan atual)
  • backend/data/whatsapp-history.json (histórico persistente)
    ↓
Backend server.js (localhost:3456)
    ↓
Frontend Dashboard (localhost:3457)
```

---

## 📊 CHECKLIST DE VERIFICAÇÃO RÁPIDA

```powershell
# Testar APIs do backend
Invoke-RestMethod -Uri "http://localhost:3456/api/whatsapp" | Select-Object totalMessages, totalNewMessages
Invoke-RestMethod -Uri "http://localhost:3456/api/schema/contacts" | Select-Object success
Invoke-RestMethod -Uri "http://localhost:3456/api/nexo-state" | Select-Object success

# Verificar arquivos
Get-Content "backend/data/whatsapp-history.json" | ConvertFrom-Json | Select-Object -ExpandProperty messages | Measure-Object
Get-Content "backend/data/luna-buffer.json" | ConvertFrom-Json | Select-Object -ExpandProperty newMessages | Measure-Object

# Verificar Gemma 2B
curl http://localhost:11434/api/tags
```

---

## 📝 NOTAS PARA O AGENTE

- O usuário é CEO da NEXO, baseado em Barcelona, fala pt-BR com toques de espanhol
- O usuário prefere **1 arquivo por vez**, com revisão brutal
- O usuário quer **EXTRAORDINÁRIO**, não "bom o suficiente"
- O backend está em `localhost:3456`, frontend em `localhost:3457`
- O agente Luna roda em Windows, usa Chrome CDP (porta 9223)
- Ollama roda em `localhost:11434` com modelo `gemma2:2b`
- WhatsApp Web está logado no perfil "Luna" do Chrome
- **NUNCA** enviar mensagens no grupo do Paulo (regra absoluta)

---

*Gerado automaticamente após sessão de desenvolvimento v16.0*
*Status: Backend ✅ | Agente ✅ | Frontend ⚠️ (precisa de ajustes)*
*Data: 2026-05-05 18:50*
