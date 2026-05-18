import {
  Mail, Send, Inbox, Star, Trash2, FileText,
  Archive, AlertTriangle, RefreshCw, Plus, Wifi, WifiOff,
  ChevronDown, ChevronRight, Tag
} from 'lucide-react'
import { useState } from 'react'

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
}) {
  const [showCustomLabels, setShowCustomLabels] = useState(false)
  const customLabels = labels.filter((l) => l.type === 'user')

  return (
    <div className="w-60 border-r border-nexo-border flex flex-col h-full bg-nexo-card/50">
      {/* Conta / Status */}
      <div className="p-3 border-b border-nexo-border">
        {connected && userProfile?.email ? (
          <div className="flex items-center gap-2">
            <img
              src={userProfile.picture || '/default-avatar.png'}
              alt=""
              className="w-8 h-8 rounded-full border border-nexo-border"
              onError={(e) => { e.target.src = 'https://ui-avatars.com/api/?name=N+D&background=1A56DB&color=fff' }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{userProfile.name || userProfile.email}</p>
              <p className="text-[10px] text-nexo-muted truncate">{userProfile.email}</p>
            </div>
            <Wifi className="w-3.5 h-3.5 text-green-400" />
          </div>
        ) : (
          <button
            onClick={onConnect}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-nexo-primary/10 border border-nexo-primary/20 text-nexo-primary text-xs font-medium hover:bg-nexo-primary/20 transition-colors"
          >
            <WifiOff className="w-3.5 h-3.5" />
            Conectar Gmail
          </button>
        )}
      </div>

      {/* Compor */}
      <div className="p-3">
        <button
          onClick={onCompose}
          className="w-full flex items-center justify-center gap-2 bg-nexo-primary hover:opacity-90 text-white py-2.5 px-4 rounded-xl font-medium transition-opacity text-sm shadow-lg shadow-nexo-primary/20"
        >
          <Plus className="w-4 h-4" /> Compor
        </button>
      </div>

      {/* Labels do sistema */}
      <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
        {SYSTEM_LABELS.map((item) => {
          const isActive = activeLabel === item.id
          const unread = unreadCounts[item.id] || 0
          return (
            <button
              key={item.id}
              onClick={() => onLabelChange(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-nexo-primary/15 text-nexo-primary font-medium'
                  : 'text-nexo-muted hover:text-nexo-text hover:bg-nexo-bg'
              }`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {unread > 0 && (
                <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full font-bold">
                  {unread}
                </span>
              )}
            </button>
          )
        })}

        {/* Labels customizadas */}
        {customLabels.length > 0 && (
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
      <div className="p-3 border-t border-nexo-border">
        <button
          onClick={onSync}
          disabled={syncing || !connected}
          className="w-full flex items-center justify-center gap-2 py-2 text-xs text-nexo-muted hover:text-nexo-text transition-colors disabled:opacity-40"
        >
          <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Sincronizando...' : 'Sincronizar'}
        </button>
      </div>
    </div>
  )
}
