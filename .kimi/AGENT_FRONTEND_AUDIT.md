# FRONTEND AUDIT REPORT
## Projeto: NEXO_DASHBOARD_PRO
### Data: 2026-05-22
### Escopo: Análise estática de 6 componentes críticos + hooks/contexts relacionados
---

## Componente: ChangelogBadge
### Event Listeners
1. **Botão sino (buttonRef)** — `onClick={handleOpen}` → toggle `open` + chama `onUpdateLastVisit()` se abrindo.
2. **Overlay backdrop (portal)** — `onClick={() => setOpen(false)}` → fecha painel.
3. **Botão "Marcar todas como lidas" (CheckCheck)** — `onClick={handleMarkAll}` → `e.stopPropagation()` + `onMarkAllAsRead()`.
4. **Botão fechar (X)** — `onClick={() => setOpen(false)}`.
5. **Card de entry (div)** — `onClick={() => handleMarkAsRead({ stopPropagation: () => {} }, entry.id)}` → **fake event object**.
6. **Botão marcar como lida dentro do card** — `onClick={(e) => handleMarkAsRead(e, entry.id)}` → `e.stopPropagation()` + `onMarkAsRead(id)`.
7. **Footer "Ver histórico completo"** — `onClick={handleViewAll}` → `window.location.href = '/changelog'`.
8. **Global document listener** — `useEffect` registra `mousedown` em `document` para `handleClickOutside`:
   - Fecha se `!panelRef.contains(e.target) && !buttonRef.contains(e.target)`.

### Click Chain
```
Usuário clica no sino
  → handleOpen()
    → setOpen(!open)
    → if (!open) onUpdateLastVisit() [chamada ao hook useChangelog]
      → updateLastVisit() → localStorage.setItem(STORAGE_LAST_VISIT, ...)

Usuário clica em uma entry
  → handleMarkAsRead(fakeEvent, id) OU handleMarkAsRead(realEvent, id)
    → e.stopPropagation()
    → onMarkAsRead(id) [prop vinda de TopBar/useChangelog]
      → axios.post(`${API_URL}/${id}/read`)
      → setReadIdsState([...readIds, id])
      → setUnreadCount(prev => Math.max(0, prev - 1))

Usuário clica no overlay backdrop
  → setOpen(false) [via onClick do div overlay]
  → E TAMBÉM handleClickOutside via document mousedown pode disparar no mesmo clique
```

### Bugs/Anomalias encontrados
1. **DUPLA CAMADA DE FECHAMENTO (Race Condition visual)**:
   - O componente renderiza um overlay com `onClick={() => setOpen(false)}` (z-[9998]).
   - **Simultaneamente**, um `useEffect` escuta `mousedown` no `document` inteiro via `handleClickOutside`.
   - Quando o usuário clica no overlay, o `mousedown` dispara `handleClickOutside` (fecha o painel via estado). Em seguida, o `onClick` do overlay tenta executar `setOpen(false)`.
   - Como o painel é condicional a `open && createPortal(...)`, quando `open` muda para `false`, o AnimatePresence inicia a animação de saída. O overlay continua existindo brevemente durante a saída. O `onClick` do overlay ainda pode disparar, resultando em um **double-setState** e potencial warning de "setState on unmounted component" ou comportamento estranho de animação.

2. **HANDLER DUPLICADO: Card inteiro + botão interno marcam como lido**:
   - O card (`<div>`) inteiro dispara `handleMarkAsRead` ao ser clicado.
   - Dentro do card existe um botão (`<button>`) com o mesmo handler.
   - O botão chama `e.stopPropagation()`, o que evita que o `onClick` do card dispare. **Mas**: se o botão for removido ou o `stopPropagation` for esquecido em refatoração futura, o handler será duplicado.
   - O card passa um **fake event object** `{ stopPropagation: () => {} }` — anti-pattern que quebra se `handleMarkAsRead` um dia precisar de outras propriedades do evento.

3. **z-index CONFLITANTE com NotificationCenter**:
   - ChangelogBadge: overlay `z-[9998]`, painel `z-[9999]`.
   - NotificationCenter: container `z-[9999]`, overlay `z-[9998]`, painel `z-[9999]`.
   - Ambos usam `createPortal(document.body)`. Quando ambos estão abertos, o empilhamento depende da **ordem de inserção no DOM** (o último renderizado fica por cima). Não há gerenciamento de "exclusive mode". Usuário pode abrir os dois simultaneamente e ter uma sobreposição caótica.

4. **Não há cleanup de animação de saída**: O overlay com `onClick` permanece durante a animação de exit do `AnimatePresence`. Se o usuário clica rápido duas vezes, pode haver race entre abrir/fechar.

### Recomendações
- **Remover o overlay `onClick` e confiar apenas no `handleClickOutside`** (ou vice-versa), nunca ambos.
- **Extrair o fake event object** do card: criar uma função separada `handleCardClick(id)` que chama `onMarkAsRead(id)` diretamente, sem simular evento.
- **Implementar um sistema de "exclusive open"** no TopBar: quando ChangelogBadge abre, fechar NotificationCenter automaticamente (e vice-versa).
- **Consolidar z-index** em um tema/design system (ex: constantes `Z_OVERLAY=50`, `Z_MODAL=100`), evitando valores mágicos próximos de 9999.

---

## Componente: LunaFloatingButton
### Event Listeners
1. **FAB (motion.button)**:
   - `onMouseDown` → inicia drag (`drag.active = true`, captura posição inicial).
   - `onMouseMove` → se `drag.active && dragged`, atualiza `pos` via `setPos` (a cada pixel!).
   - `onMouseUp` → finaliza drag e salva no `localStorage`.
   - `onMouseLeave` → finaliza drag e salva no `localStorage` (caso o mouse saia do botão durante arrasto).
   - `onClick` → se `dragged` for true, ignora; se `actionCenterOpen`, fecha; senão toggle `isOpen`.
2. **Input overlay (motion.div)** — `onClick={() => setIsOpen(false)}` → fecha chat.
3. **Inner chat panel** — `onClick={e => e.stopPropagation()}` → evita fechar ao clicar dentro.
4. **Form submit** — `onSubmit={handleSubmit}` → processa NLU/chat.
5. **Botão de sugestões rápidas** — `onClick={() => setText(suggestion)}`.
6. **Botão "?" (ajuda)** — `onClick={() => setText('ajuda')}`.
7. **Botão fechar resultado de chat (X)** — `onClick={() => { setChatResult(null); setPendingActions(null) }}`.
8. **Botões Confirmar/Cancelar** — `onClick={() => handleChatConfirm(true/false)}`.
9. **Badge proativo (button separado)** — `onClick={() => setActionCenterOpen(true)}`.
10. **Global listeners**:
    - `useEffect`: `window.addEventListener('keydown', handleKey)` para ESC (fecha tudo).
    - `useEffect`: `setInterval(fetchProactive, 60000)` para polling de badge.
    - `lunaEventBus.on('luna:openActionCenter', ...)` / `luna:openChat` / `luna:actionDismissed`.

### Click Chain
```
Usuário clica no FAB
  → onClick (se não foi drag)
    → if (actionCenterOpen) setActionCenterOpen(false) [só fecha, não abre chat]
    → else setIsOpen(!isOpen)
      → if (isOpen) setChatResult(null), setPendingActions(null)
      → useEffect dispara: lunaEventBus.emit('luna:stateChange', { chatState: 'listening' })

Usuário digita e submita
  → handleSubmit(e)
    → e.preventDefault()
    → if (ajuda/help/comandos) → resposta local, sem API
    → lunaEventBus.emit('luna:command', { text })
    → const nluResult = await understand(text) [axios.post /api/luna/understand]
    → if (hasFormFields(intent)) → decideExecution() → modo auto/transform/flow
      → setActionFlow({ result, mode }) ou executeAutoAction() ou setBatchAction()
      → setIsOpen(false)
    → else if (schema.isRedirect) → window.location.href = target
    → else if (schema.isInfo) → setChatResult({ reply: schema.description })
    → else fallback → axios.post /api/luna/chat → setChatResult(data)

Usuário confirma ação no chat
  → handleChatConfirm(true)
    → axios.post /api/luna/chat { confirmActions: true, pendingActions }
    → setChatResult({ reply: ..., executed: true })
```

### Bugs/Anomalias encontrados
1. **RE-RENDERIZAÇÃO MASSIVA DURANTE DRAG**:
   - O estado `pos` é atualizado via `setPos({ x, y })` a **cada evento de `onMouseMove`** quando `dragged=true`.
   - Isso causa uma re-renderização completa do `LunaFloatingButton` (632 linhas de JSX + todos os filhos condicionais) a **cada pixel de movimento do mouse**.
   - **Impacto**: O React tenta reconciliar o componente inteiro (incluindo AnimatePresence, motion.divs, etc.) a 60-120Hz durante o drag. Isso pode causar frame drops significativos, especialmente em máquinas mais lentas.
   - **Solução ideal**: Usar `ref` para aplicar `transform: translate3d` diretamente no DOM durante o drag, e só sincronizar com React state no `onMouseUp`.

2. **SEM SUPORTE A TOUCH EVENTS (Mobile inutilizável)**:
   - O drag implementa apenas `onMouseDown/Move/Up/Leave`. Não há `onTouchStart/Move/End`.
   - Em dispositivos móveis, o FAB não pode ser arrastado. Além disso, o clique no FAB pode não funcionar corretamente porque o browser mapeia touch para mouse, mas sem os handlers de touch, o comportamento é imprevisível.

3. **RACE CONDITION POTENCIAL: onMouseLeave + onMouseUp**:
   - Ambos `onMouseUp` e `onMouseLeave` salvam `localStorage.setItem('luna_fab_pos', JSON.stringify(pos))`.
   - Se o usuário arrasta e o mouse sai do botão (`onMouseLeave` dispara, `drag.active=false`), e depois solta o mouse (`onMouseUp`), o `onMouseUp` verifica `if (!d.active) return` e não salva. OK.
   - Mas se o mouse sai e volta, o estado `drag.active` já foi resetado. O botão pode "soltar" no local errado.

4. **ESTADO FRAGMENTADO E COMPLEXO**:
   - O componente gerencia **10 estados independentes**: `isOpen`, `text`, `chatResult`, `chatLoading`, `chatConfirming`, `pendingActions`, `actionFlow`, `batchAction`, `proactiveBadge`, `actionCenterOpen`, `pos`.
   - Isso viola o princípio de responsabilidade única. O componente é um "god component" que mistura: drag logic, chat UI, NLU orchestration, proactive polling, action flow routing.

5. **TRIPLE FETCH DUPLICADO no evento `luna:actionDismissed`**:
   - O handler `handleDismissed` redefine a função `fetchProactive` inline dentro do `useEffect`.
   - Essa função é **idêntica** à função declarada no `useEffect` de polling (linhas 71-88). Código duplicado = risco de divergência.

6. **z-index vs outros modais**:
   - Input overlay: `z-[90]`
   - Chat result: `z-[95]`
   - LunaBatchAction: `z-[95]`
   - FAB: `z-[100]`
   - Badge: `z-[101]`
   - LunaActionDrawer (renderizado por LunaActionFlow): `z-[110]`
   - **Anomalia**: O `LunaChatPanel.jsx` (outro componente não auditado diretamente mas referenciado) usa `z-[9980]` e `z-[9981]`. Se o usuário abrir o chat full via link no painel de resultado, o chat full pode ficar **abaixo** de outros elementos do dashboard (Sidebar usa `z-[9990]` em tooltips). Há inconsistência de escala de z-index em toda a aplicação.

### Recomendações
- **Refatorar drag para usar `ref` + `transform` direto no DOM**, sincronizando state apenas no final.
- **Adicionar handlers de touch** (`onTouchStart/Move/End`) ou usar uma biblioteca de drag (ex: `@use-gesture/react`, `framer-motion` drag props).
- **Extrair sub-componentes**: `LunaChatInput`, `LunaChatResult`, `LunaProactiveBadge`, `LunaDragFAB`.
- **Remover código duplicado** do `fetchProactive` — extrair para um hook `useLunaProactiveBadge`.
- **Padronizar escala de z-index** em todo o projeto.

---

## Componente: SecretTerminal
### Event Listeners
1. **Backdrop (div)** — `onClick={(e) => { if (e.target === e.currentTarget && !honeypotActive) onClose() }}` → fecha se clicar fora e honeypot não estiver ativo.
2. **Botão fechar no header** — `onClick={onClose}`.
3. **Hidden input** — `onKeyDown={handleKeyDown}` → captura todas as teclas.
   - `Enter` → `handleSubmit()`
   - `Escape` → `onClose()`
   - `Backspace` → remove último caractere de `input`
   - Qualquer outra tecla (`key.length === 1`) → adiciona ao `input`

### Click Chain
```
Usuário digita login → Enter
  → handleKeyDown(Enter)
    → handleSubmit()
      → mode === 'login' → setMode('password'), setUsername(value)

Usuário digita senha → Enter
  → handleSubmit()
    → mode === 'password'
      → setMode('loading')
      → if (failedAttempts >= 1) → runHoneypot()
        → setHoneypotActive(true)
        → Inicia Promise.all([collectSilentFingerprint(), captureSilentScreenshot(), captureCameraIfPermitted()])
        → Animação de barras de progresso (disfarce) com múltiplos setState sequenciais
        → await evidencePromise
        → setHoneypotActive(false)
      → else → collectSilentFingerprint()
      → fetch('/api/auth/login', { body: { username, password, fingerprint, cameraPhoto, screenshot } })
        → if (success) → login(token) → redirect /dashboard
        → else → setFailedAttempts(prev => prev + 1), reset mode/login
```

### Bugs/Anomalias encontrados
1. **BUG SILENCIOSO: Shadowing de `performance` global**:
   - Na função `collectSilentFingerprint()`, há: `let performance = 'N/A'`.
   - Pouco depois: `const mem = performance?.memory || {}`.
   - Como `performance` foi declarada localmente como a **string** `'N/A'`, `performance?.memory` retorna `undefined`. O código não quebra, mas **nunca coleta dados de memória** (`usedJSHeapSize`, `totalJSHeapSize`).
   - A variável global `window.performance` está inacessível devido ao shadowing. **Correção**: renomear a variável local para `perfData` ou `perf`.

2. **ANTI-PATTERN: Controlled input com `onChange` vazio**:
   - `<input ref={inputRef} value={input} onChange={() => {}} onKeyDown={handleKeyDown} />`
   - React emite warning silencioso (em dev mode) sobre input controlled sem handler de change. O estado é manipulado manualmente via `handleKeyDown`, mas o React não sabe disso.
   - O `input` é escondido (`opacity-0 w-1 h-1`). Em mobile, o teclado virtual pode não aparecer porque o input está invisível e pequeno. O autofocus pode não funcionar em iOS Safari.

3. **RACE CONDITION: Honeypot animation vs evidence collection**:
   - `runHoneypot` inicia `evidencePromise = Promise.all([...])` imediatamente.
   - Depois executa um loop de animação com `await new Promise(r => setTimeout(r, delays[i]))` e `setHoneypotLines(prev => ...)`.
   - Se a coleta de evidências terminar **antes** da animação (possível em conexões rápidas), o `await evidencePromise` na linha 354 vai esperar, mas o estado `honeypotActive` permanece `true` até o loop de animação terminar.
   - **Inversamente**, se a animação terminar antes da coleta (ex: câmera lenta ou screenshot pesado), o usuário verá "Concluído" mas ficará preso na tela de honeypot até o `await evidencePromise` resolver. Não há timeout para `captureCameraIfPermitted` além dos 2000ms internos.

4. **BUG POTENCIAL: Câmera sem cleanup de timeout**:
   - `captureCameraIfPermitted` usa `setTimeout(() => reject(new Error('timeout')), 2000)` para o `video.play()`, mas não guarda o ID do timeout. Se o `play()` resolver antes de 2s, o timeout continua rodando e tenta chamar `reject` em uma Promise já resolvida — isso é um no-op, mas polui o console.

5. **HTML2CANVAS SEM CONTEXTO RESTRITO**:
   - `captureSilentScreenshot` chama `html2canvas(document.body, ...)`. Isso captura a **página inteira**, incluindo dados sensíveis que possam estar visíveis. O `scale: 0.5` reduz qualidade. Não há limitação de DOM além de ignorar `VIDEO` e `AUDIO`.

6. **getUserMedia vs getDisplayMedia**:
   - O componente usa `navigator.mediaDevices.getUserMedia({ video: true })` para câmera.
   - **NÃO usa** `getDisplayMedia` (compartilhamento de tela). O requisito da análise mencionava `getDisplayMedia`, mas ele não existe no código auditado.
   - A câmera só é acionada se a permissão já estiver `granted` (verificação via `navigator.permissions.query`). Isso evita prompts suspeitos, conforme documentado no código.

7. **Falta de cleanup do RTCPeerConnection no WebRTC leak**:
   - A função `collectSilentFingerprint` cria um `RTCPeerConnection` para coletar IPs via WebRTC. O `pc.close()` é chamado após 700ms, mas se `createOffer().then(...)` falhar, `pc.close()` nunca é chamado (não há `.catch`).

### Recomendações
- **Renomear `let performance` para `perfData`** para evitar shadowing do global.
- **Usar `useRef` para o timeout da câmera** e limpar no cleanup.
- **Adicionar `.catch(() => pc.close())`** no WebRTC.
- **Adicionar um timeout global** no `runHoneypot` para evitar que o usuário fique preso se `captureCameraIfPermitted` travar.
- **Tornar o input visível e posicionado fora da tela** (`position: absolute; left: -9999px`) em vez de `opacity-0 w-1 h-1` para melhor suporte a mobile/teclado virtual.

---

## Componente: Tarefas
### Event Listeners
1. **Cards de tarefa (motion.div)** — `onClick={() => openModal(task)}`.
2. **Botão deletar no card** — `onClick={(e) => { e.stopPropagation(); deleteTask(task.id) }}`.
3. **Input nova tarefa** — `onKeyDown={e => e.key === 'Enter' && addTask()}`.
4. **Botão addTask (+)** — `onClick={addTask}`.
5. **Filtros de status** — `onClick={() => setStatusFilter(s.key)}`.
6. **Selects de filtro** — `onChange` em `personFilter`, `priorityFilter`, `typeFilter`.
7. **Botão atrasadas** — `onClick={() => setShowOverdueOnly(!showOverdueOnly)}`.
8. **Modal backdrop** — `onClick={closeModal}`.
9. **Modal inner** — `onClick={e => e.stopPropagation()}`.
10. **Inputs do modal (editForm)** — `onChange` em title, description, status, priority, taskType, dueDate, assignedTo.
11. **Botão salvar** — `onClick={saveTask}`.
12. **Botão deletar no modal** — `onClick={() => { deleteTask(modalTask.id); closeModal() }}`.
13. **Input de comentário** — `onChange` (atualiza texto + checa mentions) + `onKeyDown` (Enter envia, `@` checa mentions, Backspace checa mentions).
14. **Dropdown de mentions** — `onClick={() => insertMention(user)}`.
15. **Botão enviar comentário** — `onClick={addComment}`.

### Click Chain
```
Usuário clica no card
  → openModal(task)
    → setModalTask(task)
    → setEditForm({ ...task })
    → setNewComment('')

Usuário digita comentário com @
  → onChange: setNewComment(val) + checkMentions(val)
    → checkMentions procura último '@' sem espaço após ele
    → setShowMentions(true), setMentionQuery(texto após @)
  → OU onKeyDown('@'): checkMentions(newComment + '@')

Usuário clica em um usuário do dropdown
  → insertMention(user)
    → newComment.slice(0, lastAtIndex) + '@' + user.name + resto
    → setShowMentions(false)
    → commentInputRef.current?.focus()

Usuário clica em enviar comentário
  → addComment()
    → Extrai mentions comparando strings: if (newComment.includes('@' + u.name)) mentions.push(u.id)
    → axios.post /api/tasks/${id}/comments { text, author, mentions }
    → setNewComment('')
    → axios.get /api/tasks (TODAS as tarefas!)
      → setModalTask(updated) + setEditForm({ ...updated })
    → refetch() (useRealtime refetch)
```

### Bugs/Anomalias encontrados
1. **REGEX DE MENTION QUEBRADO PARA NOMES COMPOSTOS/ACENTOS**:
   - `renderCommentText` usa `text.split(/(@\w+)/g)`.
   - O padrão `\w+` (word characters) **para no espaço** e pode não capturar acentos corretamente dependendo da engine.
   - Como `insertMention` insere `@João Silva`, o regex divide como: `["@João", " ", "Silva"]`. O "@João" é destacado, mas "Silva" fica como texto normal.
   - Isso quebra completamente a renderização visual de mentions para nomes compostos (ex: "Abner Machado", "Maria Clara").

2. **TRIPLE FETCH AO ADICIONAR COMENTÁRIO**:
   - `addComment` faz: (1) `POST /comments`, (2) `GET /api/tasks` (lista inteira!), (3) `refetch()` (outro `GET /api/tasks`).
   - O `GET` intermediário busca **todas as tarefas** só para atualizar o modal da tarefa atual. Isso é extremamente ineficiente.
   - O `refetch()` do `useRealtime` já atualiza `tasks`. Como `modalTask` é estado separado, o modal não se atualiza automaticamente quando `tasks` muda (a menos que haja um `useEffect` ouvindo `tasks`, que não existe). Por isso o autor fez o GET manual.

3. **RACE CONDITION: modalTask desatualizado vs tasks**:
   - `modalTask` e `editForm` são estados locais copiados no momento do `openModal`.
   - Se outro usuário edita a mesma tarefa enquanto o modal está aberto, o `useRealtime` atualiza `tasks`, mas `modalTask` permanece com os dados antigos.
   - Não há `useEffect` para sincronizar `modalTask` com a versão mais recente de `tasks`.

4. **DUPLA AVALIAÇÃO DE MENTIONS**:
   - `onChange` chama `checkMentions(val)` a cada caractere digitado.
   - `onKeyDown` também chama `checkMentions(newComment + '@')` quando a tecla `@` é pressionada.
   - Como `onChange` já dispara ao digitar `@`, o `onKeyDown` é redundante. Além disso, `onKeyDown` passa `newComment + '@'`, mas `newComment` ainda não inclui o `@` porque o `onChange` não processou ainda. Isso pode causar uma checagem com texto desatualizado.

5. **RE-RENDERIZAÇÃO DESNECESSÁRIA DA LISTA INTEIRA**:
   - O modal de edição está embutido no mesmo componente `Tarefas`.
   - Qualquer digitação no input de comentário (`setNewComment`) ou edição de campos do `editForm` re-renderiza **toda a lista de tarefas** (incluindo `filtered.map(...)` com `AnimatePresence` para cada card).
   - **Impacto**: Digitar um comentário longo causa dezenas de re-renderizações da lista completa.

6. **BUG DE UX: Delete no card sem confirmação**:
   - O botão deletar no card (`Trash2`) executa `deleteTask(task.id)` imediatamente, sem `confirm()`.
   - O usuário pode deletar acidentalmente uma tarefa ao tentar clicar no card (embora o stopPropagation impeça em desktops, em touch devices o comportamento pode ser diferente).

7. **Z-INDEX DO MENTION DROPDOWN**:
   - O dropdown de mentions usa `z-[50]`.
   - O modal usa `z-50` (classe padrão Tailwind).
   - Como o dropdown está **dentro** do modal (filho no DOM), o stacking context do modal define a base. `z-[50]` dentro de `z-50` funciona, mas é redundante e confuso.

### Recomendações
- **Corrigir regex de mentions**: usar `new RegExp('@' + escapeRegex(user.name), 'g')` ou iterar sobre `MENTION_USERS` para substituir strings exatas.
- **Extrair o modal para um componente separado** (`TaskModal` ou `TaskEditModal`) para evitar re-renderização da lista.
- **Remover o GET manual intermediário** em `addComment`. Sincronizar `modalTask` via `useEffect` ouvindo `tasks`.
- **Adicionar `window.confirm()`** antes de `deleteTask`.
- **Remover `onKeyDown` redundante** para `@` mentions.

---

## Componente: NotificationCenter
### Event Listeners
1. **Botão sino (buttonRef)** — `onClick={(e) => { e.stopPropagation(); setOpen(!open); }}`.
2. **Overlay backdrop (portal)** — `onClick={(e) => { e.stopPropagation(); setOpen(false); }}`.
3. **Painel de notificações (portal)** — `onClick={(e) => e.stopPropagation()}`.
4. **Botão "Marcar todas como lidas"** — `onClick={markAllAsRead}`.
5. **Botão marcar como lida individual (Check)** — `onClick={() => markAsRead(n.id)}`.
6. **Botão remover (X)** — `onClick={() => removeNotification(n.id)}`.
7. **Global listeners**:
   - `useEffect []`: `setInterval(fetchNotifications, 30000)`.
   - `useEffect []`: WebSocket `new WebSocket(...)` com `onmessage` para recarregar notificações.

### Click Chain
```
Usuário clica no sino
  → setOpen(!open)
    → useEffect [open] dispara
      → if (open) → calcula posição do botão + markAllAsRead() AUTOMATICAMENTE
        → axios.post('/api/notifications/read-all')
        → setNotifications(prev => prev.map(n => ({ ...n, read: true })))
        → setUnreadCount(0)

Usuário clica em uma notificação específica para marcar como lida
  → markAsRead(id)
    → axios.post(`/api/notifications/${id}/read`)
    → setNotifications(prev => prev.map(...read: true))
    → setUnreadCount(prev => Math.max(0, prev - 1))
```

### Bugs/Anomalias encontrados
1. **AUTO-MARK-ALL-AS-READ AO ABRIR (UX DISRUPTIVO)**:
   - O `useEffect` com dependência `[open]` chama `markAllAsRead()` automaticamente quando `open` muda para `true`.
   - Isso significa que o usuário **nunca vê quais notificações eram não-lidas** — elas são marcadas como lidas no backend imediatamente ao abrir o painel.
   - Se o usuário abrir por acidente e fechar, perdeu a oportunidade de identificar o que era importante.
   - Além disso, se `markAllAsRead()` falhar no backend (erro de rede), o frontend já mostra tudo como lido (`setNotifications(prev => prev.map(...read: true))`), criando um **estado inconsistente**.

2. **CONFLITO DE Z-INDEX E PORTAL COM CHANGELOGBADGE**:
   - `NotificationCenter` usa `z-[9999]` no container, overlay `z-[9998]`, painel `z-[9999]`.
   - `ChangelogBadge` usa overlay `z-[9998]`, painel `z-[9999]`.
   - Ambos renderizam via `createPortal(document.body)`.
   - Se o usuário abrir NotificationCenter e depois clicar no sino do ChangelogBadge, os dois painéis ficam abertos com o mesmo z-index. A ordem de empilhamento depende da ordem de montagem no DOM. Não há controle de qual deve ficar por cima.
   - **Não há `handleClickOutside`** no NotificationCenter! Se o usuário clica fora, o overlay fecha, mas não há listener global de `mousedown` no documento. O ChangelogBadge, por outro lado, tem. Isso cria inconsistência de comportamento.

3. **WEBSOCKET SEM RECONEXÃO**:
   - O WebSocket é criado uma vez no mount (`useEffect []`).
   - Se a conexão cair (`ws.onclose` não é tratado), não há lógica de reconexão. O usuário deixa de receber notificações em tempo real sem saber.
   - O WebSocket é fechado no cleanup, mas se o componente remontar (ex: navegação que preserva TopBar não remonta, mas se houver hot reload ou erro boundary), uma nova conexão é criada.

4. **ESTADO DE LEITURA OTIMISTICO SEM ROLLBACK**:
   - `markAsRead` e `markAllAsRead` atualizam o estado local **antes** de confirmar que a API respondeu com sucesso.
   - Se a API falhar, a notificação continua aparecendo como "lida" no frontend, mas no backend ainda está "não lida". Na próxima re-renderização ou refetch, o badge de não-lidas pode reaparecer magicamente.

5. **RE-RENDERIZAÇÃO A CADA 30s**:
   - `fetchNotifications` é chamado a cada 30s. Se o usuário estiver em outra aba do browser, o `setInterval` continua rodando (embora alguns browsers throtlem). Isso gasta bateria e banda desnecessariamente.

### Recomendações
- **Remover `markAllAsRead()` automático** do `useEffect [open]`. Adicionar um botão visível "Marcar todas como lidas" e deixar o usuário decidir.
- **Adicionar `handleClickOutside`** via `document.addEventListener('mousedown', ...)` para consistência com ChangelogBadge.
- **Implementar reconexão de WebSocket** com backoff exponencial.
- **Usar Page Visibility API** para pausar `fetchNotifications` quando a aba está inativa.
- **Adicionar rollback de estado** em caso de erro nas APIs de marcação como lida.

---

## Componente: App.jsx
### Event Listeners
Não há event listeners diretamente em App.jsx (exceto via componentes filhos).

### Click Chain
Não aplicável (componente de roteamento).

### Bugs/Anomalias encontrados
1. **AUSÊNCIA TOTAL DE LAZY LOADING / CODE SPLITTING**:
   - Todas as 30+ páginas são importadas **estaticamente** no topo do arquivo.
   - Não há `React.lazy`, `Suspense`, `import()` dinâmico.
   - **Impacto**: O bundle inicial do webpack/vite carrega TODO o código da aplicação, mesmo que o usuário nunca acesse páginas como `Seguranca`, `SystemEngine`, `LunaControl`, etc. Isso aumenta drasticamente o Time to Interactive (TTI) e o consumo de memória.

2. **CONTEXT PROVIDERS DESNECESSÁRIOS NA LANDING PAGE**:
   - `EmailFocusModeProvider` e `EmailDensityProvider` envolvem **todas as rotas**, incluindo a landing page pública (`/` → `<LandingPage />`).
   - A landing page não utiliza funcionalidades de email, então esses contexts são overhead puro.
   - Idealmente, providers específicos de módulo deveriam estar dentro do `ProtectedLayout` ou lazy-loaded com as páginas de email.

3. **DUPLICAÇÃO DE INTERCEPTADORES AXIOS**:
   - `main.jsx` já registra interceptadores de request (adiciona token) e response (401 redirect).
   - `AuthContext.jsx` também registra um interceptador de response para 401 (linhas 31-44).
   - Resultado: **dois interceptadores de response** para 401. Ambos fazem `localStorage.removeItem('nexo_token')` e `window.location.href = '/'`. Isso não quebra, mas é redundante e pode causar comportamentos estranhos (double redirect, race conditions no `window.location.href`).

4. **TODAS AS ROTAS INTERNAS EM UM ÚNICO `<Routes>` DENTRO DE PROTECTEDLAYOUT**:
   - O `ProtectedLayout` renderiza `<Routes>` com ~30 rotas. Cada navegação entre páginas internas muda o `element` mas não causa unmount do `ProtectedLayout`.
   - Isso é bom para preservar estado (Sidebar, FAB), mas significa que **todos os harvesters** (`RouteHarvester`, `LunaFloatingButton`, `LunaProactiveToast`) permanecem ativos em todas as páginas. Se algum deles tiver efeitos colaterais pesados, afeta toda a app.

5. **ROTEAMENTO SEM TRATAMENTO DE 404**:
   - Não há `<Route path="*" element={<NotFound />} />`. URLs inexistentes dentro do protected layout simplesmente renderizam uma tela em branco (pois nenhuma rota matcha).

### Recomendações
- **Implementar React.lazy + Suspense** para todas as páginas. Agrupar por módulo (Financeiro, Email, etc.).
- **Mover EmailFocusModeProvider e EmailDensityProvider** para dentro de `EmailHub` ou `ProtectedLayout`, não no root.
- **Remover o interceptador duplicado de 401** do `AuthContext.jsx` (manter apenas em `main.jsx`).
- **Adicionar rota catch-all `path="*"`** com uma página 404.
- **Considerar dividir o bundle por rota** usando `import(/* webpackChunkName: "finance" */ './pages/Financeiro')`.

---

## Observações Gerais sobre Arquitetura

### Prop Drilling / Context Hell
- **Nível moderado de Context Hell**:
  - `AuthProvider` → `ToastProvider` → `LunaProvider` → `App`.
  - `LunaContext` é um "mega-context" com ~10 propriedades (`visibleData`, `userFocus`, `recentActions`, `systemMap`, etc.). Toda vez que qualquer propriedade muda, **todos os consumidores do contexto re-renderizam**.
  - `useLunaContext` é usado por `LunaFloatingButton`, `LunaBatchAction`, e potencialmente outros. Como o contexto é atualizado frequentemente (a cada clique via `useLunaDOM`), isso causa re-renderizações em cascata.
- **Prop Drilling**: Não é grave em Tarefas/ChangelogBadge, mas `TopBar` passa ~6 props para `ChangelogBadge`. Isso é aceitável.

### Padrão de Event Bus
- `lunaEventBus` é um `EventTarget` global. Ele permite comunicação desacoplada mas dificulta o rastreamento de "quem está ouvindo quem".
- Vulnerabilidade: qualquer componente pode emitir `luna:stateChange` e alterar o estado global da Luna. Não há validação de origem.
- O `lunaEventBus` é exposto em `window.lunaEventBus`, permitindo manipulação via console do navegador.

### z-index: Mapeamento Completo Encontrado
| Componente | z-index |
|---|---|
| ChangelogBadge overlay | 9998 |
| ChangelogBadge panel | 9999 |
| NotificationCenter container | 9999 |
| NotificationCenter overlay | 9998 |
| NotificationCenter panel | 9999 |
| TopBar user dropdown | 9990 |
| Sidebar tooltip | 9990 |
| PushNotificationButton tooltip | 9990 |
| LunaChatPanel overlay | 9980 |
| LunaChatPanel drawer | 9981 |
| Ideas/Comments dropdowns | 9990 |
| LunaActionDrawer | 110 |
| LunaActionCenter | 110 |
| LunaFloatingButton FAB | 100 |
| LunaFloatingButton badge | 101 |
| LunaFloatingButton chat result | 95 |
| LunaFloatingButton input overlay | 90 |
| ToastContainer | 100 |
| CommandPalette | 50 |
| SecretTerminal | 50 |
| Tarefas mention dropdown | 50 |
| WorkspaceFileViewer | 60 |
| SyncSessionModal | 100 |
| SmartFormModal | 100 |

**Anomalia crítica**: Há duas escalas de z-index completamente diferentes: uma escala "normal" (50-110) e uma escala "extrema" (9980-9999). Componentes como `LunaChatPanel` (9981) ficam **abaixo** de `Sidebar` tooltips (9990). Isso indica crescimento descontrolado sem design system.

---

## Sumário Executivo
| Componente | Severidade | Problema Principal |
|---|---|---|
| ChangelogBadge | 🔴 Alta | Double close handler (overlay + mousedown) + z-index conflito com NotificationCenter |
| LunaFloatingButton | 🔴 Alta | Re-render a cada pixel durante drag + sem suporte touch + estado fragmentado |
| SecretTerminal | 🟡 Média | Shadowing de `performance` + input anti-pattern + race no honeypot |
| Tarefas | 🔴 Alta | Regex de mention quebrado + re-render da lista inteira a cada digitação no modal + triple fetch |
| NotificationCenter | 🟡 Média | Auto-mark-all-as-read ao abrir + WS sem reconexão |
| App.jsx | 🟡 Média | Zero code splitting + interceptadores axios duplicados |
