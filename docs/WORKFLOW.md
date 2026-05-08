# Development Workflow — NEXO Dashboard PRO

## Phase 1: ANALYZE (Read-Only)

1. **Entenda a tarefa**
   - O que o usuario quer? Qual o problema? Qual a solucao esperada?
   - Leia a descricao completa antes de comecar

2. **Explore o codigo existente**
   - Use Glob para encontrar arquivos relevantes
   - Use ReadFile para entender implementacao atual
   - Identifique padroes: como outros componentes/paginas fazem similar?

3. **Identifique dependencias**
   - Quais arquivos serao afetados?
   - Ha APIs que precisam ser criadas/atualizadas?
   - Ha componentes que precisam ser reusados?

## Phase 2: PLAN

**Para mudancas simples (<3 arquivos):**
- Proceda diretamente

**Para mudancas medias (3-5 arquivos):**
- Escreva plano bullet-point com arquivos a modificar

**Para mudancas complexas (>5 arquivos ou breaking changes):**
- Escreva plano detalhado
- Pergunte ao usuario se quer prosseguir

## Phase 3: IMPLEMENT

1. **Backend primeiro** (se necessario)
   - Crie/atualize APIs em `backend/server.js`
   - Adicione dados iniciais em `backend/data/`
   - Teste a API com curl ou Invoke-RestMethod

2. **Frontend depois**
   - Crie paginas em `frontend/src/pages/`
   - Crie componentes em `frontend/src/components/`
   - Adicione hooks em `frontend/src/hooks/`
   - Atualize rotas em `App.jsx`
   - Atualize sidebar em `Sidebar.jsx`

3. **Siga convencoes**
   - Veja `docs/CONVENTIONS.md`
   - Mantenha consistencia com codigo existente
   - Use mesmo estilo de naming, organizacao, patterns

## Phase 4: VALIDATE

1. **Build**
   ```bash
   cd frontend && npm run build
   ```

2. **Backend**
   ```bash
   node backend/server.js
   # Verifique se inicia sem erros
   ```

3. **Testes manuais**
   - A funcionalidade funciona como esperado?
   - Nao quebrou outras funcionalidades?
   - UI esta correta?

4. **Qualidade**
   - Nao ha console.log esquecidos
   - Nao ha codigo comentado desnecessario
   - Erros sao tratados apropriadamente

## Phase 5: COMMIT

1. **Revisao**
   ```bash
   git add -A
   git diff --cached --stat
   ```

2. **Commit**
   ```bash
   git commit -m "[Modulo] Descricao da mudanca"
   ```

3. **Push** (SEMPRE peca confirmacao)
   ```bash
   git push origin main  # SÓ com confirmacao do usuario
   ```

## Error Handling

| Problema | Acao |
|----------|------|
| Build falhou | Leia o erro, corrija, tente novamente |
| Backend nao inicia | Verifique porta em uso, syntax errors |
| API retorna erro | Verifique logs, teste isoladamente |
| Teste manual falha | Debugue, adicione logs temporarios |
| Git conflict | Pergunte ao usuario como resolver |
