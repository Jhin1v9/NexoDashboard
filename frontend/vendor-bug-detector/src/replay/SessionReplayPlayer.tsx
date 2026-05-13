/**
 * SessionReplayPlayer
 * Componente React para reproduzir session replays.
 * Renderiza um cursor, clicks, scroll e informações de eventos.
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import type { SessionReplayData, ReplayEvent } from './SessionReplayEngine';

interface SessionReplayPlayerProps {
  data: SessionReplayData;
  width?: number;
  height?: number;
}

export const SessionReplayPlayer: React.FC<SessionReplayPlayerProps> = ({
  data,
  width = 320,
  height = 200,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [cursor, setCursor] = useState({ x: 0, y: 0, visible: false });
  const [clickPulse, setClickPulse] = useState<{ x: number; y: number; id: number } | null>(null);
  const [currentEvent, setCurrentEvent] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const duration = useMemo(() => data.endTime - data.startTime, [data]);
  const scaleX = width / data.viewport.width;
  const scaleY = height / data.viewport.height;

  const play = () => {
    if (isPlaying) return;
    setIsPlaying(true);
    startTimeRef.current = performance.now() - progress;
    tick();
  };

  const pause = () => {
    setIsPlaying(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };

  const reset = () => {
    pause();
    setProgress(0);
    setCursor({ x: 0, y: 0, visible: false });
    setClickPulse(null);
    setCurrentEvent('');
  };

  const seek = (ms: number) => {
    const clamped = Math.max(0, Math.min(ms, duration));
    setProgress(clamped);
    if (isPlaying) {
      startTimeRef.current = performance.now() - clamped;
    }
    applyStateAt(clamped);
  };

  const tick = () => {
    const now = performance.now();
    const elapsed = now - startTimeRef.current;
    if (elapsed >= duration) {
      setProgress(duration);
      setIsPlaying(false);
      applyStateAt(duration);
      return;
    }
    setProgress(elapsed);
    applyStateAt(elapsed);
    rafRef.current = requestAnimationFrame(tick);
  };

  const applyStateAt = (elapsed: number) => {
    const currentTimestamp = data.startTime + elapsed;
    // Encontra o último evento até o timestamp atual
    const index = findLastEventIndex(currentTimestamp);

    // Atualiza cursor com último mousemove
    const lastMove = findLastEventOfType(index, 'mousemove');
    if (lastMove) {
      setCursor({
        x: (lastMove.data.x as number) * scaleX,
        y: (lastMove.data.y as number) * scaleY,
        visible: true,
      });
    }

    // Detecta click exatamente no frame
    const clickEvent = data.events[index];
    if (clickEvent && clickEvent.timestamp >= currentTimestamp - 50 && clickEvent.type === 'click') {
      triggerClick((clickEvent.data.x as number) * scaleX, (clickEvent.data.y as number) * scaleY);
      setCurrentEvent(`Click em ${clickEvent.data.target || 'elemento'}`);
    }

    // Mostra eventos recentes
    const recent = data.events[index];
    if (recent && recent.timestamp >= currentTimestamp - 200) {
      if (recent.type === 'scroll') {
        setCurrentEvent(`Scroll para (${recent.data.x}, ${recent.data.y})`);
      } else if (recent.type === 'input') {
        setCurrentEvent(`Input em ${recent.data.selector || recent.data.tag}: ${recent.data.value}`);
      } else if (recent.type === 'navigation') {
        setCurrentEvent(`Navegação: ${recent.data.url}`);
      } else if (recent.type === 'resize') {
        setCurrentEvent(`Resize: ${recent.data.width}×${recent.data.height}`);
      }
    }
  };

  const findLastEventIndex = (timestamp: number): number => {
    let i = data.events.length - 1;
    while (i >= 0 && data.events[i].timestamp > timestamp) i--;
    return i;
  };

  const findLastEventOfType = (maxIndex: number, type: ReplayEvent['type']): ReplayEvent | null => {
    for (let i = maxIndex; i >= 0; i--) {
      if (data.events[i].type === type) return data.events[i];
    }
    return null;
  };

  const triggerClick = (x: number, y: number) => {
    const id = Date.now();
    setClickPulse({ x, y, id });
    setTimeout(() => {
      setClickPulse((prev) => (prev && prev.id === id ? null : prev));
    }, 400);
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const seconds = totalSeconds % 60;
    const millis = Math.floor((ms % 1000) / 10);
    return `${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="relative bg-slate-950 border border-slate-700 rounded-lg overflow-hidden"
        style={{ width, height }}
      >
        {/* Background pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />

        {/* Cursor */}
        {cursor.visible && (
          <div
            className="absolute w-4 h-4 pointer-events-none transition-all"
            style={{
              left: cursor.x,
              top: cursor.y,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4 drop-shadow">
              <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
            </svg>
          </div>
        )}

        {/* Click pulse */}
        {clickPulse && (
          <div
            className="absolute rounded-full border-2 border-red-400 animate-ping pointer-events-none"
            style={{
              left: clickPulse.x,
              top: clickPulse.y,
              width: 24,
              height: 24,
              transform: 'translate(-50%, -50%)',
            }}
          />
        )}

        {/* Info overlay */}
        <div className="absolute bottom-2 left-2 right-2 px-2 py-1 bg-black/60 text-white text-[10px] rounded truncate">
          {currentEvent || 'Session replay'}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={isPlaying ? pause : play}
          className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded"
        >
          {isPlaying ? '⏸ Pausar' : '▶ Reproduzir'}
        </button>
        <button
          onClick={reset}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium rounded"
        >
          ↺ Reiniciar
        </button>
        <span className="text-xs text-slate-400">
          {formatTime(progress)} / {formatTime(duration)}
        </span>
      </div>

      {/* Seek bar */}
      <input
        type="range"
        min={0}
        max={duration}
        value={progress}
        onChange={(e) => seek(Number(e.target.value))}
        className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
      />

      {/* Stats */}
      <div className="flex gap-4 text-[10px] text-slate-500">
        <span>{data.events.length} eventos</span>
        <span>Viewport: {data.viewport.width}×{data.viewport.height}</span>
      </div>
    </div>
  );
};

export default SessionReplayPlayer;
