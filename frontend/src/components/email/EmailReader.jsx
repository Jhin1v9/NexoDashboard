import { useState, useEffect } from 'react'
import axios from 'axios'
import {
  Reply, ReplyAll, Forward, Archive, Trash2, AlertTriangle,
  Star, StarOff, MailOpen, MoreVertical, Download, Paperclip,
  Clock, User, Sparkles, X, ChevronDown, ChevronUp
} from 'lucide-react'
import EmailCompose from './EmailCompose'

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function EmailReader({ thread, onAction, onReplySent }) {
  const [expandedMessages, setExpandedMessages] = useState(new Set([0]))
  const [replyMode, setReplyMode] = useState(null) // 'reply', 'replyAll', 'forward'
  const [replyingTo, setReplyingTo] = useState(null)
  const [showMore, setShowMore] = useState(false)

  const messages = thread?.messages || []
  const firstMsg = messages[0]

  useEffect(() => {
    // Expandir a última mensagem por padrão
    if (messages.length > 0) {
      setExpandedMessages(new Set([messages.length - 1]))
    }
    setReplyMode(null)
  }, [thread?.id])

  const toggleMessage = (idx) => {
    setExpandedMessages((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const handleAction = async (action, messageId) => {
    try {
      await axios.post(`/api/email/messages/${messageId}/${action}`)
      onAction?.(action, messageId)
    } catch (e) {
      console.error(`Erro ao ${action}:`, e)
    }
  }

  const startReply = (mode, message) => {
    setReplyingTo(message)
    setReplyMode(mode)
  }

  const handleReplySent = () => {
    setReplyMode(null)
    setReplyingTo(null)
    onReplySent?.()
  }

  if (!thread || messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-nexo-muted">
        <div className="text-center">
          <MailOpen className="w-16 h-16 mx-auto mb-4 opacity-10" />
          <p className="text-sm">Selecione um email para visualizar</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header da thread */}
      <div className="p-4 border-b border-nexo-border">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-nexo-text leading-tight">
              {firstMsg.subject}
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {firstMsg.labelIds?.filter((l) => !['INBOX', 'UNREAD', 'SENT', 'IMPORTANT', 'STARRED'].includes(l)).map((label) => (
                <span key={label} className="text-[10px] px-2 py-0.5 rounded-full bg-nexo-bg border border-nexo-border text-nexo-muted">
                  {label}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => handleAction('archive', firstMsg.id)} className="p-2 rounded-lg text-nexo-muted hover:bg-nexo-bg hover:text-nexo-text transition-colors" title="Arquivar (e)">
              <Archive className="w-4 h-4" />
            </button>
            <button onClick={() => handleAction('trash', firstMsg.id)} className="p-2 rounded-lg text-nexo-muted hover:bg-nexo-bg hover:text-red-400 transition-colors" title="Lixeira (#)">
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={() => handleAction('spam', firstMsg.id)} className="p-2 rounded-lg text-nexo-muted hover:bg-nexo-bg hover:text-orange-400 transition-colors" title="Spam (!)">
              <AlertTriangle className="w-4 h-4" />
            </button>
            <button onClick={() => handleAction(firstMsg.isStarred ? 'unstar' : 'star', firstMsg.id)} className="p-2 rounded-lg text-nexo-muted hover:bg-nexo-bg transition-colors" title="Estrelar (s)">
              {firstMsg.isStarred ? (
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              ) : (
                <StarOff className="w-4 h-4" />
              )}
            </button>
            <div className="relative">
              <button onClick={() => setShowMore(!showMore)} className="p-2 rounded-lg text-nexo-muted hover:bg-nexo-bg transition-colors">
                <MoreVertical className="w-4 h-4" />
              </button>
              {showMore && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-nexo-card border border-nexo-border rounded-xl shadow-xl z-50 py-1">
                  <button onClick={() => { handleAction('unread', firstMsg.id); setShowMore(false) }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-nexo-muted hover:bg-nexo-bg hover:text-nexo-text transition-colors">
                    <MailOpen className="w-4 h-4" /> Marcar como não lido
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lista de mensagens */}
      <div className="flex-1 overflow-y-auto">
        {messages.map((msg, idx) => {
          const isExpanded = expandedMessages.has(idx)
          const fromName = msg.from?.match(/^([^<]+)/)?.[1]?.trim() || msg.from || 'Desconhecido'
          const fromEmail = msg.from?.match(/<([^>]+)>/)?.[1] || msg.from
          const date = msg.internalDate
            ? new Date(parseInt(msg.internalDate)).toLocaleString('pt-BR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
              })
            : ''

          return (
            <div key={msg.id} className={`border-b border-nexo-border/50 ${idx === messages.length - 1 ? '' : ''}`}>
              {/* Header da mensagem */}
              <button
                onClick={() => toggleMessage(idx)}
                className="w-full flex items-center gap-3 p-4 hover:bg-nexo-bg/30 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-full bg-nexo-primary/20 flex items-center justify-center text-nexo-primary text-xs font-bold flex-shrink-0">
                  {getInitials(fromName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-nexo-text">{fromName}</span>
                    <span className="text-xs text-nexo-muted">&lt;{fromEmail}&gt;</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-nexo-muted mt-0.5">
                    <span>Para: {msg.to}</span>
                    {msg.cc && <span>CC: {msg.cc}</span>}
                    <span className="ml-auto flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {date}
                    </span>
                  </div>
                </div>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-nexo-muted" /> : <ChevronDown className="w-4 h-4 text-nexo-muted" />}
              </button>

              {/* Corpo da mensagem */}
              {isExpanded && (
                <div className="px-4 pb-4">
                  {/* Anexos */}
                  {msg.attachments?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {msg.attachments.map((att, aIdx) => (
                        <div key={aIdx} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-nexo-bg border border-nexo-border text-xs">
                          <Paperclip className="w-3.5 h-3.5 text-nexo-muted" />
                          <span className="text-nexo-text truncate max-w-[150px]">{att.filename}</span>
                          <span className="text-nexo-muted">({Math.round((att.size || 0) / 1024)}KB)</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* HTML / Texto */}
                  {(() => {
                    const body = msg.body
                    if (typeof body === 'string') {
                      return <div className="prose prose-invert prose-sm max-w-none text-nexo-text" dangerouslySetInnerHTML={{ __html: body }} />
                    }
                    if (body?.html) {
                      return <div className="prose prose-invert prose-sm max-w-none text-nexo-text" dangerouslySetInnerHTML={{ __html: body.html }} />
                    }
                    return <pre className="whitespace-pre-wrap text-sm text-nexo-text font-sans">{body?.text || msg.snippet || '(sem conteúdo)'}</pre>
                  })()}

                  {/* Ações da mensagem */}
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-nexo-border/50">
                    <button
                      onClick={() => startReply('reply', msg)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-nexo-bg border border-nexo-border text-xs text-nexo-muted hover:text-nexo-text hover:border-nexo-primary/30 transition-colors"
                    >
                      <Reply className="w-3.5 h-3.5" /> Responder
                    </button>
                    <button
                      onClick={() => startReply('replyAll', msg)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-nexo-bg border border-nexo-border text-xs text-nexo-muted hover:text-nexo-text hover:border-nexo-primary/30 transition-colors"
                    >
                      <ReplyAll className="w-3.5 h-3.5" /> Responder a todos
                    </button>
                    <button
                      onClick={() => startReply('forward', msg)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-nexo-bg border border-nexo-border text-xs text-nexo-muted hover:text-nexo-text hover:border-nexo-primary/30 transition-colors"
                    >
                      <Forward className="w-3.5 h-3.5" /> Encaminhar
                    </button>
                    <button
                      onClick={() => startReply('luna', msg)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-nexo-primary/10 border border-nexo-primary/20 text-xs text-nexo-primary hover:bg-nexo-primary/20 transition-colors ml-auto"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Luna ✨
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Compose inline para resposta */}
        {replyMode && replyingTo && (
          <div className="p-4 border-t border-nexo-border">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-nexo-text">
                {replyMode === 'reply' && 'Responder'}
                {replyMode === 'replyAll' && 'Responder a todos'}
                {replyMode === 'forward' && 'Encaminhar'}
                {replyMode === 'luna' && 'Luna — Sugerir resposta'}
              </span>
              <button onClick={() => setReplyMode(null)} className="p-1 rounded-lg text-nexo-muted hover:bg-nexo-bg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <EmailCompose
              mode={replyMode}
              replyTo={replyingTo}
              threadId={thread.id}
              onSent={handleReplySent}
              onCancel={() => setReplyMode(null)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
