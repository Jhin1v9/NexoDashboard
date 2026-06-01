import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  Bell, X, Check, AlertTriangle, Shield, Info,
  Zap, Lock, Mail, DollarSign,
  Trash2, CheckCheck, Filter
} from 'lucide-react'
import axios from 'axios'

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO VISUAL POR TIPO DE NOTIFICAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

const TYPE_CONFIG = {
  security_alert: {
    icon: Lock,
    label: 'Segurança',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    dot: 'bg-red-500',
    severity: 'high'
  },
  system: {
    icon: Zap,
    label: 'Sistema',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    dot: 'bg-cyan-500',
    severity: 'medium'
  },
  info: {
    icon: Info,
    label: 'Info',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    dot: 'bg-blue-500',
    severity: 'low'
  },
  email: {
    icon: Mail,
    label: 'Email',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    dot: 'bg-amber-500',
    severity: 'medium'
  },
  finance: {
    icon: DollarSign,
    label: 'Financeiro',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    dot: 'bg-green-500',
    severity: 'medium'
  }
}

const SEVERITY_CONFIG = {
  high: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', dot: 'bg-red-500' },
  medium: { icon: Info, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', dot: 'bg-yellow-500' },
  low: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', dot: 'bg-blue-500' }
}

const FILTERS = [
  { key: 'all', label: 'Todas', icon: Bell },
  { key: 'unread', label: 'Não lidas', icon: Mail },
  { key: 'alert', label: 'Alertas', icon: AlertTriangle },
  { key: 'system', label: 'Sistema', icon: Zap }
]

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatTimeAgo(isoString) {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now - date
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffSecs < 10) return 'Agora'
  if (diffSecs < 60) return `Há ${diffSecs}s`
  if (diffMins < 60) return `Há ${diffMins}min`
  if (diffHours < 24) return `Há ${diffHours}h`
  if (diffDays === 1) return 'Ontem'
  if (diffDays < 7) return `Há ${diffDays}d`
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function getNotifConfig(n) {
  return TYPE_CONFIG[n.type] || SEVERITY_CONFIG[n.severity] || SEVERITY_CONFIG.low
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [wsConnected, setWsConnected] = useState(false)
  const [activeFilter, setActiveFilter] = useState('all')
  const [dismissing, setDismissing] = useState(new Set())
  const [pos, setPos] = useState({ top: 56, right: 16 })
  const buttonRef = useRef(null)
  const dropdownRef = useRef(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await axios.get('/api/notifications')
      if (res.data.success) {
        setNotifications(res.data.notifications || [])
        setUnreadCount(res.data.unreadCount || 0)
      }
    } catch (e) {}
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, wsConnected ? 30000 : 15000)
    return () => clearInterval(interval)
  }, [fetchNotifications, wsConnected])

  // ── WebSocket ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.port === '3457' ? 'localhost:3456' : window.location.host
    const wsUrl = `${protocol}//${host}/ws`
    const ws = new WebSocket(wsUrl)
    ws.onopen = () => setWsConnected(true)
    ws.onclose = () => setWsConnected(false)
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'notifications:new' || data.type === 'security:alert') {
          fetchNotifications()
        }
      } catch {}
    }
    ws.onerror = () => {}
    return () => ws.close()
  }, [fetchNotifications])

  // ── Escape para fechar ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') { setOpen(false); buttonRef.current?.focus() }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  // ── Filtragem ────────────────────────────────────────────────────────────────
  const filteredNotifications = useMemo(() => {
    switch (activeFilter) {
      case 'unread': return notifications.filter(n => !n.read)
      case 'alert': return notifications.filter(n => (TYPE_CONFIG[n.type]?.severity || n.severity) === 'high')
      case 'system': return notifications.filter(n => n.type === 'system' || n.type === 'info')
      default: return notifications
    }
  }, [notifications, activeFilter])

  const filterCounts = useMemo(() => ({
    all: notifications.length,
    unread: notifications.filter(n => !n.read).length,
    alert: notifications.filter(n => (TYPE_CONFIG[n.type]?.severity || n.severity) === 'high').length,
    system: notifications.filter(n => n.type === 'system' || n.type === 'info').length
  }), [notifications])

  // ── Ações ────────────────────────────────────────────────────────────────────
  const markAsRead = async (id) => {
    try {
      await axios.post(`/api/notifications/${id}/read`)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (e) {}
  }

  // 🎯 CLIQUE NO CARD = MARCAR COMO LIDA + ANIMAR SAÍDA
  const handleCardClick = async (n) => {
    if (n.read) return
    setDismissing(prev => new Set(prev).add(n.id))
    await markAsRead(n.id)
    setTimeout(() => {
      setDismissing(prev => {
        const next = new Set(prev)
        next.delete(n.id)
        return next
      })
    }, 350)
  }

  const markAllAsRead = async () => {
    try {
      await axios.post('/api/notifications/read-all')
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch (e) {}
  }

  const removeNotification = async (id, e) => {
    e.stopPropagation()
    try {
      await axios.delete(`/api/notifications/${id}`)
      setNotifications(prev => prev.filter(n => n.id !== id))
    } catch (e) {}
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="relative z-[9999]">
      {/* ── Botão do Sino ─────────────────────────────────────────────────────── */}
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation()
          if (!open && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect()
            setPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right })
          }
          setOpen(!open)
        }}
        className="relative p-2 text-nexo-muted hover:text-nexo-text transition-colors rounded-lg hover:bg-white/5"
        aria-label={`Notificações${unreadCount > 0 ? ` (${unreadCount} não lidas)` : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className="w-5 h-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown (Portal para ficar acima de tudo) ────────────────────────── */}
      {open && createPortal(
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setOpen(false)}
            role="presentation"
            aria-hidden="true"
          />

          {/* Painel */}
          <div
            ref={dropdownRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="nc-title"
            className="fixed w-[400px] rounded-xl shadow-2xl z-[9999] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
            style={{
              top: pos.top,
              right: pos.right,
              background: 'linear-gradient(180deg, rgba(12,12,18,0.99) 0%, rgba(6,6,10,0.99) 100%)',
              border: '1px solid rgba(0,240,255,0.12)',
              boxShadow: '0 12px 50px rgba(0,0,0,0.6), 0 0 30px rgba(0,240,255,0.04)',
              maxHeight: '560px'
            }}
          >
            {/* ═════ HEADER ═════ */}
            <div className="px-4 pt-4 pb-3 border-b border-nexo-border/60">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 id="nc-title" className="text-base font-bold text-nexo-text flex items-center gap-2">
                    <Bell className="w-4 h-4 text-nexo-primary" />
                    Central de Notificações
                  </h3>
                  <p className="text-[11px] text-nexo-muted mt-0.5">
                    {unreadCount > 0
                      ? `${unreadCount} não ${unreadCount === 1 ? 'lida' : 'lidas'} de ${notifications.length} total`
                      : notifications.length > 0
                        ? `${notifications.length} notificações — todas lidas`
                        : 'Nenhuma notificação no momento'
                    }
                  </p>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-nexo-primary bg-nexo-primary/10 hover:bg-nexo-primary/20 rounded-lg transition-colors border border-nexo-primary/20"
                    title="Marcar todas como lidas"
                  >
                    <CheckCheck className="w-3 h-3" />
                    Limpar tudo
                  </button>
                )}
              </div>

              {/* ═════ FILTROS (Tabs) ═════ */}
              <div className="flex items-center gap-1 mt-2">
                {FILTERS.map(f => {
                  const Icon = f.icon
                  const isActive = activeFilter === f.key
                  const count = filterCounts[f.key]
                  return (
                    <button
                      key={f.key}
                      onClick={() => setActiveFilter(f.key)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                        isActive
                          ? 'bg-nexo-primary/15 text-nexo-primary border border-nexo-primary/30'
                          : 'text-nexo-muted hover:text-nexo-text hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      {f.label}
                      {count > 0 && (
                        <span className={`ml-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                          isActive ? 'bg-nexo-primary text-white' : 'bg-white/10 text-nexo-muted'
                        }`}>
                          {count > 99 ? '99+' : count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ═════ LISTA ═════ */}
            <div className="overflow-y-auto flex-1" style={{ maxHeight: '380px' }}>
              {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-nexo-muted">
                  <Filter className="w-10 h-10 mb-3 opacity-20" />
                  <p className="text-sm font-medium">
                    {activeFilter === 'all' ? 'Nenhuma notificação' : 'Nenhuma notificação neste filtro'}
                  </p>
                  <p className="text-[11px] opacity-60 mt-1">
                    {activeFilter === 'all' ? 'Você está em dia!' : 'Tente outro filtro'}
                  </p>
                </div>
              ) : (
                <div className="py-1">
                  {filteredNotifications.map(n => {
                    const config = getNotifConfig(n)
                    const Icon = config.icon
                    const isDismissing = dismissing.has(n.id)

                    return (
                      <div
                        key={n.id}
                        onClick={() => handleCardClick(n)}
                        className={`
                          group relative mx-2 my-1 rounded-lg border transition-all duration-300 cursor-pointer
                          ${n.read
                            ? 'opacity-50 border-transparent hover:opacity-70 hover:bg-white/[0.03]'
                            : `${config.bg} ${config.border} hover:brightness-110 hover:scale-[1.01]`
                          }
                          ${isDismissing ? 'opacity-0 translate-x-4 scale-95' : 'opacity-100 translate-x-0 scale-100'}
                        `}
                        style={{ padding: '10px 12px' }}
                      >
                        {/* Indicador de não lido (dot pulsante) */}
                        {!n.read && (
                          <div className={`absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${config.dot} animate-pulse`} />
                        )}

                        <div className={`flex items-start gap-3 ${!n.read ? 'pl-3' : ''}`}>
                          {/* Ícone */}
                          <div className={`
                            flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
                            ${n.read ? 'bg-white/5' : config.bg}
                          `}>
                            <Icon className={`w-4 h-4 ${config.color}`} />
                          </div>

                          {/* Conteúdo */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${config.bg} ${config.color}`}>
                                {config.label}
                              </span>
                              <span className="text-[10px] text-nexo-muted/60">
                                {formatTimeAgo(n.timestamp)}
                              </span>
                            </div>
                            <p className={`text-xs font-semibold leading-tight ${n.read ? 'text-nexo-muted' : 'text-nexo-text'}`}>
                              {n.title}
                            </p>
                            <p className="text-[11px] text-nexo-muted mt-0.5 line-clamp-2 leading-relaxed">
                              {n.message}
                            </p>
                          </div>

                          {/* Ações */}
                          <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!n.read && (
                              <div className="w-5 h-5 rounded flex items-center justify-center bg-nexo-primary/20">
                                <Check className="w-3 h-3 text-nexo-primary" />
                              </div>
                            )}
                            <button
                              onClick={(e) => removeNotification(n.id, e)}
                              className="w-5 h-5 rounded flex items-center justify-center hover:bg-red-500/20 transition-colors"
                              title="Remover"
                            >
                              <Trash2 className="w-3 h-3 text-nexo-muted hover:text-red-400" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ═════ FOOTER ═════ */}
            <div className="px-4 py-2.5 border-t border-nexo-border/60 bg-white/[0.02] flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`} />
                <span className="text-[10px] text-nexo-muted/60">
                  {wsConnected ? 'Em tempo real' : 'Polling a cada 15s'}
                </span>
              </div>
              <span className="text-[10px] text-nexo-muted/40">
                {filteredNotifications.length} exibidas
              </span>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}

export default NotificationCenter
