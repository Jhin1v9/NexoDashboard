/**
 * ScreenshotAnnotationCanvas
 * Componente React para anotações em screenshots
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { CanvasAnnotationEngine, type AnnotationTool } from './CanvasAnnotationEngine';

interface ScreenshotAnnotationCanvasProps {
  screenshotDataUrl: string;
  onApply: (annotatedDataUrl: string) => void;
  onCancel: () => void;
  sensitiveRects?: Array<{ x: number; y: number; width: number; height: number }>;
}

const tools: { id: AnnotationTool; label: string; icon: string }[] = [
  { id: 'rectangle', label: 'Retângulo', icon: '▭' },
  { id: 'arrow', label: 'Seta', icon: '→' },
  { id: 'blur', label: 'Blur', icon: '◧' },
  { id: 'text', label: 'Texto', icon: 'T' },
];

const colors = [
  '#ef4444', // red
  '#eab308', // yellow
  '#22c55e', // green
  '#3b82f6', // blue
  '#a855f7', // purple
  '#ffffff', // white
];

export const ScreenshotAnnotationCanvas: React.FC<ScreenshotAnnotationCanvasProps> = ({
  screenshotDataUrl,
  onApply,
  onCancel,
  sensitiveRects = [],
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CanvasAnnotationEngine | null>(null);
  const [activeTool, setActiveTool] = useState<AnnotationTool>('rectangle');
  const [activeColor, setActiveColor] = useState<string>(colors[0]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [textInput, setTextInput] = useState<{ x: number; y: number; visible: boolean } | null>(null);
  const [textValue, setTextValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Inicializa engine
  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new CanvasAnnotationEngine(canvasRef.current);
    engineRef.current = engine;

    engine.setTextInputCallback((x, y, callback) => {
      // Converter coordenadas do canvas para coordenadas do container
      if (!canvasRef.current || !containerRef.current) return;
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      const scaleX = containerRect.width / canvasRef.current.width;
      const scaleY = containerRect.height / canvasRef.current.height;

      setTextInput({
        x: (x * scaleX),
        y: (y * scaleY),
        visible: true,
      });
      setTextValue('');

      // Guardar callback para ser chamada no submit
      (engine as typeof engine & { _pendingTextCallback?: (text: string) => void })._pendingTextCallback = callback;
    });

    engine.loadImage(screenshotDataUrl).then(() => {
      if (sensitiveRects.length > 0) {
        engine.setSensitiveRects(sensitiveRects);
      }
    });

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [screenshotDataUrl, sensitiveRects]);

  // Atualiza tool/color no engine
  useEffect(() => {
    engineRef.current?.setTool(activeTool);
    engineRef.current?.setColor(activeColor);
  }, [activeTool, activeColor]);

  // Poll para atualizar estado undo/redo (engine não é reativo)
  useEffect(() => {
    const interval = setInterval(() => {
      setCanUndo(engineRef.current?.canUndo() ?? false);
      setCanRedo(engineRef.current?.canRedo() ?? false);
    }, 200);
    return () => clearInterval(interval);
  }, []);

  const handleUndo = useCallback(() => {
    engineRef.current?.undo();
  }, []);

  const handleRedo = useCallback(() => {
    engineRef.current?.redo();
  }, []);

  const handleClear = useCallback(() => {
    if (confirm('Limpar todas as anotações?')) {
      engineRef.current?.clear();
    }
  }, []);

  const handleApply = useCallback(() => {
    const dataUrl = engineRef.current?.export();
    if (dataUrl) {
      onApply(dataUrl);
    }
  }, [onApply]);

  const handleTextSubmit = useCallback(() => {
    const callback = (engineRef.current as unknown as { _pendingTextCallback?: (text: string) => void })?._pendingTextCallback;
    if (callback) {
      callback(textValue);
      (engineRef.current as unknown as { _pendingTextCallback?: undefined })._pendingTextCallback = undefined;
    }
    setTextInput(null);
    setTextValue('');
  }, [textValue]);

  const handleTextCancel = useCallback(() => {
    (engineRef.current as unknown as { _pendingTextCallback?: undefined })._pendingTextCallback = undefined;
    setTextInput(null);
    setTextValue('');
  }, []);

  return (
    <div className="fixed inset-0 z-[11000] flex flex-col bg-slate-950" data-bug-detector-ui>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900">
        <div className="flex items-center gap-4">
          {/* Tools */}
          <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
            {tools.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTool(t.id)}
                title={t.label}
                className={`w-9 h-9 flex items-center justify-center rounded-md text-sm font-bold transition-colors ${
                  activeTool === t.id
                    ? 'bg-cyan-500 text-white'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {t.icon}
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-slate-700" />

          {/* Colors */}
          <div className="flex items-center gap-1">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => setActiveColor(c)}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${
                  activeColor === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Cor ${c}`}
              />
            ))}
          </div>

          <div className="w-px h-6 bg-slate-700" />

          {/* Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              title="Desfazer"
              className="px-3 py-1.5 text-sm rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ↩ Desfazer
            </button>
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              title="Refazer"
              className="px-3 py-1.5 text-sm rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ↪ Refazer
            </button>
            <button
              onClick={handleClear}
              title="Limpar"
              className="px-3 py-1.5 text-sm rounded-md bg-slate-800 text-red-400 hover:bg-slate-700"
            >
              🗑 Limpar
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleApply}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-medium rounded-lg hover:from-cyan-400 hover:to-blue-400"
          >
            ✓ Aplicar Anotações
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-300 hover:text-white"
          >
            Cancelar
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div ref={containerRef} className="flex-1 overflow-auto flex items-center justify-center p-6 bg-slate-950 relative">
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full shadow-2xl rounded-lg cursor-crosshair"
          style={{ imageRendering: 'auto' }}
        />

        {textInput?.visible && (
          <div
            className="absolute"
            style={{ left: textInput.x, top: textInput.y }}
          >
            <input
              autoFocus
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTextSubmit();
                if (e.key === 'Escape') handleTextCancel();
              }}
              onBlur={handleTextSubmit}
              placeholder="Digite e Enter"
              className="px-2 py-1 text-white bg-slate-900 border border-cyan-500 rounded shadow-lg outline-none min-w-[120px]"
              style={{ fontSize: '16px' }}
            />
          </div>
        )}
      </div>

      {/* Hint */}
      <div className="px-4 py-2 text-xs text-slate-500 bg-slate-900 border-t border-slate-800 text-center">
        Dica: arraste para desenhar retângulos, setas e blur. Clique uma vez para adicionar texto.
      </div>
    </div>
  );
};

export default ScreenshotAnnotationCanvas;
