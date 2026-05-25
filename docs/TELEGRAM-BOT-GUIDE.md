# 🤖 Guia Completo — Luna Telegram Bot (@lunanexobot)

> Última atualização: 2026-05-25  
> Versão do Bridge: v2.1  
> Modo padrão: ⚡ Instant

---

## 📋 Índice

1. [O que é](#o-que-é)
2. [Como funciona](#como-funciona)
3. [Comandos do Kimi Bridge](#comandos-do-kimi-bridge)
4. [Comandos gerais da Luna](#comandos-gerais-da-luna)
5. [Arquitetura](#arquitetura)
6. [Primeiros passos](#primeiros-passos)
7. [Troubleshooting](#troubleshooting)

---

## O que é

O **@lunanexobot** é o bot oficial da NEXO Digital no Telegram. Ele conecta seu grupo do Telegram à **Kimi AI** (a IA mais avançada do momento) e ao **dashboard interno da NEXO**.

Com ele você pode:
- 💬 Conversar com a Kimi AI direto do Telegram
- ⚡ Usar modo Instant (rápido) ou 🧠 Thinking (raciocínio profundo)
- 📊 Criar tarefas, leads, ideias e registrar financeiro
- 🧙 Usar wizards interativos para ações complexas
- 📈 Ver status do bridge e suas sessões

---

## Como funciona

O bot roda em **dois modos**:

### Modo 1 — Kimi Bridge (IA)
Quando você usa `/kimi`, o bot envia sua pergunta para a **Kimi Web** (kimi.com) através de um navegador Chrome automatizado. A resposta é extraída em Markdown completo (código, listas, tabelas preservados) e devolvida no Telegram.

**Privacidade:** cada usuário tem sua **própria aba** no Chrome. Suas conversas não se misturam.

### Modo 2 — Luna Agent (Dashboard)
Quando você menciona o bot (`@lunanexobot` ou `@luna`), ele interpreta sua intenção usando IA e pode:
- Criar tarefas no dashboard
- Registrar leads
- Salvar ideias
- Registrar pagamentos/despesas
- E muito mais

---

## Comandos do Kimi Bridge

### `/kimi [pergunta]`
Envia uma pergunta para a Kimi no modo atual (padrão: ⚡ Instant).

```
/kimi Explique blockchain em 3 parágrafos
```

**Resposta:** resposta completa em Markdown, como reply à sua mensagem.

---

### `/kimi_instant [pergunta]`
Modo ⚡ **Instant** — respostas rápidas (3–8s), sem raciocínio passo a passo.

```
/kimi_instant Resuma este texto: ...
```

**Quando usar:** perguntas simples, resumos, traduções, fatos diretos.

---

### `/kimi_thinking [pergunta]`
Modo 🧠 **Thinking** — raciocínio passo a passo visível, melhor para problemas complexos.

```
/kimi_thinking Resolva esta equação diferencial: ...
```

**Quando usar:** matemática, código complexo, análise profunda, debug.

---

### `/kimi_novo`
Cria um **novo chat** para você na Kimi. O histórico anterior fica preservado em outra aba.

```
/kimi_novo
```

**Resposta:** "🆕 Novo chat criado! Seu histórico anterior foi preservado em outra aba."

---

### `/kimi_status`
Mostra o status do bridge e da sua sessão.

```
/kimi_status
```

**Resposta:**
```
📊 Kimi Bridge Status

🔗 Bridge API (remoto)
📄 Páginas ativas: 1/5

👤 Sua sessão:
• Modo: ⚡ Instant
• Processando: não
```

---

### `/help`
Mostra este guia resumido diretamente no Telegram.

---

## Comandos gerais da Luna

### Mencionar o bot
```
@lunanexobot Criar tarefa: revisar contrato do cliente XYZ
```

O bot vai:
1. Classificar sua intenção (criar tarefa)
2. Iniciar um **wizard** interativo com botões
3. Perguntar os campos que faltam (prioridade, responsável, etc.)
4. Confirmar antes de salvar no dashboard

### Menções naturais
Você também pode mencionar `@luna` ou `@kimi` em qualquer mensagem do grupo.

### Responder ao bot
Se o bot perguntar algo (ex: "Anoto como concluído?"), basta responder **sim** ou **não**.

---

## Arquitetura

```
[ Você no Telegram ]
         ↓
[ @lunanexobot no Render ]
         ↓
[ Cloudflare Tunnel ] ←→ [ Seu PC local ]
         ↓                       ↓
[ Kimi Bridge API ]      [ Chrome CDP ]
         ↓                       ↓
[ Kimi Web (kimi.com) ] ←———→ [ Chrome com perfil logado ]
```

**O que roda onde:**
- **Render (nuvem):** o bot do Telegram, conectado 24/7
- **Seu PC local:** Chrome com perfil logado na Kimi + Bridge API
- **Tunnel Cloudflare:** conexão segura entre Render e seu PC

> ⚠️ O Chrome precisa estar rodando no seu PC para o `/kimi` funcionar. Se você desligar o PC, o bot avisa que o bridge está offline.

---

## Primeiros passos

### 1. Iniciar o Chrome com perfil logado
```bash
./scripts/start-kimi-chrome.sh
```

### 2. Iniciar a Bridge API + Tunnel
```bash
./scripts/start-kimi-bridge-api.sh
```

Esse script:
- Verifica se o Chrome está acessível
- Inicia a API local na porta 9223
- Cria um tunnel Cloudflare
- Mostra a URL do tunnel

### 3. Configurar o Render
No [Dashboard do Render](https://dashboard.render.com), adicione as env vars:
- `KIMI_BRIDGE_URL` = URL do tunnel (ex: `https://xxxx.trycloudflare.com`)
- `KIMI_BRIDGE_API_KEY` = chave mostrada no terminal

### 4. Testar
Mande no Telegram:
```
/kimi_status
/kimi Diga oi
```

---

## Troubleshooting

| Problema | Solução |
|---|---|
| "Chrome CDP not reachable" | Rode `./scripts/start-kimi-chrome.sh` primeiro |
| "Erro no Kimi: Response timeout" | A Kimi pode estar lenta. Tente `/kimi_instant` |
| "Erro no Kimi: session expired" | Faça login novamente no Chrome em `kimi.com` |
| "409 Conflict" no bot | Apenas uma instância do bot pode rodar. Pare a local se o Render já estiver ativo |
| Resposta vem cortada | Raro na v2.1, mas se acontecer, use `/kimi_novo` para novo chat |
| Tunnel parou de funcionar | O quick tunnel muda a URL a cada reinício. Rode o script novamente e atualize a env var no Render |
| "Aguarde Xs antes de enviar" | Rate limiting ativado. Espere 5 segundos entre mensagens |

---

## Dicas avançadas

### Múltiplos usuários
Cada pessoa que usa `/kimi` no Telegram recebe uma **aba separada** no Chrome. Ninguém vê a conversa do outro.

### Limite de páginas
O bridge suporta até **5 usuários simultâneos**. Páginas inativas há mais de 10 minutos são fechadas automaticamente.

### Modo padrão
O modo padrão é **⚡ Instant**. Para mudar permanentemente para Thinking, use `/kimi_thinking` em cada pergunta.

### Markdown no Telegram
As respostas vêm em Markdown. O Telegram suporta negrito, itálico, código inline e blocos de código.

---

*Desenvolvido por NEXO Digital S.L. — Barcelona, 2026*
