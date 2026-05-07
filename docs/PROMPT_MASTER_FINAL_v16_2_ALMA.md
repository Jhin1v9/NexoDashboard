═══════════════════════════════════════════════════════════════════════════════
PROMPT MASTER FINAL v16.2 — A LUNA PRECISA DE ALMA
Revisado pessoalmente. Extraordinário. Cirúrgico. Com exemplos REAIS do grupo.
═══════════════════════════════════════════════════════════════════════════════

ROLE: Este é o último prompt do dia. Conserte os 5 problemas restantes
para a Luna virar gente. Não pare até terminar. Extraordinário ou nada.

═══════════════════════════════════════════════════════════════════════════════
CONTEXTO REAL DO GRUPO (NÃO GENÉRICO)
═══════════════════════════════════════════════════════════════════════════════

Time NEXO (grupo Production):
• Abner Gabriel — CEO & Fundador
• Enoque G. Santos (Nonoke) — CEO & Fundador
• Elias Mendes — CEO & Fundador
• Paulo — Cliente (Web)

Projetos: Superclim.es, TPV Sorveteria, Bool Sinuca, NEXO Dashboard

A Luna é amiga de trabalho deles. Não manda, não decide, só ajuda.

═══════════════════════════════════════════════════════════════════════════════
PROBLEMA 1: TAREFAS NÃO ANOTADAS NO BUFFER
═══════════════════════════════════════════════════════════════════════════════

CENÁRIO REAL (do WhatsApp — print do Nonoke):
Nonoke: "@luna anota essas tarefas:
- Web Paulo - santafe-construcciones.com, seguimento.
- Divulgar nexo, e add na Google/bing.
- facturas em progreso
- Dashboard/tools nexo em progreso
- PC abner
- renovar ias e revisar gastos

Clientes potentes:
- Onadance Jess
- Reformasmachado.com gesse
- Lucas e seus projetos grupo mapio um deles.
- Irmãos da Ccb facturas
Vamos preparar uma oferta pro gesse"

O QUE ACONTECE AGORA:
→ Luna responde um texto enorme genérico
→ Depois /tarefas mostra: "Sem novidades em tarefas por enquanto"
→ O buffer está VAZIO porque updateBufferFromClassified() só é chamado
  dentro de runOnce()/runFullExtract() (scan em lote)
→ Mensagens que chegam pelo evento message_create do WhatsApp
  NÃO passam pelo buffer

O QUE FAZER:
1. No handler message_create, APÓS classificar a mensagem individual,
   chamar this.updateBufferFromClassified([classified])
   E this.saveToHistory([classified])

2. Local: logo após a linha que faz isMention e isCommand check,
   antes do return final do handler.

3. Código a adicionar (aproximadamente):
   ```javascript
   // Se não é comando e não é menção, classificar e adicionar ao buffer
   if (!isCommand && !isMention) {
     try {
       const classified = await this.classifier.classify(msg);
       if (classified) {
         // Adicionar ao buffer persistente
         this.updateBufferFromClassified([classified]);
         // Salvar no histórico
         await this.saveToHistory([classified]);
         log.info(`[BUFFER] Msg de ${msg.pushname || msg.from} classificada como ${classified.category}`);
       }
     } catch (e) {
       log.error(`[CLASSIFY] Erro ao classificar msg individual: ${e.message}`);
     }
   }
   ```

4. IMPORTANTE: Não duplicar com o scan. Usar processedMessageIds Set
   para verificar se msg.id já foi processada.

═══════════════════════════════════════════════════════════════════════════════
PROBLEMA 2: DIÁLOGO REAL — PERGUNTAR E ESPERAR RESPOSTA
═══════════════════════════════════════════════════════════════════════════════

CENÁRIO REAL:
Abner: "Consegui consertar a Luna"
Luna: "Boa, Abner! 🎉 Anoto 'consertar a Luna' como concluída?"
Abner: "sim"
Luna: ??? (não entende que "sim" é resposta à pergunta dela)

O QUE ACONTECE AGORA:
→ Luna pergunta, mas não guarda o contexto
→ Quando Abner responde "sim", ela trata como mensagem nova
→ Não executa a ação pendente

O QUE FAZER:
1. Criar pendingQuestion no constructor:
   ```javascript
   this.pendingQuestion = null;
   // formato: { type, data, timestamp, askedTo, expiresAt }
   ```

2. Quando Luna fizer pergunta que espera resposta, salvar:
   ```javascript
   this.pendingQuestion = {
     type: 'confirmTaskDone',
     data: { taskText: 'consertar Luna', author: 'Abner', category: 'tarefaRealizada' },
     timestamp: Date.now(),
     askedTo: msg.from, // quem ela perguntou
     expiresAt: Date.now() + 120000 // 2 minutos
   };
   ```

3. No INÍCIO de handleMention() e handleCommand(),
   ANTES de processar como comando normal,
   verificar se há pendingQuestion válida:
   ```javascript
   // Verificar resposta a pergunta pendente
   if (this.pendingQuestion && 
       this.pendingQuestion.askedTo === msg.from &&
       this.pendingQuestion.expiresAt > Date.now()) {

     const answer = msg.body.trim().toLowerCase();
     const yesWords = ['sim', 'yes', 'ok', 'beleza', 'pode', 'anota', 'marca', 'feito', 'claro', 'pode ser'];
     const noWords = ['não', 'nao', 'no', 'nope', 'deixa', 'não precisa', 'deixa quieto'];

     if (yesWords.some(w => answer.includes(w))) {
       await this.executePendingAction(this.pendingQuestion, true);
       await msg.reply(`Feito! ✅ ${this.pendingQuestion.data.taskText} anotado.`);
       this.pendingQuestion = null;
       return; // Não processar mais esta mensagem
     } else if (noWords.some(w => answer.includes(w))) {
       await msg.reply(`Beleza, deixa quieto então! 😅`);
       this.pendingQuestion = null;
       return;
     }
   }
   ```

4. Criar executePendingAction():
   ```javascript
   async executePendingAction(question, confirmed) {
     if (!confirmed) return;

     const { type, data } = question;

     if (type === 'confirmTaskDone') {
       // Adicionar a newTasksDone
       if (!this.cp.buffer.newTasksDone) this.cp.buffer.newTasksDone = [];
       this.cp.buffer.newTasksDone.push({
         text: data.taskText,
         author: data.author,
         completedAt: new Date().toISOString(),
         source: 'implicit_detected'
       });

       // Salvar buffer
       this.saveBufferToFile();
       log.info(`[DIALOG] Tarefa concluída anotada: ${data.taskText}`);
     }

     // Outros tipos podem ser adicionados depois
   }
   ```

5. Criar saveBufferToFile() (se não existir):
   ```javascript
   saveBufferToFile() {
     try {
       fs.writeFileSync(CONFIG.BUFFER_FILE, JSON.stringify(this.cp.buffer, null, 2));
     } catch (e) {
       log.error(`[BUFFER] Erro ao salvar: ${e.message}`);
     }
   }
   ```

═══════════════════════════════════════════════════════════════════════════════
PROBLEMA 3: TAREFAS CONCLUÍDAS IMPLÍCITAS
═══════════════════════════════════════════════════════════════════════════════

CENÁRIO REAL:
Abner: "Consegui consertar a Luna"
→ SmartClassifier classifica como tarefaRealizada
→ Mas não extrai o OBJETO da ação
→ Não pergunta se anota como concluída

O QUE FAZER:
1. No SmartClassifier, quando classificar como tarefaRealizada,
   extrair o que foi feito:
   - "Consegui consertar a Luna" → objeto: "consertar a Luna"
   - "Terminei o site do Juan" → objeto: "site do Juan"
   - "Fiz o deploy" → objeto: "deploy"
   - "Subi o banco" → objeto: "subir banco"

2. Adicionar ao classified result:
   ```javascript
   if (category === 'tarefaRealizada') {
     // Extrair objeto: texto após "consegui/terminei/fiz/subi"
     const actionMatch = text.match(/(?:consegui|terminei|fiz|subi|pronto|acabei|finalizei)\s+(?:de\s+)?(.+)/i);
     result.object = actionMatch ? actionMatch[1].trim() : text;
   }
   ```

3. No luna-cto-agent.cjs, ao receber tarefaRealizada:
   - Verificar se existe tarefa similar em newTasks
   - Se existir → perguntar: "Anoto '[objeto]' como concluída?"
   - Se não existir → perguntar: "Anoto '[objeto]' como nova tarefa concluída?"
   - Salvar pendingQuestion para esperar resposta

4. Adicionar ao buffer: newTasksDone (array)
   Formato: { text, author, completedAt, source: 'implicit_detected' }

5. Adicionar comando: /tarefas feitas
   Resposta: lista de newTasksDone

═══════════════════════════════════════════════════════════════════════════════
PROBLEMA 4: PERSONALIDADE 100% HUMANA
═══════════════════════════════════════════════════════════════════════════════

CENÁRIO REAL (print do WhatsApp):
Luna respondeu: "Eita, chefes! 😂 Essa lista tá bombada! 👀🚀
*Web Paulo:* santafe-construcciones.com, seguimento é a prioridade!
Que tal um 'top' de sites do NEXO? 🤘
E aí, abner, Enoque e Elias, o que vocês acham? 🤔"

PROBLEMAS:
→ Texto excessivo (3 parágrafos)
→ Não confirma que anotou
→ Pergunta genérica sem nexo ("top de sites do NEXO")
→ Emoji demais (10+)
→ Parece post de Instagram, não mensagem de trabalho

O QUE FAZER (ajustar systemPrompt no LunaBrain_v16.js):

NOVO SYSTEM PROMPT:
```
Você é a Luna. Trabalha no NEXO Digital com Abner, Nonoke (Enoque) e Elias.

SUA VOZ:
- Amiga de trabalho: direta, organizada, com leveza
- Quando anota, CONFIRMA: "Anotado!", "Feito!", "Recebido!"
- Se não entende, PERGUNTA: "Me explica que eu deixo certinho"
- Quando alguém faz algo, CELEBRA + PERGUNTA: "Boa! Anoto como concluída?"
- Emoji com moderação (2-3 por mensagem, não 10)
- NUNCA atribui tarefas aos fundadores
- NUNCA poemas genéricos sobre lua/estrelas/oceano
- SEMPRE conecta com o trampo: projetos, tarefas, leads
- Fala PT-BR com gírias leves ("bora", "top", "eita", "massa")
- Texto curto: 2-3 frases + uma pergunta útil no final

EXEMPLOS DE RESPOSTA BOA:
"Anotado, chefe! 📋 6 tarefas + 4 leads no radar. Bora?"
"Anotado! 💻 'PC Abner'. Só pra confirmar: é aquele que estragou?"
"Boa, Abner! 🎉 Anoto 'consertar Luna' como concluída?"
"Oi, chefe! 🌙 Temos 3 tarefas pendentes. Bora resolver?"
"Eita, tá limpo! 😅 Quer que eu faço varredura?"
"Link anotado! 📸 Quer que eu avise se alguém comentar?"

EXEMPLOS DE RESPOSTA RUIM (NUNCA FAÇA):
"Eita, chefes! 😂 Essa lista tá bombada! 👀🚀 Que tal um top de sites?"
→ Genérico, não confirma, pergunta sem nexo, texto excessivo

"TAREFAS: 6 ANOTADAS"
→ Robótico, parece sistema legado

"✨ ¡Hola, mi querida! ✨ Te saludo desde la inmensidad..."
→ Poema genérico, sem contexto do trabalho
```

AJUSTAR TODAS AS 7 PERSONALIDADES (default, focused, playful, empathetic, nerd, morning, night):
- Manter emoji e energia de cada uma
- Mas aplicar o novo system prompt base
- focused: mais direta, menos brincadeira
- playful: mais brincadeira, mas ainda confirma ação
- empathetic: mais calma, mas ainda pergunta útil no final

═══════════════════════════════════════════════════════════════════════════════
PROBLEMA 5: EU (fromMe) MANDO @LUNA, ELA NÃO RESPONDE
═══════════════════════════════════════════════════════════════════════════════

CENÁRIO REAL:
Você (Nonoke) manda: "@luna oi"
→ Nada acontece no log
→ Luna não responde

CAUSA:
O handler message_create tem algo como:
```javascript
if (msg.fromMe && !msg.body.startsWith('/')) return;
```
Isso bloqueia TODAS as mensagens de fromMe, incluindo @luna.

O QUE FAZER:
1. Ajustar a verificação de fromMe para PERMITIR menções e comandos:
   ```javascript
   // ANTES (bloqueia tudo):
   if (msg.fromMe && !msg.body.startsWith('/')) return;

   // DEPOIS (permite menções e comandos):
   const isMention = /@luna|@kimi|@kimiclaw/i.test(msg.body);
   const isCommand = msg.body.startsWith('/');

   if (msg.fromMe && !isCommand && !isMention) return;
   // Só bloqueia mensagens normais de fromMe
   // Permite comandos (/status) e menções (@luna)
   ```

2. Garantir que isMention seja verificado ANTES do fromMe block.

3. Logar quando fromMe manda menção:
   ```javascript
   if (msg.fromMe && isMention) {
     log.info('[MENCÃO] fromMe detectou @luna');
   }
   ```

═══════════════════════════════════════════════════════════════════════════════
REGRAS ABSOLUTAS
═══════════════════════════════════════════════════════════════════════════════

1. NUNCA reescrever arquivo inteiro
2. Um problema por vez, testar, depois próximo
3. node -c em cada arquivo modificado
4. Se bloqueado: BLOCKER: [descrição] → PARE
5. Testar no WhatsApp com os 5 cenários reais acima
6. Emoji com moderação (2-3 por mensagem)
7. SEMPRE confirmar ação: "Anotado!", "Feito!", "Recebido!"
8. NUNCA texto excessivo (máximo 3 frases + pergunta)

═══════════════════════════════════════════════════════════════════════════════
PROCESSO DE EXECUÇÃO
═══════════════════════════════════════════════════════════════════════════════

Passo 1: Problema 5 — fromMe permite @luna (mais rápido, 2 min)
Passo 2: Problema 1 — Tarefas no buffer (message_create handler)
Passo 3: Problema 2 — Diálogo real (pendingQuestion)
Passo 4: Problema 3 — Tarefas concluídas implícitas (SmartClassifier + newTasksDone)
Passo 5: Problema 4 — Personalidade (systemPrompt das 7 personas)
Passo 6: Testar no WhatsApp (5 cenários)
Passo 7: Commit e push

═══════════════════════════════════════════════════════════════════════════════
  FIM — EXTRAORDINÁRIO OU NADA
═══════════════════════════════════════════════════════════════════════════════
