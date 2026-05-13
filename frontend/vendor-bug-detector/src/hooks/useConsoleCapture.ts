/**
 * Hook useConsoleCapture
 * Captura logs do console em componentes React
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ConsoleCapture } from '../devtools';
import type { ConsoleLog } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReactModule = any;

interface UseConsoleCaptureOptions {
  maxLogs?: number;
  captureErrors?: boolean;
  captureWarnings?: boolean;
  captureInfo?: boolean;
  captureDebug?: boolean;
  autoStart?: boolean;
}

interface UseConsoleCaptureReturn {
  logs: ConsoleLog[];
  errors: ConsoleLog[];
  warnings: ConsoleLog[];
  isCapturing: boolean;
  start: () => void;
  stop: () => void;
  clear: () => void;
  refresh: () => void;
}

export function useConsoleCapture(options: UseConsoleCaptureOptions = {}): UseConsoleCaptureReturn {
  const {
    maxLogs = 50,
    captureErrors = true,
    captureWarnings = true,
    captureInfo = true,
    captureDebug = false,
    autoStart = true,
  } = options;

  const captureRef = useRef<ConsoleCapture | null>(null);
  const [logs, setLogs] = useState<ConsoleLog[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);

  // Inicializa o capturador
  useEffect(() => {
    captureRef.current = new ConsoleCapture({
      maxLogs,
      captureErrors,
      captureWarnings,
      captureInfo,
      captureDebug,
    });

    if (autoStart) {
      captureRef.current.start();
      setIsCapturing(true);
    }

    return () => {
      captureRef.current?.stop();
    };
  }, [maxLogs, captureErrors, captureWarnings, captureInfo, captureDebug, autoStart]);

  // Atualiza logs periodicamente
  useEffect(() => {
    if (!isCapturing) return;

    const interval = setInterval(() => {
      if (captureRef.current) {
        setLogs(captureRef.current.getLogs());
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isCapturing]);

  const start = useCallback(() => {
    captureRef.current?.start();
    setIsCapturing(true);
    setLogs(captureRef.current?.getLogs() ?? []);
  }, []);

  const stop = useCallback(() => {
    captureRef.current?.stop();
    setIsCapturing(false);
  }, []);

  const clear = useCallback(() => {
    captureRef.current?.clear();
    setLogs([]);
  }, []);

  const refresh = useCallback(() => {
    setLogs(captureRef.current?.getLogs() ?? []);
  }, []);

  const errors = logs.filter((log: ConsoleLog) => log.type === 'error');
  const warnings = logs.filter((log: ConsoleLog) => log.type === 'warn');

  return {
    logs,
    errors,
    warnings,
    isCapturing,
    start,
    stop,
    clear,
    refresh,
  };
}

export default useConsoleCapture;
