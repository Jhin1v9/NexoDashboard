import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import {
  Search, X, Loader2, Mail, Plus, Sparkles
} from 'lucide-react'
import EmailSidebar from '../components/email/EmailSidebar'
import EmailList from '../components/email/EmailList'
import EmailReader from '../components/email/EmailReader'
import EmailCompose from '../components/email/EmailCompose'
import LunaEmailAssistant from '../components/email/LunaEmailAssistant'
import { useGmailAuth } from '../hooks/useGmailAuth'
import { useEmailShortcuts } from '../hooks/useEmailShortcuts'

export default function EmailHub() {
  const { status: authStatus, connect, disconnect, refresh: refreshAuth } = useGmailAuth()

  const [emails, setEmails] = useState([])
  const [selectedThread, setSelectedThread] = useState(null)
  const [selectedEmailId, setSelectedEmailId] = useState(null)
  const [activeLabel, setActiveLabel] = useState('INBOX')
  const [labels, setLabels] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [showCompose, setShowCompose] = useState(false)
  const [showLuna, setShowLuna] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [unreadCounts, setUnreadCounts] = useState({})
  const searchInputRef = useRef(null)

  // Buscar emails
  const fetchEmails = useCallback(async () => {
    if (!authStatus.connected) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('labelIds', activeLabel)
      params.append('maxResults', '50')
      if (search) params.append('q', search)

      const res = await axios.get(`/api/email/messages?${params.toString()}`)
      if (res.data.success) {
        setEmails(res.data.messages || [])
        setHasMore(!!res.data.nextPageToken)
      }
    } catch (e) {
      console.error('Erro ao buscar emails:', e)
    } finally {
      setLoading(false)
    }
  }, [authStatus.connected, activeLabel, search])

  // Buscar labels
  const fetchLabels = useCallback(async () => {
    if (!authStatus.connected) return
    try {
      const res = await axios.get('/api/email/labels')
      if (res.data.success) {
        setLabels(res.data.labels)
        // Calcular unread counts por label
        const counts = {}
        for (const label of res.data.labels) {
          if (label.messagesUnread) {
            counts[label.id] = label.messagesUnread
          }
        }
        setUnreadCounts(counts)
      }
    } catch (e) {
      console.error('Erro ao buscar labels:', e)
    }
  }, [authStatus.connected])

  // Buscar thread
  const fetchThread = useCallback(async (threadId) => {
    try {
      const res = await axios.get(`/api/email/threads/${threadId}`)
      if (res.data.success) {
        setSelectedThread(res.data.thread)
        // Marcar como lido ao abrir
        const firstUnread = res.data.thread.messages?.find((m) => m.isUnread)
        if (firstUnread) {
          await axios.post(`/api/email/messages/${firstUnread.id}/read`)
          setEmails((prev) =>
            prev.map((e) =>
              e.threadId === threadId || e.id === firstUnread.id
                ? { ...e, isUnread: false, labelIds: e.labelIds?.filter((l) => l !== 'UNREAD') }
                : e
            )
          )
        }
      }
    } catch (e) {
      console.error('Erro ao buscar thread:', e)
    }
  }, [])

  // Sincronizar
  const handleSync = async () => {
    if (!authStatus.connected) return
    setSyncing(true)
    try {
      await fetchEmails()
      await fetchLabels()
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    if (authStatus.connected) {
      fetchEmails()
      fetchLabels()
    }
  }, [authStatus.connected, activeLabel, search, fetchEmails, fetchLabels])

  // Atalhos de teclado
  useEmailShortcuts({
    enabled: !showCompose && !showLuna,
    onCompose: () => setShowCompose(true),
    onReply: () => {
      // Implementar resposta com email selecionado
    },
    onArchive: async () => {
      if (selectedEmailId) {
        await axios.post(`/api/email/messages/${selectedEmailId}/archive`)
        setEmails((prev) => prev.filter((e) => e.id !== selectedEmailId))
        setSelectedEmailId(null)
        setSelectedThread(null)
      }
    },
    onTrash: async () => {
      if (selectedEmailId) {
        await axios.post(`/api/email/messages/${selectedEmailId}/trash`)
        setEmails((prev) => prev.filter((e) => e.id !== selectedEmailId))
        setSelectedEmailId(null)
        setSelectedThread(null)
      }
    },
    onStar: async () => {
      if (selectedEmailId) {
        const email = emails.find((e) => e.id === selectedEmailId)
        if (email) {
          await axios.post(`/api/email/messages/${selectedEmailId}/${email.isStarred ? 'unstar' : 'star'}`)
          setEmails((prev) =>
            prev.map((e) =>
              e.id === selectedEmailId ? { ...e, isStarred: !e.isStarred } : e
            )
          )
        }
      }
    },
    onFocusSearch: () => searchInputRef.current?.focus(),
  })

  const handleSelectEmail = async (email) => {
    setSelectedEmailId(email.id)
    if (email.threadId) {
      await fetchThread(email.threadId)
    } else {
      // Email sem thread, buscar diretamente
      try {
        const res = await axios.get(`/api/email/messages/${email.id}`)
        if (res.data.success) {
          setSelectedThread({ id: email.id, messages: [res.data.message] })
        }
      } catch (e) {
        console.error('Erro:', e)
      }
    }
  }

  const handleStar = async (id, starred) => {
    try {
      await axios.post(`/api/email/messages/${id}/${starred ? 'star' : 'unstar'}`)
      setEmails((prev) =>
        prev.map((e) => (e.id === id ? { ...e, isStarred: starred } : e))
      )
    } catch (e) {
      console.error('Erro ao estrelar:', e)
    }
  }

  const handleAction = async (action, messageId) => {
    if (action === 'archive') {
      setEmails((prev) => prev.filter((e) => e.id !== messageId))
      setSelectedThread(null)
      setSelectedEmailId(null)
    }
    // Recarregar lista
    await fetchEmails()
  }

  const handleReplySent = () => {
    fetchEmails()
    if (selectedThread?.id) {
      fetchThread(selectedThread.id)
    }
  }

  const handlePageChange = (newPage) => {
    setPage(newPage)
    fetchEmails()
  }

  // Tela de não conectado
  if (!authStatus.loading && !authStatus.connected) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <div className="text-center max-w-md p-8 glass-card rounded-2xl">
          <Mail className="w-16 h-16 mx-auto mb-4 text-nexo-primary opacity-30" />
          <h2 className="text-xl font-bold mb-2">Conectar Gmail</h2>
          <p className="text-sm text-nexo-muted mb-6">
            Conecte sua conta do Gmail para gerenciar emails diretamente do NEXO Dashboard.
          </p>
          <button
            onClick={connect}
            className="flex items-center justify-center gap-2 mx-auto px-6 py-3 bg-nexo-primary hover:opacity-90 text-white rounded-xl font-medium transition-opacity"
          >
            <Mail className="w-5 h-5" />
            Conectar com Google
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-80px)] glass-card rounded-xl border border-nexo-border overflow-hidden">
      {/* Sidebar */}
      <EmailSidebar
        activeLabel={activeLabel}
        onLabelChange={(label) => { setActiveLabel(label); setSelectedEmailId(null); setSelectedThread(null); setPage(1) }}
        labels={labels}
        onCompose={() => setShowCompose(true)}
        onSync={handleSync}
        syncing={syncing}
        connected={authStatus.connected}
        onConnect={connect}
        userProfile={authStatus}
        unreadCounts={unreadCounts}
      />

      {/* Lista de emails */}
      <div className="w-80 border-r border-nexo-border flex flex-col">
        {/* Barra de busca */}
        <div className="p-3 border-b border-nexo-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nexo-muted" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar emails..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-nexo-bg border border-nexo-border rounded-lg text-sm text-nexo-text placeholder-nexo-muted focus:outline-none focus:border-nexo-primary"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-nexo-muted hover:text-nexo-text"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {/* Filtros rápidos */}
          <div className="flex gap-2 mt-2">
            {['Todos', 'Não Lidos', 'Com Anexo'].map((f) => (
              <button
                key={f}
                onClick={() => {
                  if (f === 'Não Lidos') setSearch('is:unread')
                  else if (f === 'Com Anexo') setSearch('has:attachment')
                  else setSearch('')
                }}
                className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                  (f === 'Todos' && !search) ||
                  (f === 'Não Lidos' && search === 'is:unread') ||
                  (f === 'Com Anexo' && search === 'has:attachment')
                    ? 'bg-nexo-primary/20 text-nexo-primary border border-nexo-primary/30'
                    : 'text-nexo-muted hover:text-nexo-text'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <EmailList
          emails={emails}
          selectedId={selectedEmailId}
          onSelect={handleSelectEmail}
          onStar={handleStar}
          loading={loading}
          page={page}
          hasMore={hasMore}
          onPageChange={handlePageChange}
        />
      </div>

      {/* Leitor / Compose */}
      <div className="flex-1 flex flex-col min-w-0">
        {showCompose ? (
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-nexo-border">
              <h3 className="font-bold text-sm">Novo Email</h3>
              <button
                onClick={() => setShowCompose(false)}
                className="p-1.5 rounded-lg text-nexo-muted hover:bg-nexo-bg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <EmailCompose onSent={() => { setShowCompose(false); fetchEmails() }} onCancel={() => setShowCompose(false)} />
            </div>
          </div>
        ) : (
          <EmailReader
            thread={selectedThread}
            onAction={handleAction}
            onReplySent={handleReplySent}
          />
        )}
      </div>

      {/* Luna Assistant Modal */}
      {showLuna && selectedThread && (
        <LunaEmailAssistant
          threadMessages={selectedThread.messages}
          onApplyDraft={(text) => {
            // Abrir compose com o rascunho
            setShowCompose(true)
          }}
          onClose={() => setShowLuna(false)}
        />
      )}
    </div>
  )
}
