/**
 * Vue Adapter para BugDetector
 * Plugin e composable
 */

import type { App, InjectionKey, Ref } from 'vue';
import { ref, readonly } from 'vue';
import { BugDetector } from '../core/BugDetector';
import type {
  BugDetectorConfig,
  InspectedElement,
  BugReport,
  CreateReportData,
  ExportOptions,
  ExportResult,
} from '../types';

// ============================================================================
// PLUGIN
// ============================================================================

/** Configuração do plugin */
export interface VueBugDetectorConfig extends BugDetectorConfig {
  /** Ativar automaticamente */
  autoActivate?: boolean;
}

/** Injection key */
export const BugDetectorKey: InjectionKey<BugDetectorComposable> = Symbol('BugDetector');

/** Plugin Vue */
export function createBugDetector(config: VueBugDetectorConfig = {}) {
  return {
    install(app: App) {
      const detector = new BugDetector(config);
      
      // Auto-ativa se configurado
      if (config.autoActivate) {
        detector.activate();
      }

      // Cria composable
      const composable = createComposable(detector);
      
      // Registra globalmente
      app.provide(BugDetectorKey, composable);
      app.config.globalProperties.$bugDetector = composable;

      // Cleanup
      app.unmount = () => {
        detector.deactivate();
      };
    },
  };
}

// ============================================================================
// COMPOSABLE
// ============================================================================

export interface BugDetectorComposable {
  /** Se está ativo */
  isActive: Ref<boolean>;
  /** Elemento selecionado */
  selectedElement: Ref<InspectedElement | null>;
  /** Reports */
  reports: Ref<BugReport[]>;
  /** Ativar */
  activate: () => void;
  /** Desativar */
  deactivate: () => void;
  /** Alternar */
  toggle: () => void;
  /** Inspecionar elemento */
  inspectElement: (element: Element | string) => InspectedElement;
  /** Criar report */
  createReport: (data: CreateReportData) => Promise<BugReport>;
  /** Exportar report */
  exportReport: (reportId: string, options: ExportOptions) => Promise<ExportResult>;
  /** Deletar report */
  deleteReport: (reportId: string) => Promise<void>;
  /** Analisar com IA */
  analyzeWithAI: (reportId: string) => Promise<void>;
  /** Criar issue no GitHub */
  createGitHubIssue: (reportId: string, repo?: string) => Promise<void>;
  /** Notificar Slack */
  notifySlack: (reportId: string, channel?: string) => Promise<void>;
  /** Instância do detector */
  detector: BugDetector;
}

/** Cria composable a partir do detector */
function createComposable(detector: BugDetector): BugDetectorComposable {
  const isActive = ref(detector.isActivated());
  const selectedElement = ref<InspectedElement | null>(null);
  const reports = ref<BugReport[]>(detector.getReports());

  // Sincroniza estado
  const syncState = () => {
    isActive.value = detector.isActivated();
    reports.value = detector.getReports();
  };

  return {
    isActive,
    selectedElement,
    reports,

    activate: () => {
      detector.activate();
      syncState();
    },

    deactivate: () => {
      detector.deactivate();
      syncState();
    },

    toggle: () => {
      detector.toggle();
      syncState();
    },

    inspectElement: (element: Element | string) => {
      const inspected = detector.inspectElement(element);
      selectedElement.value = inspected;
      return inspected;
    },

    createReport: async (data: CreateReportData) => {
      const report = await detector.createReport(data);
      syncState();
      return report;
    },

    exportReport: (reportId: string, options: ExportOptions) => {
      return detector.exportReport(reportId, options);
    },

    deleteReport: async (reportId: string) => {
      await detector.deleteReport(reportId);
      syncState();
    },

    analyzeWithAI: async (reportId: string) => {
      await detector.analyzeReport(reportId);
      syncState();
    },

    createGitHubIssue: (reportId: string, repo?: string) => {
      return detector.createGitHubIssue(reportId, repo);
    },

    notifySlack: (reportId: string, channel?: string) => {
      return detector.notifySlack(reportId, channel);
    },

    detector,
  };
}

/** Composable para usar no Vue 3 */
export function useBugDetector(): BugDetectorComposable {
  // Em Vue 3 Composition API
  const { inject } = require('vue');
  const composable = inject(BugDetectorKey);
  
  if (!composable) {
    throw new Error('useBugDetector deve ser usado após instalar o plugin createBugDetector');
  }
  
  return composable;
}

/** Composable para Vue 2 (Composition API plugin) */
export function useBugDetectorVue2(): BugDetectorComposable {
  const vue = require('vue');
  
  if (!vue.inject) {
    throw new Error('Vue 2 requer @vue/composition-api plugin');
  }
  
  const composable = vue.inject(BugDetectorKey);
  
  if (!composable) {
    throw new Error('useBugDetector deve ser usado após instalar o plugin createBugDetector');
  }
  
  return composable;
}

// ============================================================================
// COMPONENTE
// ============================================================================

/** Componente Botão Flutuante (Vue) */
export const BugDetectorButton = {
  name: 'BugDetectorButton',
  props: {
    position: {
      type: String,
      default: 'bottom-right',
      validator: (v: string) => ['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(v),
    },
    color: {
      type: String,
      default: '#3b82f6',
    },
  },
  setup(props: { position: string; color: string }) {
    const detector = useBugDetector();

    const positionStyles: Record<string, Record<string, string>> = {
      'top-left': { top: '20px', left: '20px' },
      'top-right': { top: '20px', right: '20px' },
      'bottom-left': { bottom: '20px', left: '20px' },
      'bottom-right': { bottom: '20px', right: '20px' },
    };

    return () => ({
      type: 'button',
      style: {
        position: 'fixed',
        ...positionStyles[props.position],
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        backgroundColor: detector.isActive.value ? '#ef4444' : props.color,
        color: 'white',
        border: 'none',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        cursor: 'pointer',
        zIndex: 2147483647,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px',
        transition: 'all 0.2s',
      },
      onClick: detector.toggle,
      title: detector.isActive.value ? 'Desativar Debug' : 'Ativar Debug',
      innerHTML: detector.isActive.value ? '✕' : '🐛',
    });
  },
};

export default createBugDetector;
