/**
 * Motor de inspeção de elementos DOM
 */

import type { InspectedElement, ParentInfo } from '../types';
// UUID nativo - sem dependência externa

/** Classe Inspector */
export class Inspector {
  private _highlightedElement: HTMLElement | null = null;
  private highlightOverlay: HTMLElement | null = null;
  private isActive = false;
  private onElementSelect: ((element: InspectedElement) => void) | null = null;
  private onElementHover: ((element: InspectedElement | null) => void) | null = null;
  private idCounter = 0;
  private elementIdMap = new WeakMap<Element, string>();

  /** Ativa o modo de inspeção */
  activate(
    onSelect: (element: InspectedElement) => void,
    onHover?: (element: InspectedElement | null) => void
  ): void {
    if (this.isActive) return;

    this.isActive = true;
    this.onElementSelect = onSelect;
    this.onElementHover = onHover || null;

    // Adiciona event listeners
    document.addEventListener('mouseover', this.handleMouseOver, true);
    document.addEventListener('mouseout', this.handleMouseOut, true);
    document.addEventListener('click', this.handleClick, true);
    document.addEventListener('keydown', this.handleKeyDown, true);

    // Previne interação normal
    this.preventPageInteraction();
  }

  /** Desativa o modo de inspeção */
  deactivate(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.onElementSelect = null;
    this.onElementHover = null;

    // Remove event listeners
    document.removeEventListener('mouseover', this.handleMouseOver, true);
    document.removeEventListener('mouseout', this.handleMouseOut, true);
    document.removeEventListener('click', this.handleClick, true);
    document.removeEventListener('keydown', this.handleKeyDown, true);

    // Remove highlight
    this.removeHighlight();

    // Restaura interação da página
    this.restorePageInteraction();
  }

  /** Inspeciona elemento específico */
  inspectElement(element: Element): InspectedElement {
    return this.createInspectedElement(element);
  }

  /** Obtém ou cria um ID único estável para o elemento */
  private getElementId(element: Element): string {
    let id = this.elementIdMap.get(element);
    if (!id) {
      id = `bd-${++this.idCounter}`;
      this.elementIdMap.set(element, id);
      try {
        element.setAttribute('data-bd-id', id);
      } catch {
        // ignore em ambientes restritos
      }
    }
    return id;
  }

  /** Gera seletor CSS único */
  generateSelector(element: Element): string {
    const bdId = this.elementIdMap.get(element) || element.getAttribute('data-bd-id');
    if (bdId) {
      return `[data-bd-id="${bdId}"]`;
    }

    const path: string[] = [];
    let current: Element | null = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();

      // Adiciona ID se existir
      if (current.id) {
        selector += `#${CSS.escape(current.id)}`;
        path.unshift(selector);
        break;
      }

      // Adiciona classes significativas (escapadas)
      const classes = Array.from(current.classList)
        .filter(c => !c.startsWith('_') && !c.includes('scoped'))
        .slice(0, 2);
      
      if (classes.length > 0) {
        const escapedClasses = classes.map(c => CSS.escape(c)).join('.');
        selector += `.${escapedClasses}`;
      }

      // Adiciona nth-child se necessário
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          child => child.tagName === current!.tagName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(' > ');
  }

  /** Gera XPath */
  generateXPath(element: Element): string {
    const path: string[] = [];
    let current: Element | null = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          child => child.tagName === current!.tagName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `[${index}]`;
        }
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return '//' + path.join('/');
  }

  /** Obtém estilos computados */
  getComputedStyles(element: Element): Record<string, string> {
    const styles = window.getComputedStyle(element);
    const result: Record<string, string> = {};

    // Propriedades relevantes
    const properties = [
      'display', 'position', 'width', 'height',
      'margin', 'padding', 'border',
      'color', 'background-color', 'font-size',
      'z-index', 'opacity', 'visibility',
      'pointer-events', 'cursor',
    ];

    properties.forEach(prop => {
      result[prop] = styles.getPropertyValue(prop);
    });

    return result;
  }

  /** Obtém cadeia de pais */
  getParentChain(element: Element, maxDepth = 5): ParentInfo[] {
    const chain: ParentInfo[] = [];
    let current: Element | null = element.parentElement;
    let depth = 0;

    while (current && depth < maxDepth) {
      chain.push({
        tag: current.tagName.toLowerCase(),
        id: current.id || null,
        className: current.className,
        selector: this.generateSelector(current),
      });
      current = current.parentElement;
      depth++;
    }

    return chain;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private handleMouseOver = (e: MouseEvent): void => {
    if (!this.isActive) return;
    
    const target = e.target as HTMLElement;
    if (!target || target === this.highlightOverlay || this.isBugDetectorUiTarget(target)) {
      this.removeHighlight();
      this.onElementHover?.(null);
      return;
    }

    this.highlightElement(target);
    
    const inspected = this.createInspectedElement(target);
    this.onElementHover?.(inspected);
  };

  private handleMouseOut = (e: MouseEvent): void => {
    if (!this.isActive) return;
    
    const target = e.target as HTMLElement;
    if (!target || target === this.highlightOverlay || this.isBugDetectorUiTarget(target)) return;

    this.removeHighlight();
    this.onElementHover?.(null);
  };

  private handleClick = (e: MouseEvent): void => {
    if (!this.isActive) return;

    const target = e.target as HTMLElement;
    // Permite interação normal dentro da UI do bug-detector (modal, botões, etc.)
    if (!target || target === this.highlightOverlay || this.isBugDetectorUiTarget(target)) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const inspected = this.createInspectedElement(target);
    this.onElementSelect?.(inspected);
  };

  private isBugDetectorUiTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    const selectors = [
      '[data-bug-detector-ui]',
      '#bug-detector-ui',
      '[data-bugdetector-floating-button]',
      '[data-bugdetector-panel]',
      '[data-bugdetector-report-modal]',
      '[data-bugdetector-reports-list]',
      '[data-bugdetector-tooltip]',
      '[data-bugdetector-annotate-overlay]',
    ];
    return !!target.closest(selectors.join(', '));
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (!this.isActive) return;
    
    // ESC desativa
    if (e.key === 'Escape') {
      this.deactivate();
    }
  };

  private highlightElement(element: HTMLElement): void {
    this.removeHighlight();

    const rect = element.getBoundingClientRect();
    
    this.highlightOverlay = document.createElement('div');
    this.highlightOverlay.style.cssText = `
      position: fixed;
      top: ${rect.top}px;
      left: ${rect.left}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      background: rgba(59, 130, 246, 0.1);
      border: 2px solid #3b82f6;
      border-radius: 4px;
      pointer-events: none;
      z-index: 2147483646;
      transition: all 0.1s ease;
      box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2);
    `;

    document.body.appendChild(this.highlightOverlay);
    this._highlightedElement = element;
  }

  private removeHighlight(): void {
    if (this.highlightOverlay) {
      this.highlightOverlay.remove();
      this.highlightOverlay = null;
    }
    this._highlightedElement = null;
  }

  private createInspectedElement(element: Element): InspectedElement {
    const rect = element.getBoundingClientRect();
    const bdId = this.getElementId(element);
    
    return {
      id: bdId,
      tag: element.tagName.toLowerCase(),
      elementId: element.id || null,
      className: element.className,
      selector: this.generateSelector(element),
      xpath: this.generateXPath(element),
      rect,
      computedStyles: this.getComputedStyles(element),
      attributes: this.getAttributes(element),
      innerHTML: element.innerHTML.slice(0, 1000), // Limita tamanho
      textContent: element.textContent?.slice(0, 200) || '',
      parentChain: this.getParentChain(element),
      siblingCount: element.parentElement 
        ? Array.from(element.parentElement.children).filter(c => c !== element).length 
        : 0,
      childCount: element.children.length,
      domElement: element,
    };
  }

  private getAttributes(element: Element): Record<string, string> {
    const attrs: Record<string, string> = {};
    
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      // Ignora atributos internos
      if (!attr.name.startsWith('data-react') && !attr.name.startsWith('data-v-')) {
        attrs[attr.name] = attr.value;
      }
    }

    return attrs;
  }

  private preventPageInteraction(): void {
    document.body.style.cursor = 'crosshair';
    document.body.style.userSelect = 'none';
  }

  private restorePageInteraction(): void {
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }
}

export default Inspector;
