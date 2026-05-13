/**
 * Hook useNetworkMonitor
 * Monitora requisições de rede em componentes React
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { NetworkMonitor } from '../devtools';
import type { NetworkRequest } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReactModule = any;

interface UseNetworkMonitorOptions {
  maxRequests?: number;
  captureSuccessful?: boolean;
  captureFailed?: boolean;
  autoStart?: boolean;
}

interface UseNetworkMonitorReturn {
  requests: NetworkRequest[];
  failedRequests: NetworkRequest[];
  isMonitoring: boolean;
  start: () => void;
  stop: () => void;
  clear: () => void;
  refresh: () => void;
}

export function useNetworkMonitor(options: UseNetworkMonitorOptions = {}): UseNetworkMonitorReturn {
  const {
    maxRequests = 50,
    captureSuccessful = true,
    captureFailed = true,
    autoStart = true,
  } = options;

  const monitorRef = useRef<NetworkMonitor | null>(null);
  const [requests, setRequests] = useState<NetworkRequest[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);

  // Inicializa o monitor
  useEffect(() => {
    monitorRef.current = new NetworkMonitor({
      maxRequests,
      captureSuccessful,
      captureFailed,
    });

    if (autoStart) {
      monitorRef.current.start();
      setIsMonitoring(true);
    }

    return () => {
      monitorRef.current?.stop();
    };
  }, [maxRequests, captureSuccessful, captureFailed, autoStart]);

  // Atualiza requisições periodicamente
  useEffect(() => {
    if (!isMonitoring) return;

    const interval = setInterval(() => {
      if (monitorRef.current) {
        setRequests(monitorRef.current.getRequests());
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isMonitoring]);

  const start = useCallback(() => {
    monitorRef.current?.start();
    setIsMonitoring(true);
    setRequests(monitorRef.current?.getRequests() ?? []);
  }, []);

  const stop = useCallback(() => {
    monitorRef.current?.stop();
    setIsMonitoring(false);
  }, []);

  const clear = useCallback(() => {
    monitorRef.current?.clear();
    setRequests([]);
  }, []);

  const refresh = useCallback(() => {
    setRequests(monitorRef.current?.getRequests() ?? []);
  }, []);

  const failedRequests = requests.filter((req: NetworkRequest) => req.status >= 400 || req.status === 0);

  return {
    requests,
    failedRequests,
    isMonitoring,
    start,
    stop,
    clear,
    refresh,
  };
}

export default useNetworkMonitor;
