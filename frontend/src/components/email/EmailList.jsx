import React from 'react'
import {
  Mail, Paperclip, Star, StarOff, AlertTriangle,
  CheckCircle, Clock, ChevronLeft, ChevronRight
} from 'lucide-react'

function getInitials(name) {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function getAvatarColor(email) {
  const colors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
    'bg-rose-500', 'bg-cyan-500', 'bg-orange-500', 'bg-pink-500'
  ]
  let hash = 0
  for (let i = 0; i < email.length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function formatRelativeTime(internalDate) {
  if (!internalDate) return ''
  const date = new Date(parseInt(internalDate))
  const now = new Date()
  const diff = now - date
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Agora'
  if (minutes < 60) return `${minutes}min`
  if (hours < 24) return `${hours}h`
  if (days < 2) return 'Ontem'
  if (days < 7) return `${days}d`
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

const densityStyles = {
  compact: {
    itemPadding: 'p-2',
    avatarSize: 'w-8 h-8',
    fromSize: 'text-xs',
    subjectSize: 'text-xs',
    snippetSize: 'text-[10px]',
    timeSize: 'text-[10px]',
    gap: 'gap-2',
  },
  normal: {
    itemPadding: 'p-3',
    avatarSize: 'w-10 h-10',
    fromSize: 'text-sm',
    subjectSize: 'text-sm',
    snippetSize: 'text-xs',
    timeSize: 'text-[10px]',
    gap: 'gap-3',
  },
  comfortable: {
    itemPadding: 'p-4',
    avatarSize: 'w-10 h-10',
    fromSize: 'text-sm',
    subjectSize: 'text-sm',
    snippetSize: 'text-xs',
    timeSize: 'text-xs',
    gap: 'gap-3',
  },
}

export default function EmailList({
  emails,
  selectedId,
  onSelect,
  onStar,
  loading,
  page,
  hasMore,
  onPageChange,
  density = 'normal',
}) {
  const ds = densityStyles[density] || densityStyles.normal
  if (loading && emails.length === 0) {
    return (
      <div className="flex-1 p-4 space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="animate-pulse flex gap-3 p-3 rounded-lg">
            <div className="w-10 h-10 rounded-full bg-nexo-border" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-nexo-border rounded w-3/4" />
              <div className="h-2.5 bg-nexo-border rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (emails.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-nexo-muted p-8">
        <Mail className="w-12 h-12 mb-3 opacity-20" />
        <p className="text-sm">Nenhum email encontrado</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {emails.map((email) => {
          const fromName = email.from?.match(/^([^<]+)/)?.[1]?.trim() || email.from || 'Desconhecido'
          const fromEmail = email.from?.match(/<([^>]+)>/)?.[1] || email.from
          const isSelected = selectedId === email.id

          return (
            <div
              key={email.id}
              onClick={() => onSelect(email)}
              className={`group flex items-start ${ds.gap} ${ds.itemPadding} cursor-pointer border-b border-nexo-border/50 transition-all hover:bg-nexo-bg/50 ${
                isSelected ? 'bg-nexo-primary/10 border-l-2 border-l-nexo-primary' : ''
              } ${email.isUnread ? 'bg-nexo-card' : ''}`}
            >
              {/* Checkbox + Estrela */}
              <div className="flex flex-col items-center gap-1 pt-0.5">
                <button
                  onClick={(e) => { e.stopPropagation(); onStar?.(email.id, !email.isStarred) }}
                  className={`opacity-0 group-hover:opacity-100 transition-opacity ${
                    email.isStarred ? 'opacity-100' : ''
                  }`}
                >
                  {email.isStarred ? (
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ) : (
                    <StarOff className="w-4 h-4 text-nexo-muted" />
                  )}
                </button>
              </div>

              {/* Avatar */}
              <div className={`${ds.avatarSize} rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${getAvatarColor(fromEmail)}`}>
                {getInitials(fromName)}
              </div>

              {/* Conteúdo */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`${ds.fromSize} truncate ${email.isUnread ? 'font-bold text-nexo-text' : 'text-nexo-muted'}`}>
                    {fromName}
                  </span>
                  {email.isUnread && <span className="w-2 h-2 rounded-full bg-nexo-primary flex-shrink-0" />}
                  {email.isImportant && <AlertTriangle className="w-3 h-3 text-orange-400 flex-shrink-0" />}
                  <span className={`${ds.timeSize} text-nexo-muted ml-auto flex-shrink-0`}>
                    {formatRelativeTime(email.internalDate)}
                  </span>
                </div>
                <p className={`${ds.subjectSize} truncate ${email.isUnread ? 'font-semibold text-nexo-text' : 'text-nexo-muted'}`}>
                  {email.subject}
                </p>
                <p className={`${ds.snippetSize} text-nexo-muted truncate mt-0.5`}>
                  {email.snippet}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {email.attachments?.length > 0 && (
                    <Paperclip className="w-3 h-3 text-nexo-muted" />
                  )}
                  {email.labels?.filter((l) => !['INBOX', 'UNREAD', 'SENT', 'IMPORTANT'].includes(l)).map((label) => (
                    <span key={label} className="text-[9px] px-1.5 py-0.5 rounded bg-nexo-bg text-nexo-muted border border-nexo-border">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Paginação */}
      {(page > 1 || hasMore) && (
        <div className="p-2 border-t border-nexo-border flex items-center justify-between">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="p-1.5 rounded-lg text-nexo-muted hover:bg-nexo-bg disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-nexo-muted">Página {page}</span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={!hasMore}
            className="p-1.5 rounded-lg text-nexo-muted hover:bg-nexo-bg disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
