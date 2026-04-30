# 🔥 NEXO DASHBOARD PRO
> **Dashboard operacional da NEXO DIGITAL** — Self-hosted, VPN-only, privado
> **Autor:** Luna 🦀 CTO Virtual
> **Stack:** React 18 + Vite + Tailwind + Express + WebSocket + Recharts

---

## 🎯 O QUE É

Dashboard profissional para gerenciar:
- 📁 **Clientes** — Fichas, projetos, relatórios
- 🚀 **Projetos** — Health score, tendências, status
- ✅ **Tarefas** — Checklist com auto-save
- 💬 **WhatsApp** — Mensagens do grupo Production 2026
- 🐙 **GitHub** — Repos, issues, PRs
- ▲ **Vercel** — Deploys e projetos
- 🔧 **Ferramentas** — CLI tools (gh, vercel, supabase)

---

## 🚀 COMO RODAR (Privado — VPN Only)

### Opção 1: Script Interativo (Recomendado)
```powershell
# Na pasta do projeto:
.\START_VPN.ps1

# Escolha o IP da sua VPN (Tailscale/rede local)
# O script detecta automaticamente
```

### Opção 2: Manual
```powershell
# Definir IP da VPN (ex: Tailscale)
$env:BIND_IP = "100.x.x.x"  # ou IP da rede local
$env:PORT = "3456"
$env:NEXO_BASE_PATH = "C:\Users\Administrator\Documents\NEXO DIGITAL"

cd backend
node server.js

# Acesse: http://100.x.x.x:3456 (de qualquer PC na VPN)
```

### Opção 3: Docker (se tiver instalado)
```powershell
# Criar .env com:
# VPN_IP=100.x.x.x
# NEXO_BASE_PATH=C:\Users\Administrator\Documents\NEXO DIGITAL

docker-compose up -d --build
```

---

## 🔒 SEGURANÇA — Por que não Vercel?

| | Vercel Gratuito | Self-Hosted VPN |
|---|---|---|
| **Privacidade** | ❌ URL pública | ✅ Apenas VPN |
| **Dados clientes** | ❌ Risco de vazamento | ✅ Controle total |
| **Custo** | Grátis (público) | Grátis (privado) |

**NEXO DIGITAL tem dados de clientes.** Self-hosted na VPN é a única forma segura e gratuita.

---

## 📡 ACESSO PARA EQUIPE

Você, Nonoke e seu pai estão na mesma VPN. Para acessar:

1. **No PC do Jhin:** Rodar o dashboard (`START_VPN.ps1`)
2. **Em qualquer PC na VPN:** Abrir navegador em `http://IP_DO_PC_JHIN:3456`

**Para descobrir o IP do PC do Jhin:**
```powershell
ipconfig | findstr "Tailscale"
# ou
ipconfig | findstr "IPv4"
```

---

## 📦 GITHUB REPO PRIVADO

https://github.com/Jhin1v9/nexo-dashboard-pro

---

## 📁 Estrutura

```
NEXO_DASHBOARD_PRO/
├── backend/
│   ├── server.js          # Express + WS + Scanner + AI Predictions
│   └── data/
│       └── tasks.json     # Persistência local
├── frontend/
│   ├── src/
│   │   ├── pages/         # 8 páginas SPA
│   │   │   ├── Dashboard.jsx        # Gráficos + Previsões
│   │   │   ├── Clientes.jsx
│   │   │   ├── Projetos.jsx
│   │   │   ├── Tarefas.jsx           # Auto-save
│   │   │   ├── WhatsApp.jsx
│   │   │   ├── GitHub.jsx
│   │   │   ├── VercelProjects.jsx
│   │   │   └── Ferramentas.jsx       # CLI actions
│   │   ├── components/
│   │   │   ├── charts/    # Recharts
│   │   │   │   ├── HealthTimeline.jsx
│   │   │   │   ├── PortfolioRadar.jsx
│   │   │   │   ├── BugVelocity.jsx
│   │   │   │   └── ClientBurnup.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── TopBar.jsx
│   │   │   └── CommandPalette.jsx    # Ctrl+K
│   │   ├── context/
│   │   │   └── ToastContext.jsx
│   │   └── hooks/
│   │       └── useRealtime.js
│   └── dist/              # Build pronto
├── Dockerfile
├── docker-compose.yml
├── START_VPN.ps1          # Script de inicialização
├── TUTORIAL.md            # Tutorial completo
├── DOCKER_DEPLOY.md       # Deploy com Docker
└── README.md              # Este arquivo
```

---

## 🎨 Design System

- **Glassmorphism** profissional
- **Dark mode** nativo
- **Cores .brain:**
  - 🟢 `#2ed573` — OK/Success
  - 🔴 `#ff4757` — Error/Danger
  - 🟠 `#ffa502` — Warning/Attention
  - 🔵 `#6c5ce7` — Info/Accent
- **Fontes:** Space Grotesk + Inter

---

## 🎯 PRÓXIMOS PASSOS

- [ ] Autenticar GitHub CLI (`gh auth login`)
- [ ] Configurar deploy automático (GitHub Actions)
- [ ] Instalar Tailscale para VPN (se não tiver)
- [ ] Rodar `START_VPN.ps1` e testar acesso

---

_Extraordinário > Perfeito > Funciona > Nada_
_🦀 Luna — CTO Virtual NEXO DIGITAL_
