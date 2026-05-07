# 🎯 PROMPT MASTER — Sistema de Access Requests (Approve/Deny)

> **Objetivo:** Implementar no NEXO Dashboard um sistema onde usuários sem acesso podem solicitar entrada, e admins podem aceitar/negar via painel.
>
> **Inspiração:** Vercel Deployment Protection, GitHub Org Invites, Notion Workspace, Slack Workspace
> **Data:** 2026-05-01
> **De:** Luna (CTO Virtual)

---

## 📸 CONTEXTO (Print do Owner)

O usuário está vendo na Vercel: **"Access Required — Pending Approval"**
- Usuário: `nexusplayjuegos-5620`
- Status: Aguardando aprovação do admin
- Quer replicar isso no Dashboard NEXO

---

## 🏆 MELHORES PRÁTICAS (Pesquisa de Apps de Sucesso)

### 1. Vercel — Deployment Protection
- **Flow:** Usuário sem acesso → "Request Access" → Admin recebe email/notificação → Dashboard > Settings > Deployment Protection > Requests → Approve/Decline
- **Features:** Motivo do request, role assignment (viewer/commenter), revoke access anytime
- **URL:** `vercel.com/dashboard/[team]/settings/deployment-protection/requests`

### 2. GitHub — Organization Invites
- **Flow:** Convite enviado → Usuário aceita → Admin aprova → Entra na org
- **Features:** Role-based (member/admin), team assignment, pending invites list

### 3. Notion — Workspace Invites
- **Flow:** Admin convida → Usuário entra com permissões limitadas → Admin pode ajustar
- **Features:** Page-level permissions, guest vs member, bulk actions

### 4. Slack — Workspace Requests
- **Flow:** Usuário tenta entrar → Admin aprova → Recebe canal #general
- **Features:** Email domain auto-approve, manual review for external, message to requester

### 5. Linear — Team Invites
- **Flow:** Convite por email → Usuário aceita → Aparece na lista de members
- **Features:** Simple, clean UI, role assignment (admin/member/guest)

### 6. Atlassian — Product Requests
- **Flow:** Usuário solicita produto → Admin review → Approve/Deny com motivo
- **Features:** Admin review required setting, bulk actions, reason field

---

## 🎯 PADRÃO UNIVERSAL IDENTIFICADO

Todos os apps de sucesso seguem este padrão:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  1. REQUEST     │────▶│  2. PENDING      │────▶│  3. DECISION    │
│  User asks for  │     │  Admin sees list  │     │  Approve / Deny │
│  access + reason │     │  + notifications  │     │  + role + msg   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │                        │
        ▼                        ▼                        ▼
   ┌─────────┐            ┌─────────┐            ┌─────────┐
   │  FORM   │            │  BADGE  │            │ NOTIFY  │
   │ email   │            │ count   │            │ user    │
   │ reason  │            │ alerts  │            │ result  │
   └─────────┘            └─────────┘            └─────────┘
```

---

## 🔧 IMPLEMENTAÇÃO NO DASHBOARD

### A. Estrutura de Dados (JSON)

```json
// access-requests.json
{
  "requests": [
    {
      "id": "req-001",
      "requesterEmail": "nexusplayjuegos@email.com",
      "requesterName": "Nexus Play",
      "requesterAvatar": "...",
      "reason": "Preciso acessar o dashboard para gerenciar pagamentos",
      "status": "pending",
      "role": "viewer",
      "requestedAt": "2026-05-01T17:13:00Z",
      "resolvedAt": null,
      "resolvedBy": null,
      "resolutionMessage": null,
      "ipAddress": "192.168.1.x",
      "userAgent": "Mozilla/5.0..."
    }
  ],
  "settings": {
    "autoApproveDomains": ["nexo-digital.app"],
    "requireReason": true,
    "defaultRole": "viewer",
    "notifyOnRequest": ["email", "whatsapp", "push"]
  }
}

// approved-users.json
{
  "users": [
    {
      "email": "nexusplayjuegos@email.com",
      "name": "Nexus Play",
      "role": "viewer",
      "approvedAt": "2026-05-01T17:15:00Z",
      "approvedBy": "abner@nexo-digital.app",
      "accessCount": 3,
      "lastAccess": "2026-05-01T18:00:00Z"
    }
  ]
}
```

### B. Estados do Request

| Status | Cor | Badge | Significado |
|--------|-----|-------|-------------|
| `pending` | 🟡 Amarelo | "Pendente" | Aguardando decisão do admin |
| `approved` | 🟢 Verde | "Aprovado" | Acesso concedido |
| `denied` | 🔴 Vermelho | "Negado" | Acesso recusado |
| `revoked` | 🟠 Laranja | "Revogado" | Acesso removido depois |
| `expired` | ⚪ Cinza | "Expirado" | Request expirou (7 dias) |

### C. Roles de Acesso

| Role | Permissões | Quem pode atribuir |
|------|-----------|-------------------|
| `owner` | Tudo | Só o criador |
| `admin` | Tudo exceto deletar owner | Owner |
| `editor` | Editar dados, criar tarefas | Admin+ |
| `viewer` | Só visualizar | Admin+ |
| `guest` | Acesso limitado a 1 projeto | Admin+ |

### D. Endpoints API

```
POST   /api/access-request         → Criar novo request
GET    /api/access-requests        → Listar todos (admin only)
PUT    /api/access-requests/:id     → Aprovar/Negar (admin only)
DELETE /api/access-users/:id        → Revogar acesso (admin only)
GET    /api/access-users           → Listar usuários aprovados
POST   /api/access-check           → Verificar se email tem acesso
```

### E. Middleware de Proteção

```javascript
// Middleware: proteger rotas
function requireAccess(req, res, next) {
  const userEmail = req.headers['x-user-email'] || req.session?.email;
  
  if (!userEmail) {
    return res.status(401).json({ 
      error: 'Access Required',
      message: 'Você não tem acesso. Solicite aprovação.',
      requestUrl: '/api/access-request'
    });
  }
  
  const approvedUsers = readJSON(approvedUsersFile);
  const user = approvedUsers.users.find(u => u.email === userEmail);
  
  if (!user) {
    return res.status(403).json({
      error: 'Access Required',
      message: 'Seu acesso está pendente de aprovação ou foi negado.',
      status: 'pending',
      requestForm: true
    });
  }
  
  req.user = user;
  next();
}
```

---

## 🎨 UI/UX — Componentes

### 1. Página "Access Denied" (para usuários não-autorizados)

```jsx
<div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
  <div className="max-w-md w-full glass-card p-8 text-center">
    <Lock className="h-16 w-16 text-nexo-danger mx-auto mb-4" />
    <h1 className="text-2xl font-bold mb-2">Acesso Restrito</h1>
    <p className="text-slate-400 mb-6">
      Você não tem permissão para acessar o NEXO Dashboard.
    </p>
    
    {!hasRequested ? (
      <form onSubmit={handleRequest} className="space-y-4">
        <input
          type="email"
          placeholder="Seu email"
          className="w-full h-12 px-4 rounded-xl bg-slate-800 border border-slate-700"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <input
          type="text"
          placeholder="Seu nome"
          className="w-full h-12 px-4 rounded-xl bg-slate-800 border border-slate-700"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <textarea
          placeholder="Por que você precisa de acesso?"
          className="w-full h-24 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 resize-none"
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
        <button type="submit" className="w-full btn-primary">
          Solicitar Acesso
        </button>
      </form>
    ) : (
      <div className="space-y-4">
        <div className="flex items-center justify-center gap-2 text-yellow-400">
          <Clock className="h-5 w-5" />
          <span>Aguardando aprovação...</span>
        </div>
        <p className="text-sm text-slate-500">
          O admin foi notificado. Você receberá um email quando for aprovado.
        </p>
      </div>
    )}
  </div>
</div>
```

### 2. Admin Panel — Lista de Requests

```jsx
<div className="space-y-4">
  <div className="flex items-center justify-between">
    <h2 className="text-xl font-bold">Solicitações de Acesso</h2>
    <Badge count={pendingCount} />
  </div>
  
  {requests.map(req => (
    <div key={req.id} className="mobile-card flex flex-col sm:flex-row gap-4">
      <div className="flex items-center gap-3 flex-1">
        <Avatar email={req.requesterEmail} />
        <div>
          <p className="font-medium">{req.requesterName}</p>
          <p className="text-sm text-slate-400">{req.requesterEmail}</p>
          <p className="text-sm text-slate-500 mt-1">{req.reason}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <select 
          value={req.role}
          onChange={e => setRole(req.id, e.target.value)}
          className="h-10 px-3 rounded-lg bg-slate-800 border border-slate-700 text-sm"
        >
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
          <option value="admin">Admin</option>
        </select>
        
        <button 
          onClick={() => approve(req.id)}
          className="h-10 px-4 bg-emerald-600 rounded-lg text-sm font-medium flex items-center gap-1"
        >
          <Check className="h-4 w-4" />
          Aceitar
        </button>
        
        <button 
          onClick={() => deny(req.id)}
          className="h-10 px-4 bg-red-600 rounded-lg text-sm font-medium flex items-center gap-1"
        >
          <X className="h-4 w-4" />
          Negar
        </button>
      </div>
    </div>
  ))}
</div>
```

### 3. Notificação Toast (quando chega novo request)

```jsx
<Toast 
  type="info"
  title="Nova solicitação de acesso"
  message="Nexus Play (nexusplayjuegos@email.com) solicitou acesso"
  actions={[
    { label: 'Ver', onClick: () => navigate('/admin/access') },
    { label: 'Aceitar', onClick: () => quickApprove() },
  ]}
/>
```

### 4. Badge no Header (contador de pendentes)

```jsx
<div className="relative">
  <Bell className="h-5 w-5" />
  {pendingCount > 0 && (
    <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center">
      {pendingCount}
    </span>
  )}
</div>
```

---

## 📨 NOTIFICAÇÕES

### Quando notificar o Admin:
1. ✅ Novo request criado
2. ✅ Request aprovado/negado (para auditoria)
3. ✅ Usuário revogado

### Quando notificar o Requester:
1. ✅ Request aprovado (com link de acesso)
2. ❌ Request negado (com motivo)
3. ⚠️ Acesso revogado

### Canais:
- **In-app:** Toast + badge no dashboard
- **WhatsApp:** Mensagem no Production 2026 (via Luna)
- **Email:** SMTP (quando configurado)

---

## 🔒 SEGURANÇA

1. **Rate limit:** Max 3 requests por email por dia
2. **Expiry:** Requests expiram em 7 dias
3. **IP log:** Registrar IP do requester
4. **Audit trail:** Quem aprovou/negou e quando
5. **No self-approval:** Requester não pode aprovar próprio request
6. **Owner protection:** Só 1 owner, não pode ser removido

---

## 📁 ARQUIVOS A CRIAR/MODIFICAR

### Novos arquivos:
1. `backend/data/access-requests.json`
2. `backend/data/access-users.json`
3. `frontend/src/pages/AccessRequest.jsx` (formulário)
4. `frontend/src/pages/AdminAccess.jsx` (painel admin)
5. `frontend/src/components/AccessDenied.jsx` (tela bloqueio)
6. `frontend/src/components/AccessBadge.jsx` (badge no header)

### Modificar:
1. `backend/server.js` — Adicionar endpoints
2. `frontend/src/App.jsx` — Adicionar rotas
3. `frontend/src/components/TopBar.jsx` — Adicionar badge

---

## 🚀 CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1: Backend (API)
- [ ] Criar `access-requests.json` e `access-users.json`
- [ ] POST /api/access-request (criar request)
- [ ] GET /api/access-requests (listar, admin only)
- [ ] PUT /api/access-requests/:id (approve/deny)
- [ ] DELETE /api/access-users/:id (revoke)
- [ ] Middleware requireAccess
- [ ] Notificações via WebSocket

### Fase 2: Frontend (UI)
- [ ] Página AccessDenied com formulário
- [ ] Painel AdminAccess com lista
- [ ] Badge no header com contador
- [ ] Toast notifications
- [ ] Responsivo mobile

### Fase 3: Integração
- [ ] WhatsApp notificação (Luna)
- [ ] Testes end-to-end
- [ ] Documentação

---

*"Funciona > Perfeito > Bonito > Nada"*

🌙 *Luna — CTO Virtual — NEXO Digital*
