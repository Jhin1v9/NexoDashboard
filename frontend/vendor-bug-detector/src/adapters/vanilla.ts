/**
 * Vanilla JS Adapter para BugDetector
 * API simples e completa para uso sem frameworks
 *
 * Uso:
 *   BugDetector.init({ shortcut: 'Ctrl+Shift+D' });
 *   BugDetector.inject('https://cdn.../bug-detector.iife.js', { ... });
 */

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
// API VANILLA
// ============================================================================

/** Instância global */
let globalInstance: BugDetector | null = null;
let keyboardHandler: ((e: KeyboardEvent) => void) | null = null;
let floatingButton: HTMLButtonElement | null = null;

/** Inicializa o BugDetector com uma única chamada */
export function initBugDetector(config: BugDetectorConfig = {}): BugDetector {
  if (globalInstance) {
    console.warn('[BugDetector] Já inicializado. Use destroyBugDetector() primeiro se quiser reiniciar.');
    return globalInstance;
  }

  globalInstance = new BugDetector(config);

  // Auto-ativa com atalho de teclado
  if (config.trigger === 'keyboard-shortcut' && config.shortcut) {
    setupKeyboardShortcut(config.shortcut);
  }

  // Cria botão flutuante se configurado
  if (config.trigger === 'floating-button') {
    createFloatingButton(config.branding);
  }

  // Auto-ativa em desenvolvimento
  if (config.autoActivateInDev && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    globalInstance.activate();
  }

  return globalInstance;
}

/** Obtém instância existente */
export function getBugDetector(): BugDetector {
  if (!globalInstance) {
    throw new Error('BugDetector não inicializado. Chame BugDetector.init() primeiro.');
  }
  return globalInstance;
}

/** Destrói instância e limpa tudo */
export function destroyBugDetector(): void {
  if (globalInstance) {
    globalInstance.destroy();
    globalInstance = null;
  }
  if (keyboardHandler) {
    document.removeEventListener('keydown', keyboardHandler);
    keyboardHandler = null;
  }
  if (floatingButton) {
    floatingButton.remove();
    floatingButton = null;
  }
}

// ============================================================================
// INJEÇÃO REMOTA (CDN / Bookmarklet)
// ============================================================================

/** Injeta o BugDetector via script tag remota */
export function injectBugDetector(
  scriptUrl: string,
  config: BugDetectorConfig = {}
): Promise<BugDetector> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('document não disponível'));
      return;
    }
    if ((window as any).__bugDetectorInjected) {
      resolve(getBugDetector());
      return;
    }

    const script = document.createElement('script');
    script.src = scriptUrl;
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      (window as any).__bugDetectorInjected = true;
      const detector = initBugDetector(config);
      resolve(detector);
    };
    script.onerror = () => reject(new Error(`Falha ao carregar ${scriptUrl}`));
    document.head.appendChild(script);
  });
}

/** Gera código de bookmarklet para injeção */
export function generateBookmarklet(
  scriptUrl: string,
  config: BugDetectorConfig = {}
): string {
  const configJson = JSON.stringify(config);
  const code = `
    (function(){
      if(window.__bugDetectorInjected)return;
      window.__bugDetectorInjected=true;
      var s=document.createElement('script');
      s.src='${scriptUrl}';
      s.crossOrigin='anonymous';
      s.onload=function(){
        if(window.BugDetector&&window.BugDetector.init){
          window.BugDetector.init(${configJson});
        }
      };
      document.head.appendChild(s);
    })();
  `;
  return 'javascript:' + encodeURIComponent(code.trim().replace(/\s+/g, ' '));
}

// ============================================================================
// FUNÇÕES DE CONVENIÊNCIA
// ============================================================================

/** Ativa o BugDetector */
export function activate(): void {
  getBugDetector().activate();
}

/** Desativa o BugDetector */
export function deactivate(): void {
  getBugDetector().deactivate();
}

/** Alterna estado */
export function toggle(): void {
  getBugDetector().toggle();
}

/** Inspeciona elemento */
export function inspect(element: Element | string): InspectedElement {
  return getBugDetector().inspectElement(element);
}

/** Cria report */
export async function report(
  description: string,
  options: Partial<CreateReportData> = {}
): Promise<BugReport> {
  return getBugDetector().createReport({
    description,
    ...options,
  });
}

/** Obtém todos os reports */
export function getReports(): BugReport[] {
  return getBugDetector().getReports();
}

/** Exporta report */
export async function exportReport(
  reportId: string,
  format: ExportOptions['format'] = 'markdown'
): Promise<ExportResult> {
  return getBugDetector().exportReport(reportId, { format });
}

// ============================================================================
// BOTÃO FLUTUANTE
// ============================================================================

interface FloatingButtonBranding {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  color?: string;
  logoURL?: string;
  buttonText?: string;
}

export function createFloatingButton(branding: FloatingButtonBranding = {}): HTMLButtonElement {
  if (floatingButton) {
    floatingButton.remove();
  }

  const position = branding.position || 'bottom-right';
  const color = branding.color || '#3b82f6';
  const size = 56;

  const positions: Record<string, { top?: string; left?: string; right?: string; bottom?: string }> = {
    'top-left': { top: '20px', left: '20px' },
    'top-right': { top: '20px', right: '20px' },
    'bottom-left': { bottom: '20px', left: '20px' },
    'bottom-right': { bottom: '20px', right: '20px' },
  };

  const button = document.createElement('button');
  button.innerHTML = branding.logoURL
    ? `<img src="${branding.logoURL}" style="width:28px;height:28px;object-fit:contain;border-radius:4px;">`
    : (branding.buttonText || '🐛');
  button.title = 'BugDetector Pro — Click para ativar, Shift+Click para painel, RMB para menu';

  Object.assign(button.style, {
    position: 'fixed',
    ...positions[position],
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    backgroundColor: color,
    color: 'white',
    border: 'none',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    cursor: 'pointer',
    zIndex: '2147483647',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: branding.buttonText ? '14px' : '24px',
    fontWeight: '600',
    transition: 'all 0.2s',
  });

  button.addEventListener('mouseenter', () => {
    button.style.transform = 'scale(1.1)';
  });
  button.addEventListener('mouseleave', () => {
    button.style.transform = 'scale(1)';
  });

  button.addEventListener('click', (e) => {
    const detector = getBugDetector();
    if (e.shiftKey) {
      // Abre painel de reports via UIManager
      (detector as any).ui?.renderReportsList?.();
    } else {
      detector.toggle();
      updateButtonState();
    }
  });

  // Menu com RMB
  button.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showContextMenu(button, color);
  });

  document.body.appendChild(button);
  floatingButton = button;
  return button;
}

function updateButtonState(): void {
  if (!floatingButton || !globalInstance) return;
  const isActive = globalInstance.isActivated();
  const config = (globalInstance as any).config?.getBranding?.() || {};
  floatingButton.innerHTML = config.logoURL
    ? `<img src="${config.logoURL}" style="width:28px;height:28px;object-fit:contain;border-radius:4px;">`
    : (isActive ? '✕' : '🐛');
  floatingButton.style.backgroundColor = isActive ? '#ef4444' : (config.primaryColor || '#3b82f6');
  floatingButton.title = isActive ? 'Desativar Debug' : 'Ativar Debug';
}

function showContextMenu(button: HTMLButtonElement, color: string): void {
  const existing = document.querySelector('[data-bugdetector-context-menu]');
  if (existing) { existing.remove(); return; }

  const rect = button.getBoundingClientRect();
  const menu = document.createElement('div');
  menu.setAttribute('data-bugdetector-context-menu', '');
  menu.style.cssText = `
    position: fixed;
    bottom: ${window.innerHeight - rect.top + 8}px;
    right: ${window.innerWidth - rect.right}px;
    background: rgba(15,23,42,0.98);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    z-index: 2147483647;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    min-width: 160px;
  `;

  const items = [
    { label: '📋 Ver Reports', action: () => { (globalInstance as any).ui?.renderReportsList?.(); } },
    { label: '🔍 Inspecionar', action: () => { globalInstance?.activate(); } },
    { label: '⚙️ Configurações', action: () => { (globalInstance as any).ui?.renderPanel?.(); } },
  ];

  items.forEach(item => {
    const btn = document.createElement('button');
    btn.textContent = item.label;
    btn.style.cssText = `
      text-align: left;
      padding: 8px 12px;
      background: transparent;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      white-space: nowrap;
    `;
    btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(255,255,255,0.1)'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; });
    btn.addEventListener('click', () => { item.action(); menu.remove(); });
    menu.appendChild(btn);
  });

  document.body.appendChild(menu);

  // Fecha ao clicar fora
  const closeMenu = (e: MouseEvent) => {
    if (!menu.contains(e.target as Node)) {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    }
  };
  setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

// ============================================================================
// UTILIDADES
// ============================================================================

/** Configura atalho de teclado */
function setupKeyboardShortcut(shortcut: string): void {
  const keys = shortcut.toLowerCase().split('+');

  keyboardHandler = (e: KeyboardEvent) => {
    const hasCtrl = keys.includes('ctrl') || keys.includes('control');
    const hasShift = keys.includes('shift');
    const hasAlt = keys.includes('alt');
    const key = keys.find(k => !['ctrl', 'control', 'shift', 'alt'].includes(k));

    if (
      e.ctrlKey === hasCtrl &&
      e.shiftKey === hasShift &&
      e.altKey === hasAlt &&
      e.key.toLowerCase() === key
    ) {
      e.preventDefault();
      getBugDetector().toggle();
    }
  };

  document.addEventListener('keydown', keyboardHandler);
}

/** Auto-inicialização */
export function autoInit(config: BugDetectorConfig = {}): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init(config));
  } else {
    init(config);
  }

  function init(cfg: BugDetectorConfig) {
    const detector = initBugDetector(cfg);
    if (cfg.trigger === 'floating-button') {
      createFloatingButton(cfg.branding);
    }
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      detector.activate();
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  BugDetector,
  BugDetectorConfig,
  InspectedElement,
  BugReport,
  CreateReportData,
  ExportOptions,
  ExportResult,
};

/** Exporta tudo em um objeto global */
export const BugDetectorAPI = {
  init: initBugDetector,
  get: getBugDetector,
  destroy: destroyBugDetector,
  inject: injectBugDetector,
  bookmarklet: generateBookmarklet,
  activate,
  deactivate,
  toggle,
  inspect,
  report,
  getReports,
  exportReport,
  createFloatingButton,
  autoInit,
};

export default BugDetectorAPI;
