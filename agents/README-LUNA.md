# 🌙 Luna CLI v3.1

Terminal UI agente autônomo para Abner Gabriel (CEO NEXO DIGITAL S.L., Barcelona).

Conecta ao **Kimi Web** via Playwright CDP e controla o PC com 32+ ferramentas nativas.

## 🚀 Instalação Rápida

```bash
curl -fsSL https://raw.githubusercontent.com/Jhin1v9/NexoDashboard/main/install-luna.sh | bash
```

Ou manualmente:

```bash
git clone https://github.com/Jhin1v9/NexoDashboard.git ~/NEXO_DASHBOARD_PRO
cd ~/NEXO_DASHBOARD_PRO/agents
npm install
ln -s ~/NEXO_DASHBOARD_PRO/agents/luna-tui.mjs ~/.local/bin/luna
```

## 🔐 Primeiro Uso (Login)

```bash
luna
# Dentro do TUI, digite:
/login
```

O `/login` vai:
1. Verificar se Chrome está rodando com `--remote-debugging-port=9222`
2. Se não estiver, iniciar o Chrome automaticamente
3. Abrir kimi.com e verificar se você está logado
4. Se não estiver logado, navegar para a página de login

**Faça login manualmente no Chrome que abriu.** Depois disso, a Luna está pronta.

## 🖥️ Interface

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🌙 Luna │ Nova sessão │ a1b2c3d4 │ 2 msgs │ default │ thinking │ 🔥YOLO    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  > Você                          17:06:35                                   │
│  oi                                                                         │
│                                                                             │
│  🌙 Luna                         17:06:56                                   │
│  Oi, Abner! 🌙 Luna aqui. Pronta pra te ajudar.                           │
│                                                                             │
│  📖 readFile                     17:07:10                                   │
│  {"path":"~/Documentos/teste.txt"}                                          │
│    ✅ Sucesso                                                               │
│    1 │ Olá, sou a Luna!                                                     │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ ❯ digite aqui...                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ 🟢 online │ thinking │ ctx: ████░░░░ 15% │ 12.3k/200k │ ⏱ 04:32 │ 8 msgs  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## ⌨️ Comandos

| Comando | Ação |
|---------|------|
| `/login` | Inicia Chrome e verifica login no Kimi |
| `/status` | Status do sistema |
| `/yolo` | Toggle modo sem confirmação |
| `/novo` | Nova sessão |
| `/limpar` | Limpa contexto |
| `/modo <nome>` | Muda persona |
| `/skills` | Lista skills |
| `/help` | Ajuda |
| `Ctrl+S` | Steer (interromper/responder mid-flight) |
| `Ctrl+V` | Colar do clipboard |
| `Ctrl+H` | Toggle ajuda |
| `Ctrl+C` | Sair |

## 🛠️ Ferramentas (32+)

| Categoria | Ferramentas |
|-----------|-------------|
| **Arquivo** | `readFile`, `writeFile`, `appendFile`, `replaceInFile`, `deleteFile`, `moveFile`, `copyFile`, `getFileInfo` |
| **Diretório** | `listFiles`, `viewDirectory`, `createDirectory`, `removeDirectory` |
| **Busca** | `searchFiles`, `grep`, `glob`, `searchWeb`, `fetchURL` |
| **Shell** | `executeShell`, `runTests`, `checkSyntax`, `installPackages` |
| **Git** | `gitStatus`, `gitDiff`, `gitLog`, `gitCommit` |
| **Utilidades** | `applyPatch`, `downloadFile`, `clipboardRead`, `clipboardWrite`, `readMediaFile` |
| **Raciocínio** | `think` |
| **Desktop** | `shell`, `click`, `type`, `keypress`, `hotkey`, `screenshot`, `scroll`, `wait`, `open_app`, `ocr` |

## 🧠 Arquitetura

```
Usuário → TUI (Ink + React)
            ↓
        LunaSoul (orquestrador)
            ↓
    KimiBridge (Playwright CDP)  ←→  Kimi Web (cérebro)
            ↓
        luna-tools.cjs (32 ferramentas)
```

## 📦 Dependências

- Node.js v18+
- Google Chrome / Chromium
- xclip (para clipboard)
- npm packages: `ink`, `react`, `playwright`, `glob`, `turndown`

## ⚙️ Variáveis de Ambiente

| Variável | Default | Descrição |
|----------|---------|-----------|
| `KIMI_CDP_URL` | `http://localhost:9222` | URL do Chrome DevTools Protocol |
| `KIMI_TIMEOUT` | `120000` | Timeout padrão (ms) |
| `KIMI_MAX_PAGES` | `5` | Máximo de páginas concorrentes |
| `KIMI_IDLE_TIMEOUT` | `600000` | Tempo para fechar página inativa (ms) |

## 📝 Licença

Proprietário — NEXO DIGITAL S.L.
