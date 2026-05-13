# 🐛 BugDetector Pro - Tutorial Completo

Guia passo a passo para instalar, configurar e usar o BugDetector Pro v2.0 em seus projetos.

---

## 📦 1. Instalação

### Opção A: Instalar via NPM (Recomendado)

```bash
# No seu projeto
npm install @auris/bug-detector

# ou com yarn
yarn add @auris/bug-detector

# ou com pnpm
pnpm add @auris/bug-detector
```

### Opção B: Usar via CDN (Rápido)

```html
<!-- ESM (Módulos Modernos) -->
<script type="module">
  import { BugDetector } from 'https://unpkg.com/@auris/bug-detector/dist/index.esm.js';
</script>

<!-- UMD (Navegadores Antigos) -->
<script src="https://unpkg.com/@auris/bug-detector/dist/index.js"></script>
```

### Opção C: Download Manual

1. Baixe o arquivo `index.esm.js` ou `index.js` da pasta `dist/`
2. Copie para a pasta do seu projeto (ex: `/js/bug-detector.js`)
3. Importe no seu HTML

---

## 🚀 2. Configuração Básica

### HTML Simples (Vanilla JS)

```html
<!DOCTYPE html>
<html>
<head>
  <title>Meu Projeto</title>
</head>
<body>
  <h1>Meu Site</h1>

  <!-- Importe o BugDetector -->
  <script type="module">
    import { BugDetector } from './js/bug-detector.js';
    
    // Inicialize
    const detector = new BugDetector({
      trigger: 'floating-button',  // Botão flutuante
      zIndexBase: 999999           // Z-index dos elementos UI
    });
  </script>
</body>
</html>
```

### React

```bash
npm install @auris/bug-detector
```

```jsx
import { useBugDetector } from '@auris/bug-detector/adapters/react';

function App() {
  const { isActive, activate, deactivate, lastReport } = useBugDetector({
    trigger: 'manual',
    callbacks: {
      onReportCreated: (report) => {
        console.log('Novo bug reportado:', report);
      }
    }
  });

  return (
    <div>
      <button onClick={isActive ? deactivate : activate}>
        {isActive ? 'Desativar' : 'Reportar Bug'}
      </button>
      {lastReport && <p>Último report: {lastReport.id}</p>}
    </div>
  );
}
```

### Vue 3

```bash
npm install @auris/bug-detector
```

```javascript
// main.js
import { createApp } from 'vue';
import { BugDetectorPlugin } from '@auris/bug-detector/adapters/vue';
import App from './App.vue';

const app = createApp(App);

app.use(BugDetectorPlugin, {
  trigger: 'keyboard-shortcut',
  shortcut: 'Ctrl+Shift+B'
});

app.mount('#app');
```

```vue
<!-- Componente.vue -->
<template>
  <div>
    <button @click="detector.activate()">
      🐛 Reportar Bug
    </button>
    <p v-if="detector.lastReport">
      Report criado: {{ detector.lastReport.id }}
    </p>
  </div>
</template>

<script setup>
import { inject } from 'vue';

const detector = inject('bugDetector');
</script>
```

---

## ⚙️ 3. Configurações Avançadas

```javascript
const detector = new BugDetector({
  // 🎯 Gatilho de ativação
  trigger: 'floating-button',    // 'floating-button' | 'keyboard-shortcut' | 'manual'
  
  // ⌨️ Atalho de teclado (se trigger = 'keyboard-shortcut')
  shortcut: 'Ctrl+Shift+B',
  
  // 👻 Modo headless (sem UI, só API)
  headless: false,
  
  // 💾 Persistência dos reports
  persistTo: 'localStorage',     // 'localStorage' | 'indexedDB' | 'api' | 'none'
  
  // 📊 Z-index base (para sobrepor outros elementos)
  zIndexBase: 999999,
  
  // 📸 Configuração de captura
  capture: {
    screenshot: true,      // Capturar screenshots
    console: true,         // Capturar logs do console
    network: true,         // Capturar requisições de rede
    performance: true      // Capturar métricas de performance
  },
  
  // 🤖 Configuração de IA (opcional)
  ai: {
    enabled: true,
    provider: 'deepseek',
    apiKey: 'sua-api-key',
    model: 'deepseek-chat',
    maxTokens: 2000
  },
  
  // 🔗 Integrações (opcional)
  integrations: {
    github: {
      token: 'seu-token',
      owner: 'sua-org',
      repo: 'seu-repo'
    },
    jira: {
      baseUrl: 'https://sua-instancia.atlassian.net',
      token: 'seu-token',
      project: 'PROJ'
    },
    slack: {
      webhook: 'https://hooks.slack.com/services/...'
    }
  },
  
  // 📞 Callbacks
  callbacks: {
    onActivate: () => console.log('Ativado!'),
    onDeactivate: () => console.log('Desativado!'),
    onElementSelected: (element) => console.log('Elemento:', element),
    onReportCreated: (report) => console.log('Report:', report)
  },
  
  // 🛠️ Ativar automaticamente em desenvolvimento
  autoActivateInDev: true
});
```

---

## 🎮 4. Como Usar

### Modo 1: Botão Flutuante (Padrão)

```javascript
const detector = new BugDetector({
  trigger: 'floating-button'
});
// Um botão 🐛 aparece no canto inferior direito
// Clique para ativar, clique em um elemento para reportar
```

### Modo 2: Atalho de Teclado

```javascript
const detector = new BugDetector({
  trigger: 'keyboard-shortcut',
  shortcut: 'Ctrl+Shift+B'  // ou 'F12', 'Cmd+Shift+I', etc
});
// Pressione Ctrl+Shift+B para ativar
// Clique em um elemento para reportar
```

### Modo 3: Manual (Programático)

```javascript
const detector = new BugDetector({
  trigger: 'manual'
});

// Ative quando quiser
detector.activate();

// Desative
detector.deactivate();

// Verifique status
console.log(detector.isActivated()); // true ou false
```

---

## 📋 5. Fluxo de Uso

### Passo a Passo

1. **Ative** o BugDetector (botão, atalho ou código)
2. **Clique** no elemento com problema
3. **Preencha** o formulário:
   - Tipo: Bug ou Melhoria
   - Severidade: Baixa, Média, Alta ou Crítica
   - Descrição: Explique o problema
   - Comportamento Esperado: Como deveria funcionar
   - Screenshot: Opcional
4. **Clique** em "Criar Report"

### O que é Capturado Automaticamente

```javascript
// Estrutura do Report gerado
{
  id: "uuid-unico",
  timestamp: 1699999999999,
  url: "https://meusite.com/pagina",
  userAgent: "Mozilla/5.0...",
  viewport: { width: 1920, height: 1080 },
  
  // Elemento clicado
  element: {
    tag: "button",
    id: "btn-submit",
    className: "btn btn-primary",
    text: "Enviar",
    xpath: "/html/body/div[1]/button"
  },
  
  // Dados do formulário
  formData: {
    type: "bug",
    severity: "high",
    description: "...",
    expected: "...",
    includeScreenshot: true
  },
  
  // Capturas (se habilitado)
  captures: {
    screenshot: "data:image/png;base64,...",
    consoleLogs: [...],
    networkRequests: [...],
    performanceMetrics: {...}
  }
}
```

---

## 🔧 6. API e Métodos

### Métodos Principais

```javascript
const detector = new BugDetector(config);

// Controle
detector.activate();           // Ativa modo de inspeção
detector.deactivate();         // Desativa modo de inspeção
detector.isActivated();        // Retorna true/false
detector.toggle();             // Alterna estado

// Criação de Reports
detector.createReport(element, formData);  // Cria report manualmente
detector.exportReport(reportId, 'json');   // Exporta como JSON
detector.exportReport(reportId, 'md');     // Exporta como Markdown
detector.exportReport(reportId, 'html');   // Exporta como HTML

// Gerenciamento
detector.getAllReports();      // Lista todos os reports
detector.getReport(id);        // Pega um report específico
detector.deleteReport(id);     // Deleta um report
detector.clearAllReports();    // Limpa todos os reports

// Integrações
detector.sendToGitHub(reportId);   // Cria issue no GitHub
detector.sendToJira(reportId);     // Cria ticket no Jira
detector.sendToSlack(reportId);    // Envia notificação Slack

// Análise de IA
detector.analyzeWithAI(reportId);  // Analisa o report com IA

// Destruição
detector.destroy();            // Limpa tudo e remove listeners
```

### Hooks e Callbacks

```javascript
const detector = new BugDetector({
  callbacks: {
    // Quando ativado
    onActivate: () => {
      console.log('Modo de inspeção ativado!');
    },
    
    // Quando desativado
    onDeactivate: () => {
      console.log('Modo de inspeção desativado!');
    },
    
    // Quando um elemento é selecionado
    onElementSelected: (element) => {
      console.log('Elemento clicado:', element.tag, element.id);
    },
    
    // Quando um report é criado
    onReportCreated: (report) => {
      console.log('Novo report:', report.id);
      // Envie para seu backend
      fetch('/api/bugs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report)
      });
    }
  }
});
```

---

## 💾 7. Persistência

### LocalStorage (Padrão)

```javascript
const detector = new BugDetector({
  persistTo: 'localStorage'
});
// Reports ficam salvos no navegador
// Mesmo após fechar a página, os dados persistem
```

### IndexedDB (Para muitos dados)

```javascript
const detector = new BugDetector({
  persistTo: 'indexedDB'
});
// Melhor para grandes volumes de dados
// Suporta queries e indexação
```

### API Própria

```javascript
const detector = new BugDetector({
  persistTo: 'api',
  callbacks: {
    onReportCreated: async (report) => {
      // Envie para seu backend
      await fetch('/api/bug-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report)
      });
    }
  }
});
```

---

## 🎨 8. Customização Visual

### CSS Personalizado

O BugDetector usa classes CSS prefixadas com `bd-`:

```css
/* Botão flutuante */
.bd-floating-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  border-radius: 50% !important;
}

/* Modal */
.bd-modal {
  border-radius: 16px !important;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5) !important;
}

/* Tooltip de inspeção */
.bd-tooltip {
  background: rgba(0, 0, 0, 0.9) !important;
  font-family: 'Monaco', monospace !important;
}

/* Destaque do elemento */
.bd-highlight {
  outline: 2px solid #ff6b6b !important;
  outline-offset: 2px !important;
}
```

---

## 🔐 9. Segurança

### Proteção de Dados Sensíveis

```javascript
const detector = new BugDetector({
  capture: {
    screenshot: true,
    console: true,
    network: true
  },
  // O BugDetector automaticamente:
  // - Ofusca campos de senha
  // - Remove tokens de autenticação
  // - Limita tamanho de logs (máx 1000)
  // - Limita requisições de rede (máx 500)
});
```

### Rate Limiting (IA)

```javascript
const detector = new BugDetector({
  ai: {
    enabled: true,
    // Rate limit automático: 10 requisições/minuto
    // Previne custos excessivos com APIs de IA
  }
});
```

---

## 🐛 10. Debug e Troubleshooting

### Verificar Instalação

```javascript
// Verifique se carregou corretamente
console.log(typeof BugDetector); // "function"

// Verifique a versão
const detector = new BugDetector();
console.log(detector.version); // "2.0.0"
```

### Problemas Comuns

**Erro: "BugDetector is not defined"**
```javascript
// Solução: Verifique o caminho do import
import { BugDetector } from '@auris/bug-detector';
// ou
import { BugDetector } from './caminho/correto/bug-detector.js';
```

**Botão não aparece**
```javascript
// Verifique o z-index
const detector = new BugDetector({
  zIndexBase: 999999  // Aumente se necessário
});
```

**Screenshots não funcionam**
```javascript
// Verifique CORS - o html2canvas precisa de permissões
// Adicione headers CORS ou use proxy de imagens
```

---

## 📚 11. Exemplos Completos

### Exemplo 1: Bug Básico

```html
<!DOCTYPE html>
<html>
<head>
  <title>Minha Loja</title>
</head>
<body>
  <header>
    <h1>Minha Loja Online</h1>
    <button id="cart">Carrinho (2)</button>
  </header>

  <script type="module">
    import { BugDetector } from '@auris/bug-detector';
    
    const detector = new BugDetector({
      trigger: 'keyboard-shortcut',
      shortcut: 'F8',
      callbacks: {
        onReportCreated: (report) => {
          alert(`Bug reportado! ID: ${report.id}`);
          console.log(report);
        }
      }
    });
  </script>
</body>
</html>
```

### Exemplo 2: Com Backend

```javascript
// frontend.js
import { BugDetector } from '@auris/bug-detector';

const detector = new BugDetector({
  trigger: 'floating-button',
  capture: {
    screenshot: true,
    console: true,
    network: true
  },
  callbacks: {
    onReportCreated: async (report) => {
      try {
        const response = await fetch('/api/bugs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(report)
        });
        
        if (response.ok) {
          alert('Bug reportado com sucesso!');
        }
      } catch (error) {
        console.error('Erro ao enviar:', error);
      }
    }
  }
});
```

```javascript
// backend.js (Node.js/Express)
app.post('/api/bugs', async (req, res) => {
  const report = req.body;
  
  // Salve no banco de dados
  const saved = await db.bugs.create({
    id: report.id,
    description: report.formData.description,
    severity: report.formData.severity,
    screenshot: report.captures.screenshot,
    metadata: {
      url: report.url,
      userAgent: report.userAgent,
      element: report.element
    }
  });
  
  // Notifique no Slack
  await notifySlack(`Novo bug reportado: ${report.id}`);
  
  res.json({ success: true, id: saved.id });
});
```

### Exemplo 3: Com Análise de IA

```javascript
const detector = new BugDetector({
  trigger: 'manual',
  ai: {
    enabled: true,
    provider: 'deepseek',
    apiKey: process.env.DEEPSEEK_API_KEY,
    model: 'deepseek-chat'
  },
  callbacks: {
    onReportCreated: async (report) => {
      // Analise com IA
      const analysis = await detector.analyzeWithAI(report.id);
      
      console.log('Análise da IA:', analysis);
      // {
      //   severity: 'high',
      //   category: 'frontend',
      //   suggestions: ['Verificar CSS do botão'],
      //   impact: 'Afeta todos os usuários mobile'
      // }
    }
  }
});

// Botão personalizado
document.getElementById('report-bug-btn').addEventListener('click', () => {
  detector.activate();
});
```

---

## 📖 Resumo dos Arquivos

```
bug-detector/
├── dist/
│   ├── index.js          # Versão UMD (navegadores antigos)
│   ├── index.esm.js      # Versão ESM (módulos modernos)
│   └── index.d.ts        # Tipos TypeScript
├── src/
│   ├── adapters/
│   │   ├── react.tsx     # Hook para React
│   │   └── vue.ts        # Plugin para Vue
│   └── ...
├── TUTORIAL.md           # Este arquivo
└── README.md             # Documentação técnica
```

---

## 🤝 Suporte

- 📧 Email: suporte@auris.dev
- 🐛 Issues: https://github.com/auris/bug-detector/issues
- 💬 Discord: https://discord.gg/auris

---

**Feito com ❤️ pela equipe Auris**

*Versão 2.0 - Última atualização: Abril 2026*
