# 🚀 Deploy no Render — Guia Passo a Passo

## O que foi preparado

O projeto já está configurado para deploy automático no Render:

- `render.yaml` — Blueprint da infraestrutura
- `package.json` na raiz — Script de build unificado
- Backend serve o frontend buildado (monolito)
- `BIND_IP` configurado para `0.0.0.0`
- URLs hardcoded `localhost:3456` removidas do frontend

---

## 📋 Pré-requisitos

1. Conta no GitHub com o repositório do NEXO
2. Conta gratuita no [Render](https://render.com)

---

## 🔧 Passo 1: Commit e Push

```bash
git add .
git commit -m "config: deploy no Render"
git push origin codex/initial-nexo-dashboard-pro-v16
```

---

## 🔧 Passo 2: Conectar no Render

1. Acesse [dashboard.render.com](https://dashboard.render.com)
2. Clique em **"New +"** → **"Blueprint"**
3. Conecte seu repositório GitHub
4. Selecione o repositório `NEXO_DASHBOARD_PRO`
5. O Render vai detectar automaticamente o `render.yaml`
6. Clique em **"Apply"**

---

## 🔧 Passo 3: Configurar Variáveis de Ambiente

Após criar o serviço, vá em **Environment** e adicione:

| Variável | Valor | Obrigatório |
|----------|-------|-------------|
| `GEMINI_API_KEY` | (sua key do Google Gemini) | ⚠️ **Obrigatório para IA generativa** |
| `JWT_SECRET` | (gerado automaticamente pelo Render) | ✅ |
| `NODE_ENV` | `production` | ✅ |

> ⚠️ **Atenção:** A key anterior foi revogada por segurança. Gere uma nova em [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) e adicione aqui.
> **Dica:** Se a API key do Gemini esgotar, adicione mais keys separadas por vírgula: `key1,key2,key3`

---

## 🔧 Passo 4: Atualizar Plano (Opcional mas Recomendado)

O plano **Free** do Render dorme após 15 minutos de inatividade.

Para manter 24/7:
1. Vá em **Settings** do serviço
2. Mude de **Free** para **Starter** ($7/mês ≈ €6,50)
3. O serviço nunca mais dorme

---

## 🌐 Domínio

Após o deploy, seu dashboard estará em:
```
https://nexo-dashboard-pro.onrender.com
```

Para usar domínio próprio:
1. Vá em **Settings** → **Custom Domains**
2. Adicione seu domínio (ex: `dashboard.nexodigital.com`)
3. Configure o DNS conforme instruções do Render

---

## 📁 Estrutura do Deploy

```
NEXO_DASHBOARD_PRO/
├── backend/
│   ├── server.js          ← Express + WebSocket
│   ├── public/            ← Frontend buildado (gerado no build)
│   └── ...
├── frontend/
│   ├── src/
│   └── dist/              ← Build Vite (copiado para backend/public)
├── render.yaml            ← Config Render
├── package.json           ← Scripts de build
└── .gitignore
```

---

## 🔄 Atualizações

Sempre que fizer `git push`, o Render rebuilda e redeploya automaticamente!

```bash
git add .
git commit -m "feat: nova funcionalidade"
git push
# Deploy automático em ~2 minutos
```

---

## 🆘 Troubleshooting

### "Service unavailable" após inatividade
→ Normal no plano Free. O serviço "acorda" no primeiro request (~30-60s).

### Erro 500 no backend
→ Verifique os logs em **Logs** no dashboard do Render.

### API key do Gemini esgotada
→ Adicione mais keys no formato `key1,key2,key3` na variável `GEMINI_API_KEY`.

---

## 💰 Custo Estimado

| Plano | Preço | Observação |
|-------|-------|------------|
| Free | $0 | Dorme após 15min inativo |
| Starter | $7/mês | Always-on, 512MB RAM |
| Pro | $25/mês | Mais RAM, múltiplos serviços |

Para o NEXO Dashboard, o plano **Starter ($7/mês)** é mais que suficiente.
