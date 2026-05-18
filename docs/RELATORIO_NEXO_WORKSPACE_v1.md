# 🚀 RELATÓRIO NEXO WORKSPACE v1.0
## Evolução da Ideia: Sistema de Arquivos por Cliente + Execução Local

> Data: 18/05/2026 | Pesquisa: 15+ referências de mercado

---

## 📸 ASSETS VISUAIS

As imagens da Luna foram adicionadas ao projeto:
- `public/luna-avatar.png` — Avatar circular oficial da Luna (uso em chat, sidebar, perfil)
- `public/luna-hero.png` — Banner conceitual do dashboard da Luna (uso em landing, hero sections)

---

## 💡 A IDEIA ORIGINAL (Resumo do Cliente)

> "Quero criar um estilo de file, arquivos, tipo do Linux, organizado por cliente. Dentro do cliente tem demos, documentos, orçamentos. O dashboard vai saber se é HTML, Vite ou React e vai criar um botão pra executar local. Se for HTML abre direto, se for React dá npm run dev, instala dependências se precisar, abre o CMD externo e um botão de fechar servidor."

---

## 🔬 PESQUISA DE MERCADO — Referências Analisadas

### 1. **Productive.io** — Client Portal All-in-One
- Cliente vê progresso, arquivos, orçamentos em um portal dedicado
- Permissões customizáveis por cliente
- Dashboards com widgets de status
- **O que pegar:** Portal por cliente com visão customizada

### 2. **SuperOkay** — Creative Agency Portal
- Interface limpa para freelancers/agências
- Embed de apps (Figma, Dropbox, Google Drive)
- Documentos interativos e propostas
- Templates reutilizáveis
- **O que pegar:** Embed de previews + templates de documentos

### 3. **Dock** — White-label Client Workspace
- Portais white-label com marca da agência
- Multi-phase task checklists
- Analytics de engajamento (quem viu o quê)
- In-portal messaging
- **O que pegar:** Analytics de visualização + checklist de entregas

### 4. **Clustdoc** — Client File Organization
- Estrutura de pastas por cliente
- Document collection workflows
- Naming conventions automatizadas
- **O que pegar:** Estrutura hierárquica de pastas + naming conventions

### 5. **Assembly** — Branded Client Portal
- CRM + portal + billing em um só
- AI Assistant que resume atividades do cliente
- Contratos, invoices, files em um workspace
- **O que pegar:** AI summaries + centralização de tudo por cliente

### 6. **Scoro** — Agency Operations
- "Quoted vs Actual" table em tempo real
- 47 templates de relatórios pré-built
- Client portal com aprovação de orçamentos
- **O que pegar:** Tracking de orçamento vs real + aprovações

### 7. **Notion** — Flexible Content Hubs
- Bases de dados ligadas
- Múltiplas views (Kanban, lista, calendário)
- Wikis e documentação viva
- **O que pegar:** Databases ligados por cliente + múltiplas views

### 8. **Brandfolder** — Digital Asset Management
- Taxonomia de assets com metadados
- Tags e campos customizados
- Version control automático
- **O que pegar:** Metadata tagging + versionamento de arquivos

### 9. **Codux** — Visual IDE
- Edição visual de projetos React
- Preview em tempo real
- Integração com Vite
- **O que pegar:** Preview integrado + hot reload visual

### 10. **Vite Dev Server**
- Porta 5173 padrão
- Hot Module Replacement (HMR)
- `npm run dev` / `vite preview`
- **O que pegar:** Execução local como padrão de mercado

---

## 🧬 EVOLUÇÃO DA IDEIA — NEXO WORKSPACE

### Conceito Central
**"Cada cliente é um universo. Dentro dele, tudo vive organizado."**

A NEXO Digital precisa de um **Workspace por Cliente** que funcione como um sistema operacional miniatura — onde arquivos, demos, orçamentos, contratos e comunicações vivem em um só lugar, com execução local de projetos.

---

## 🏗️ ARQUITETURA PROPOSTA

```
📁 NEXO_BASE_PATH (ex: C:\Users\...\Documents\NEXO DIGITAL)
│
├── 📁 CLIENTES/
│   ├── 📁 Jesse — Onadance/
│   │   ├── 📁 01_orcamentos/
│   │   │   ├── orcamento-inicial-v1.pdf
│   │   │   ├── orcamento-revisado-v2.pdf
│   │   │   └── (aprovado) orcamento-final-v3.pdf
│   │   ├── 📁 02_contratos/
│   │   │   ├── contrato-servicos-2026.pdf
│   │   │   └── nda-assinado.pdf
│   │   ├── 📁 03_briefings/
│   │   │   ├── briefing-inicial.docx
│   │   │   └── referencias-visuais/
│   │   ├── 📁 04_design/
│   │   │   ├── 📁 figma-exports/
│   │   │   ├── 📁 mockups/
│   │   │   └── style-guide.pdf
│   │   ├── 📁 05_demos/
│   │   │   ├── 📁 site-v1-html/          ← HTML → abre no navegador
│   │   │   ├── 📁 dashboard-vite/        ← Vite → npm run dev
│   │   │   └── 📁 app-react-native/      ← React Native → metro start
│   │   ├── 📁 06_documentacao/
│   │   │   ├── api-docs.md
│   │   │   └── changelog.md
│   │   ├── 📁 07_entregas/
│   │   │   ├── entrega-fase-1.zip
│   │   │   └── entrega-fase-2.zip
│   │   └── 📄 cliente.json               ← metadata do cliente
│   │
│   ├── 📁 Paulo — Santafe Construcciones/
│   │   ├── 📁 01_orcamentos/
│   │   ├── 📁 02_contratos/
│   │   ├── 📁 05_demos/
│   │   │   └── 📁 site-wordpress/        ← WordPress → local server
│   │   └── 📄 cliente.json
│   │
│   └── 📁 Juan — Tropicale/
│       ├── 📁 01_orcamentos/
│       ├── 📁 05_demos/
│       │   └── 📁 tpv-sistema/           ← React + Electron → npm run dev
│       └── 📄 cliente.json
│
└── 📁 .nexo/
    ├── 📄 workspace-index.json            ← índice de todos os projetos
    ├── 📄 dev-servers.json                ← servidores locais rodando
    └── 📄 recent-files.json               ← arquivos recentemente abertos
```

---

## 🎯 FUNCIONALIDADES EVOLUÍDAS

### 1. FILE MANAGER ESTILO LINUX + MAC FINDER

**Interface:**
- **Sidebar:** Lista de clientes com ícone de pasta
- **Breadcrumbs:** `Clientes > Jesse > 05_demos > site-v1-html`
- **View modes:** Ícone (grid), Lista (detalhes), Colunas (estilo Finder)
- **Preview pane:** Ao clicar em um arquivo, mostra preview no lado direito
- **Ações rápidas:**
  - 🖱️ Duplo-clique: abre/preview
  - 📋 Copiar/Colar/Colar caminho
  - 🗑️ Mover para lixo (soft delete)
  - ⭐ Favoritar
  - 🔗 Copiar link compartilhável

**Tipos de arquivo suportados:**
| Tipo | Preview | Ação principal |
|------|---------|----------------|
| HTML | Iframe embutido | Abrir no navegador |
| PDF | PDF.js embutido | Abrir no leitor |
| IMG | Lightbox | Abrir em nova aba |
| MP4 | Player de vídeo | Play inline |
| ZIP | Lista de conteúdo | Extrair aqui |
| JSON/YAML/Markdown | Editor com syntax highlight | Editar inline |
| JS/TS/CSS | Code preview | Abrir no VS Code |

---

### 2. DETECÇÃO INTELIGENTE DE PROJETOS + EXECUÇÃO LOCAL

**Como o sistema detecta o tipo de projeto:**

```javascript
// Algoritmo de detecção
function detectProjectType(folderPath) {
  const files = fs.readdirSync(folderPath);
  
  if (files.includes('package.json')) {
    const pkg = JSON.parse(fs.readFileSync(path.join(folderPath, 'package.json')));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    
    if (deps['react-native'] || deps['expo']) return 'react-native';
    if (deps['next']) return 'nextjs';
    if (deps['react']) return 'react';
    if (deps['vue']) return 'vue';
    if (deps['svelte']) return 'svelte';
    if (deps['angular']) return 'angular';
    if (deps['electron']) return 'electron';
    return 'node-generic';
  }
  
  if (files.includes('index.html')) return 'static-html';
  if (files.some(f => f.endsWith('.php'))) return 'php';
  if (files.includes('wordpress') || files.includes('wp-content')) return 'wordpress';
  if (files.includes('composer.json')) return 'php-composer';
  
  return 'unknown';
}
```

**Ações por tipo de projeto:**

| Tipo | Script de start | Porta padrão | Comando de execução |
|------|-----------------|--------------|---------------------|
| HTML Estático | `live-server` ou `npx serve` | 8080 | `npx serve .` |
| React (Vite) | `npm run dev` | 5173 | `npm install && npm run dev` |
| React (CRA) | `npm start` | 3000 | `npm install && npm start` |
| Next.js | `npm run dev` | 3000 | `npm install && npm run dev` |
| Vue (Vite) | `npm run dev` | 5173 | `npm install && npm run dev` |
| WordPress | `php -S localhost:8000` | 8000 | `php -S localhost:8000` |
| Python/Flask | `python app.py` | 5000 | `pip install -r requirements.txt && python app.py` |
| React Native | `npx react-native start` | 8081 | `npm install && npx react-native start` |
| Electron | `npm run electron:dev` | — | `npm install && npm run electron:dev` |

**Fluxo de execução:**
1. Usuário clica no botão "▶️ Executar" na pasta do demo
2. Sistema detecta o tipo de projeto
3. Verifica se `node_modules` existe (ou equivalente)
4. Se não existir → roda `npm install` (mostra progresso no painel)
5. Roda o script de start
6. Abre o navegador automaticamente na URL local
7. Mostra no dashboard: "🟢 Site Jesse rodando em http://localhost:5173"
8. Botão "⏹️ Parar servidor" fica disponível

---

### 3. PAINEL DE SERVIDORES LOCAIS

**Widget no Dashboard mostrando:**
```
┌─ Servidores Locais Ativos ──────────────────┐
│ 🟢 Jesse — site-v1-html    http://localhost:8080   [⏹️] [🌐]
│ 🟢 Paulo — site-wordpress  http://localhost:8000   [⏹️] [🌐]
│ 🔴 Juan — tpv-sistema      (parado)              [▶️]
└──────────────────────────────────────────────┘
```

**Features:**
- Status em tempo real (ping a cada 5s)
- Kill switch (mata o processo gracefully)
- Abrir no navegador
- Abrir pasta no explorador de arquivos
- Ver logs do servidor em tempo real (mini terminal embutido)

---

### 4. CLIENTE.JSON — METADATA DO CLIENTE

Cada pasta de cliente tem um `cliente.json`:

```json
{
  "id": "jesse-onadance",
  "nome": "Jesse — Onadance",
  "tipo": "cliente",
  "status": "ativo",
  "dataInicio": "2026-03-15",
  "responsavel": "nonoke",
  "orcamentoTotal": 4500,
  "moeda": "EUR",
  "pagamentos": [
    { "parcela": 1, "valor": 1500, "status": "pago", "data": "2026-03-15" },
    { "parcela": 2, "valor": 1500, "status": "pendente", "data": "2026-04-15" },
    { "parcela": 3, "valor": 1500, "status": "pendente", "data": "2026-05-15" }
  ],
  "demos": [
    { "nome": "site-v1-html", "tipo": "static-html", "status": "entregue", "data": "2026-03-20" },
    { "nome": "dashboard-vite", "tipo": "react-vite", "status": "em-desenvolvimento", "data": "2026-05-01" }
  ],
  "documentos": {
    "orcamentos": 3,
    "contratos": 1,
    "briefings": 2
  },
  "cor": "#8b5cf6",
  "logo": "./assets/logo-onadance.png",
  "tags": ["danca", "app", "react-native"],
  "anotacoes": "Cliente quer lançar em junho. Prioridade alta."
}
```

---

### 5. WORKSPACE INDEX — ÍNDICE GLOBAL

```json
{
  "versao": "1.0",
  "ultimaAtualizacao": "2026-05-18T23:00:00Z",
  "clientes": [
    {
      "id": "jesse-onadance",
      "nome": "Jesse — Onadance",
      "caminho": "CLIENTES/Jesse — Onadance",
      "status": "ativo",
      "cor": "#8b5cf6",
      "demosAtivas": 2,
      "servidoresAtivos": 1
    },
    {
      "id": "paulo-santafe",
      "nome": "Paulo — Santafe Construcciones",
      "caminho": "CLIENTES/Paulo — Santafe Construcciones",
      "status": "ativo",
      "cor": "#22c55e",
      "demosAtivas": 1,
      "servidoresAtivos": 0
    }
  ],
  "servidoresAtivos": [
    {
      "id": "srv-jesse-html-001",
      "clienteId": "jesse-onadance",
      "demoNome": "site-v1-html",
      "tipo": "static-html",
      "porta": 8080,
      "url": "http://localhost:8080",
      "pid": 12345,
      "iniciadoEm": "2026-05-18T22:30:00Z"
    }
  ],
  "estatisticas": {
    "totalClientes": 5,
    "clientesAtivos": 4,
    "demosTotais": 12,
    "servidoresRodando": 2,
    "orcamentosPendentes": 3
  }
}
```

---

## 🎨 INTERFACE PROPOSTA

### Sidebar — Nova Organização

```
┌─ NEXO WORKSPACE ───────────────┐
│ 🏠 Dashboard                    │
│ 📊 Operações                    │
│ 📁 CLIENTES  ▼                  │
│   📂 Jesse — Onadance          │
│     ├─ 📄 Orçamentos (3)       │
│     ├─ 📄 Contratos (1)        │
│     ├─ 🎨 Design               │
│     ├─ 🚀 Demos (2)            │
│     │   ├─ 🌐 site-v1-html     │
│     │   └─ ⚡ dashboard-vite   │
│     └─ 📦 Entregas             │
│   📂 Paulo — Santafe           │
│   📂 Juan — Tropicale          │
│   📂 Maria — Superclim         │
│                                 │
│ 💰 Financeiro                   │
│ 📋 Tarefas                      │
│ 💡 Ideias                       │
│ 📱 WhatsApp                     │
│ 🌙 Luna Chat  🤖               │ ← NOVO: Luna no sidebar
│ ⚙️ Sistema                      │
└─────────────────────────────────┘
```

### Página do Cliente — Layout

```
┌─ Jesse — Onadance ──────────────────────────── [Editar] [Exportar] ─┐
│                                                                     │
│  🟣 #8b5cf6    Responsável: Nonoke    Status: Ativo    Desde: Mar │
│                                                                     │
│  ┌─ Tabs: Overview | Orçamentos | Demos | Documentos | Chat ──────┐│
│                                                                     │
│  ┌─ Progresso do Projeto ─────────┐  ┌─ Demos ───────────────────┐│
│  │ ████████████░░ 75% Completo    │  │ 🌐 site-v1-html            ││
│  │                                 │  │    [▶️ Executar] [📂]     ││
│  │ Fase 1: ✅ Design               │  │ ⚡ dashboard-vite          ││
│  │ Fase 2: ✅ Desenvolvimento      │  │    [⏹️ Parar] [🌐] [📂]   ││
│  │ Fase 3: 🔄 Testes               │  └───────────────────────────┘│
│  │ Fase 4: ⬜ Deploy               │  ┌─ Orçamentos ──────────────┐│
│  │                                 │  │ 📄 v1 — €4.500 (aprovado) ││
│  │ Próxima entrega: 25 Mai         │  │ 📄 v2 — €5.200 (revisão)  ││
│  └─────────────────────────────────┘  └───────────────────────────┘│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🤖 LUNA CHAT — NOVA POSIÇÃO

### Mudança proposta:
- **De:** Página dedicada `/luna` acessível pelo menu
- **Para:** Item "🌙 Luna Chat" no **sidebar principal**
- **Comportamento:** Abre um painel slide-out (estilo chat do Slack/Discord) à direita

### Interface do Chat:
```
┌─ 🌙 Luna — Assistente NEXO ──── [✕] ─┐
│                                       │
│  ┌─ Mensagens ──────────────────────┐ │
│  │ 🤖 Luna: Olá! Como posso ajudar? │ │
│  │ 👤 Abner: Status do projeto Jesse?│ │
│  │ 🤖 Luna: 75% completo. Fase 3.   │ │
│  └───────────────────────────────────┘ │
│                                       │
│  [📎] [🎤] Digite sua mensagem... [➤] │
└───────────────────────────────────────┘
```

**Foto da Luna:** `luna-avatar.png` usada no avatar do bot.

---

## 📊 COMPARATIVO — O QUE EXISTE vs O QUE VAMOS CONSTRUIR

| Feature | Productive | SuperOkay | Dock | **NEXO WORKSPACE** |
|---------|------------|-----------|------|-------------------|
| Portal por cliente | ✅ | ✅ | ✅ | ✅ |
| File manager estilo Linux | ❌ | ❌ | ❌ | ✅ |
| Execução local de demos | ❌ | ❌ | ❌ | ✅ |
| Detecção automática de projeto | ❌ | ❌ | ❌ | ✅ |
| Preview embutido | ⚠️ | ⚠️ | ⚠️ | ✅ |
| Terminal embutido | ❌ | ❌ | ❌ | ✅ |
| AI Assistente (Luna) | ❌ | ❌ | ❌ | ✅ |
| Orçamentos + Financeiro | ✅ | ❌ | ❌ | ✅ (já temos) |
| WhatsApp Integration | ❌ | ❌ | ❌ | ✅ (já temos) |
| Custo | $19-49/mês | $9-29/mês | $custom | **Grátis (self-hosted)** |

---

## 🛠️ PLANO DE IMPLEMENTAÇÃO (Fases)

### Fase 1 — Fundação (2-3h)
- [ ] Criar estrutura de pastas `CLIENTES/` no sistema de arquivos
- [ ] Criar `cliente.json` schema e generator
- [ ] Criar `workspace-index.json` e API de leitura
- [ ] Criar tabela `clients` no PostgreSQL (sincroniza com pasta local)

### Fase 2 — File Manager UI (4-6h)
- [ ] Nova rota `/clientes/:id/workspace`
- [ ] Componente `FileManager` com tree view
- [ ] Breadcrumbs navegáveis
- [ ] Ações: criar pasta, upload arquivo, renomear, deletar
- [ ] Preview pane para arquivos comuns

### Fase 3 — Execução Local (4-6h)
- [ ] Backend: endpoint `/api/workspace/detect` (detecta tipo de projeto)
- [ ] Backend: endpoint `/api/workspace/start` (inicia servidor)
- [ ] Backend: endpoint `/api/workspace/stop` (mata processo)
- [ ] Backend: gerenciador de processos (PID tracking)
- [ ] Frontend: widget "Servidores Ativos" no dashboard
- [ ] Frontend: botões ▶️/⏹️ em cada pasta de demo

### Fase 4 — Luna Chat no Sidebar (2h)
- [ ] Mover link do `/luna` para o sidebar
- [ ] Criar painel slide-out para o chat
- [ ] Usar `luna-avatar.png` como foto do bot
- [ ] Persistir estado do chat (aberto/fechado)

### Fase 5 — Polish (2h)
- [ ] Animações de transição
- [ ] Drag & drop de arquivos
- [ ] Context menu (botão direito)
- [ ] Dark mode consistente
- [ ] Mobile responsive

**Estimativa total: 14-19 horas de desenvolvimento**

---

## 🎯 PRÓXIMA AÇÃO RECOMENDADA

1. **Começar pela Fase 4 (Luna Chat no Sidebar)** — é rápido e dá valor imediato
2. **Depois Fase 1 (Fundação)** — cria a base de dados
3. **Em seguida Fase 2 (File Manager UI)** — o coração do workspace
4. **Por último Fase 3 (Execução Local)** — o diferencial competitivo

---

> **Nota:** Este relatório é um documento vivo. À medida que a NEXO Digital crescer, o NEXO Workspace pode evoluir para incluir features como: versionamento Git integrado, deploy automático para Vercel/Netlify, colaboração em tempo real (multi-user editing), e integração com Figma/Adobe XD.
