// ============================================================
// AutoFixPanel.tsx - Painel de Auto-Correção para Dashboard NEXO
// Adicionar em: frontend/src/components/AutoFixPanel.tsx
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';

interface FixEntry {
  id: string;
  timestamp: string;
  service: string;
  action: string;
  success: boolean;
  details: string;
}

interface ServiceStatus {
  status: 'online' | 'offline' | 'stale' | 'error';
  lastCheck: string;
  details: string;
  autoFixed?: boolean;
}

interface AutoFixStatus {
  timestamp: string;
  isRunning: boolean;
  lastCheck: string | null;
  services: Record<string, ServiceStatus>;
  overall: 'healthy' | 'degraded' | 'critical';
  config: {
    checkInterval: number;
    maxRetries: number;
  };
}

interface FixHistory {
  fixes: FixEntry[];
  total: number;
  successCount: number;
  failCount: number;
}

const AutoFixPanel: React.FC = () => {
  const [status, setStatus] = useState<AutoFixStatus | null>(null);
  const [history, setHistory] = useState<FixHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auto-fix/status');
      if (!res.ok) throw new Error('Backend offline');
      const data = await res.json();
      setStatus(data);
      setError(null);
    } catch (e) {
      setError('Não foi possível conectar ao Auto-Fix');
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/auto-fix/history');
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (e) {
      console.error('Erro ao buscar histórico:', e);
    }
  }, []);

  const forceCheck = async () => {
    setIsChecking(true);
    try {
      const res = await fetch('/api/auto-fix/check-now', { method: 'POST' });
      if (res.ok) {
        await fetchStatus();
        await fetchHistory();
      }
    } catch (e) {
      console.error('Erro ao forçar verificação:', e);
    }
    setIsChecking(false);
  };

  const forceFix = async (service: string) => {
    try {
      const res = await fetch(`/api/auto-fix/fix/${service}`, { method: 'POST' });
      if (res.ok) {
        await fetchStatus();
        await fetchHistory();
      }
    } catch (e) {
      console.error(`Erro ao forçar correção de ${service}:`, e);
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      await Promise.all([fetchStatus(), fetchHistory()]);
      setLoading(false);
    };
    loadAll();

    const interval = setInterval(() => {
      fetchStatus();
      fetchHistory();
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchStatus, fetchHistory]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'offline': return 'bg-red-500';
      case 'stale': return 'bg-yellow-500';
      case 'error': return 'bg-red-600';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return '✅';
      case 'offline': return '❌';
      case 'stale': return '⚠️';
      case 'error': return '💥';
      default: return '⏳';
    }
  };

  const getOverallColor = (overall: string) => {
    switch (overall) {
      case 'healthy': return 'bg-green-500 text-black';
      case 'degraded': return 'bg-yellow-500 text-black';
      case 'critical': return 'bg-red-600 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  if (loading) {
    return (
      <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
        <div className="animate-pulse text-white">Carregando Auto-Fix...</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🤖</span>
          <h2 className="text-xl font-bold text-white">Auto-Fix System</h2>
          {status?.isRunning && (
            <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full animate-pulse">
              Verificando...
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={forceCheck}
            disabled={isChecking}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition-colors disabled:opacity-50"
          >
            {isChecking ? '⏳ Verificando...' : '🔍 Verificar Agora'}
          </button>
          <div className={`px-3 py-1 rounded-full text-sm font-bold ${getOverallColor(status?.overall || 'critical')}`}>
            {status?.overall === 'healthy' ? '🟢 TUDO OK' : 
             status?.overall === 'degraded' ? '🟡 DEGRADADO' : 
             '🔴 CRÍTICO'}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-300">
          {error}
        </div>
      )}

      {/* Config Info */}
      {status?.config && (
        <div className="mb-3 text-xs text-gray-500 flex gap-4">
          <span>⏱️ Verificação: a cada {status.config.checkInterval / 1000}s</span>
          <span>🔄 Máx tentativas: {status.config.maxRetries}</span>
          <span>📅 Última: {status.lastCheck ? new Date(status.lastCheck).toLocaleTimeString() : 'Nunca'}</span>
        </div>
      )}

      {/* Services Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {status && Object.entries(status.services).map(([name, service]) => (
          <div key={name} className={`bg-gray-800 rounded p-3 border ${
            service.status === 'online' ? 'border-green-600/50' : 
            service.status === 'offline' ? 'border-red-600/50' : 
            'border-yellow-600/50'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-300 font-medium capitalize">
                {name === 'chrome_cdp' ? '🔌 Chrome CDP' :
                 name === 'luna_daemon' ? '🤖 Luna Agent' :
                 name === 'backend' ? '⚙️ Backend' :
                 name === 'frontend' ? '🌐 Frontend' : name}
              </span>
              <div className="flex items-center gap-2">
                {service.autoFixed !== undefined && (
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    service.autoFixed ? 'bg-green-600/30 text-green-400' : 'bg-red-600/30 text-red-400'
                  }`}>
                    {service.autoFixed ? '🛠️ Auto-fix' : '❌ Falhou'}
                  </span>
                )}
                <div className={`w-3 h-3 rounded-full ${getStatusColor(service.status)}`} />
              </div>
            </div>
            <div className="text-sm">
              <span className={service.status === 'online' ? 'text-green-400' : 'text-red-400'}>
                {getStatusIcon(service.status)} {service.status.toUpperCase()}
              </span>
              <div className="text-gray-500 text-xs mt-1">{service.details}</div>
            </div>
            {service.status !== 'online' && (
              <button
                onClick={() => forceFix(name)}
                className="mt-2 w-full px-2 py-1 bg-orange-600 hover:bg-orange-500 text-white text-xs rounded transition-colors"
              >
                🛠️ Forçar Correção Manual
              </button>
            )}
          </div>
        ))}
      </div>

      {/* History */}
      <div className="bg-gray-800 rounded p-3 border border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-gray-300">📋 Histórico de Correções</h3>
          {history && (
            <div className="text-xs text-gray-500">
              ✅ {history.successCount} | ❌ {history.failCount} | 📊 {history.total} total
            </div>
          )}
        </div>
        <div className="bg-black rounded p-2 h-40 overflow-y-auto font-mono text-xs">
          {history && history.fixes.length > 0 ? (
            history.fixes.map((fix) => (
              <div key={fix.id} className={`flex items-start gap-2 py-1 border-b border-gray-800 ${
                fix.success ? 'text-green-400' : 'text-red-400'
              }`}>
                <span className="text-gray-600 shrink-0">
                  {new Date(fix.timestamp).toLocaleTimeString()}
                </span>
                <span className="shrink-0">
                  {fix.success ? '✅' : '❌'}
                </span>
                <span className="text-gray-300">
                  [{fix.service}] {fix.action}
                </span>
                {fix.details && (
                  <span className="text-gray-500">- {fix.details}</span>
                )}
              </div>
            ))
          ) : (
            <span className="text-gray-600">Nenhuma correção aplicada ainda...</span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 text-xs text-gray-500 text-right">
        Auto-Fix v1.0 | Atualizado: {status ? new Date(status.timestamp).toLocaleTimeString() : '---'}
      </div>
    </div>
  );
};

export default AutoFixPanel;

