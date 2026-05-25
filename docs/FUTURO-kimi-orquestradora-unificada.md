# Arquitetura Futura: Kimi Web como Orquestradora Única

> **Insight:** A própria Kimi Web pode decidir se uma mensagem do usuário requer ação no PC ou apenas resposta em texto. Não precisamos de classificadores, comandos `/pc`, `/kimi`, ou separação de modos. A Kimi Web é o cérebro. O agente local é apenas o braço.

---

## 1. O PROBLEMA COM A ARQUITETURA ATUAL

Hoje temos:
```
/kimi      → Kimi Web (só texto)
/pc        → Shell direto (sem Kimi)
/pc_assisted → Kimi Web + ReAct loop
```

**Problemas:**
- O usuário precisa SABER qual comando usar
- O classificador regex às vezes erra
- O contexto é fragmentado entre modos
- A Kimi Web não vê o "mundo" do usuário quando ele usa `/kimi`

---

## 2. A NOVA ARQUITETURA — "Luna Orquestradora"

### Visão

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         LUNA ORQUESTRADORA ÚNICA                         │
│                                                                          │
│  Usuário (Telegram DM) ──► Orquestrador ──► Kimi Web (único cérebro)   │
│                                                  │                       │
│                    ┌─────────────────────────────┘                       │
│                    │                                                     │
│         ┌──────────▼──────────┐                                         │
│         │   DECISÃO DA KIMI   │                                         │
│         │                     │                                         │
│         │ "Isso é só chat?"   │───► Responde texto no Telegram         │
│         │                     │                                         │
│         │ "Preciso agir?"     │───► Envia ação para Engine Local       │
│         │                     │         │                                │
│         │ "Preciso ver?"      │         ▼                                │
│         │                     │    ┌────────────┐                        │
│         └─────────────────────┘    │   ENGINE   │                        │
│                                    │   LOCAL    │                        │
│                                    │            │                        │
│                                    │ • Shell    │                        │
│                                    │ • Mouse    │                        │
│                                    │ • Keyboard │                        │
│                                    │ • Screenshot│                       │
│                                    └─────┬──────┘                        │
│                                          │                               │
│                                          ▼                               │
│                                    ┌────────────┐                        │
│                                    │  RESULTADO │                        │
│                                    │  (screenshot│                       │
│                                    │   + output) │                       │
│                                    └─────┬──────┘                        │
│                                          │                               │
│                                          ▼                               │
│                                    ┌────────────┐                        │
│                                    │  KIMI WEB  │                        │
│                                    │  (novamente│                        │
│                                    │   com o    │                        │
│                                    │  resultado)│                        │
│                                    └─────┬──────┘                        │
│                                          │                               │
│                                          ▼                               │
│                                    Resposta final no Telegram            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Como funciona na prática

#### Cenário A: Conversa normal
```
Usuário: "Oi Luna, tudo bem?"

Orquestrador envia para Kimi Web:
  [SYSTEM]
  Você é a Luna. Contexto: PC do Abner, Ubuntu+GNOME, 14:30.
  Última ação: nenhuma.
  
  [USER] "Oi Luna, tudo bem?"
  
  Decida: responda em texto OU execute ação.
  Formato: {"mode": "CHAT", "response": "..."}
          {"mode": "ACTION", "action": {...}, "message": "..."}

Kimi Web responde:
  {"mode": "CHAT", "response": "Oi Abner! Tudo ótimo por aqui. Como posso te ajudar hoje?"}

Orquestrador: Envia resposta no Telegram. Fim.
```

#### Cenário B: Ação simples
```
Usuário: "Qual a hora?"

Kimi Web responde:
  {"mode": "ACTION", "action": {"type": "shell", "params": {"command": "date"}},
   "message": "Deixa eu verificar..."}

Orquestrador:
  1. Executa `date` → "seg 25 mai 2026 14:47:31 CEST"
  2. Reenvia para Kimi Web com o resultado
  
Kimi Web (segunda chamada):
  {"mode": "CHAT", "response": "São 14:47 no seu PC! 🕐"}

Orquestrador: Envia no Telegram.
```

#### Cenário C: Ação complexa (ReAct implícito)
```
Usuário: "Abre o Chrome e vai pro Gmail"

Kimi Web responde:
  {"mode": "ACTION", "action": {"type": "open_app", "params": {"app": "chrome"}},
   "message": "Abrindo Chrome..."}

Orquestrador:
  1. Executa ação
  2. Tira screenshot
  3. Reenvia para Kimi Web: "Ação executada. Screenshot: [OCR]. Próximo passo?"

Kimi Web:
  {"mode": "ACTION", "action": {"type": "click", "params": {"x": 640, "y": 65}},
   "message": "Clicando na barra de endereço..."}

[loop continua até Kimi Web retornar mode: "CHAT" com done]
```

#### Cenário D: Análise de código
```
Usuário: "Esse CSS do login tá feio, melhora"

Kimi Web responde:
  {"mode": "ACTION", "action": {"type": "shell", "params": {"command": "cat frontend/src/components/Login.css"}},
   "message": "Deixa eu ver o CSS atual..."}

Orquestrador:
  1. Executa → retorna conteúdo do arquivo
  2. Reenvia para Kimi Web

Kimi Web:
  {"mode": "ACTION", 
   "action": {"type": "shell", "params": {"command": "cat > frontend/src/components/Login.css << 'EOF'\n[novo CSS]\nEOF"}},
   "message": "Atualizando o CSS com mais contraste..."}

[loop continua até Kimi Web confirmar que terminou]
```

---

## 3. PROMPT ÚNICO PARA KIMI WEB

```markdown
Você é a Luna, assistente executiva da NEXO Digital. Você controla o PC do Abner (Ubuntu + GNOME + Wayland).

CONTEXTO ATUAL:
- Data/hora: {{datetime}}
- PC ligado, usuário ativo
- Resolução: {{screen_width}}x{{screen_height}}
- Janela ativa: {{active_window}}
- Aplicações abertas: {{window_list}}

REGRAS DE DECISÃO:
1. Se o usuário estiver apenas conversando, perguntando, ou pedindo informação que você já sabe → mode: "CHAT"
2. Se o usuário pedir para fazer algo no PC (abrir app, executar comando, verificar arquivo, tirar screenshot) → mode: "ACTION"
3. Se precisar de dados do PC para responder → mode: "ACTION" para coletar, depois mode: "CHAT"
4. Se for uma tarefa complexa de múltiplos passos → mode: "ACTION" passo a passo

FORMATO DE RESPOSTA (JSON obrigatório):
```json
{
  "mode": "CHAT" | "ACTION",
  "action": {
    "type": "shell|click|type|key|hotkey|open_app|screenshot|ocr|wait",
    "params": {...}
  },
  "message": "mensagem para o usuário (obrigatória)",
  "done": false | true
}
```

QUANDO mode="CHAT":
- action pode ser null
- Responda ao usuário diretamente

QUANDO mode="ACTION":
- action é obrigatória
- message é obrigatória (o usuário vê isso enquanto executa)
- done: false (ainda trabalhando) ou true (terminou)

CONTEXTO DE AÇÕES ANTERIORES:
{{action_history}}

ÚLTIMO RESULTADO:
{{last_result}}

USUÁRIO DISSE: "{{user_message}}"

Responda com JSON. Nada fora do JSON.
```

---

## 4. VANTAGENS DESTA ARQUITETURA

### Para o usuário
| Antes (arquitetura atual) | Depois (orquestradora única) |
|---------------------------|------------------------------|
| Precisa lembrar `/pc`, `/kimi`, `/pc_assisted` | Só conversa naturalmente |
| `/pc date` para hora, `/kimi qual meu ip` para IP | "Qual meu ip?" → Luna decide |
| Contexto fragmentado entre modos | Contexto único e contínuo |
| Classificador regex às vezes erra | Kimi Web raciocina e decide |

### Para o desenvolvedor
| Antes | Depois |
|-------|--------|
| 3 handlers diferentes (`/kimi`, `/pc`, `/pc_assisted`) | 1 handler único |
| Classificador regex complexo | Eliminado |
| Loop ReAct separado | Integrado no fluxo normal |
| Prompts diferentes para cada modo | 1 prompt único |

---

## 5. IMPLEMENTAÇÃO SUGERIDA

### Fase 1: Handler Único (2 dias)
- Criar `UnifiedHandler` que recebe TODAS as mensagens do DM
- Envia para Kimi Web com o prompt único
- Processa resposta JSON (CHAT vs ACTION)
- Se ACTION → executa e reenvia resultado
- Se CHAT → responde no Telegram

### Fase 2: Contexto Persistente (1 dia)
- Manter `action_history` na memória da conversa
- Incluir screenshot OCR em cada chamada
- Cache de contexto (não reenviar o mesmo OCR)

### Fase 3: Modo YOLO Integrado (1 dia)
- Se YOLO ativado, ACTIONs executam sem confirmação
- Se YOLO desativado, ações destrutivas pedem OK
- A própria Kimi Web pode sugerir "Quer que eu ative o modo automático?"

### Fase 4: Workspace Context (futuro)
- Quando Kimi Web pedir arquivo → Engine lê e retorna
- Quando pedir diretório → Engine lista e retorna
- Kimi Web decide quais arquivos precisa ver

---

## 6. EXEMPLO DE CONVERSA FLUIDA

```
Abner: "Oi Luna"
Luna:  "Oi Abner! Tudo bem? Como posso ajudar?" [CHAT]

Abner: "Qual a hora?"
Luna:  [ACTION: shell "date"] → "São 14:47 no seu PC! 🕐"

Abner: "Abre o Chrome"
Luna:  [ACTION: open_app chrome] → "Chrome aberto! ✅"

Abner: "E agora vai pro Gmail"
Luna:  [ACTION: click barra endereço] → [ACTION: type "gmail.com"] → [ACTION: key Return]
       "Pronto! Gmail carregado. 📧"

Abner: "Esse botão de compose tá onde?"
Luna:  [ACTION: screenshot] → analisa → [CHAT]
       "O botão 'Compose' está no canto superior esquerdo, escrito '+ Compose'"

Abner: "Clica nele"
Luna:  [ACTION: click (x, y)] → "Clicado! Nova mensagem aberta. ✉️"

Abner: "Valeu, agora me conta uma piada"
Luna:  [CHAT] "Por que o programador foi ao médico? Porque tinha um bug! 😄"

[Conversa fluida, sem comandos, sem contexto perdido]
```

---

## 7. IMPACTO NA IDEIA "KIMI CODE NO TELEGRAM"

Esta arquitetura unificada TAMBÉM resolve o "Kimi Code no Telegram":

```
Abner: "O CSS do login tá feio"
Luna:  [ACTION: shell "cat frontend/src/Login.css"] 
       "Deixa eu ver o CSS atual..."
       
       [recebe CSS]
       [ACTION: shell "cat > Login.css << 'EOF'\n[novo CSS]\nEOF"]
       "Atualizei! Agora tem mais contraste. Quer ver?"

Abner: "Mostra"
Luna:  [ACTION: open_app chrome, navigate to localhost:3457]
       [ACTION: screenshot]
       [envia foto no Telegram]
       "Ficou assim! 🎨"

Abner: "Perfeito, commita isso"
Luna:  [ACTION: shell "git add . && git commit -m 'fix: melhora contraste do login'"]
       "Commit feito! ✅"
```

**A Kimi Web decidiu TUDO:**
- "Preciso ver o arquivo → ACTION: cat"
- "Agora vou editar → ACTION: write"
- "Quer ver resultado? → ACTION: screenshot"
- "Commitar? → ACTION: git commit"

O Orquestrador não decide nada. Ele só executa o que a Kimi Web pede.

---

## 8. CONCLUSÃO

A ideia do usuário é **revolucionária para a arquitetura**:

> "A própria Kimi Web pode decidir se precisa agir ou só responder."

Isso elimina:
- ✅ Comandos `/pc`, `/kimi`, `/pc_assisted`
- ✅ Classificador regex de intenções
- ✅ Separação entre "modo conversa" e "modo execução"
- ✅ Complexidade de múltiplos handlers

E entrega:
- ✅ Conversa fluida e natural
- ✅ Contexto persistente
- ✅ Decisões inteligentes (a Kimi Web raciocina)
- ✅ Base para o "Kimi Code no Telegram"

**Recomendação:** Quando estabilizar o MVP atual, a PRÓXIMA grande refatoração deve ser esta — unificar tudo em um único handler onde a Kimi Web é a orquestradora.
