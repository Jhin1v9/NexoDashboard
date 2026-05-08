# Skill: Fazer Deploy

## Quando Usar
Quando pronto para enviar mudancas para producao.

## Passos

1. **Verifique o estado**
   ```bash
   git status
   git diff --stat
   ```

2. **Build do frontend**
   ```bash
   cd frontend && npm run build
   ```
   - Deve passar sem erros
   - Verifique se dist/ foi gerado

3. **Teste local**
   ```bash
   node backend/server.js
   ```
   - Acesse http://localhost:3456
   - Teste funcionalidades modificadas

4. **Commit**
   ```bash
   git add -A
   git commit -m "[Modulo] Descricao da mudanca"
   ```

5. **Push** (SEMPRE peca confirmacao)
   ```bash
   git push origin main
   ```

## Regras
- NUNCA faca push sem testar localmente primeiro
- NUNCA faca push sem revisar `git diff`
- SEMPRE mantenha mensagens de commit descritivas
- Se houver erro no deploy, reverta imediatamente
