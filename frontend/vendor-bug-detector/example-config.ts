import type { BugDetectorConfig } from './src/types';

/**
 * Exemplo de configuração completa do BugDetector Pro
 * Copie e adapte conforme suas necessidades.
 */

export const exampleConfig: BugDetectorConfig = {
  // Ativação
  trigger: 'keyboard-shortcut',
  shortcut: 'Ctrl+Shift+D',

  // Persistência
  persistTo: 'localStorage',

  // Inteligência Artificial
  ai: {
    provider: 'kimi',
    apiKey: process.env.VITE_KIMI_API_KEY || '',
    model: 'kimi-for-coding',
    baseURL: 'https://api.kimi.com/coding/v1',
    temperature: 0.3,
    timeout: 30000,
  },

  // Integrações
  integrations: {
    github: {
      repo: 'seu-usuario/seu-repo',
      token: process.env.VITE_GITHUB_TOKEN || '',
      labels: ['bug', 'bug-detector'],
    },
    slack: {
      webhook: process.env.VITE_SLACK_WEBHOOK || '',
      channel: '#bugs',
    },
    cloud: {
      baseURL: 'http://localhost:3456',
    },
  },

  // Captura
  capture: {
    screenshot: true,
    console: true,
    network: true,
    performance: true,
    includeHTML: false,
    includeStyles: true,
  },

  // White-label / Branding
  branding: {
    primaryColor: '#10b981',
    backgroundColor: '#0f172a',
    position: 'bottom-right',
    buttonText: 'Reportar',
  },

  // Modo guest (esconde painel de reports, mostra apenas botão)
  guestMode: false,

  // Callbacks
  callbacks: {
    onReportCreated(report) {
      console.log('Report criado:', report.id);
    },
    onActivate() {
      console.log('BugDetector ativado');
    },
    onDeactivate() {
      console.log('BugDetector desativado');
    },
  },
};

export default exampleConfig;
