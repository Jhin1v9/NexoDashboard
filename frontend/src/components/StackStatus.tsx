// ============================================================
// StackStatus.tsx - Componente para Dashboard NEXO
// Adicionar em: frontend/src/components/StackStatus.tsx
// ============================================================

import React, { useState, useEffect } from 'react';

interface ServiceStatus {
  status: 'online' | 'offline' | 'stale' | 'error' | 'checking';
  port?: number;
  uptime?: number;
  last_checkpoint?: string | null;
}

interface StackStatus {
  timestamp: string;
  overall: 'healthy' | 'degraded' | 'checking';
  services: {
    backend: ServiceStatus;
    frontend: ServiceStatus;
    chrome_cdp: ServiceStatus;
    luna_daemon: ServiceStatus;
  };
}

const StackStatusPanel: React.FC = () => {
  const [status, setStatus] = useState<StackStatus | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/stack-status');
      if (!res.ok) throw new Error('Backend offline');
      const data = await res.json();
      setStatus(data);
      setError(null);
    } catch (e) {
      setError('Não foi possível conectar ao backend');
      setStatus(null);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/stack-logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.error('Erro ao buscar logs:', e);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchLogs();
    setLoading(false);

    // Atualiza a cada 10 segundos
    const interval = setInterval(() => {
      fetchStatus();
      fetchLogs();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'offline': return 'bg-red-500';
      case 'stale': return 'bg-yellow-500';
      case 'error': return 'bg-red-600';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online': return '✅ Online';
      case 'offline': return '❌ Offline';
      case 'stale': return '⚠️ Stale';
      case 'error': return '💥 Erro';
      default: return '⏳ Verificando...';
    }
  };

  if (loading) {
    return (
      <div className="p-4 bg-gray-800 rounded-lg">
        <div className="animate-pulse text-white">Carregando status...</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">🚀 NEXO Stack Status</h2>
        <div className={`px-3 py-1 rounded-full text-sm font-bold ${
          status?.overall === 'healthy' ? 'bg-green-500 text-black' : 
          status?.overall === 'degraded' ? 'bg-yellow-500 text-black' : 
          'bg-gray-500 text-white'
        }`}>
          {status?.overall === 'healthy' ? '🟢 TUDO OK' : 
           status?.overall === 'degraded' ? '🟡 DEGRADADO' : 
           '⚪ VERIFICANDO'}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-300">
          {error}
        </div>
      )}

      {/* Services Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {status && Object.entries(status.services).map(([name, service]) => (
          <div key={name} className="bg-gray-800 rounded p-3 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-300 font-medium capitalize">
                {name === 'chrome_cdp' ? '🔌 Chrome CDP' :
                 name === 'luna_daemon' ? '🤖 Luna Agent' :
                 name === 'backend' ? '⚙️ Backend' :
                 name === 'frontend' ? '🌐 Frontend' : name}
              </span>
              <div className={`w-3 h-3 rounded-full ${getStatusColor(service.status)}`} />
            </div>
            <div className="text-sm">
              <span className={service.status === 'online' ? 'text-green-400' : 'text-red-400'}>
                {getStatusText(service.status)}
              </span>
              {service.port && (
                <span className="text-gray-500 ml-2">:{service.port}</span>
              )}
              {service.uptime && (
                <div className="text-gray-500 text-xs mt-1">
                  Uptime: {Math.floor(service.uptime / 60)}m {Math.floor(service.uptime % 60)}s
                </div>
              )}
              {service.last_checkpoint && (
                <div className="text-gray-500 text-xs mt-1">
                  Último scan: {new Date(service.last_checkpoint).toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Logs */}
      <div className="bg-gray-800 rounded p-3 border border-gray-700">
        <h3 className="text-sm font-bold text-gray-300 mb-2">📄 Logs do Stack</h3>
        <div className="bg-black rounded p-2 h-32 overflow-y-auto font-mono text-xs">
          {logs.length === 0 ? (
            <span className="text-gray-600">Nenhum log disponível...</span>
          ) : (
            logs.map((log, i) => (
              <div key={i} className={`${
                log.includes('CRASHOU') || log.includes('ERRO') ? 'text-red-400' :
                log.includes('sucesso') || log.includes('OK') ? 'text-green-400' :
                'text-gray-400'
              }`}>
                {log}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 text-xs text-gray-500 text-right">
        Atualizado: {status ? new Date(status.timestamp).toLocaleTimeString() : '---'}
      </div>
    </div>
  );
};

export default StackStatusPanel;

