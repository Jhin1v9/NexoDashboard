# Skill: Debugar Problemas

## Quando Usar
Quando algo nao funciona, build quebra, ou comportamento inesperado.

## Passos

1. **Colete evidencias**
   - Leia logs: `backend/data/*.log`, console do navegador
   - Verifique processos: `Get-Process node`
   - Verifique portas: `Get-NetTCPConnection -LocalPort 3456`

2. **Isole o problema**
   - A API retorna erro? Teste isoladamente com curl/Invoke-RestMethod
   - O frontend nao renderiza? Verifique console do navegador
   - O build falha? Leia a mensagem de erro completa

3. **Faca mudancas minimas**
   - Altere apenas o necessario para testar hipoteses
   - Adicione logs temporarios (remova depois)
   - Use `console.log` ou `Write-Host` para debug

4. **Verifique dependencias**
   - O backend esta rodando?
   - O Chrome CDP esta acessivel (porta 9223)?
   - As variaveis de ambiente estao configuradas?

## Comandos Uteis
```powershell
# Ver logs do backend
Get-Content backend/data/luna-scheduler.log -Tail 20

# Ver se servidor esta rodando
Invoke-RestMethod -Uri "http://127.0.0.1:3456/api/state"

# Ver processos Node
Get-Process node | Select-Object Id, StartTime

# Testar API isolada
Invoke-RestMethod -Uri "http://127.0.0.1:3456/api/changelog" -Method GET
```
