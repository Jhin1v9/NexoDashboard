# Ideia Futura: Kimi Code no Telegram — Luna como IDE Inteligente

> **Status:** Pesquisa arquitetural | **Prioridade:** Alta (pós-MVP Computer Use)
> **Visão:** Transformar o chat privado com @lunanexobot em uma experiência equivalente ao Kimi Code CLI / Claude Code / Aider — mas via Telegram, controlando o PC local.

---

## 1. CONCEITO

Hoje, o Kimi Code CLI (eu) permite ao usuário:
- Editar arquivos de código
- Analisar diretórios inteiros
- Executar comandos no terminal
- Fazer perguntas sobre o codebase

A ideia é trazer essa experiência para o Telegram:
- **Abner manda mensagem:** "analisa o dashboard e melhora o CSS do botão de login"
- **Luna:**
  1. Lê os arquivos do projeto (`~/NEXO_DASHBOARD_PRO/frontend/src/components/Login.jsx`, etc.)
  2. Envia o código + contexto para a Kimi Web
  3. Recebe a edição proposta
  4. Aplica a edição no arquivo local
  5. Executa build/teste para verificar
  6. Reporta resultado no Telegram

---

## 2. MODOS DE OPERAÇÃO

### 2.1 Modo YOLO ("Confiar em tudo")

O usuário pode ativar um modo onde o agente executa **TODAS as ações** sem pedir confirmação.

```
Usuário: /modo_yolo on
Luna: ⚡ Modo YOLO ativado. Vou executar todas as ações sem confirmar.
       Use /modo_yolo off para desativar.

Usuário: Remove o componente deprecated do dashboard e atualiza os imports
Luna: [executa tudo automaticamente]
      ✅ Componente removido
      ✅ 3 imports atualizados
      ✅ Build passou
      ✅ Testes passaram
```

**Níveis de YOLO:**
| Nível | Descrição | Quem usa |
|-------|-----------|----------|
| **YOLO_SAFE** | Só ações SAFE (read-only, edits simples) | Padrão para usuários novos |
| **YOLO_MODERATE** | Inclui writes, renomeações, deleções | Usuários confiantes |
| **YOLO_FULL** | TUDO — inclui git push, deploy, instalação | Apenas Abner (admin) |

**Persistência:** O modo YOLO é por sessão (reset após 30min de inatividade) ou até o usuário desativar.

**Auditoria:** TODAS as ações em YOLO são logadas em arquivo append-only para revisão.

### 2.2 Modo Assisted (atual)

Modo padrão — cada ação destrutiva requer confirmação.

---

## 3. ARQUITETURA PROPOSTA — "Workspace Context Pipeline"

### 3.1 Visão Geral

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         KIMI CODE NO TELEGRAM v1.0                          │
│                                                                             │
│  Usuário (Telegram DM)                                                      │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │   PARSER    │───→│   INTENT     │───→│   ROUTER     │                   │
│  │   (NLP)     │    │  CLASSIFIER  │    │              │                   │
│  │             │    │              │    │ • code_edit  │                   │
│  │ "melhora    │    │ • code_edit  │───→│ • analyze    │                   │
│  │  o login"   │    │ • analyze    │    │ • execute    │                   │
│  │             │    │ • execute    │    │ • search     │                   │
│  │             │    │ • search     │    │ • question   │                   │
│  └─────────────┘    └──────────────┘    └──────┬───────┘                   │
│                                                  │                          │
│                    ┌─────────────────────────────┘                          │
│                    │                                                        │
│         ┌──────────▼──────────┐           ┌──────────────▼──────────────┐  │
│         │  WORKSPACE ENGINE   │           │      KIMI WEB (Bridge)      │  │
│         │  (Context Builder)  │◄─────────→│      (Raciocínio + Edição)  │  │
│         │                     │  (arquivos│                             │  │
│         │ • File tree scan    │  + diff)  │ • Analisa código            │  │
│         │ • Git status        │           │ • Propõe edições            │  │
│         │ • Recent changes    │           │ • Gera patches              │  │
│         │ • Selective read    │           │ • Explica mudanças          │  │
│         │ • Apply edits       │           │                             │  │
│         │ • Run tests/build   │           │                             │  │
│         └─────────────────────┘           └─────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Componentes

#### A. Intent Classifier

Classifica a intenção do usuário em categorias:

```javascript
const INTENTS = {
  CODE_EDIT: 'edita código (arquivos específicos ou geral)',
  ANALYZE: 'analisa código/dashboard/sistema',
  EXECUTE: 'executa comando no PC',
  SEARCH: 'procura arquivo/símbolo no projeto',
  QUESTION: 'pergunta sobre o projeto (não executa)',
  REFACTOR: 'refatora código (renomeia, move, extrai)',
  DEBUG: 'depura erro (logs, stack traces)',
};
```

**Implementação:**
- Regex/heurísticas rápidas para 80% dos casos
- Fallback para Kimi Web (mode: instant) quando incerto

#### B. Workspace Engine (Context Builder)

Responsável por:
1. **File Tree Scan** — mapear estrutura do projeto
2. **Selective File Read** — ler apenas arquivos relevantes
3. **Git Context** — status, diff, branch, últimos commits
4. **Recent Changes** — arquivos modificados recentemente
5. **Apply Edits** — aplicar patches/edições nos arquivos
6. **Run Commands** — build, test, lint

**File Tree Scan:**
```javascript
async function scanWorkspace(rootPath, options = {}) {
  // Ignora: node_modules, .git, build, dist, .env
  // Limita: max 1000 arquivos, max 50MB total
  // Prioriza: arquivos recentes, arquivos com "TODO", arquivos modificados no git
}
```

**Selective File Read (CRÍTICO):**
Não podemos enviar 10MB de código para a Kimi Web. Precisamos de estratégia inteligente:

```javascript
async function readFilesForContext(query, fileTree) {
  // Estratégia 1: Se usuário mencionou arquivo específico
  // → Ler apenas esse arquivo
  
  // Estratégia 2: Se usuário pediu análise geral
  // → Ler arquivos de entrada (index, main, app)
  // + arquivos modificados recentemente
  // + arquivos com mais linhas (provavelmente importantes)
  
  // Estratégia 3: Se usuário pediu feature específica
  // → Buscar por keywords no nome do arquivo e conteúdo
  // → Ler matches + dependências
  
  // Limites: max 20 arquivos, max 8000 linhas, max 50KB de texto
}
```

**Apply Edits (PATCH SYSTEM):**
A Kimi Web responde com edições em formato patch ou "search/replace":

```json
{
  "thought": "O botão de login precisa de mais contraste",
  "edits": [
    {
      "file": "frontend/src/components/LoginButton.css",
      "search": ".login-btn {\n  background: #333;\n  color: #666;\n}",
      "replace": ".login-btn {\n  background: var(--gold);\n  color: #000;\n  font-weight: 600;\n}"
    }
  ],
  "commands": ["npm run build"],
  "message": "Aumentei o contraste do botão de login usando a cor dourada da marca."
}
```

O Workspace Engine aplica cada edit:
1. Valida que o `search` existe no arquivo
2. Substitui por `replace`
3. Salva backup (.bak)
4. Executa comandos (build/test)
5. Reporta resultado

#### C. Git Integration

```javascript
// Antes de qualquer edição em YOLO mode:
// 1. Verifica se há mudanças não commitadas
// 2. Se houver, cria stash automático
// 3. Aplica edições
// 4. Se falhar, restaura do stash

async function safeEdit(filePath, edit) {
  const stashName = `luna-auto-${Date.now()}`;
  await gitStash(stashName);
  try {
    applyEdit(filePath, edit);
    return { success: true };
  } catch (err) {
    await gitStashPop(stashName);
    return { success: false, error: err.message };
  }
}
```

---

## 4. FLUXOS DE USO

### 4.1 Editar Código

```
Usuário: "O botão de login do dashboard tá feio, deixa ele dourado"

Luna:
  1. Intent: CODE_EDIT (arquivo: login/css, ação: mudar cor)
  2. Workspace Engine:
     - Busca arquivos com "login" no nome
     - Encontra: LoginButton.jsx, LoginButton.css, LoginPage.jsx
     - Lê os 3 arquivos (500 linhas total)
  3. Envia para Kimi Web:
     "[CONTEXT] Arquivos do login: [conteúdo]
      [TASK] Deixar o botão de login dourado (#c9a96e) com melhor contraste"
  4. Kimi Web responde com edits JSON
  5. Workspace Engine:
     - Aplica edits
     - Executa `npm run build` (se houver)
     - Tira screenshot do resultado (se for visual)
  6. Responde no Telegram:
     "✅ Botão de login atualizado!
     📁 Arquivo: LoginButton.css
     📝 Mudanças: background → #c9a96e, color → #000, font-weight → 600
     🔨 Build: OK
     📸 [screenshot do resultado]"
```

### 4.2 Analisar Dashboard

```
Usuário: "Analisa o dashboard e me diz o que pode melhorar"

Luna:
  1. Intent: ANALYZE (escopo: projeto/dashboard)
  2. Workspace Engine:
     - Scaneia estrutura de frontend/src
     - Lê componentes principais (App, Dashboard, Sidebar, Header)
     - Lê package.json (dependências, scripts)
     - Lê últimos commits (o que mudou recentemente)
  3. Envia para Kimi Web:
     "[CONTEXT] Estrutura do projeto + arquivos principais + dependências
      [TASK] Analise o dashboard e sugira melhorias de UX/performance/código"
  4. Kimi Web responde com análise detalhada
  5. Luna formata e envia no Telegram (com markdown)
```

### 4.3 Refatorar

```
Usuário: "Extrai esse componente gigante em arquivos menores"

Luna:
  1. Intent: REFACTOR
  2. Pede arquivo específico (se não mencionado)
  3. Analisa dependências internas
  4. Propõe estrutura nova
  5. Aplica mudanças em múltiplos arquivos
  6. Atualiza imports
  7. Roda testes
```

---

## 5. IMPLEMENTAÇÃO — ORDEM SUGERIDA

### Fase 1: Workspace Engine Básico (1 semana)
- File tree scanner
- Selective file reader
- Git status reader
- Context formatter (envia para Kimi)

### Fase 2: Apply Edits + YOLO Mode (1 semana)
- Patch system (search/replace)
- Git stash/backup automático
- Modo YOLO com níveis
- Auditoria de ações

### Fase 3: Intent Classifier + Integração Telegram (1 semana)
- Classificador de intenções
- Integração com os handlers existentes do bot
- Comando `/modo_yolo on/off`
- Comando `/contexto` para ver o que está no contexto

### Fase 4: Features Avançadas (futuro)
- Symbol search (encontrar funções/classes)
- Debug mode (analisar stack traces, logs)
- Multi-file refactoring
- Test runner integration
- Linter integration

---

## 6. TECNOLOGIAS E REFERÊNCIAS

### Inspirado em:
- **Claude Code** (Anthropic) — `claude.ai/code`
- **Aider** — `aider.chat` — AI pair programming no terminal
- **GitHub Copilot Chat** — chat inline no VSCode
- **Continue.dev** — open-source AI code assistant

### Bibliotecas úteis:
- `ripgrep` (rg) — busca rápida em código
- `tree-sitter` — parsing de AST para entender estrutura do código
- `git-diff` / `git-apply` — para patch system
- `globby` — file scanning
- `fs-extra` — operações de arquivo com backup

### Estratégia de contexto (aprendido com Aider):
Aider usa um sistema de "repo map" — um mapa do repositório que inclui:
- Lista de todos os arquivos
- Árvore de imports/dependências
- Assinaturas de funções/classes (sem corpo)
- Isso permite à IA "entender" o projeto sem ler todos os arquivos

Podemos implementar algo similar:
```javascript
// Repo Map — gerado uma vez por sessão
const repoMap = {
  files: [
    { path: 'backend/server.js', size: 1200, exports: ['app', 'startServer'] },
    { path: 'frontend/src/App.jsx', size: 800, imports: ['react', './Dashboard'] },
  ],
  symbols: [
    { name: 'processLunaChatRequest', file: 'backend/server.js', type: 'function' },
    { name: 'KimiBridge', file: 'agents/kimi-bridge.cjs', type: 'class' },
  ]
};
```

---

## 7. PROMPTS PARA KIMI WEB

### Prompt de Análise de Código

```
Você é um engenheiro sênior analisando o código do projeto NEXO Dashboard.

[REPO_MAP]
{{REPO_MAP}}

[ARQUIVOS RELEVANTES]
{{FILE_CONTENTS}}

[PERGUNTA DO USUÁRIO]
{{USER_QUESTION}}

Responda em JSON:
{
  "analysis": "análise detalhada",
  "suggestions": ["sugestão 1", "sugestão 2"],
  "edits": [
    {"file": "path", "search": "texto", "replace": "novo texto"}
  ],
  "message": "resposta para o usuário"
}
```

### Prompt de Edição de Código

```
Você é o Kimi Code — editor de código da equipe NEXO Digital.

[ARQUIVO ATUAL]
{{FILE_PATH}}
```
{{FILE_CONTENT}}
```

[TAREFA]
{{USER_TASK}}

Regras:
1. Responda APENAS com o novo conteúdo do arquivo
2. Não altere nada além do necessário
3. Mantenha formatação e estilo consistentes
4. Se não tiver certeza, retorne o arquivo original
```

---

## 8. RISCOS E MITIGAÇÕES

| Risco | Mitigação |
|-------|-----------|
| Kimi Web propõe código quebrado | Sempre rodar build/test antes de confirmar |
| Edição em arquivo errado | Validar `search` antes de `replace` |
| Loop infinito de edições | Max 10 iterações por sessão |
| Perda de código | Git stash automático antes de toda edição |
| Contexto muito grande | Limitar a 20 arquivos / 8000 linhas |
| Kimi Web alucina | Validar JSON, fallback para texto |
| YOLO mode destrói projeto | YOLO_FULL só para admin, backup automático |

---

## 9. PRÓXIMO PASSO

Quando o MVP do Computer Use Agent estiver estável (Fase 4 do plano), iniciar a **Fase 1 do Workspace Engine** — scanner de arquivos + selective reader + context formatter.

Isso transforma o @lunanexobot de "assistente que executa comandos" para "engenheiro de software completo que entende seu codebase".
