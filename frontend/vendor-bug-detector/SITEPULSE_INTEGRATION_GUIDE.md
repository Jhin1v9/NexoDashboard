# 🚀 Integração Bug Detector ↔ SitePulse-QA (Opção 3 — Fusão com AI Assistant)

> **Objetivo:** O Bug Detector vira o **braço de captura visual** do SitePulse. Quando o usuário acha um bug no site auditado, o AI Assistant do SitePulse responde como `bug_analyst`, explicando causa raiz e entregando código corrigido.
> 
> **IA:** Gemini é o padrão. Kimi entra automaticamente como fallback.

---

## 📦 O que já foi feito neste repo

| Arquivo | O que mudou |
|---------|-------------|
| `src/types/index.ts` | Adicionado `kimi` como provider válido de IA |
| `src/devtools/AIAnalyzer.ts` | Novo método `analyzeWithKimi()` + parse para respostas Kimi |
| `src/intelligence/IntelligenceEngine.ts` | Novos métodos `callDeepSeek()` e `callKimi()` |
| `src/integrations/SitePulseBridge.ts` | **Bridge oficial** que conecta Bug Detector → SitePulse Assistant |
| `src/integrations/index.ts` | Exporta `SitePulseBridge`, `CloudAPI` e tipos |
| `sitepulse-integration.js` | Preload script para injetar o Bug Detector no `<webview>` do Electron |
| `sitepulse-renderer-patch.js` | Patch do `renderer.js` do SitePulse para processar reports e chamar a IA |

---

## 🏗️ Arquitetura da integração

```
┌─────────────────────────────────────────────────────────────┐
│  SitePulse Desktop (Electron)                               │
│  ┌─────────────────┐     ┌─────────────────────────────┐   │
│  │  <webview>      │────▶│  Bug Detector (vanilla)     │   │
│  │  site auditado  │     │  Ctrl+Shift+D               │   │
│  └─────────────────┘     └─────────────────────────────┘   │
│           │                                               │
│           │ postMessage('report-created')                 │
│           ▼                                               │
│  ┌─────────────────────────────┐                         │
│  │  renderer.js (SitePulse)    │                         │
│  │  - Recebe o report          │                         │
│  │  - Chama Gemini             │                         │
│  │  - Se falhar, chama Kimi    │                         │
│  │  - Popula appContext        │                         │
│  └─────────────────────────────┘                         │
│           │                                               │
│           ▼                                               │
│  ┌─────────────────────────────┐                         │
│  │  assistant-service.js       │                         │
│  │  modo: bug_analyst          │                         │
│  │  "Causa raiz: undefined..." │                         │
│  └─────────────────────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚡ Passo a passo de implementação

### 1. Buildar o pacote `@auris/bug-detector`

Já está buildado com as mudanças, mas se precisar rebuildar:

```bash
cd packages/bug-detector
npm run build
```

O resultado fica em `packages/bug-detector/dist/`.

---

### 2. Copiar o Bug Detector para dentro do SitePulse

No repo do **SitePulse-QA**, copie os arquivos do build:

```bash
# A partir da raiz do SitePulse-QA
cp -r /caminho/para/bug-detector/dist companion/src/bug-detector-dist/
cp sitepulse-integration.js companion/src/bug-detector-preload.js
```

Ou, se estiver no Windows:

```powershell
robocopy "C:\caminho\bug-detector\dist" "C:\caminho\SitePulse-QA\companion\src\bug-detector-dist" /E
Copy-Item "C:\caminho\bug-detector\sitepulse-integration.js" "C:\caminho\SitePulse-QA\companion\src\bug-detector-preload.js"
```

---

### 3. Modificar o `main.cjs` do Electron para injetar o preload no webview

Abra `companion/src/main.cjs` e localize onde a `BrowserWindow` é criada (função `createMainWindow` ou similar).

Adicione este trecho **após** o webview carregar uma URL:

```javascript
// Injeta o Bug Detector no webview de preview
mainWindow.webContents.on('did-attach-webview', (_, wc) => {
  wc.executeJavaScript(`
    (function(){
      if(window.__bdInjected)return;
      window.__bdInjected=true;
      const s=document.createElement('script');
      s.src='./bug-detector-dist/bug-detector.iife.js';
      s.onload=function(){
        window.BugDetector.init({
          shortcut:'Ctrl+Shift+D',
          guestMode:true,
          integrations:{cloud:{baseURL:'http://localhost:3456'}},
          callbacks:{
            onReportCreated:function(r){
              window.postMessage({source:'bug-detector',type:'report-created',payload:r},'*');
            }
          }
        });
      };
      document.head.appendChild(s);
    })();
  `).catch(()=>{});
});
```

> 💡 **Alternativa mais limpa:** configure o `preload` do próprio `webview` tag no `renderer.html` apontando para `bug-detector-preload.js`.

---

### 4. Aplicar o patch no `renderer.js` do SitePulse

Abra `companion/src/renderer.js` e cole o conteúdo de `sitepulse-renderer-patch.js` no **final do arquivo**.

Isso fará com que o renderer:
1. Escute reports do webview
2. Envie para o Cloud
3. Chame a **Gemini API** para análise
4. Se Gemini falhar, chame a **Kimi API**
5. Popule `uiState.bugDetector` e `appContext.bugDetector`

---

### 5. Configurar as API Keys no SitePulse

No seu frontend do SitePulse (ou em um painel de settings), peça ao usuário para salvar as chaves:

```javascript
// Salvar chaves
localStorage.setItem('sitepulse_gemini_key', 'SUA_CHAVE_GEMINI');
localStorage.setItem('sitepulse_kimi_key',   'SUA_CHAVE_KIMI');   // opcional, fallback
```

> ⚠️ **Segurança:** Em produção, mova essas chamadas de IA para um backend Node.js do SitePulse para não expor keys no renderer.

---

### 6. Testar o fluxo completo

1. Inicie o **Bug Detector Cloud**:
```bash
cd packages/bug-detector-cloud
npm start
```

2. Inicie o **SitePulse Desktop**:
```bash
cd companion
npm run dev
```

3. No SitePulse, inicie uma auditoria com URL qualquer (ex: `https://example.com`)

4. Aperte `Ctrl+Shift+D` dentro do webview de preview

5. Preencha e envie o bug

6. Veja o console do SitePulse — você verá:
```
[BugDetectorBridge] Report processado: {...}
```

7. Abra o assistant (`Ctrl+J`) e digite:
```
bug detectado
```

O assistente deve responder no modo **Bug Analyst** com:
- Causa raiz
- Código corrigido (com botão copiar)
- Recomendações

---

## 🧠 Como funciona o modo `bug_analyst`

Já foi adicionado no `assistant-service.js` do SitePulse:

```javascript
bug_analyst: {
  key: "bug_analyst",
  name: "Bug Analyst",
  description: "Analyzes visual and functional bugs captured by Bug Detector...",
  capabilities: ["analyze-bug", "explain-root-cause", "suggest-code-fix"],
  allowedActions: ["switch-findings", "copy-text", "generate-prompt"],
  responseStyle: "technical",
}
```

### Intents que ativam o modo:
- `bug detectado`
- `bug detector`
- `causa raiz`
- `codigo corrigido`
- `screen recording`
- `screenshot`

### Estrutura do contexto injetado:
O patch do renderer popula `appContext.bugDetector` com:
- `reportId`, `description`, `url`
- `elementSelector`, `severity`
- `rootCause`, `solution`, `recommendations[]`
- `fixCode`, `fixLanguage`
- `consoleLogCount`, `networkRequestCount`
- `hasScreenshot`, `hasVideo`

---

## 🔧 Personalizações avançadas

### Trocar o modelo Gemini
Edite `sitepulse-renderer-patch.js`:
```javascript
// De:
models/gemini-1.5-flash:generateContent
// Para:
models/gemini-1.5-pro:generateContent
```

### Usar o SitePulseBridge direto no backend
Se o SitePulse tiver um processo Node.js (o `main.cjs` ou `qa/src`), você pode usar o `SitePulseBridge` TypeScript:

```typescript
import { SitePulseBridge } from '@auris/bug-detector';

const bridge = new SitePulseBridge({
  cloudBaseURL: 'http://localhost:3456',
  geminiApiKey: process.env.GEMINI_KEY,
  kimiApiKey: process.env.KIMI_KEY,
});

const enriched = await bridge.submitAndAnalyze(report);
const assistantContext = bridge.buildAssistantContext(enriched);
// Envie assistantContext para o renderer via IPC
```

---

## ✅ Checklist de validação

- [ ] `npm run build` passa no bug-detector
- [ ] Cloud está rodando em `localhost:3456`
- [ ] Arquivos do `dist` foram copiados para `companion/src/bug-detector-dist/`
- [ ] `main.cjs` injeta o script no webview
- [ ] `renderer.js` tem o patch no final
- [ ] API keys salvas no `localStorage`
- [ ] Enviar um bug ativa o modo `bug_analyst` no assistant
- [ ] Gemini funciona como padrão
- [ ] Kimi funciona quando Gemini falha (teste com key inválida)

---

## 📞 Precisa de ajuda?

Se o assistant não estiver respondendo no modo `bug_analyst`, verifique no DevTools do Electron:
1. `console.log(uiState.bugDetector)` — deve ter dados
2. `console.log(window.createSitePulseAssistantService)` — deve existir
3. Verifique se `assistant-service.js` carregou sem erros

**Pronto! Seu SitePulse agora tem visão de bug + cérebro de IA. 🧠🐞**
