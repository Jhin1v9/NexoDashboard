import {
  Mail, Send, Inbox, Star, Trash2, FileText,
  Archive, AlertTriangle, RefreshCw, Plus, Wifi, WifiOff,
  ChevronDown, ChevronRight, Tag, PanelLeftClose, PanelLeftOpen,
  Maximize2, Minimize2
} from 'lucide-react'
import { useState, useCallback } from 'react'

const SYSTEM_LABELS = [
  { id: 'INBOX', icon: Inbox, label: 'Caixa de Entrada' },
  { id: 'STARRED', icon: Star, label: 'Com Estrela' },
  { id: 'SENT', icon: Send, label: 'Enviados' },
  { id: 'DRAFT', icon: FileText, label: 'Rascunhos' },
  { id: 'IMPORTANT', icon: AlertTriangle, label: 'Importante' },
  { id: 'TRASH', icon: Trash2, label: 'Lixeira' },
]

export default function EmailSidebar({
  activeLabel,
  onLabelChange,
  labels = [],
  onCompose,
  onSync,
  syncing,
  connected,
  onConnect,
  userProfile,
  unreadCounts = {},
  collapsed: controlledCollapsed,
  onToggleCollapse,
  onFocusMode,
  isFocusMode,
}) {
  const [internalCollapsed, setInternalCollapsed] = useState(() => {
    try {
      return localStorage.getItem('nexo-email-sidebar-collapsed') === 'true'
    } catch {
      return false
    }
  })
  const [showCustomLabels, setShowCustomLabels] = useState(false)
  const [hoveredLabel, setHoveredLabel] = useState(null)

  const collapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed

  const setCollapsed = useCallback((value) => {
    if (controlledCollapsed === undefined) {
      setInternalCollapsed(value)
      try {
        localStorage.setItem('nexo-email-sidebar-collapsed', String(value))
      } catch {}
    }
    onToggleCollapse?.(value)
  }, [controlledCollapsed, onToggleCollapse])

  const toggle = useCallback(() => setCollapsed(!collapsed), [collapsed, setCollapsed])

  const customLabels = labels.filter((l) => l.type === 'user')
  const widthClass = collapsed ? 'w-14' : 'w-56'

  return (
    <div className={`${widthClass} border-r border-nexo-border flex flex-col h-full bg-nexo-card/50 transition-[width] duration-200 ease-out relative`}>
      {/* Toggle + Focus mode buttons (header) */}
      <div className={`flex items-center ${collapsed ? 'justify-center px-1 gap-1' : 'justify-between px-3'} py-2 border-b border-nexo-border`}>
        {onFocusMode && (
          <button
            onClick={onFocusMode}
            className="p-1.5 rounded-lg text-nexo-muted hover:text-nexo-text hover:bg-nexo-bg transition-colors"
            title={isFocusMode ? 'Sair do Modo Foco' : 'Modo Foco (tela cheia)'}
          >
            {isFocusMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        )}
        <button
          onClick={toggle}
          className="p-1.5 rounded-lg text-nexo-muted hover:text-nexo-text hover:bg-nexo-bg transition-colors"
          title={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
        >
          {collapsed ? <PanelLeftOpen className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Conta / Status */}
      <div className={`${collapsed ? 'px-1.5' : 'px-3'} py-2 border-b border-nexo-border`}>
        {connected && userProfile?.email ? (
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2'}`}>
            <img
              src={userProfile.picture || '/default-avatar.png'}
              alt=""
              className="w-8 h-8 rounded-full border border-nexo-border flex-shrink-0"
              onError={(e) => { e.target.src = 'https://ui-avatars.com/api/?name=N+D&background=1A56DB&color=fff' }}
            />
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{userProfile.name || userProfile.email}</p>
                <p className="text-[10px] text-nexo-muted truncate">{userProfile.email}</p>
              </div>
            )}
            {!collapsed && <Wifi className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />}
          </div>
        ) : (
          <button
            onClick={onConnect}
            className={`${collapsed ? 'w-10 h-10 p-0 justify-center' : 'w-full gap-2 px-3'} flex items-center py-2 rounded-lg bg-nexo-primary/10 border border-nexo-primary/20 text-nexo-primary text-xs font-medium hover:bg-nexo-primary/20 transition-colors`}
            title={collapsed ? 'Conectar Gmail' : undefined}
          >
            <WifiOff className="w-3.5 h-3.5" />
            {!collapsed && 'Conectar Gmail'}
          </button>
        )}
      </div>

      {/* Compor */}
      <div className={`${collapsed ? 'px-1.5 py-2' : 'p-3'}`}>
        <button
          onClick={onCompose}
          className={`${collapsed ? 'w-10 h-10 p-0 justify-center' : 'w-full gap-2 px-4 py-2.5'} flex items-center bg-nexo-primary hover:opacity-90 text-white rounded-xl font-medium transition-opacity text-sm shadow-lg shadow-nexo-primary/20`}
          title={collapsed ? 'Compor' : undefined}
        >
          <Plus className="w-4 h-4" />
          {!collapsed && 'Compor'}
        </button>
      </div>

      {/* Labels do sistema */}
      <nav className="flex-1 px-1.5 space-y-0.5 overflow-y-auto">
        {SYSTEM_LABELS.map((item) => {
          const isActive = activeLabel === item.id
          const unread = unreadCounts[item.id] || 0
          return (
            <button
              key={item.id}
              onClick={() => onLabelChange(item.id)}
              onMouseEnter={() => collapsed && setHoveredLabel(item.id)}
              onMouseLeave={() => setHoveredLabel(null)}
              className={`w-full flex items-center ${collapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3 py-2'} rounded-lg text-sm transition-colors relative ${
                isActive
                  ? 'bg-nexo-primary/15 text-nexo-primary font-medium'
                  : 'text-nexo-muted hover:text-nexo-text hover:bg-nexo-bg'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left">{item.label}</span>
                  {unread > 0 && (
                    <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full font-bold">
                      {unread}
                    </span>
                  )}
                </>
              )}
              {collapsed && unread > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
              {/* Tooltip no hover quando colapsado */}
              {collapsed && hoveredLabel === item.id && (
                <span className="absolute left-full ml-2 px-2 py-1 bg-nexo-card border border-nexo-border rounded-lg text-xs text-nexo-text whitespace-nowrap z-50 shadow-lg">
                  {item.label}{unread > 0 ? ` (${unread})` : ''}
                </span>
              )}
            </button>
          )
        })}

        {/* Labels customizadas */}
        {customLabels.length > 0 && !collapsed && (
          <div className="mt-2">
            <button
              onClick={() => setShowCustomLabels(!showCustomLabels)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-nexo-muted hover:text-nexo-text transition-colors"
            >
              {showCustomLabels ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              Labels
            </button>
            {showCustomLabels && (
              <div className="mt-0.5 space-y-0.5">
                {customLabels.map((label) => (
                  <button
                    key={label.id}
                    onClick={() => onLabelChange(label.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      activeLabel === label.id
                        ? 'bg-nexo-primary/15 text-nexo-primary font-medium'
                        : 'text-nexo-muted hover:text-nexo-text hover:bg-nexo-bg'
                    }`}
                  >
                    <Tag className="w-3.5 h-3.5 flex-shrink-0" style={{ color: label.color?.backgroundColor || '#9ca3af' }} />
                    <span className="flex-1 text-left truncate">{label.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Sincronizar */}
      <div className={`${collapsed ? 'px-1.5' : 'px-3'} py-2 border-t border-nexo-border`}>
        <button
          onClick={onSync}
          disabled={syncing || !connected}
          className={`${collapsed ? 'w-10 h-10 p-0 justify-center' : 'w-full gap-2'} flex items-center py-2 text-xs text-nexo-muted hover:text-nexo-text transition-colors disabled:opacity-40`}
          title={collapsed ? (syncing ? 'Sincronizando...' : 'Sincronizar') : undefined}
        >
          <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
          {!collapsed && (syncing ? 'Sincronizando...' : 'Sincronizar')}
        </button>
      </div>
    </div>
  )
}
