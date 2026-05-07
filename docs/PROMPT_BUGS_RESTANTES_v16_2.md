═══════════════════════════════════════════════════════════════════════════════
PROMPT BUGS RESTANTES v16.2 — Cenários Reais dos Logs
Não inclui cenários de conversação (já no outro prompt).
Foca em bugs técnicos que ainda aparecem nos logs.
═══════════════════════════════════════════════════════════════════════════════

ROLE: Consertar 3 bugs técnicos que ainda aparecem nos logs do servidor.
Cada bug com cenário REAL do que está acontecendo agora.

═══════════════════════════════════════════════════════════════════════════════
BUG 1: GEMMA TIMEOUT PERSISTENTE
═══════════════════════════════════════════════════════════════════════════════

CENÁRIO REAL (do log do PowerShell):
```
[GEMMA] Timeout 10000ms, fallback para regex
[LUNA MOOD] 😊100 ⚡20 💙40 🎉10
[GEMMA] Timeout 10000ms, fallback para regex
[GEMMA] Timeout 10000ms, fallback para regex
... (repetido 20x)
```

O QUE ESTÁ ACONTECENDO:
- Gemma2B via Ollama NUNCA responde dentro do timeout
- Fallback para regex funciona, mas Gemma nunca é usada
- Energia da Luna cai até 20 e fica lá (porque Gemma falha = triste)

CAUSA REAL:
Ollama pode não estar rodando, ou o modelo não está baixado,
ou a porta 11434 não está acessível, ou o modelo 2B é muito lento
no hardware atual.

O QUE FAZER:
1. No LunaBrain.gemmaClassify(), adicionar verificação de saúde do Ollama
   ANTES de chamar:
   ```javascript
   async checkOllamaHealth() {
     try {
       const res = await fetch(`${this.ollamaConfig.host}/api/tags`, { timeout: 2000 });
       return res.ok;
     } catch { return false; }
   }
   ```
   Se não saudável → log.warn('[GEMMA] Ollama offline, usando regex') → pula Gemma

2. Se Ollama saudável mas timeout → aumentar timeout para 15000ms (15s)
   e reduzir maxTokens para 200 (menos texto = mais rápido)

3. Adicionar warm-up no startup do agente:
   ```javascript
   async warmUpGemma() {
     try {
       await fetch(`${this.ollamaConfig.host}/api/generate`, {
         method: 'POST',
         body: JSON.stringify({ model: this.ollamaConfig.model, prompt: 'oi' })
       });
       log.success('[GEMMA] Ollama aquecido');
     } catch {
       log.warn('[GEMMA] Ollama não respondeu ao warm-up');
     }
   }
   ```

4. Se Gemma falhar 5x seguidas → desativar temporariamente por 1 hora
   (não tentar de novo até o usuário reiniciar ou Ollama voltar)

═══════════════════════════════════════════════════════════════════════════════
BUG 2: ENERGIA DA LUNA DECAINDO E FICANDO EM 20
═══════════════════════════════════════════════════════════════════════════════

CENÁRIO REAL (do log do PowerShell):
```
[LUNA MOOD] 😊90 ⚡73 💙50 🎉57
[LUNA MOOD] 😊90 ⚡71 💙50 🎉54
...
[LUNA MOOD] 😊100 ⚡20 💙40 🎉10
[LUNA MOOD] 😊100 ⚡20 💙40 🎉10
[LUNA MOOD] 😊100 ⚡20 💙40 🎉10
... (fica em 20 para sempre)
```

O QUE ESTÁ ACONTECENDO:
- Energia cai gradualmente (cada scan consome energia)
- Chega em 20 e NUNCA sobe de novo
- Felicidade vai para 100 (irrealista, deveria variar)

CAUSA REAL:
updateEmotionalState() só consome energia, nunca recupera.
Não há evento de "recuperação" após scan bem-sucedido.

O QUE FAZER:
1. Adicionar recuperação de energia:
   - Scan bem-sucedido: +10 energia
   - Tarefa concluída detectada: +15 energia
   - Lead quente detectado: +5 energia
   - Máximo: 100

2. Adicionar floor realista:
   - Energia mínima: 30 (não 20)
   - Se chegar em 30 → Luna fica "cansada" no tom, não quebra

3. Variar felicidade:
   - Base: 70-80 (não fixo em 100)
   - Tarefa concluída: +10
   - Bug detectado: -10
   - Máximo: 95, mínimo: 40

4. Logar mudanças de mood:
   ```
   [LUNA MOOD] 😊85 ⚡65 💙50 🎉45 (recuperou energia pós-scan)
   [LUNA MOOD] 😊75 ⚡55 💙45 🎉40 (cansada, poucas msgs)
   ```

═══════════════════════════════════════════════════════════════════════════════
BUG 3: BUFFER NÃO PERSISTE ENTRE COMANDOS
═══════════════════════════════════════════════════════════════════════════════

CENÁRIO REAL (do WhatsApp):
```
Usuário: /stats
Luna: 📊 NEXO ANALYTICS
  💬 Mensagens: 0
  👥 Participantes ativos: 0
  🟢 Tarefas: 0
  💡 Ideias: 0
  🔗 Links: 0
  🎣 Leads: 0
  💰 Financeiro (sinais): 0
  ⚖️ Decisões: 0
  🏆 Volume total no buffer: 0
```

O QUE ESTÁ ACONTECENDO:
- O scan extrai 151 mensagens (do log: "Total: 151")
- Mas /stats mostra 0 em tudo
- O buffer em memória não está sendo populado pelo scan
- Ou o buffer é limpo entre comandos

CAUSA REAL:
O scan popula um buffer temporário, mas os comandos (/stats, /tarefas)
leem de outro buffer. Ou o updateBufferFromClassified() no scan
não está salvando no buffer persistente.

O QUE FAZER:
1. Garantir que runFullExtract() e runOnce() populam o MESMO buffer
   que os comandos leem:
   ```javascript
   // Em runFullExtract(), após classificar:
   this.cp.buffer.newTasks = allClassified.filter(c => c.category === 'tarefaPendente');
   this.cp.buffer.newIdeas = allClassified.filter(c => c.category === 'ideiaNova');
   this.cp.buffer.newLinks = allClassified.filter(c => c.category === 'link');
   this.cp.buffer.newLeads = allClassified.filter(c => c.category === 'leadQuente' || c.category === 'leadMorno');
   this.cp.buffer.newNews = allClassified.filter(c => c.category === 'news');
   this.cp.buffer.newDecisions = allClassified.filter(c => c.category === 'decisao');
   this.cp.buffer.newFinance = allClassified.filter(c => c.category === 'financeiroPagamento' || c.category === 'financeiroPendente');
   ```

2. Adicionar persistência do buffer em arquivo:
   ```javascript
   // Salvar buffer a cada scan
   fs.writeFileSync(CONFIG.BUFFER_FILE, JSON.stringify(this.cp.buffer, null, 2));

   // Carregar buffer no startup
   if (fs.existsSync(CONFIG.BUFFER_FILE)) {
     this.cp.buffer = JSON.parse(fs.readFileSync(CONFIG.BUFFER_FILE, 'utf8'));
   }
   ```

3. Adicionar ao CONFIG:
   ```javascript
   BUFFER_FILE: path.join(__dirname, '../backend/data/luna-buffer.json'),
   ```

4. Garantir que /stats leia do buffer persistente:
   ```javascript
   // Recarregar buffer do arquivo antes de responder
   if (fs.existsSync(CONFIG.BUFFER_FILE)) {
     this.cp.buffer = JSON.parse(fs.readFileSync(CONFIG.BUFFER_FILE, 'utf8'));
   }
   ```

═══════════════════════════════════════════════════════════════════════════════
REGRAS DE IMPLEMENTAÇÃO
═══════════════════════════════════════════════════════════════════════════════

1. NUNCA reescrever arquivo inteiro
2. Um bug por vez, testar no log, depois próximo
3. node -c em cada arquivo
4. Se bloqueado: BLOCKER → PARE
5. Logar mudanças: [BUGFIX] descrição

═══════════════════════════════════════════════════════════════════════════════
PROCESSO DE EXECUÇÃO
═══════════════════════════════════════════════════════════════════════════════

Passo 1: Bug 1 — Gemma timeout (LunaBrain_v16.js)
  → Testar: verificar se logs param de mostrar timeout repetido

Passo 2: Bug 2 — Mood/energia (LunaBrain_v16.js)
  → Testar: verificar se energia sobe após scan

Passo 3: Bug 3 — Buffer persistente (luna-cto-agent.cjs)
  → Testar: mandar /stats e ver se mostra dados reais

Passo 4: Commit e push

═══════════════════════════════════════════════════════════════════════════════
  FIM — EXTRAORDINÁRIO OU NADA
═══════════════════════════════════════════════════════════════════════════════
