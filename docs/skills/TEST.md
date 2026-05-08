# Skill: Testar Funcionalidades

## Quando Usar
Apos implementar qualquer mudanca no codigo.

## Tipos de Teste

### 1. Build Test
```bash
cd frontend && npm run build
```
- Deve completar sem erros
- Deve gerar arquivos em `frontend/dist/`

### 2. Backend Startup Test
```bash
node backend/server.js
```
- Deve iniciar sem erros
- Deve ouvir na porta 3456

### 3. API Test
```powershell
# Teste a API modificada
Invoke-RestMethod -Uri "http://127.0.0.1:3456/api/sua-api" -Method GET

# Teste POST
Invoke-RestMethod -Uri "http://127.0.0.1:3456/api/sua-api" -Method POST -Body '{"campo":"valor"}' -ContentType "application/json"
```

### 4. Frontend Manual Test
- Acesse http://localhost:3456
- Navegue ate a funcionalidade modificada
- Teste casos positivos e negativos
- Verifique console do navegador (F12)

### 5. Integration Test
- A funcionalidade funciona de ponta a ponta?
- Frontend → Backend → Dados → Frontend (real-time via WS)

## Checklist Final
- [ ] Build passa
- [ ] Backend inicia
- [ ] API responde corretamente
- [ ] Frontend renderiza sem erros
- [ ] Console do navegador limpo
- [ ] Nao quebrou funcionalidades existentes
- [ ] Dados persistem corretamente
