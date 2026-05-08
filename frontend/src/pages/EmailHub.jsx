import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail, Send, Inbox, Star, Trash2, Paperclip, Search,
  RefreshCw, Plus, X, FileText, AlertCircle, CheckCircle,
  Clock, User, ChevronLeft, ChevronRight
} from 'lucide-react'
import axios from 'axios'

export default function EmailHub() {
  const [emails, setEmails] = useState([])
  const [selectedEmail, setSelectedEmail] = useState(null)
  const [folder, setFolder] = useState('INBOX')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const [showCompose, setShowCompose] = useState(false)
  const [stats, setStats] = useState({ total: 0, unread: 0 })

  const fetchEmails = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('folder', folder)
      if (search) params.append('search', search)
      if (filter === 'unread') params.append('isRead', 'false')
      const res = await axios.get(`/api/emails?${params.toString()}`)
      if (res.data.success) {
        setEmails(res.data.emails)
        setStats(res.data.stats)
      }
    } catch (e) {
      console.error('Erro ao buscar emails:', e)
    } finally {
      setLoading(false)
    }
  }, [folder, search, filter])

  const handleSync = async () => {
    try {
      setLoading(true)
      await axios.post('/api/emails/sync')
      await fetchEmails()
    } catch (e) {
      console.error('Erro ao sincronizar:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchEmails() }, [fetchEmails])

  return (
    <div className="flex h-[600px] glass-card rounded-xl border border-nexo-border overflow-hidden">
      {/* SIDEBAR DE PASTAS */}
      <div className="w-56 border-r border-nexo-border flex flex-col">
        <div className="p-3">
          <button onClick={() => setShowCompose(true)} className="w-full flex items-center justify-center gap-2 bg-nexo-primary hover:opacity-90 text-white py-2.5 px-4 rounded-xl font-medium transition-opacity text-sm">
            <Plus className="w-4 h-4" /> Compor
          </button>
        </div>
        <nav className="flex-1 px-2 space-y-0.5">
          <FolderButton icon={Inbox} label="Caixa de Entrada" count={stats.unread} active={folder === 'INBOX'} onClick={() => setFolder('INBOX')} />
          <FolderButton icon={Send} label="Enviados" active={folder === 'Sent'} onClick={() => setFolder('Sent')} />
          <FolderButton icon={Star} label="Favoritos" active={folder === 'Starred'} onClick={() => setFolder('Starred')} />
          <FolderButton icon={Trash2} label="Lixeira" active={folder === 'Trash'} onClick={() => setFolder('Trash')} />
        </nav>
        <div className="p-3 border-t border-nexo-border">
          <button onClick={handleSync} className="w-full flex items-center justify-center gap-2 py-2 text-xs text-nexo-muted hover:text-nexo-text transition-colors">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Sincronizar
          </button>
        </div>
      </div>

      {/* LISTA DE EMAILS */}
      <div className="w-80 border-r border-nexo-border flex flex-col">
        <div className="p-3 border-b border-nexo-border">
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nexo-muted" />
            <input type="text" placeholder="Buscar emails..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-nexo-bg border border-nexo-border rounded-lg text-sm text-nexo-text placeholder-nexo-muted focus:outline-none focus:border-nexo-primary" />
          </div>
          <div className="flex gap-2">
            {['all', 'unread', 'attachments'].map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`px-2 py-1 rounded-lg text-xs transition-colors ${filter === f ? 'bg-nexo-primary/20 text-nexo-primary border border-nexo-primary/30' : 'text-nexo-muted hover:text-nexo-text'}`}>
                {f === 'all' && 'Todos'}
                {f === 'unread' && 'Nao Lidos'}
                {f === 'attachments' && 'Com Anexo'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-nexo-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            emails.map(email => (
              <EmailListItem key={email.id} email={email} selected={selectedEmail?.id === email.id} onClick={() => setSelectedEmail(email)} />
            ))
          )}
          {!loading && emails.length === 0 && (
            <div className="text-center py-8 text-nexo-muted text-sm">
              <Mail className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Nenhum email</p>
            </div>
          )}
        </div>
      </div>

      {/* CONTEÚDO DO EMAIL */}
      <div className="flex-1 flex flex-col">
        {selectedEmail ? (
          <>
            <div className="p-4 border-b border-nexo-border flex items-start justify-between">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold truncate">{selectedEmail.subject}</h2>
                <div className="flex items-center gap-2 mt-1 text-sm text-nexo-muted">
                  <span>De: {selectedEmail.from}</span>
                </div>
                <span className="text-xs text-nexo-muted">{selectedEmail.date ? new Date(selectedEmail.date).toLocaleString('pt-BR') : ''}</span>
              </div>
            </div>
            <div className="flex-1 p-4 overflow-y-auto">
              <div className="prose prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{ __html: selectedEmail.html || `<pre class="whitespace-pre-wrap">${selectedEmail.text || ''}</pre>` }} />
              {selectedEmail.attachments?.length > 0 && (
                <div className="mt-6 pt-4 border-t border-nexo-border">
                  <h3 className="text-sm font-medium text-nexo-muted mb-3 flex items-center gap-2">
                    <Paperclip className="w-4 h-4" /> Anexos ({selectedEmail.attachments.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedEmail.attachments.map((att, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 bg-nexo-bg border border-nexo-border rounded-lg">
                        <FileText className="w-4 h-4 text-nexo-primary" />
                        <span className="text-sm">{att.filename}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-nexo-muted">
            <div className="text-center">
              <Mail className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>Selecione um email para visualizar</p>
            </div>
          </div>
        )}
      </div>

      {/* MODAL COMPOR */}
      <AnimatePresence>
        {showCompose && <ComposeModal onClose={() => setShowCompose(false)} onSent={fetchEmails} />}
      </AnimatePresence>
    </div>
  )
}

function FolderButton({ icon: Icon, label, count, active, onClick }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${active ? 'bg-nexo-primary/10 text-nexo-primary' : 'text-nexo-muted hover:text-nexo-text hover:bg-nexo-card'}`}>
      <Icon className="w-4 h-4" />
      <span className="flex-1 text-left">{label}</span>
      {count > 0 && <span className="px-2 py-0.5 bg-nexo-primary text-white text-xs rounded-full">{count}</span>}
    </button>
  )
}

function EmailListItem({ email, selected, onClick }) {
  return (
    <button onClick={onClick} className={`w-full text-left p-3 border-b border-nexo-border transition-colors ${selected ? 'bg-nexo-primary/5 border-l-2 border-l-nexo-primary' : 'hover:bg-nexo-card'} ${!email.isRead ? 'bg-nexo-card' : ''}`}>
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${email.isRead ? 'bg-nexo-border text-nexo-muted' : 'bg-nexo-primary/20 text-nexo-primary'}`}>
          {(email.from?.match(/([^<]+)/)?.[1] || '?')[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm truncate ${!email.isRead ? 'font-semibold text-nexo-text' : 'text-nexo-muted'}`}>{email.from?.match(/([^<]+)/)?.[1] || email.from}</span>
            {email.attachments?.length > 0 && <Paperclip className="w-3 h-3 text-nexo-muted flex-shrink-0" />}
          </div>
          <p className={`text-sm truncate ${!email.isRead ? 'text-nexo-text' : 'text-nexo-muted'}`}>{email.subject}</p>
          <p className="text-xs text-nexo-muted truncate mt-0.5">{(email.text || '').substring(0, 80)}...</p>
        </div>
        <span className="text-xs text-nexo-muted flex-shrink-0">{email.date ? new Date(email.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : ''}</span>
      </div>
    </button>
  )
}

function ComposeModal({ onClose, onSent }) {
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    if (!to.trim() || !subject.trim()) return
    setSending(true)
    try {
      await axios.post('/api/emails/send', { to: to.split(',').map(e => e.trim()), subject, text: body, html: `<pre>${body}</pre>` })
      onSent()
      onClose()
    } catch (e) {
      alert('Erro ao enviar: ' + e.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-2xl bg-nexo-card border border-nexo-border rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-nexo-border flex items-center justify-between">
          <h3 className="font-semibold">Novo Email</h3>
          <button onClick={onClose} className="text-nexo-muted hover:text-nexo-text"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3">
          <input type="text" placeholder="Para" value={to} onChange={(e) => setTo(e.target.value)} className="w-full px-3 py-2 bg-nexo-bg border border-nexo-border rounded-lg text-nexo-text placeholder-nexo-muted focus:outline-none focus:border-nexo-primary" />
          <input type="text" placeholder="Assunto" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full px-3 py-2 bg-nexo-bg border border-nexo-border rounded-lg text-nexo-text placeholder-nexo-muted focus:outline-none focus:border-nexo-primary" />
          <textarea placeholder="Mensagem..." value={body} onChange={(e) => setBody(e.target.value)} rows={8} className="w-full px-3 py-2 bg-nexo-bg border border-nexo-border rounded-lg text-nexo-text placeholder-nexo-muted focus:outline-none focus:border-nexo-primary resize-none" />
        </div>
        <div className="p-4 border-t border-nexo-border flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-nexo-muted hover:text-nexo-text transition-colors text-sm">Cancelar</button>
          <button onClick={handleSend} disabled={sending || !to || !subject} className="px-4 py-2 bg-nexo-primary hover:opacity-90 disabled:opacity-50 text-white rounded-lg transition-opacity flex items-center gap-2 text-sm">
            <Send className="w-4 h-4" /> {sending ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
