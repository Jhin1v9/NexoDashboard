import { useState, useEffect } from 'react'
import axios from 'axios'
import {
  Shield, AlertTriangle, Globe, Monitor, Smartphone, Cpu,
  MapPin, Clock, Fingerprint, X, Filter, ChevronDown,
  Eye, Trash2, Lock, Wifi, Server, HardDrive
} from 'lucide-react'

export default function Seguranca() {
  const [events, setEvents] = useState([])
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all, failed_login, alert
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [stats, setStats] = useState({ total: 0, uniqueIps: 0, today: 0, alerted: 0 })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [logRes, settingsRes] = await Promise.all([
        axios.get('/api/security/log'),
        axios.get('/api/security/settings')
      ])
      const evts = logRes.data.events || []
      setEvents(evts)
      setSettings(settingsRes.data.settings || {})

      // Calcular estatísticas
      const uniqueIps = new Set(evts.map(e => e.ip)).size
      const today = evts.filter(e => {
        const d = new Date(e.timestamp)
        const now = new Date()
        return d.toDateString() === now.toDateString()
      }).length
      const alerted = evts.filter(e => e.notified).length
      setStats({ total: evts.length, uniqueIps, today, alerted })
    } catch (e) {}
    setLoading(false)
  }

  const filteredEvents = events.filter(e => {
    if (filter === 'all') return true
    if (filter === 'alert') return e.notified
    return e.type === filter
  })

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'text-red-500 bg-red-500/10 border-red-500/20'
      case 'high': return 'text-orange-400 bg-orange-500/10 border-orange-500/20'
      case 'medium': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
      default: return 'text-blue-400 bg-blue-500/10 border-blue-500/20'
    }
  }

  const getSeverityLabel = (severity) => {
    switch (severity) {
      case 'critical': return 'CRÍTICO'
      case 'high': return 'ALTO'
      case 'medium': return 'MÉDIO'
      default: return 'BAIXO'
    }
  }

  const formatDate = (ts) => {
    const d = new Date(ts)
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const deleteEvent = async (id) => {
    // No backend não tem delete individual, vamos filtrar no frontend
    setEvents(prev => prev.filter(e => e.id !== id))
    setSelectedEvent(null)
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-7 h-7 text-nexo-primary" />
          <div>
            <h1 className="text-2xl font-bold">Centro de Segurança</h1>
            <p className="text-sm text-nexo-muted">Monitoramento de ameaças e eventos de segurança</p>
          </div>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-nexo-card border border-nexo-border rounded-lg text-sm hover:bg-nexo-bg transition-colors"
        >
          <Wifi className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { icon: AlertTriangle, label: 'Eventos Totais', value: stats.total, color: 'text-orange-400' },
          { icon: Globe, label: 'IPs Únicos', value: stats.uniqueIps, color: 'text-blue-400' },
          { icon: Clock, label: 'Hoje', value: stats.today, color: 'text-green-400' },
          { icon: Shield, label: 'Alertas Enviados', value: stats.alerted, color: 'text-red-400' },
        ].map((s, i) => (
          <div key={i} className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-xs text-nexo-muted uppercase">{s.label}</span>
            </div>
            <p className="text-2xl font-bold font-mono">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Filter className="w-4 h-4 text-nexo-muted" />
        {[
          { id: 'all', label: 'Todos' },
          { id: 'failed_login', label: 'Login Falho' },
          { id: 'alert', label: 'Com Alerta' },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f.id ? 'bg-nexo-primary text-white' : 'bg-nexo-card text-nexo-muted hover:text-nexo-text'
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="text-xs text-nexo-muted ml-auto">{filteredEvents.length} eventos</span>
      </div>

      {/* Events Table */}
      {loading ? (
        <div className="glass-card p-8 text-center text-nexo-muted">Carregando...</div>
      ) : filteredEvents.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Shield className="w-12 h-12 mx-auto mb-3 text-nexo-muted opacity-30" />
          <p className="text-nexo-muted">Nenhum evento de segurança encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEvents.map(event => (
            <div
              key={event.id}
              className="glass-card p-4 hover:border-nexo-primary/30 transition-all cursor-pointer"
              onClick={() => setSelectedEvent(event)}
            >
              <div className="flex items-start gap-4">
                {/* Severity Badge */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center border ${getSeverityColor(event.severity)}`}>
                  <AlertTriangle className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getSeverityColor(event.severity)}`}>
                      {getSeverityLabel(event.severity)}
                    </span>
                    {event.notified && (
                      <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded">
                        ALERTA ENVIADO
                      </span>
                    )}
                    <span className="text-xs text-nexo-muted ml-auto">{formatDate(event.timestamp)}</span>
                  </div>

                  <p className="text-sm font-medium mt-1 truncate">{event.message}</p>

                  {/* Quick details */}
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-nexo-muted">
                    <span className="flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      {event.ip}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {event.location?.city || '?'}, {event.location?.country || '?'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Monitor className="w-3 h-3" />
                      {event.device?.browser || '?'}
                    </span>
                    <span className="flex items-center gap-1">
                      <HardDrive className="w-3 h-3" />
                      {event.device?.os || '?'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Cpu className="w-3 h-3" />
                      {event.device?.gpu || '?'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Fingerprint className="w-3 h-3" />
                      {event.device?.fingerprint?.slice(0, 8) || 'N/A'}...
                    </span>
                  </div>
                </div>

                <Eye className="w-4 h-4 text-nexo-muted flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setSelectedEvent(null)}>
          <div className="bg-nexo-card border border-nexo-border rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-nexo-border">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${getSeverityColor(selectedEvent.severity)}`}>
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold">Detalhes do Evento</p>
                  <p className="text-xs text-nexo-muted">{selectedEvent.id}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => deleteEvent(selectedEvent.id)}
                  className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  title="Remover do log"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="p-2 text-nexo-muted hover:bg-nexo-bg rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* General Info */}
              <div>
                <h3 className="text-sm font-bold text-nexo-primary mb-3 flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Informações Gerais
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-nexo-bg rounded-lg p-3">
                    <p className="text-[10px] text-nexo-muted uppercase">Tipo</p>
                    <p className="text-sm font-medium">{selectedEvent.type === 'failed_login' ? 'Login Falho' : selectedEvent.type}</p>
                  </div>
                  <div className="bg-nexo-bg rounded-lg p-3">
                    <p className="text-[10px] text-nexo-muted uppercase">Severidade</p>
                    <p className="text-sm font-medium">{getSeverityLabel(selectedEvent.severity)}</p>
                  </div>
                  <div className="bg-nexo-bg rounded-lg p-3">
                    <p className="text-[10px] text-nexo-muted uppercase">Horário</p>
                    <p className="text-sm font-medium">{formatDate(selectedEvent.timestamp)}</p>
                  </div>
                  <div className="bg-nexo-bg rounded-lg p-3">
                    <p className="text-[10px] text-nexo-muted uppercase">Usuário Tentado</p>
                    <p className="text-sm font-medium">{selectedEvent.attemptedUser || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* IP & Location */}
              <div>
                <h3 className="text-sm font-bold text-blue-400 mb-3 flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  IP & Localização
                </h3>
                <div className="bg-nexo-bg rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-nexo-muted">Endereço IP</span>
                    <span className="text-sm font-mono font-medium">{selectedEvent.ip}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-nexo-muted">País</span>
                    <span className="text-sm font-medium">{selectedEvent.location?.country || 'Desconhecido'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-nexo-muted">Cidade</span>
                    <span className="text-sm font-medium">{selectedEvent.location?.city || 'Desconhecido'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-nexo-muted">Região</span>
                    <span className="text-sm font-medium">{selectedEvent.location?.region || 'Desconhecido'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-nexo-muted">ISP</span>
                    <span className="text-sm font-medium">{selectedEvent.location?.isp || 'Desconhecido'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-nexo-muted">Organização</span>
                    <span className="text-sm font-medium">{selectedEvent.location?.org || 'Desconhecido'}</span>
                  </div>
                  {(selectedEvent.location?.lat && selectedEvent.location?.lon) && (
                    <div className="flex justify-between">
                      <span className="text-sm text-nexo-muted">Coordenadas</span>
                      <span className="text-sm font-mono">{selectedEvent.location.lat}, {selectedEvent.location.lon}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Device Info */}
              <div>
                <h3 className="text-sm font-bold text-emerald-400 mb-3 flex items-center gap-2">
                  <Monitor className="w-4 h-4" />
                  Dispositivo do Intruso
                </h3>
                <div className="bg-nexo-bg rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-nexo-muted">Navegador</span>
                    <span className="text-sm font-medium">{selectedEvent.device?.browser || 'Desconhecido'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-nexo-muted">Sistema Operacional</span>
                    <span className="text-sm font-medium">{selectedEvent.device?.os || 'Desconhecido'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-nexo-muted">Dispositivo</span>
                    <span className="text-sm font-medium">{selectedEvent.device?.device || 'Desconhecido'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-nexo-muted">Arquitetura</span>
                    <span className="text-sm font-medium">{selectedEvent.device?.arch || 'Desconhecido'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-nexo-muted">Tipo</span>
                    <span className="text-sm font-medium">{selectedEvent.device?.isMobile ? 'Mobile' : 'Desktop'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-nexo-muted">Resolução de Tela</span>
                    <span className="text-sm font-medium">{selectedEvent.device?.resolution || 'Desconhecido'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-nexo-muted">GPU / WebGL</span>
                    <span className="text-sm font-medium">{selectedEvent.device?.gpu || 'Desconhecido'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-nexo-muted">Idioma</span>
                    <span className="text-sm font-medium">{selectedEvent.device?.language || 'Desconhecido'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-nexo-muted">Timezone</span>
                    <span className="text-sm font-medium">{selectedEvent.device?.timezone || 'Desconhecido'}</span>
                  </div>
                </div>
              </div>

              {/* Fingerprint */}
              <div>
                <h3 className="text-sm font-bold text-violet-400 mb-3 flex items-center gap-2">
                  <Fingerprint className="w-4 h-4" />
                  Fingerprint Digital
                </h3>
                <div className="bg-nexo-bg rounded-lg p-4">
                  <p className="text-xs text-nexo-muted mb-2">Hash único do canvas (usado para identificar dispositivos)</p>
                  <code className="block text-xs font-mono bg-black/30 p-3 rounded-lg break-all">
                    {selectedEvent.device?.fingerprintFull || selectedEvent.device?.fingerprint || 'N/A'}
                  </code>
                </div>
              </div>

              {/* Raw User-Agent */}
              <div>
                <h3 className="text-sm font-bold text-nexo-muted mb-3 flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  User-Agent Completo
                </h3>
                <div className="bg-nexo-bg rounded-lg p-4">
                  <code className="block text-[10px] font-mono bg-black/30 p-3 rounded-lg break-all text-nexo-muted">
                    {selectedEvent.device?.userAgent || 'N/A'}
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
