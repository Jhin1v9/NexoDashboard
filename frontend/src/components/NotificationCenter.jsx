import { useState, useEffect } from 'react'
import { Bell, X, Check, AlertTriangle, Shield, Info } from 'lucide-react'
import axios from 'axios'

const severityConfig = {
  high: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  medium: { icon: Info, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  low: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' }
}

function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const fetchNotifications = async () => {
    try {
      const res = await axios.get('/api/notifications')
      if (res.data.success) {
        setNotifications(res.data.notifications || [])
        setUnreadCount(res.data.unreadCount || 0)
      }
    } catch (e) {}
  }

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  // Escutar WebSocket para notificações em tempo real
  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.host}/ws`)
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'notifications:new' || data.type === 'security:alert') {
          fetchNotifications()
        }
      } catch {}
    }
    return () => ws.close()
  }, [])

  const markAsRead = async (id) => {
    try {
      await axios.post(`/api/notifications/${id}/read`)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (e) {}
  }

  const markAllAsRead = async () => {
    try {
      await axios.post('/api/notifications/read-all')
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch (e) {}
  }

  const removeNotification = async (id) => {
    try {
      await axios.delete(`/api/notifications/${id}`)
      setNotifications(prev => prev.filter(n => n.id !== id))
    } catch (e) {}
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-nexo-muted hover:text-nexo-text transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 bg-nexo-card border border-nexo-border rounded-xl shadow-2xl z-[101] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-nexo-border">
              <h3 className="font-semibold text-sm">Notificações</h3>
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} className="text-xs text-nexo-primary hover:underline">
                  Marcar todas como lidas
                </button>
              )}
            </div>

            <div className="max-h-72 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="text-center py-8 text-nexo-muted text-sm">
                  <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Nenhuma notificação</p>
                </div>
              ) : (
                notifications.map(n => {
                  const config = severityConfig[n.severity] || severityConfig.low
                  const Icon = config.icon
                  return (
                    <div
                      key={n.id}
                      className={`px-4 py-3 border-b border-nexo-border/50 hover:bg-nexo-bg/50 transition-colors ${n.read ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.color}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-nexo-text">{n.title}</p>
                          <p className="text-[11px] text-nexo-muted mt-0.5 line-clamp-2">{n.message}</p>
                          <p className="text-[10px] text-nexo-muted/50 mt-1">
                            {new Date(n.timestamp).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1">
                          {!n.read && (
                            <button onClick={() => markAsRead(n.id)} className="p-1 hover:bg-nexo-bg rounded" title="Marcar como lida">
                              <Check className="w-3 h-3 text-nexo-success" />
                            </button>
                          )}
                          <button onClick={() => removeNotification(n.id)} className="p-1 hover:bg-nexo-bg rounded" title="Remover">
                            <X className="w-3 h-3 text-nexo-muted" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default NotificationCenter
