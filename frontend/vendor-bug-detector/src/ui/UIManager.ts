/**
 * Gerenciador de UI
 * Controla todos os elementos visuais da ferramenta
 */

import type { InspectedElement, BugReport, CreateReportData, BrandingConfig, AIEnhancedReport } from '../types';
import { CanvasAnnotationEngine } from './CanvasAnnotationEngine';
import { ScreenRecorder } from '../capture/ScreenRecorder';

/** Callbacks da UI */
interface UIManagerCallbacks {
  onActivate: () => void;
  onDeactivate: () => void;
  onElementInspect: (element: InspectedElement) => void;
  onCreateReport: (data: CreateReportData) => Promise<BugReport>;
  onSendMessage: (sessionId: string, message: string) => Promise<any>;
  onEnhanceReport: (data: {
    description: string;
    expectedBehavior?: string;
    element: InspectedElement;
    screenshotBase64?: string;
  }) => Promise<AIEnhancedReport>;
}

/** Classe UIManager */
export class UIManager {
  private callbacks: UIManagerCallbacks;
  private container: HTMLElement | null = null;
  private _isVisible = false;
  private _currentElement: InspectedElement | null = null;
  private zIndexBase: number;
  private branding: BrandingConfig;
  private guestMode: boolean;

  constructor(
    callbacks: UIManagerCallbacks,
    zIndexBase: number = 999999,
    branding: BrandingConfig = {},
    guestMode: boolean = false,
  ) {
    this.callbacks = callbacks;
    this.zIndexBase = zIndexBase;
    this.branding = branding;
    this.guestMode = guestMode;
    this.createContainer();
  }

  /** Mostra a UI */
  show(): void {
    if (!this.container) {
      this.createContainer();
    }
    this.container!.style.display = 'block';
    this._isVisible = true;
    this.renderFloatingButton();
  }

  /** Abre o painel de reports (público para vanilla API) */
  openReportsPanel(): void {
    this.renderReportsList();
  }

  /** Abre o menu de configurações (público para vanilla API) */
  openSettingsPanel(): void {
    this.renderPanel();
  }

  /** Esconde a UI */
  hide(): void {
    if (this.container) {
      this.container.style.display = 'none';
    }
    this._isVisible = false;
  }

  /** Mostra modal de report */
  showReportModal(element: InspectedElement): void {
    this._currentElement = element;
    void this.renderReportModal(element);
  }

  /** Atualiza tooltip do elemento */
  updateElementTooltip(element: InspectedElement | null): void {
    this.renderTooltip(element);
  }

  /** Destrói a UI */
  destroy(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }

  // ============================================================================
  // PRIVATE METHODS - Container
  // ============================================================================

  private createContainer(): void {
    this.container = document.createElement('div');
    this.container.id = 'bug-detector-ui';
    this.container.setAttribute('data-bug-detector-ui', '');
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 2147483646;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    document.body.appendChild(this.container);
  }

  // ============================================================================
  // PRIVATE METHODS - Floating Button
  // ============================================================================

  private renderFloatingButton(): void {
    if (!this.container) return;

    // Remove botão existente
    const existing = this.container.querySelector('[data-bugdetector-floating-button]');
    if (existing) existing.remove();

    const primary = this.branding.primaryColor || '#3b82f6';
    const secondary = this.branding.backgroundColor || '#8b5cf6';
    const pos = this.branding.position || 'bottom-right';
    const posMap: Record<string, { bottom?: string; top?: string; right?: string; left?: string }> = {
      'bottom-right': { bottom: '20px', right: '20px' },
      'bottom-left': { bottom: '20px', left: '20px' },
      'top-right': { top: '20px', right: '20px' },
      'top-left': { top: '20px', left: '20px' },
    };
    const p = posMap[pos] || posMap['bottom-right'];

    const button = document.createElement('button');
    button.setAttribute('data-bugdetector-floating-button', '');
    button.innerHTML = this.branding.logoURL ? `<img src="${this.branding.logoURL}" style="width:28px;height:28px;object-fit:contain;border-radius:4px;">` : (this.branding.buttonText || '🐛');
    button.title = 'BugDetector Pro';
    button.style.cssText = `
      position: fixed;
      ${p.top ? `top: ${p.top};` : ''}
      ${p.bottom ? `bottom: ${p.bottom};` : ''}
      ${p.left ? `left: ${p.left};` : ''}
      ${p.right ? `right: ${p.right};` : ''}
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: ${this.branding.buttonText || this.branding.logoURL ? primary : `linear-gradient(135deg, ${primary}, ${secondary})`};
      color: white;
      border: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      cursor: pointer;
      pointer-events: auto;
      font-size: ${this.branding.buttonText ? '14px' : '24px'};
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      z-index: ${this.zIndexBase};
    `;

    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.1)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
    });

    button.addEventListener('click', () => {
      this.renderPanel();
    });

    this.container.appendChild(button);
  }

  // ============================================================================
  // PRIVATE METHODS - Tooltip
  // ============================================================================

  private renderTooltip(element: InspectedElement | null): void {
    if (!this.container) return;

    const existing = this.container.querySelector('[data-bugdetector-tooltip]');
    if (existing) existing.remove();

    if (!element) return;

    const tooltip = document.createElement('div');
    tooltip.setAttribute('data-bugdetector-tooltip', '');
    tooltip.style.cssText = `
      position: fixed;
      top: ${element.rect.top + element.rect.height + 8}px;
      left: ${element.rect.left}px;
      background: rgba(15, 23, 42, 0.95);
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 12px;
      pointer-events: none;
      z-index: ${this.zIndexBase};
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.1);
      max-width: 320px;
    `;

    tooltip.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 4px; color: #60a5fa;">
        &lt;${element.tag}&gt;
      </div>
      ${element.elementId ? `<div style="color: #94a3b8;">#${element.elementId}</div>` : ''}
      ${element.className ? `<div style="color: #94a3b8; margin-top: 2px;">${element.className.slice(0, 50)}${element.className.length > 50 ? '...' : ''}</div>` : ''}
      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.1); color: #64748b;">
        ${Math.round(element.rect.width)}×${Math.round(element.rect.height)}px
      </div>
    `;

    this.container.appendChild(tooltip);
  }

  // ============================================================================
  // PRIVATE METHODS - Panel
  // ============================================================================

  renderPanel(): void {
    if (!this.container) return;

    const existing = this.container.querySelector('[data-bugdetector-panel]');
    if (existing) {
      existing.remove();
      return;
    }

    const primary = this.branding.primaryColor || '#3b82f6';
    const bg = this.branding.backgroundColor || 'rgba(15, 23, 42, 0.98)';

    const panel = document.createElement('div');
    panel.setAttribute('data-bugdetector-panel', '');
    panel.style.cssText = `
      position: fixed;
      top: 20px;
      right: 80px;
      width: 320px;
      background: ${bg};
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      pointer-events: auto;
      z-index: ${this.zIndexBase};
      border: 1px solid rgba(255,255,255,0.1);
      color: white;
      overflow: hidden;
    `;

    const reportsButton = this.guestMode ? '' : `
      <button data-bugdetector-btn-reports style="padding: 12px; background: rgba(255,255,255,0.1); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 8px;">
        <span>📋</span> Ver Reports
      </button>
    `;

    panel.innerHTML = `
      <div style="padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 20px;">🐛</span>
          <span style="font-weight: 600;">BugDetector Pro</span>
        </div>
        <button data-bugdetector-close-panel style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 18px; padding: 4px;">×</button>
      </div>
      <div style="padding: 16px;">
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <button data-bugdetector-btn-inspect style="padding: 12px; background: ${primary}; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 8px;">
            <span>🔍</span> Inspecionar Elemento
          </button>
          ${reportsButton}
          <button data-bugdetector-btn-settings style="padding: 12px; background: rgba(255,255,255,0.1); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 8px;">
            <span>⚙️</span> Configurações
          </button>
        </div>
        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 12px; color: #64748b; text-align: center;">
          Pressione ESC para sair do modo inspeção
        </div>
      </div>
    `;

    // Event listeners
    panel.querySelector('[data-bugdetector-close-panel]')?.addEventListener('click', () => panel.remove());
    panel.querySelector('[data-bugdetector-btn-inspect]')?.addEventListener('click', () => {
      panel.remove();
      this.callbacks.onActivate();
    });
    panel.querySelector('[data-bugdetector-btn-reports]')?.addEventListener('click', () => {
      this.renderReportsList();
      panel.remove();
    });

    this.container.appendChild(panel);
  }

  // ============================================================================
  // PRIVATE METHODS - Helpers
  // ============================================================================

  private async captureScreenshot(element?: Element): Promise<string> {
    try {
      const html2canvas = (await import('html2canvas')).default;
      const target = element || document.body;
      const canvas = await html2canvas(target as HTMLElement, {
        logging: false,
        useCORS: true,
        allowTaint: true,
        scale: window.devicePixelRatio,
        backgroundColor: null,
      });
      return canvas.toDataURL('image/png');
    } catch {
      return '';
    }
  }

  private getSensitiveRects(element: Element): Array<{ x: number; y: number; width: number; height: number }> {
    const rects: Array<{ x: number; y: number; width: number; height: number }> = [];
    const addRect = (el: Element) => {
      const rect = el.getBoundingClientRect();
      const bodyRect = document.body.getBoundingClientRect();
      rects.push({
        x: rect.left - bodyRect.left + window.scrollX,
        y: rect.top - bodyRect.top + window.scrollY,
        width: rect.width,
        height: rect.height,
      });
    };

    if (!element) return rects;

    element.querySelectorAll('input[type="password"]').forEach(addRect);
    ['cpf', 'ssn', 'credit', 'card', 'cvv', 'password', 'secret'].forEach((name) => {
      element.querySelectorAll(`input[name*="${name}"], input[id*="${name}"]`).forEach(addRect);
    });
    element.querySelectorAll('input[type="email"]').forEach(addRect);
    return rects;
  }

  // ============================================================================
  // PRIVATE METHODS - Report Modal
  // ============================================================================

  private async renderReportModal(element: InspectedElement): Promise<void> {
    if (!this.container) return;

    // Captura screenshot para preview e anotação
    const screenshotUrl = await this.captureScreenshot(element.domElement || document.body);
    let annotatedUrl: string | null = null;

    const modal = document.createElement('div');
    modal.setAttribute('data-bugdetector-report-modal', '');
    modal.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 480px;
      max-height: 80vh;
      background: rgba(15, 23, 42, 0.98);
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      pointer-events: auto;
      z-index: ${this.zIndexBase};
      border: 1px solid rgba(255,255,255,0.1);
      color: white;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    `;

    let recordedVideoBase64: string | null = null;
    let isRecording = false;
    let recorder: ScreenRecorder | null = null;
    let aiMarkdownReport: string | undefined;

    const screenshotSection = screenshotUrl ? `
      <div style="margin-bottom: 16px;">
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px;">
          <input type="checkbox" data-bugdetector-screenshot checked style="width: 18px; height: 18px;">
          <span>Incluir screenshot</span>
        </label>
        <div data-bugdetector-screenshot-preview style="margin-top: 10px; position: relative; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
          <img src="${screenshotUrl}" style="width: 100%; height: 120px; object-fit: cover; display: block;">
          <button data-bugdetector-annotate style="position: absolute; inset: 0; margin: auto; width: fit-content; height: fit-content; padding: 8px 14px; background: rgba(15,23,42,0.95); color: white; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; cursor: pointer; font-size: 13px; opacity: 0; transition: opacity 0.2s;">✏️ Anotar</button>
        </div>
      </div>
    ` : '';

    modal.innerHTML = `
      <div style="padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 24px;">📝</span>
          <div>
            <div style="font-weight: 600; font-size: 16px;">Novo Report</div>
            <div style="font-size: 12px; color: #64748b;">&lt;${element.tag}&gt;</div>
          </div>
        </div>
        <button data-bugdetector-close-modal style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 24px; padding: 4px;">×</button>
      </div>
      <div style="padding: 20px; overflow-y: auto; flex: 1;">
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-size: 12px; color: #94a3b8; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Tipo</label>
          <div style="display: flex; gap: 8px;">
            <button data-bugdetector-type-btn data-type="bug" data-active="true" style="flex: 1; padding: 10px; background: #ef4444; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 13px;">🐛 Bug</button>
            <button data-bugdetector-type-btn data-type="improvement" style="flex: 1; padding: 10px; background: rgba(255,255,255,0.1); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 13px;">💡 Melhoria</button>
          </div>
        </div>
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-size: 12px; color: #94a3b8; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Severidade</label>
          <select data-bugdetector-severity style="width: 100%; padding: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: white; font-size: 14px;">
            <option value="low">🟢 Baixa</option>
            <option value="medium" selected>🟡 Média</option>
            <option value="high">🟠 Alta</option>
            <option value="critical">🔴 Crítica</option>
          </select>
        </div>
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-size: 12px; color: #94a3b8; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Descrição *</label>
          <textarea data-bugdetector-description placeholder="Descreva o bug encontrado..." style="width: 100%; min-height: 100px; padding: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: white; font-size: 14px; resize: vertical; font-family: inherit;"></textarea>
        </div>
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-size: 12px; color: #94a3b8; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Comportamento Esperado</label>
          <textarea data-bugdetector-expected placeholder="Como deveria funcionar? (opcional)" style="width: 100%; min-height: 60px; padding: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: white; font-size: 14px; resize: vertical; font-family: inherit;"></textarea>
        </div>
        ${!this.guestMode ? `
        <div style="margin-bottom: 16px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 16px;" data-bugdetector-ai-section>
          <button data-bugdetector-ai-rewrite style="width: 100%; padding: 10px 12px; background: linear-gradient(135deg, #06b6d4, #3b82f6); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600;">Reescrever com IA + .BRAIN</button>
          <div data-bugdetector-ai-status style="display: none; margin-top: 8px; font-size: 13px; color: #93c5fd;"></div>
          <div data-bugdetector-ai-preview style="display: none; margin-top: 10px; padding: 12px; background: rgba(8,47,73,0.45); border: 1px solid rgba(56,189,248,0.25); border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; gap: 8px; align-items: center; margin-bottom: 8px;">
              <strong data-bugdetector-ai-title style="font-size: 13px; color: #e0f2fe;"></strong>
              <span data-bugdetector-ai-severity style="font-size: 11px; color: #bae6fd; text-transform: uppercase;"></span>
            </div>
            <div data-bugdetector-ai-description style="font-size: 13px; color: #cbd5e1; line-height: 1.45; white-space: pre-wrap;"></div>
            <details style="margin-top: 10px;">
              <summary style="cursor: pointer; color: #67e8f9; font-size: 12px;">Markdown corrigido</summary>
              <pre data-bugdetector-ai-markdown style="margin-top: 8px; max-height: 160px; overflow: auto; white-space: pre-wrap; color: #e2e8f0; font-size: 11px; line-height: 1.45;"></pre>
            </details>
          </div>
        </div>
        ` : ''}
        ${screenshotSection}
        <div style="margin-bottom: 16px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 16px;" data-bugdetector-video-section>
          <label style="display: block; font-size: 12px; color: #94a3b8; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Gravação de Tela</label>
          <div data-bugdetector-video-controls>
            <button data-bugdetector-record-start style="padding: 8px 14px; background: rgba(255,255,255,0.1); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 13px;">🔴 Gravar Tela (10s)</button>
          </div>
          <div data-bugdetector-video-recording style="display: none; align-items: center; gap: 10px; margin-top: 8px;">
            <span style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; background: rgba(239,68,68,0.15); color: #f87171; border-radius: 6px; font-size: 13px;">
              <span style="display: inline-block; width: 8px; height: 8px; background: #ef4444; border-radius: 50%;"></span>
              Gravando… <span data-bugdetector-timer>0.0s</span>
            </span>
            <button data-bugdetector-record-stop style="padding: 6px 10px; background: rgba(255,255,255,0.1); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px;">Parar</button>
          </div>
          <div data-bugdetector-video-preview style="display: none; margin-top: 8px;">
            <video data-bugdetector-video-el style="width: 100%; height: 120px; background: #000; border-radius: 8px;" controls></video>
            <div style="display: flex; align-items: center; gap: 10px; margin-top: 6px;">
              <span style="font-size: 13px; color: #34d399;">✓ Vídeo gravado</span>
              <button data-bugdetector-video-remove style="font-size: 13px; color: #f87171; background: none; border: none; cursor: pointer; text-decoration: underline;">Remover vídeo</button>
            </div>
          </div>
          <div data-bugdetector-video-error style="display: none; margin-top: 6px; font-size: 13px; color: #f87171;"></div>
        </div>
      </div>
      <div style="padding: 20px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; gap: 12px;">
        <button data-bugdetector-btn-cancel style="flex: 1; padding: 12px; background: rgba(255,255,255,0.1); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">Cancelar</button>
        <button data-bugdetector-btn-submit style="flex: 1; padding: 12px; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500;">Criar Report</button>
      </div>
    `;

    // Hover no preview para mostrar botão anotar
    const previewWrap = modal.querySelector('[data-bugdetector-screenshot-preview]') as HTMLElement | null;
    const annotateBtn = modal.querySelector('[data-bugdetector-annotate]') as HTMLElement | null;
    if (previewWrap && annotateBtn) {
      previewWrap.addEventListener('mouseenter', () => annotateBtn.style.opacity = '1');
      previewWrap.addEventListener('mouseleave', () => annotateBtn.style.opacity = '0');
      annotateBtn.addEventListener('click', () => {
        this.renderAnnotationOverlay((annotatedUrl || screenshotUrl), this.getSensitiveRects(element.domElement || document.body), (url) => {
          annotatedUrl = url;
          const img = previewWrap.querySelector('img');
          if (img) img.src = url;
          annotateBtn.textContent = '✏️ Reanotar';
        });
      });
    }

    // Event listeners
    const closeModal = () => {
      document.removeEventListener('keydown', escHandler);
      modal.remove();
    };

    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', escHandler);
    
    modal.querySelector('[data-bugdetector-close-modal]')?.addEventListener('click', closeModal);
    modal.querySelector('[data-bugdetector-btn-cancel]')?.addEventListener('click', closeModal);

    const aiRewriteBtn = modal.querySelector('[data-bugdetector-ai-rewrite]') as HTMLButtonElement | null;
    const aiStatus = modal.querySelector('[data-bugdetector-ai-status]') as HTMLElement | null;
    const aiPreview = modal.querySelector('[data-bugdetector-ai-preview]') as HTMLElement | null;
    const aiTitle = modal.querySelector('[data-bugdetector-ai-title]') as HTMLElement | null;
    const aiSeverity = modal.querySelector('[data-bugdetector-ai-severity]') as HTMLElement | null;
    const aiDescription = modal.querySelector('[data-bugdetector-ai-description]') as HTMLElement | null;
    const aiMarkdown = modal.querySelector('[data-bugdetector-ai-markdown]') as HTMLElement | null;

    aiRewriteBtn?.addEventListener('click', async () => {
      const descriptionEl = modal.querySelector('[data-bugdetector-description]') as HTMLTextAreaElement | null;
      const expectedEl = modal.querySelector('[data-bugdetector-expected]') as HTMLTextAreaElement | null;
      const severityEl = modal.querySelector('[data-bugdetector-severity]') as HTMLSelectElement | null;
      const description = descriptionEl?.value.trim() || '';

      if (!description) {
        alert('Escreva um comentário bruto antes de chamar a IA');
        return;
      }

      aiRewriteBtn.disabled = true;
      aiRewriteBtn.textContent = 'Reescrevendo...';
      if (aiStatus) {
        aiStatus.style.display = 'block';
        aiStatus.style.color = '#93c5fd';
        aiStatus.textContent = 'IA interna usando .BRAIN para estruturar o report...';
      }

      try {
        const result = await this.callbacks.onEnhanceReport({
          description,
          expectedBehavior: expectedEl?.value.trim() || undefined,
          element,
          screenshotBase64: screenshotUrl || undefined,
        });

        aiMarkdownReport = result.markdown;
        if (descriptionEl) descriptionEl.value = result.description;
        if (severityEl) severityEl.value = result.severity;
        if (aiTitle) aiTitle.textContent = result.title;
        if (aiSeverity) aiSeverity.textContent = result.severity;
        if (aiDescription) aiDescription.textContent = result.description;
        if (aiMarkdown) aiMarkdown.textContent = result.markdown;
        if (aiPreview) aiPreview.style.display = 'block';
        if (aiStatus) {
          aiStatus.style.color = '#34d399';
          aiStatus.textContent = 'Comentário reescrito e Markdown corrigido anexado ao report.';
        }
      } catch (error) {
        aiMarkdownReport = undefined;
        if (aiStatus) {
          aiStatus.style.display = 'block';
          aiStatus.style.color = '#f87171';
          aiStatus.textContent = (error as Error).message;
        }
      } finally {
        aiRewriteBtn.disabled = false;
        aiRewriteBtn.textContent = 'Reescrever com IA + .BRAIN';
      }
    });
    
    modal.querySelector('[data-bugdetector-btn-submit]')?.addEventListener('click', async () => {
      const description = (modal.querySelector('[data-bugdetector-description]') as HTMLTextAreaElement)?.value;
      if (!description?.trim()) {
        alert('Por favor, descreva o bug');
        return;
      }

      const activeTypeBtn = modal.querySelector('[data-bugdetector-type-btn][data-active="true"]') as HTMLElement;
      const type = activeTypeBtn?.dataset.type as 'bug' | 'improvement' | 'question';
      const severity = (modal.querySelector('[data-bugdetector-severity]') as HTMLSelectElement)?.value as 'low' | 'medium' | 'high' | 'critical';
      const expectedBehavior = (modal.querySelector('[data-bugdetector-expected]') as HTMLTextAreaElement)?.value;
      const includeScreenshot = !!(modal.querySelector('[data-bugdetector-screenshot]') as HTMLInputElement | null)?.checked;
      try {
        await this.callbacks.onCreateReport({
          description,
          type,
          severity,
          expectedBehavior,
          markdownReport: aiMarkdownReport,
          element,
          screenshot: includeScreenshot ? (annotatedUrl || screenshotUrl || undefined) : undefined,
          video: recordedVideoBase64 || undefined,
        });

        closeModal();
        this.showSuccessToast('Report criado com sucesso!');
      } catch (error) {
        alert('Erro ao criar report: ' + (error as Error).message);
      }
    });

    // Type buttons
    modal.querySelectorAll('[data-bugdetector-type-btn]').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('[data-bugdetector-type-btn]').forEach(b => {
          (b as HTMLElement).style.background = 'rgba(255,255,255,0.1)';
          b.removeAttribute('data-active');
        });
        (btn as HTMLElement).style.background = '#ef4444';
        btn.setAttribute('data-active', 'true');
      });
    });

    // Screen recording vanilla bindings
    const videoSection = modal.querySelector('[data-bugdetector-video-section]') as HTMLElement | null;
    const recordStartBtn = modal.querySelector('[data-bugdetector-record-start]') as HTMLElement | null;
    const recordingUI = modal.querySelector('[data-bugdetector-video-recording]') as HTMLElement | null;
    const recordStopBtn = modal.querySelector('[data-bugdetector-record-stop]') as HTMLElement | null;
    const timerEl = modal.querySelector('[data-bugdetector-timer]') as HTMLElement | null;
    const previewUI = modal.querySelector('[data-bugdetector-video-preview]') as HTMLElement | null;
    const videoEl = modal.querySelector('[data-bugdetector-video-el]') as HTMLVideoElement | null;
    const removeVideoBtn = modal.querySelector('[data-bugdetector-video-remove]') as HTMLElement | null;
    const errorEl = modal.querySelector('[data-bugdetector-video-error]') as HTMLElement | null;

    const showError = (msg: string) => {
      if (errorEl) {
        errorEl.textContent = msg;
        errorEl.style.display = 'block';
      }
    };
    const hideError = () => {
      if (errorEl) errorEl.style.display = 'none';
    };

    const updateRecordingUI = (show: boolean) => {
      if (recordStartBtn) recordStartBtn.style.display = show ? 'none' : 'inline-block';
      if (recordingUI) recordingUI.style.display = show ? 'flex' : 'none';
    };

    const updatePreviewUI = (show: boolean) => {
      if (previewUI) previewUI.style.display = show ? 'block' : 'none';
      if (recordStartBtn) recordStartBtn.style.display = show ? 'none' : 'inline-block';
    };

    if (!ScreenRecorder.isSupported() && recordStartBtn) {
      recordStartBtn.style.display = 'none';
      const noSupport = document.createElement('p');
      noSupport.style.cssText = 'font-size: 13px; color: #64748b; margin: 0;';
      noSupport.textContent = 'Seu navegador não suporta gravação de tela.';
      videoSection?.querySelector('[data-bugdetector-video-controls]')?.appendChild(noSupport);
    }

    recordStartBtn?.addEventListener('click', async () => {
      hideError();
      try {
        recorder = new ScreenRecorder({
          maxDuration: 10000,
          onProgress: (elapsed) => {
            if (timerEl) timerEl.textContent = `${(elapsed / 1000).toFixed(1)}s`;
          },
          onStop: async (blob) => {
            isRecording = false;
            updateRecordingUI(false);
            if (blob && blob.size > 0) {
              recordedVideoBase64 = await ScreenRecorder.blobToBase64(blob);
              if (videoEl) videoEl.src = recordedVideoBase64;
              updatePreviewUI(true);
            }
          },
          onError: (err) => {
            isRecording = false;
            updateRecordingUI(false);
            showError(err.message);
          },
        });
        isRecording = true;
        updateRecordingUI(true);
        await recorder.start();
      } catch (err) {
        isRecording = false;
        updateRecordingUI(false);
        showError(err instanceof Error ? err.message : String(err));
      }
    });

    recordStopBtn?.addEventListener('click', () => {
      recorder?.stop();
    });

    removeVideoBtn?.addEventListener('click', () => {
      recordedVideoBase64 = null;
      if (videoEl) videoEl.src = '';
      updatePreviewUI(false);
      if (recordStartBtn) recordStartBtn.style.display = 'inline-block';
    });

    this.container.appendChild(modal);
  }

  // ============================================================================
  // PRIVATE METHODS - Annotation Overlay (Vanilla)
  // ============================================================================

  private renderAnnotationOverlay(screenshotUrl: string, sensitiveRects: Array<{ x: number; y: number; width: number; height: number }>, onApply: (url: string) => void): void {
    if (!this.container) return;

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: #020617;
      z-index: ${this.zIndexBase + 10};
      display: flex;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.style.cssText = `
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px; background: rgba(15,23,42,0.98); border-bottom: 1px solid rgba(255,255,255,0.1);
    `;

    const toolsHtml = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="display: flex; gap: 4px; background: rgba(255,255,255,0.05); padding: 4px; border-radius: 8px;">
          <button data-tool="rectangle" title="Retângulo" style="width: 32px; height: 32px; border-radius: 6px; border: none; background: #06b6d4; color: white; cursor: pointer; font-weight: bold;">▭</button>
          <button data-tool="arrow" title="Seta" style="width: 32px; height: 32px; border-radius: 6px; border: none; background: rgba(255,255,255,0.1); color: white; cursor: pointer; font-weight: bold;">→</button>
          <button data-tool="blur" title="Blur" style="width: 32px; height: 32px; border-radius: 6px; border: none; background: rgba(255,255,255,0.1); color: white; cursor: pointer; font-weight: bold;">◧</button>
          <button data-tool="text" title="Texto" style="width: 32px; height: 32px; border-radius: 6px; border: none; background: rgba(255,255,255,0.1); color: white; cursor: pointer; font-weight: bold;">T</button>
        </div>
        <div style="width: 1px; height: 24px; background: rgba(255,255,255,0.1); margin: 0 4px;"></div>
        <div style="display: flex; gap: 4px;">
          <button data-color="#ef4444" style="width: 22px; height: 22px; border-radius: 50%; background: #ef4444; border: 2px solid white; cursor: pointer;"></button>
          <button data-color="#eab308" style="width: 22px; height: 22px; border-radius: 50%; background: #eab308; border: 2px solid transparent; cursor: pointer;"></button>
          <button data-color="#22c55e" style="width: 22px; height: 22px; border-radius: 50%; background: #22c55e; border: 2px solid transparent; cursor: pointer;"></button>
          <button data-color="#3b82f6" style="width: 22px; height: 22px; border-radius: 50%; background: #3b82f6; border: 2px solid transparent; cursor: pointer;"></button>
          <button data-color="#ffffff" style="width: 22px; height: 22px; border-radius: 50%; background: #ffffff; border: 2px solid transparent; cursor: pointer;"></button>
        </div>
        <div style="width: 1px; height: 24px; background: rgba(255,255,255,0.1); margin: 0 4px;"></div>
        <button data-action="undo" style="padding: 6px 10px; background: rgba(255,255,255,0.05); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px;">↩ Desfazer</button>
        <button data-action="redo" style="padding: 6px 10px; background: rgba(255,255,255,0.05); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px;">↪ Refazer</button>
        <button data-action="clear" style="padding: 6px 10px; background: rgba(255,255,255,0.05); color: #f87171; border: none; border-radius: 6px; cursor: pointer; font-size: 13px;">🗑 Limpar</button>
      </div>
      <div style="display: flex; gap: 8px;">
        <button data-action="apply" style="padding: 8px 16px; background: linear-gradient(135deg, #06b6d4, #3b82f6); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500;">✓ Aplicar</button>
        <button data-action="cancel" style="padding: 8px 16px; background: rgba(255,255,255,0.1); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">Cancelar</button>
      </div>
    `;
    toolbar.innerHTML = toolsHtml;

    // Canvas area
    const canvasArea = document.createElement('div');
    canvasArea.style.cssText = `
      flex: 1; overflow: auto; display: flex; align-items: center; justify-content: center; padding: 20px; position: relative;
    `;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'max-width: 100%; max-height: 100%; box-shadow: 0 8px 32px rgba(0,0,0,0.6); border-radius: 8px; cursor: crosshair;';
    canvasArea.appendChild(canvas);

    // Text input overlay
    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.placeholder = 'Digite e Enter';
    textInput.style.cssText = `
      position: absolute; display: none; padding: 6px 10px; font-size: 16px; color: white;
      background: rgba(15,23,42,0.98); border: 1px solid #06b6d4; border-radius: 6px; outline: none; min-width: 140px;
    `;
    canvasArea.appendChild(textInput);

    overlay.appendChild(toolbar);
    overlay.appendChild(canvasArea);
    this.container.appendChild(overlay);

    // Engine
    const engine = new CanvasAnnotationEngine(canvas);
    engine.loadImage(screenshotUrl).then(() => {
      if (sensitiveRects.length) engine.setSensitiveRects(sensitiveRects);
    });

    engine.setTextInputCallback((x, y, callback) => {
      const canvasRect = canvas.getBoundingClientRect();
      const areaRect = canvasArea.getBoundingClientRect();
      const scaleX = canvasRect.width / canvas.width;
      const scaleY = canvasRect.height / canvas.height;
      textInput.style.left = `${canvasRect.left - areaRect.left + x * scaleX}px`;
      textInput.style.top = `${canvasRect.top - areaRect.top + y * scaleY}px`;
      textInput.style.display = 'block';
      textInput.value = '';
      textInput.focus();

      const submit = () => {
        callback(textInput.value);
        textInput.style.display = 'none';
        textInput.removeEventListener('keydown', onKey);
        textInput.removeEventListener('blur', submit);
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Enter') submit();
        if (e.key === 'Escape') {
          textInput.style.display = 'none';
          textInput.removeEventListener('keydown', onKey);
          textInput.removeEventListener('blur', submit);
        }
      };
      textInput.addEventListener('blur', submit);
      textInput.addEventListener('keydown', onKey);
    });

    // Toolbar actions
    const updateToolButtons = (activeTool: string) => {
      toolbar.querySelectorAll('[data-tool]').forEach((btn) => {
        const b = btn as HTMLElement;
        b.style.background = b.dataset.tool === activeTool ? '#06b6d4' : 'rgba(255,255,255,0.1)';
      });
    };

    const updateColorButtons = (activeColor: string) => {
      toolbar.querySelectorAll('[data-color]').forEach((btn) => {
        const b = btn as HTMLElement;
        b.style.borderColor = b.dataset.color === activeColor ? 'white' : 'transparent';
      });
    };

    toolbar.querySelectorAll('[data-tool]').forEach((btn) => {
      btn.addEventListener('click', () => {
        engine.setTool((btn as HTMLElement).dataset.tool as any);
        updateToolButtons((btn as HTMLElement).dataset.tool as string);
      });
    });

    toolbar.querySelectorAll('[data-color]').forEach((btn) => {
      btn.addEventListener('click', () => {
        engine.setColor((btn as HTMLElement).dataset.color as string);
        updateColorButtons((btn as HTMLElement).dataset.color as string);
      });
    });

    toolbar.querySelector('[data-action="undo"]')?.addEventListener('click', () => engine.undo());
    toolbar.querySelector('[data-action="redo"]')?.addEventListener('click', () => engine.redo());
    toolbar.querySelector('[data-action="clear"]')?.addEventListener('click', () => { if (confirm('Limpar todas as anotações?')) engine.clear(); });

    toolbar.querySelector('[data-action="apply"]')?.addEventListener('click', () => {
      onApply(engine.export());
      engine.destroy();
      overlay.remove();
    });

    toolbar.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
      engine.destroy();
      overlay.remove();
    });
  }

  // ============================================================================
  // PRIVATE METHODS - Reports List
  // ============================================================================

  renderReportsList(): void {
    if (!this.container) return;

    const existing = this.container.querySelector('[data-bugdetector-reports-list]');
    if (existing) {
      existing.remove();
      return;
    }

    const panel = document.createElement('div');
    panel.setAttribute('data-bugdetector-reports-list', '');
    panel.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 360px;
      max-height: 80vh;
      background: rgba(15, 23, 42, 0.98);
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      pointer-events: auto;
      z-index: ${this.zIndexBase};
      border: 1px solid rgba(255,255,255,0.1);
      color: white;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    `;

    panel.innerHTML = `
      <div style="padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: space-between;">
        <span style="font-weight: 600;">Reports Salvos</span>
        <button data-bugdetector-close-reports style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 18px; padding: 4px;">×</button>
      </div>
      <div data-bugdetector-reports-content style="padding: 12px; overflow-y: auto; flex: 1;">
        <p style="color: #64748b; font-size: 13px; text-align: center;">Carregando...</p>
      </div>
    `;

    panel.querySelector('[data-bugdetector-close-reports]')?.addEventListener('click', () => panel.remove());
    this.container.appendChild(panel);

    // Busca reports do storage via callback
    this.callbacks.onCreateReport({ description: '__list_reports__' }).catch(() => {
      // Hack: não temos API direta para listar no vanilla, então usamos o storage global se existir
    });

    // Como o vanilla não tem acesso direto à lista, vamos injetar uma mensagem informativa
    const content = panel.querySelector('[data-bugdetector-reports-content]') as HTMLElement;
    if (content) {
      content.innerHTML = `
        <p style="color: #64748b; font-size: 13px; text-align: center; padding: 24px 0;">
          A lista completa de reports está disponível via adapter React/Vue.<br><br>
          No vanilla, os reports são salvos no localStorage/indexedDB configurado.
        </p>
      `;
    }
  }

  // ============================================================================
  // PRIVATE METHODS - Toast
  // ============================================================================

  private showSuccessToast(message: string): void {
    if (!this.container) return;

    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 100px;
      right: 20px;
      padding: 16px 24px;
      background: #10b981;
      color: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: ${this.zIndexBase};
      animation: slideIn 0.3s ease;
    `;
    toast.textContent = message;

    this.container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

export default UIManager;
