# Skill: Criar Nova API no Backend

## Quando Usar
Quando o frontend precisa de um novo endpoint ou quando integrando servicos externos.

## Passos

1. **Defina o contrato**
   ```
   Metodo: GET/POST/PUT/DELETE
   Path: /api/nome-recurso
   Body (se POST/PUT): { campo1, campo2 }
   Response: { success, data, count }
   ```

2. **Adicione a rota em `backend/server.js`**
   - Coloque ANTES do catch-all `app.get('*')`
   - Use helpers `readJSON` e `writeJSON`
   - Valide inputs antes de processar

3. **Teste a API**
   ```powershell
   Invoke-RestMethod -Uri "http://127.0.0.1:3456/api/nome-recurso" -Method GET
   ```

4. **Documente no AGENTS.md** (se API publica/importante)

## Exemplo
```javascript
// GET /api/leads — lista leads
app.get('/api/leads', (req, res) => {
  const data = readJSON(LEADS_FILE) || { leads: [] }
  res.json({ success: true, count: data.leads.length, leads: data.leads })
})

// POST /api/leads — criar lead
app.post('/api/leads', (req, res) => {
  const { name, email, phone } = req.body
  if (!name || !email) {
    return res.status(400).json({ success: false, error: 'name and email required' })
  }
  const lead = { id: `lead-${Date.now()}`, name, email, phone, createdAt: new Date().toISOString() }
  const data = readJSON(LEADS_FILE) || { leads: [] }
  data.leads.push(lead)
  writeJSON(LEADS_FILE, data)
  res.status(201).json({ success: true, lead })
})
```
