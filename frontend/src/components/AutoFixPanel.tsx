import { useState, useEffect, useCallback } from 'react'
import {
  Wrench,
  Server,
  Globe,
  Plug,
  Bot,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  Loader2,
  History,
  Zap,
} from 'lucide-react'

interface FixEntry {
  id: string
  timestamp: string
  service: string
  action: string
  success: boolean
  details: string
}

interface ServiceStatus {
  status: 'online' | 'offline' | 'stale' | 'error'
  lastCheck: string
  details: string
  autoFixed?: boolean
}

interface AutoFixStatus {
  timestamp: string
  isRunning: boolean
  lastCheck: string | null
  services: Record<string, ServiceStatus>
  overall: 'healthy' | 'degraded' | 'critical'
  config: {
    checkInterval: number
    maxRetries: number
  }
}

interface FixHistory {
  fixes: FixEntry[]
  total: number
  successCount: number
  failCount: number
}

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  backend: <Server size={14} className="text-nexo-muted" />,
  frontend: <Globe size={14} className="text-nexo-muted" />,
  chrome_cdp: <Plug size={14} className="text-nexo-muted" />,
  luna_daemon: <Bot size={14} className="text-nexo-muted" />,
}

const SERVICE_LABELS: Record<string, string> = {
  backend: 'Backend',
  frontend: 'Frontend',
  chrome_cdp: 'Chrome CDP',
  luna_daemon: 'Luna Agent',
}

export default function AutoFixPanel() {
  const [status, setStatus] = useState<AutoFixStatus | null>(null)
  const [history, setHistory] = useState<FixHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auto-fix/status')
      if (!res.ok) throw new Error('Backend offline')
      const data = await res.json()
      setStatus(data)
      setError(null)
    } catch (e) {
      setError('Não foi possível conectar ao Auto-Fix')
    }
  }, [])

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/auto-fix/history')
      if (res.ok) {
        const data = await res.json()
        setHistory(data)
      }
    } catch (e) {
      console.error('Erro ao buscar histórico:', e)
    }
  }, [])

  const forceCheck = async () => {
    setIsChecking(true)
    try {
      const res = await fetch('/api/auto-fix/check-now', { method: 'POST' })
      if (res.ok) {
        await fetchStatus()
        await fetchHistory()
      }
    } catch (e) {
      console.error('Erro ao forçar verificação:', e)
    }
    setIsChecking(false)
  }

  const forceFix = async (service: string) => {
    try {
      const res = await fetch(`/api/auto-fix/fix/${service}`, { method: 'POST' })
      if (res.ok) {
        await fetchStatus()
        await fetchHistory()
      }
    } catch (e) {
      console.error(`Erro ao forçar correção de ${service}:`, e)
    }
  }

  useEffect(() => {
    const loadAll = async () => {
      await Promise.all([fetchStatus(), fetchHistory()])
      setLoading(false)
    }
    loadAll()

    const interval = setInterval(() => {
      fetchStatus()
      fetchHistory()
    }, 10000)

    return () => clearInterval(interval)
  }, [fetchStatus, fetchHistory])

  const getStatusConfig = (s: string) => {
    switch (s) {
      case 'online':
        return { icon: <CheckCircle2 size={12} />, badge: 'bg-nexo-success/10 text-nexo-success border-nexo-success/20', text: 'Online' }
      case 'offline':
        return { icon: <XCircle size={12} />, badge: 'bg-nexo-danger/10 text-nexo-danger border-nexo-danger/20', text: 'Offline' }
      case 'stale':
        return { icon: <AlertTriangle size={12} />, badge: 'bg-nexo-warning/10 text-nexo-warning border-nexo-warning/20', text: 'Stale' }
      default:
        return { icon: <Clock size={12} />, badge: 'bg-nexo-muted/10 text-nexo-muted border-nexo-muted/20', text: 'Erro' }
    }
  }

  const getOverallBadge = () => {
    switch (status?.overall) {
      case 'healthy':
        return 'bg-nexo-success/10 text-nexo-success border-nexo-success/20'
      case 'degraded':
        return 'bg-nexo-warning/10 text-nexo-warning border-nexo-warning/20'
      default:
        return 'bg-nexo-danger/10 text-nexo-danger border-nexo-danger/20'
    }
  }

  const getOverallLabel = () => {
    switch (status?.overall) {
      case 'healthy': return 'Tudo OK'
      case 'degraded': return 'Degradado'
      default: return 'Crítico'
    }
  }

  if (loading) {
    return (
      <div className="glass-card rounded-xl p-4 border border-nexo-border">
        <div className="flex items-center gap-2 text-nexo-muted animate-pulse">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Carregando Auto-Fix...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card rounded-xl border border-nexo-border overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-nexo-border">
        <div className="flex items-center gap-2">
          <Wrench size={16} className="text-nexo-info" />
          <h2 className="text-sm font-medium text-nexo-text">Auto-Fix System</h2>
          {status?.isRunning && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-nexo-info/10 text-nexo-info border border-nexo-info/20 animate-pulse">
              <RefreshCw size={10} className="animate-spin" /> Verificando...
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={forceCheck}
            disabled={isChecking}
            className="inline-flex items-center gap-1 px-2 py-1 bg-nexo-card text-nexo-muted text-xs rounded-md border border-nexo-border hover:border-nexo-info/50 hover:text-nexo-text transition-colors disabled:opacity-50"
          >
            {isChecking ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Verificar
          </button>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${getOverallBadge()}`}>
            {getOverallLabel()}
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-3 p-2 rounded-lg bg-nexo-danger/10 border border-nexo-danger/20 text-nexo-danger text-xs">
          {error}
        </div>
      )}

      {/* Config Info */}
      {status?.config && (
        <div className="px-4 pt-2 text-[10px] text-nexo-muted/60 flex gap-3">
          <span>Verificação: a cada {status.config.checkInterval / 1000}s</span>
          <span>Máx tentativas: {status.config.maxRetries}</span>
          <span>Última: {status.lastCheck ? new Date(status.lastCheck).toLocaleTimeString() : 'Nunca'}</span>
        </div>
      )}

      {/* Services Grid */}
      <div className="grid grid-cols-2 gap-2 p-3">
        {status && Object.entries(status.services).map(([name, service]) => {
          const cfg = getStatusConfig(service.status)
          return (
            <div key={name} className="glass-card rounded-lg p-3 border border-nexo-border">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  {SERVICE_ICONS[name]}
                  <span className="text-xs font-medium text-nexo-text">
                    {SERVICE_LABELS[name]}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {service.autoFixed !== undefined && (
                    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                      service.autoFixed ? 'bg-nexo-success/10 text-nexo-success border-nexo-success/20' : 'bg-nexo-danger/10 text-nexo-danger border-nexo-danger/20'
                    }`}>
                      {service.autoFixed ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                      {service.autoFixed ? 'Auto-fix' : 'Falhou'}
                    </span>
                  )}
                  <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium border ${cfg.badge}`}>
                    {cfg.icon} {cfg.text}
                  </span>
                </div>
              </div>
              <div className="text-[10px] text-nexo-muted">{service.details}</div>
              {service.status !== 'online' && (
                <button
                  onClick={() => forceFix(name)}
                  className="mt-2 w-full inline-flex items-center justify-center gap-1 px-2 py-1 bg-nexo-card text-nexo-warning text-[10px] rounded-md border border-nexo-warning/30 hover:bg-nexo-warning/10 transition-colors"
                >
                  <Zap size={10} /> Forçar Correção
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* History */}
      <div className="px-3 pb-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <History size={12} className="text-nexo-muted" />
            <span className="text-xs text-nexo-muted">Histórico</span>
          </div>
          {history && (
            <div className="text-[10px] text-nexo-muted/60 flex gap-2">
              <span className="text-nexo-success">{history.successCount} OK</span>
              <span className="text-nexo-danger">{history.failCount} falha</span>
              <span>{history.total} total</span>
            </div>
          )}
        </div>
        <div className="bg-nexo-bg rounded-lg border border-nexo-border p-2 h-28 overflow-y-auto font-mono text-[10px]">
          {history && history.fixes.length > 0 ? (
            history.fixes.map((fix) => (
              <div key={fix.id} className={`flex items-start gap-2 py-0.5 border-b border-nexo-border/50 ${
                fix.success ? 'text-nexo-success' : 'text-nexo-danger'
              }`}>
                <span className="text-nexo-muted/40 shrink-0">{new Date(fix.timestamp).toLocaleTimeString()}</span>
                <span className="shrink-0">{fix.success ? <CheckCircle2 size={10} /> : <XCircle size={10} />}</span>
                <span className="text-nexo-muted">[{fix.service}] {fix.action}</span>
                {fix.details && <span className="text-nexo-muted/50">- {fix.details}</span>}
              </div>
            ))
          ) : (
            <span className="text-nexo-muted/40">Nenhuma correção aplicada...</span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-nexo-border text-[10px] text-nexo-muted/50 text-right">
        Auto-Fix v1.0 | Atualizado: {status ? new Date(status.timestamp).toLocaleTimeString() : '---'}
      </div>
    </div>
  )
}
