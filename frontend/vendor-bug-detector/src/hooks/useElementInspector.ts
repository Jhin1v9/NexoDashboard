/**
 * Hook useElementInspector
 * Inspeção de elementos DOM em componentes React
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { InspectedElement } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReactModule = any;

interface UseElementInspectorOptions {
  onElementSelect?: (element: InspectedElement) => void;
  enabled?: boolean;
}

interface UseElementInspectorReturn {
  hoveredElement: Element | null;
  selectedElement: InspectedElement | null;
  isInspecting: boolean;
  startInspecting: () => void;
  stopInspecting: () => void;
  clearSelection: () => void;
}

export function useElementInspector(options: UseElementInspectorOptions = {}): UseElementInspectorReturn {
  const { onElementSelect, enabled = false } = options;

  const [hoveredElement, setHoveredElement] = useState<Element | null>(null);
  const [selectedElement, setSelectedElement] = useState<InspectedElement | null>(null);
  const [isInspecting, setIsInspecting] = useState(enabled);
  const originalCursorRef = useRef<string>('');

  // Gera seletor CSS único para um elemento
  const generateSelector = useCallback((element: Element): string => {
    const path: string[] = [];
    let current: Element | null = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector += `#${current.id}`;
        path.unshift(selector);
        break;
      }

      if (current.className && typeof current.className === 'string') {
        const classes = current.className.split(' ').filter(c => c && !c.startsWith('bd-'));
        if (classes.length > 0) {
          selector += `.${classes.join('.')}`;
        }
      }

      const siblings = Array.from(current.parentElement?.children || []);
      const sameTagSiblings = siblings.filter(s => s.tagName === current!.tagName);
      if (sameTagSiblings.length > 1) {
        const index = sameTagSiblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(' > ');
  }, []);

  // Gera XPath para um elemento
  const generateXPath = useCallback((element: Element): string => {
    const path: string[] = [];
    let current: Element | null = element;

    while (current && current !== document.body) {
      let xpath = current.tagName.toLowerCase();

      if (current.id) {
        xpath += `[@id='${current.id}']`;
        path.unshift(xpath);
        break;
      }

      const siblings = Array.from(current.parentElement?.children || []);
      const index = siblings.indexOf(current) + 1;
      xpath += `[${index}]`;

      path.unshift(xpath);
      current = current.parentElement;
    }

    return '//' + path.join('/');
  }, []);

  // Inspeciona um elemento
  const inspectElement = useCallback((element: Element): InspectedElement => {
    const rect = element.getBoundingClientRect();
    const computedStyles = window.getComputedStyle(element);
    const attributes: Record<string, string> = {};

    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      attributes[attr.name] = attr.value;
    }

    // Gera cadeia de pais
    const parentChain: { tag: string; id: string | null; className: string; selector: string }[] = [];
    let parent: Element | null = element.parentElement;
    while (parent && parent !== document.body) {
      parentChain.push({
        tag: parent.tagName.toLowerCase(),
        id: parent.id || null,
        className: typeof parent.className === 'string' ? parent.className : '',
        selector: generateSelector(parent),
      });
      parent = parent.parentElement;
    }

    return {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tag: element.tagName.toLowerCase(),
      elementId: element.id || null,
      className: typeof element.className === 'string' ? element.className : '',
      selector: generateSelector(element),
      xpath: generateXPath(element),
      rect,
      computedStyles: {
        display: computedStyles.display,
        position: computedStyles.position,
        width: computedStyles.width,
        height: computedStyles.height,
        color: computedStyles.color,
        backgroundColor: computedStyles.backgroundColor,
      },
      attributes,
      innerHTML: element.innerHTML.slice(0, 1000),
      textContent: (element.textContent || '').slice(0, 500),
      parentChain,
      siblingCount: element.parentElement ? element.parentElement.children.length - 1 : 0,
      childCount: element.children.length,
      domElement: element,
    };
  }, [generateSelector, generateXPath]);

  // Event handlers
  useEffect(() => {
    if (!isInspecting) return;

    originalCursorRef.current = document.body.style.cursor;
    document.body.style.cursor = 'crosshair';

    const handleMouseOver = (e: MouseEvent) => {
      e.stopPropagation();
      setHoveredElement(e.target as Element);
    };

    const handleMouseOut = (e: MouseEvent) => {
      e.stopPropagation();
      setHoveredElement(null);
    };

    const handleClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const element = e.target as Element;
      const inspected = inspectElement(element);
      setSelectedElement(inspected);
      onElementSelect?.(inspected);
      setIsInspecting(false);
      document.body.style.cursor = originalCursorRef.current;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsInspecting(false);
        document.body.style.cursor = originalCursorRef.current;
      }
    };

    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mouseover', handleMouseOver, true);
      document.removeEventListener('mouseout', handleMouseOut, true);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.cursor = originalCursorRef.current;
    };
  }, [isInspecting, inspectElement, onElementSelect]);

  const startInspecting = useCallback(() => {
    setIsInspecting(true);
    setSelectedElement(null);
  }, []);

  const stopInspecting = useCallback(() => {
    setIsInspecting(false);
    document.body.style.cursor = originalCursorRef.current;
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedElement(null);
    setHoveredElement(null);
  }, []);

  return {
    hoveredElement,
    selectedElement,
    isInspecting,
    startInspecting,
    stopInspecting,
    clearSelection,
  };
}

export default useElementInspector;
