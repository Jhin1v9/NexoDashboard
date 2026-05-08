# 🌙 LUNA — Sistema de Login NEXO Digital v1.0
## Prompt de Alta Eficiência para Implementação

---

## 📋 RESUMO EXECUTIVO

Criar página de login clean, segura e funcional para o NEXO Dashboard PRO, com autenticação de 2 fatores via WhatsApp (código de 5 dígitos enviado ao grupo "🏆Production - 2026🙏"), persistência de sessão, e logout funcional.

**Stack**: React 18 + Vite + Tailwind CSS + Express.js + JWT local + bcrypt + Playwright CDP
**Armazenamento**: Arquivos JSON locais (sem Supabase)
**Deploy**: Vercel (reaproveitar repo existente)

---

## 🎨 REFERÊNCIAS VISUAIS (Baseado em pesquisa)

### Padrões dos sites de sucesso:
| Elemento | Referência | Implementação |
|----------|-----------|---------------|
| **Layout** | Stripe, Vercel | Card centralizado, minimalista |
| **Cores** | GitHub dark | Background #0f172a, Card #1e293b, Primary #6366f1 |
| **Tipografia** | Inter (Google Fonts) | Títulos 24-32px, body 14-16px |
| **Inputs** | Linear, Notion | Borda sutil #334155, focus #6366f1, ícones inline |
| **Botão** | Stripe | Full-width, gradiente sutil, hover scale 1.02 |
| **Segurança** | GitHub, Discord | Ícone cadeado, badge "Secure", shield icons |
| **Erros** | Vercel | Inline, mensagens claras, sem alert() |
| **2FA** | Slack, Discord | Input de 5 dígitos com auto-focus |

### Animações:
- Card: fade-in + slide-up (0.3s ease-out)
- Input focus: border glow suave
- Botão hover: scale 1.02 + brightness
- Erro: shake horizontal (0.3s)
- Loading: spinner no botão

---

## 👤 USUÁRIOS E CREDENCIAIS

```json
{
  "users": [
    {
      "id": "jhin1v9",
      "username": "jhin1v9",
      "name": "Abner (Jhin1v9)",
      "role": "CEO",
      "passwordHash": "<bcrypt_hash_of_Nexodigitalsys7741@>",
      "phone": "34685093192",
      "avatar": "https://ui-avatars.com/api/?name=Abner&background=6366f1&color=fff"
    },
    {
      "id": "nonoke",
      "username": "nonoke",
      "name": "Nonoke / Enoque",
      "role": "Developer",
      "passwordHash": "<bcrypt_hash_of_Nexodigitalsys7741@>",
      "phone": "",
      "avatar": "https://ui-avatars.com/api/?name=Nonoke&background=2ed573&color=fff"
    },
    {
      "id": "wardilias",
      "username": "wardilias",
      "name": "Elias (Wardilias)",
      "role": "Developer",
      "passwordHash": "<bcrypt_hash_of_Nexodigitalsys7741@>",
      "phone": "34624529442",
      "avatar": "https://ui-avatars.com/api/?name=Elias&background=ffa502&color=fff"
    }
  ]
}
```

**Senha comum**: `Nexodigitalsys7741@`

---

## 🔐 FLUXO DE AUTENTICAÇÃO

### Fluxo 1: Login Normal (sem 2FA ativo)
```
1. Usuário acessa /
2. Vê página de login com logo NEXO DIGITAL
3. Digita username + senha
4. Clica "Entrar"
5. Backend valida credenciais (bcrypt compare)
6. Se válido → gera JWT token
7. Se "Lembrar-me" marcado → token persistente (30 dias)
8. Redireciona para / (Dashboard)
9. Navbar mostra avatar + nome + botão Sair
```

### Fluxo 2: Login com 2FA (após primeira vez ou quando ativado)
```
1. Usuário digita username + senha
2. Backend valida → gera código de 5 dígitos aleatório
3. Backend salva código + timestamp + expiração (5 min)
4. Backend chama agente WhatsApp para enviar código
5. Agente vai no grupo "🏆Production - 2026🙏"
6. Envia mensagem formatada com código
7. Usuário vê tela de "Digite o código de verificação"
8. Input de 5 dígitos com auto-focus
9. Usuário digita código → backend valida
10. Se correto → JWT token + redireciona
11. Se incorreto → erro + opção reenviar
12. Se expirado (5min) → código resetado + novo código enviado automaticamente
```

### Fluxo 3: Sessão Persistente
```
1. Usuário marca "Lembrar-me"
2. Backend gera refresh token (30 dias)
3. Armazena em localStorage: { token, refreshToken, user }
4. Próxima visita: frontend verifica localStorage
5. Se token válido → redireciona para dashboard
6. Se token expirado → usa refresh token para renovar
7. Se refresh expirado → volta para login
```

### Fluxo 4: Logout
```
1. Usuário clica "Sair" na navbar
2. Limpa localStorage
3. Invalida token no backend (blacklist em JSON)
4. Redireciona para /login
```

---

## 📱 PÁGINA DE LOGIN — ESTRUTURA

```jsx
// LoginPage.jsx
<LoginPage>
  <BackgroundAnimation /> {/* Partículas sutis ou gradiente animado */}
  
  <LoginCard>
    <Logo>NEXO DIGITAL</Logo>
    <Subtitle>Centro de Operações</Subtitle>
    
    {/* Step 1: Credenciais */}
    <Step visible={step === 1}>
      <Input 
        icon={<User />}
        placeholder="Usuário"
        value={username}
      />
      <Input 
        icon={<Lock />}
        type="password"
        placeholder="Senha"
        value={password}
        toggleVisibility
      />
      <Checkbox label="Lembrar-me" />
      <Button 
        primary 
        loading={isLoading}
        onClick={handleLogin}
      >
        Entrar
      </Button>
    </Step>
    
    {/* Step 2: Código 2FA */}
    <Step visible={step === 2}>
      <ShieldIcon />
      <Title>Verificação em duas etapas</Title>
      <Text>Código enviado para o grupo Production</Text>
      <CodeInput 
        length={5}
        autoFocus
        onComplete={handleVerifyCode}
      />
      <CountdownTimer 
        duration={300} // 5 minutos
        onExpire={handleCodeExpired}
      />
      <Button link onClick={handleResendCode}>
        Reenviar código
      </Button>
    </Step>
    
    <Footer>
      <SecurityBadge />
      <Version>v3.1 · VPN Only</Version>
    </Footer>
  </LoginCard>
</LoginPage>
```

---

## 🔒 SEGURANÇA — IMPLEMENTAÇÃO

### 1. Hash de Senhas (bcrypt)
```javascript
// backend/auth.js
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 12;

async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}
```

### 2. JWT Tokens
```javascript
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'nexo-local-secret-2026';

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { id: user.id, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}
```

### 3. Rate Limiting (anti-brute force)
```javascript
const loginAttempts = new Map(); // Em memória

function checkRateLimit(username) {
  const attempts = loginAttempts.get(username) || { count: 0, lastAttempt: 0 };
  const now = Date.now();
  
  // Reset após 15 minutos
  if (now - attempts.lastAttempt > 15 * 60 * 1000) {
    attempts.count = 0;
  }
  
  if (attempts.count >= 5) {
    const waitTime = Math.ceil((15 * 60 * 1000 - (now - attempts.lastAttempt)) / 1000 / 60);
    return { allowed: false, waitTime };
  }
  
  attempts.count++;
  attempts.lastAttempt = now;
  loginAttempts.set(username, attempts);
  return { allowed: true };
}
```

### 4. Código 2FA
```javascript
function generateVerificationCode() {
  // 5 dígitos aleatórios
  return Math.floor(10000 + Math.random() * 90000).toString();
}

function saveVerificationCode(userId, code) {
  const codes = readJSON('verification-codes.json') || {};
  codes[userId] = {
    code,
    createdAt: Date.now(),
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutos
    used: false
  };
  writeJSON('verification-codes.json', codes);
}

function verifyCode(userId, inputCode) {
  const codes = readJSON('verification-codes.json') || {};
  const record = codes[userId];
  
  if (!record) return { valid: false, reason: 'not_found' };
  if (record.used) return { valid: false, reason: 'already_used' };
  if (Date.now() > record.expiresAt) return { valid: false, reason: 'expired' };
  if (record.code !== inputCode) return { valid: false, reason: 'invalid' };
  
  record.used = true;
  writeJSON('verification-codes.json', codes);
  return { valid: true };
}
```

---

## 📤 MENSAGEM DE CÓDIGO VIA WHATSAPP

### Formato da mensagem (baseado em pesquisa de empresas):

```
🔐 *NEXO DIGITAL — Código de Verificação*

Olá! Detectamos uma tentativa de login na conta de *{nome_usuario}*.

*Código:* {codigo_5_digitos}
*Válido por:* 5 minutos
*IP:* {ip_address}
*Horário:* {data_hora}

Se NÃO foi você, ignore esta mensagem.

—
🌙 *Luna* — CTO Virtual NEXO Digital
Sistema de Segurança
```

### Quando o código expira:
```
⚠️ *Código Expirado*

O código anterior expirou. Um novo foi gerado:

*Código:* {novo_codigo}
*Válido por:* 5 minutos

—
🌙 *Luna* — CTO Virtual NEXO Digital
```

---

## 🗂️ ESTRUTURA DE ARQUIVOS

```
backend/
  data/
    users.json              # Usuários com senhas hasheadas
    sessions.json           # Tokens ativos (blacklist)
    verification-codes.json # Códigos 2FA pendentes
  auth/
    auth.js                 # Funções de autenticação
    middleware.js           # JWT middleware para rotas protegidas
    rate-limiter.js         # Anti-brute force
  routes/
    auth.js                 # POST /api/auth/login, /verify, /refresh, /logout
frontend/
  src/
    pages/
      Login.jsx             # Página de login completa
    components/
      auth/
        LoginCard.jsx       # Card de login
        CodeInput.jsx       # Input de 5 dígitos
        SecurityBadge.jsx   # Badge "Secure"
    hooks/
      useAuth.js            # Hook de autenticação
    context/
      AuthContext.jsx       # Contexto global de auth
```

---

## 🔌 APIs BACKEND

```javascript
// POST /api/auth/login
// Body: { username, password, rememberMe }
// Response: { success: true, requires2FA: true, userId: "..." }
//         | { success: true, token, refreshToken, user }
//         | { success: false, error: "invalid_credentials" | "rate_limited" }

// POST /api/auth/verify
// Body: { userId, code }
// Response: { success: true, token, refreshToken, user }
//         | { success: false, error: "invalid_code" | "expired_code" }

// POST /api/auth/refresh
// Body: { refreshToken }
// Response: { success: true, token }

// POST /api/auth/logout
// Headers: Authorization: Bearer {token}
// Response: { success: true }

// GET /api/auth/me
// Headers: Authorization: Bearer {token}
// Response: { user: { id, name, username, role } }
```

---

## ✅ CRITÉRIOS DE ACEITAÇÃO (Definition of Done)

- [ ] Página de login visualmente clean e profissional
- [ ] Login funcional com bcrypt + JWT
- [ ] 2FA com código de 5 dígitos enviado via WhatsApp
- [ ] Código expira em 5 minutos e é resetado automaticamente
- [ ] Agente Luna envia código no grupo Production
- [ ] Sessão persistente (Lembrar-me) funcional
- [ ] Logout funcional (limpa tudo)
- [ ] Rate limiting anti-brute force
- [ ] Proteção CSRF
- [ ] Rotas protegidas (não dá pra acessar dashboard sem login)
- [ ] Mobile responsive
- [ ] Deploy no Vercel funcionando
- [ ] Testado end-to-end

---

## 🚫 BOUNDARIES (NUNCA fazer)

- NUNCA armazenar senha em texto plano
- NUNCA enviar código 2FA para número pessoal (sempre para o grupo)
- NUNCA permitir múltiplas sessões simultâneas sem controle
- NUNCA usar localStorage para dados sensíveis (exceto tokens)

---

## ⚠️ PERGUNTAR ANTES (se surgir dúvida)

- Trocar design ou cores?
- Adicionar mais usuários?
- Mudar tempo de expiração do código?
- Alterar grupo de destino do código?

---

*Documento criado por Luna 🌙 CTO Virtual NEXO Digital*
*Data: 2026-05-01*
*Versão: 1.0*
