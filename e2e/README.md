# 🧪 Testes E2E — NEXO Dashboard PRO

> Testes end-to-end com Playwright (Microsoft)

## 📦 Instalação

```bash
# Na raiz do projeto
npm install
npx playwright install chromium
```

## 🚀 Como rodar

```bash
# Roda todos os testes (headless, para CI)
npm run test:e2e

# Roda com interface visual (modo UI — recomendado para desenvolver)
npm run test:e2e:ui

# Roda com navegador visível (headed)
npm run test:e2e:headed

# Roda em modo debug (breakpoints, step-by-step)
npm run test:e2e:debug

# Abre o relatório HTML do último run
npm run test:e2e:report
```

## 📁 Estrutura

```
e2e/
├── playwright.config.js      # Configuração global
├── setup/
│   ├── global-setup.js       # Sobe backend + frontend antes dos testes
│   └── global-teardown.js    # Mata processos após os testes
├── pages/                    # Page Objects (como interagir com cada tela)
│   ├── LoginPage.js
│   ├── DashboardPage.js
│   └── LandingPage.js
└── specs/                    # Os testes em si
    ├── auth.spec.js          # Login, logout, proteção de rotas
    ├── leads.spec.js         # Captura de leads (demo request)
    ├── notifications.spec.js # Central de Notificações
    └── luna-fase1.spec.js    # Luna: Preview + Confirmação + Undo
```

## 🧬 Page Object Pattern

Não escreva seletores soltos nos testes. Use Page Objects:

```javascript
// ❌ Não faça isso nos testes:
await page.click('button[aria-label="Notificações"]');

// ✅ Faça isso:
const dashboard = new DashboardPage(page);
await dashboard.openNotifications();
```

Se o seletor mudar, você altera em **um lugar só**.

## 🐛 Debug

Quando um teste falha, o Playwright salva automaticamente:
- **Screenshot** do momento da falha
- **Vídeo** da execução
- **Trace** (timeline completo de DOM, rede, console)

Para abrir o trace:
```bash
npx playwright show-trace e2e/test-results/<nome-do-teste>/trace.zip
```

## 🔄 CI/CD (GitHub Actions)

Adicione ao seu workflow:

```yaml
- name: Run E2E Tests
  run: |
    npm install
    npx playwright install chromium
    npm run test:e2e
- name: Upload E2E Report
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: e2e-report
    path: e2e/playwright-report/
```

## 📝 Convenções

1. **Um `describe` por feature**, um `test` por cenário
2. **Nomes descritivos**: `test('usuário faz login com credenciais válidas')`
3. **Não use `waitForTimeout`**, use `waitForSelector` ou `toBeVisible`
4. **Limpe dados de teste** no `afterEach` se necessário
5. **Independente**: cada teste deve poder rodar sozinho
