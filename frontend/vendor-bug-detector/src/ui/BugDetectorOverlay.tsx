/**
 * BugDetectorOverlay
 * Overlay de inspeção visual com highlighter e tooltip
 */

import React, { useCallback, useState, useEffect } from 'react';
import type { InspectedElement } from '../types';

interface BugDetectorOverlayProps {
  isActive: boolean;
  selectedElement: InspectedElement | null;
  onDeactivate: () => void;
  reportCount: number;
  onElementClick?: (element: InspectedElement) => void;
  onOpenPanel?: () => void;
}

export const BugDetectorOverlay: React.FC<BugDetectorOverlayProps> = ({
  isActive,
  selectedElement,
  onDeactivate,
  reportCount,
  onElementClick,
  onOpenPanel,
}) => {
  const [hoveredElement, setHoveredElement] = useState<InspectedElement | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    if (!isActive) {
      setHoveredElement(null);
      setShowIntro(true);
      return;
    }
    const t = setTimeout(() => setShowIntro(false), 2500);
    return () => clearTimeout(t);
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target || target.closest('[data-bug-detector-ui]')) return;
      const rect = target.getBoundingClientRect();
      setHoveredElement({
        id: target.getAttribute('data-bd-id') || `temp-${Date.now()}`,
        tag: target.tagName.toLowerCase(),
        elementId: target.id || null,
        className: target.className,
        selector: target.tagName.toLowerCase(),
        xpath: '',
        rect,
        computedStyles: {},
        attributes: {},
        innerHTML: '',
        textContent: target.textContent?.slice(0, 40) || '',
        parentChain: [],
        siblingCount: 0,
        childCount: target.children.length,
        domElement: target,
      });
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseOut = () => setHoveredElement(null);

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target || target.closest('[data-bug-detector-ui]')) return;
      e.preventDefault();
      e.stopPropagation();
      if (hoveredElement && onElementClick) {
        onElementClick(hoveredElement);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDeactivate();
    };

    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown, true);

    document.body.style.cursor = 'crosshair';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mouseover', handleMouseOver, true);
      document.removeEventListener('mouseout', handleMouseOut, true);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isActive, hoveredElement, onDeactivate, onElementClick]);

  if (!isActive) return null;

  return (
    <>
      {/* Overlay de fundo */}
      <div
        className="fixed inset-0 z-[9990] pointer-events-none"
        data-bug-detector-ui
      />

      {/* Highlighter */}
      {hoveredElement && (
        <div
          className="fixed pointer-events-none z-[9998] rounded transition-all duration-100"
          style={{
            left: hoveredElement.rect.x - 2,
            top: hoveredElement.rect.y - 2,
            width: hoveredElement.rect.width + 4,
            height: hoveredElement.rect.height + 4,
            border: '2px solid #06b6d4',
            boxShadow: '0 0 0 4px rgba(6,182,212,0.2), 0 0 20px rgba(6,182,212,0.4)',
          }}
          data-bug-detector-ui
        >
          <div className="absolute -top-5 left-0 px-1.5 py-0.5 bg-cyan-500 text-slate-900 text-[10px] font-bold rounded-t">
            {hoveredElement.tag}
          </div>
        </div>
      )}

      {/* Tooltip */}
      {hoveredElement && (
        <div
          className="fixed z-[9999] pointer-events-none px-3 py-2 bg-slate-900/95 text-white text-xs rounded-lg border border-slate-700 shadow-xl max-w-xs"
          style={{
            left: Math.min(mousePos.x + 16, window.innerWidth - 200),
            top: Math.min(mousePos.y + 16, window.innerHeight - 100),
          }}
          data-bug-detector-ui
        >
          <div className="font-semibold text-cyan-400 mb-1">&lt;{hoveredElement.tag}&gt;</div>
          {hoveredElement.elementId && (
            <div className="text-slate-400">#{hoveredElement.elementId}</div>
          )}
          {hoveredElement.className && (
            <div className="text-slate-500 truncate max-w-[180px]">{hoveredElement.className}</div>
          )}
          <div className="mt-1 text-slate-500">
            {Math.round(hoveredElement.rect.width)}×{Math.round(hoveredElement.rect.height)}px
          </div>
        </div>
      )}

      {/* Botão sair */}
      <div
        className="fixed top-6 right-6 z-[10001] flex flex-col items-end gap-2"
        data-bug-detector-ui
      >
        {reportCount > 0 && (
          <div className="px-3 py-1.5 bg-cyan-500/20 border border-cyan-500/30 rounded-full text-xs text-cyan-300 flex items-center gap-2">
            <span>🐛</span>
            {reportCount} report{reportCount !== 1 ? 's' : ''}
          </div>
        )}
        {onOpenPanel && (
          <button
            onClick={onOpenPanel}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-700/90 hover:bg-slate-600 text-white text-sm font-medium rounded-xl shadow-lg transition-all hover:scale-105 active:scale-95 backdrop-blur-sm"
          >
            <span>📋</span>
            Ver Reports
          </button>
        )}
        <button
          onClick={onDeactivate}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-500/90 hover:bg-red-500 text-white text-sm font-medium rounded-xl shadow-lg transition-all hover:scale-105 active:scale-95 backdrop-blur-sm"
        >
          <span>✕</span>
          Sair do Modo Edição
        </button>
      </div>

      {/* Indicador de modo ativo */}
      <div
        className="fixed top-6 left-6 z-[10001] flex items-center gap-3 px-4 py-2.5 bg-slate-900/90 border border-cyan-500/30 rounded-xl shadow-lg backdrop-blur-sm"
        data-bug-detector-ui
      >
        <div className="relative">
          <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse" />
          <div className="absolute inset-0 w-3 h-3 bg-cyan-400 rounded-full animate-ping opacity-30" />
        </div>
        <div>
          <p className="text-sm font-medium text-white">Modo Edição Ativo</p>
          <p className="text-xs text-slate-400">Passe o mouse e clique para reportar</p>
        </div>
      </div>

      {/* Intro */}
      {showIntro && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center pointer-events-none"
          data-bug-detector-ui
        >
          <div className="bg-slate-900/95 border border-cyan-500/30 rounded-2xl p-8 text-center shadow-2xl backdrop-blur-xl max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-2xl flex items-center justify-center text-2xl">
              👁️
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Modo Edição Ativado</h3>
            <p className="text-slate-400 text-sm mb-4">
              Passe o mouse sobre qualquer elemento para inspecionar.<br />
              Clique para adicionar um report de bug.
            </p>
            <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <span>🖱️</span>
                <span>Clique para reportar</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span>✕</span>
                <span>ESC para cancelar</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
