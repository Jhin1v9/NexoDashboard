import { useState, useEffect } from 'react'
import { Menu, Search, Wifi, WifiOff, Clock, User, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import PushNotificationButton from './PushNotificationButton'
import ChangelogBadge from './changelog/ChangelogBadge'
import NotificationCenter from './NotificationCenter'
import useChangelog from '../hooks/useChangelog'

export default function TopBar({ onMenuClick, onSearchClick }) {
  const [connected, setConnected] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const { user, logout } = useAuth()

  const {
    entries,
    unreadCount,
    markAsRead,
    markAllAsRead,
    updateLastVisit,
    isUnread,
  } = useChangelog()

  useEffect(() => {
    const interval = setInterval(() => setLastUpdate(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  const activeUser = user || { name: 'Usuário', color: '#6366f1' }

  return (
    <header className="h-14 glass flex items-center justify-between px-4 border-b border-nexo-border">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="p-2 hover:bg-nexo-card rounded-lg transition-colors">
          <Menu size={20} />
        </button>
        <button onClick={onSearchClick} className="flex items-center gap-2 px-3 py-1.5 bg-nexo-card rounded-lg text-nexo-muted text-sm hover:text-white transition-colors">
          <Search size={14} />
          <span>Buscar... (Ctrl+K)</span>
        </button>
      </div>
      <div className="flex items-center gap-4">
        <ChangelogBadge
          entries={entries}
          unreadCount={unreadCount}
          onMarkAsRead={markAsRead}
          onMarkAllAsRead={markAllAsRead}
          onUpdateLastVisit={updateLastVisit}
          isUnread={isUnread}
        />
        <NotificationCenter />
        <PushNotificationButton />
        <div className="flex items-center gap-1.5 text-xs text-nexo-muted">
          {connected ? <Wifi size={14} className="text-nexo-success" /> : <WifiOff size={14} className="text-nexo-danger" />}
          <span>{connected ? 'Online' : 'Offline'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-nexo-muted">
          <Clock size={14} />
          <span>Atualizado {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div className="relative group">
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-nexo-card transition-colors">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white font-bold" style={{ backgroundColor: activeUser.color }}>
              <User size={14} />
            </div>
            <span className="text-sm font-medium">{activeUser.name}</span>
          </button>
          <div className="absolute right-0 top-full mt-1 w-40 glass-card py-1 hidden group-hover:block z-[9990]">
            <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-nexo-card transition-colors">
              <LogOut size={14} />
              <span>Encerrar Sessão</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
