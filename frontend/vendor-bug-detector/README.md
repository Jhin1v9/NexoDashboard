# 🐛 BugDetector Pro

> Bug tracker visual open-source com IA, session replay e cloud dashboard.

---

## ✨ Features

| Feature | Status |
|---------|--------|
| Inspeção visual de elementos (hover + click) | ✅ |
| Screenshots automáticos com anotações | ✅ |
| Screen recording (gravação de tela) | ✅ |
| Session replay (30s de eventos DOM) | ✅ |
| Blur automático de dados sensíveis | ✅ |
| Análise com IA (8 especialistas) | ✅ |
| Cloud Dashboard MVP | ✅ |
| Integração 2-way com GitHub Issues | ✅ |
| White-label / custom branding | ✅ |
| Guest mode | ✅ |
| Multi-framework (React, Vue, Vanilla) | ✅ |

---

## 🚀 Instalação

### NPM

```bash
npm install @auris/bug-detector
```

### Uso com React

```tsx
import { BugDetectorProvider } from '@auris/bug-detector/adapters/react';

function App() {
  return (
    <BugDetectorProvider config={{}}>
      <YourApp />
    </BugDetectorProvider>
  );
}
```

### Uso com Vanilla (qualquer site)

```html
<script src="https://seu-cdn.com/bug-detector.iife.js"></script>
<script>
  const detector = new BugDetector.BugDetector();
</script>
```

Ou injete via bookmarklet/snippet.

---

## ⚙️ Configuração

```typescript
import type { BugDetectorConfig } from '@auris/bug-detector';

const config: BugDetectorConfig = {
  trigger: 'keyboard-shortcut',
  shortcut: 'Ctrl+Shift+D',
  persistTo: 'localStorage',
  ai: {
    provider: 'gemini',
    apiKey: 'YOUR_API_KEY',
  },
  integrations: {
    github: {
      repo: 'owner/repo',
      token: 'ghp_xxx',
      labels: ['bug'],
    },
    cloud: {
      baseURL: 'http://localhost:3456',
    },
  },
  branding: {
    primaryColor: '#10b981',
    position: 'bottom-right',
    buttonText: 'Reportar Bug',
  },
  guestMode: false,
};
```

---

## 🛠️ Scripts de build

```bash
cd packages/bug-detector
npm install
npm run build
```

Gera:
- `dist/index.js` (CJS)
- `dist/index.esm.js` (ESM)
- `dist/adapters/react.js`
- `dist/adapters/vue.js`
- `dist/bug-detector.iife.js` (Vanilla/Browser)

---

## 📦 Estrutura

```
src/
├── adapters/       # React, Vue, Vanilla
├── capture/        # Screenshot e ScreenRecorder
├── core/           # BugDetector, Inspector, Config
├── devtools/       # ConsoleCapture, NetworkMonitor
├── hooks/          # React hooks
├── integrations/   # GitHub, Jira, Slack, CloudAPI
├── intelligence/   # IA e geração de reports
├── replay/         # SessionReplayEngine + Player
├── storage/        # localStorage / IndexedDB
├── types/          # Tipagens TypeScript
└── ui/             # Componentes visuais
```

---

## 📄 Licença

MIT
