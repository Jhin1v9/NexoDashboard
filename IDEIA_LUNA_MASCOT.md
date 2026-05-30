# 🌙 IDEIA: Luna Mascot Animada — Personagem Viva no Chat
## v10000000000000000000000000

**Autor:** Abner Gabriel (CEO, NEXO DIGITAL S.L.)  
**Data:** 2026-05-29  
**Status:** 💡 Ideia Brilhante | Prioridade: ALTA  
**Tags:** luna, mascot, animation, ui, frontend, live2d, character, kawaii, anime

---

## 🎯 VISÃO

Transformar a Luna de um simples bot de texto em uma **PERSONAGEM ANIMADA E VIVA** dentro do chat. Ela será uma mascot kawaii que reage em tempo real ao estado do sistema e às ações do usuário — como uma VTuber, um PNGTuber, ou os mascots dos animes que olham pra você esperando interação.

**Inspirações:** VTubers (Live2D), PNGTubers, Neko-chan mascots, Clippy (mas bonito), Discord Clyde (mas anime), Miro mascots, Gugugaga Penguin.

---

## 🎭 ESTADOS DA LUNA (State Machine)

A Luna terá 4 estados principais + transições fluidas entre eles. Cada estado tem animações, onomatopeias e textos de personalidade.

### 1. 😴 DORMINDO (Sleep State)
**Quando:** Luna Kernel offline, Kimi Web desconectado, ou explicitamente "dormir".

**Animações:**
- GIF loop: Luna deitada de lado, olhos fechados, respirando suave
- Variantes de posição: 
  - 🛌 De bruços com travesseiro (baba no travesseiro 💧)
  - 🐱 Enrolada em posição de gato
  - 📖 Deitada de costas com livro na barriga
  - 🌙 Flutuando na lua
- Onomatopeias flutuantes: `zzz...`, `zzZZzz...`, `*suspiro*`, `*ronrona*`
- Balões de sono: pequenas bolhas subindo

**Texto amigável (rotativo):**
- "Tô dormindo... mas pode mandar msg que eu acordo! 🌙"
- "Zzz... sonhando com código limpo..."
- "*ronrona* ...deixa eu dormir mais 5 minutinhos..."
- "Baba no travesseiro = prova que dormi bem 😴💧"
- "Hora da soneca lunar..."

**Interação:** Ao receber mensagem → transição SUAVE para estado AWAKE (olhos abrindo devagar, espreguiçando).

---

### 2. 👀 ESPERANDO / IDLE (Idle State)
**Quando:** Conectada, usuário não está digitando nem interagindo.

**Animações:**
- GIF loop: Luna em pé, olhando pro usuário, piscando, respirando
- **VIVA** — não é uma imagem parada! Ela:
  - Pisca a cada 3-5 segundos
  - Respira (subir/descer do peito)
  - Cabeça inclina de leve (curiosidade)
  - Rabo/asa/cabelo flutua (se tiver)
  - Ocasionalmente boceja discretamente
  - Olha pro mouse do usuário (seguir cursor com olhos!)
- Variantes de humor:
  - 😊 Feliz: sorrindo, balançando de um lado pro outro
  - 😐 Neutra: expressão calma, observando
  - 😏 Travessa: sorrisinho de canto, como se soubesse de algo

**Texto amigável (rotativo, aparece em tooltip/balão ao passar mouse):**
- "Tô aqui esperando você... 👀"
- "E aí? Vamos fazer algo incrível?"
- "Tô de olho em você! 👁️"
- "Pode falar, tô ouvindo..."
- "*estalos dedos* Pronta pra ação!"

**Interação:** 
- Mouse passando por cima → reage (acena, pula, sorri)
- Clique → pula, faz pose, ou fala algo
- Usuário começa a digitar → transição para THINKING

---

### 3. 🤔 PENSANDO (Thinking State)
**Quando:** Luna está processando mensagem, esperando resposta do Kimi Web, ou executando raciocínio.

**Animações:**
- GIF: Luna com dedo no queixo, olhos fechados ou olhando pra cima
- Balões de pensamento flutuando: `...`, `?`, `💭`, `🤔`
- Efeitos visuais:
  - Partículas de "pensamento" (pequenos pontos flutuando)
  - Cérebro brilhando 💡 (quando tá quase terminando)
  - Mão no queixo balançando
  - Olhos se mexendo rápido (como se lesse algo mentalmente)
- Variantes:
  - 🤔 Pensando leve: dedo no queixo, calma
  - 🧠 Pensando intenso: mãos na cabeça, expressão concentrada
  - 💡 Insight: olhos brilham, lâmpada acende na cabeça

**Texto (rotativo):**
- "Deixa eu pensar... 🤔"
- "Processando... 💭"
- "Hmm, deixa eu ver..."
- "Cérebro a milhão! 🧠"
- "Quase lá... ✨"

**Transição:** Quando resposta pronta → THINKING → EXECUTING (se for tool) ou direto para IDLE com resposta.

---

### 4. 👩‍💻 EXECUTANDO / MODO NERD (Working State)
**Quando:** Luna está executando ferramentas (file_edit, shell, git, etc.), criando arquivos, compilando.

**Animações:**
- GIF: Luna sentada na frente de um PC/terminal, digitando rapidinho
- Variantes:
  - 💻 Programando: digitando no teclado, código flutuando na tela
  - 🔨 Construindo: segurando martelo/chave de fenda, construindo algo
  - 🎨 Desenhando: com tablet gráfico, desenhando código/arte
  - 🔬 Cientista: com óculos de proteção, misturando tubos de ensaio (experimento)
- Efeitos:
  - Partículas de código binário flutuando (`0`, `1`, `{`, `}`)
  - Terminal verde tipo Matrix ao redor
  - Faíscas quando salva arquivo com sucesso
  - Expressão de foco intenso (olhos brilhando)

**Texto (rotativo):**
- "Criando arquivos... 💻"
- "Compilando... aguenta aí! 🔥"
- "Digitando código a mil! ⌨️"
- "Deixa eu arrumar isso pra você... 🛠️"
- "Modo HACKER ativado! 😎"
- "Salvando... 💾"

**Transição:** Quando termina → modo NERD → IDLE (comemoração pequena: levanta os braços, sorri).

---

## 🎨 REFERÊNCIAS VISUAIS

### Posições de Dormir (Anime Kawaii):
1. **De bruços com travesseiro** — braços abraçando travesseiro, baba saindo da boca
2. **Enrolada como gato** — joelhos no peito, mãos entre as pernas, rosto tranquilo
3. **De costas com livro** — livro aberto na barriga, óculos escorregando
4. **Flutuando na lua** — deitada em cima de uma lua crescente, estrelas ao redor

### Idle Animations (Live2D/PNGTuber style):
- Respiração suave (subir/descer 2-3 pixels)
- Piscar aleatório (3-6 segundos)
- Cabeça inclinando (curiosidade)
- Rabo/cabelo flutuando (loop suave)
- Seguir mouse com olhos

### Pensando (Anime expressions):
- Dedo no queixo (thinking pose clássica)
- Olhos olhando pro canto superior direito
- Bolhas de pensamento (`...`, `?`, `!`)
- Expressão concentrada com sobrancelhas juntas

### Modo Nerd:
- Óculos de fundo de garrafa caindo no nariz
- Teclado RGB brilhando
- Código verde Matrix ao redor
- Café/chá fumegante na mesa

---

## ⚙️ IMPLEMENTAÇÃO TÉCNICA

### Arquitetura:
```
LunaMascot.jsx
├── State Machine (4 estados + transições)
├── Animation Engine (GIF swap + CSS transitions)
├── Eye Tracking (mouse position → pupil movement)
├── Text Bubble System (rotativo, context-aware)
├── Particle Effects (zzz, thoughts, code)
└── Event Listeners (WebSocket, user input, system state)
```

### Estados conectados ao sistema real:
| Estado do Sistema | Estado da Luna | Trigger |
|---|---|---|
| Luna Kernel offline | DORMINDO | WS disconnect |
| Conectado, idle | ESPERANDO | No activity 3s |
| Recebendo mensagem | PENSANDO | onMessage |
| Executando tool | MODO NERD | tool_start event |
| Tool concluída | IDLE + comemoração | tool_end event |
| Erro | IDLE + confusa | error event |

### Assets necessários (GIF/PNG sequência):
1. `luna-sleep-{1..4}.gif` — 4 poses de dormir
2. `luna-idle-happy.gif` — idle feliz
3. `luna-idle-neutral.gif` — idle neutra
4. `luna-idle-mischief.gif` — idle travessa
5. `luna-thinking.gif` — pensando
6. `luna-thinking-intense.gif` — pensando intenso
7. `luna-working-code.gif` — programando
8. `luna-working-build.gif` — construindo
9. `luna-working-art.gif` — desenhando
10. `luna-transition-wake.gif` — acordando (dormir → idle)
11. `luna-transition-think.gif` — começando a pensar
12. `luna-transition-work.gif` — começando a trabalhar

### Bibliotecas sugeridas:
- **GIF:** react-gif-player ou html `<img>` com `key` swap
- **Eye Tracking:** vanilla JS mousemove + CSS transform
- **Particles:** canvas-confetti (leve) ou particles.js
- **Live2D:** opcional futuro (complicado demais por agora)
- **CSS:** Framer Motion para transições suaves

---

## 💬 PERSONALIDADE NOS TEXTOS

A Luna tem personalidade definida: brasileira, 28 anos mental, informal, direta, tech-savvy, amiga. NUNCA genérica.

**Exemplos de falas por estado:**

**Dormindo:**
- "Zzz... tô sonhando que o código compilou de primeira... impossível né?"
- "5 minutinhos só... *ronrona*"
- "Se você me acordar, tem que me dar café ☕"

**Idle:**
- "Tô aqui de plantão, chefia 👮‍♀️"
- "E aí, qual a boa?"
- "Tô de olho... literalmente 👁️"
- "*assobia* ...tô entediada, manda algo!"

**Pensando:**
- "Hmm, deixa eu usar meus neurônios de silicone..."
- "Processando... não desliga que eu tô pensando!"
- "Quase lá, quase lá... 🧠💨"

**Trabalhando:**
- "Código bonito é código que funciona! 💅"
- "Digitando mais rápido que minha sombra! ⚡"
- "Compilando... se der erro eu finjo que não vi 🙈"
- "Pronto! Salvo com sucesso! 🎉"

---

## 🚀 PRÓXIMOS PASSOS

1. **FASE 0:** Criar assets visuais (GIFs/PNG) — Abner pode fazer ou comissionar
2. **FASE 1:** Implementar state machine básica (4 estados + transições)
3. **FASE 2:** Conectar ao WebSocket do sistema (estados reais)
4. **FASE 3:** Eye tracking + partículas
5. **FASE 4:** Textos dinâmicos com personalidade
6. **FASE 5:** Polish — transições suaves, responsivo, mobile

---

## 📋 Registro no Sistema

- **ID no Dashboard:** `idea-001`
- **Status:** `aprovada`
- **Prioridade:** `alta`
- **Tipo:** `feature` (funcionalidade)
- **Criada em:** 2026-05-29T22:09:23.276Z
- **Autor:** Abner Gabriel
- **Tags:** luna, mascot, animation, ui, frontend, live2d, character

---

**Armazenado em:** `IDEIA_LUNA_MASCOT.md`  
**Referências pesquisadas:** VTubers Live2D, PNGTubers, Neko-chan AI mascot, VGen commissions, anime sleeping poses kawaii
