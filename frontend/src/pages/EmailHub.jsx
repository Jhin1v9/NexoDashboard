import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import {
  Search, X, Mail, PanelRightOpen, PanelRightClose,
  AlignJustify, LayoutList, LayoutTemplate
} from 'lucide-react'
import EmailSidebar from '../components/email/EmailSidebar'
import EmailList from '../components/email/EmailList'
import EmailReader from '../components/email/EmailReader'
import EmailCompose from '../components/email/EmailCompose'
import LunaEmailAssistant from '../components/email/LunaEmailAssistant'
import ResizablePanel from '../components/email/ResizablePanel'
import { useGmailAuth } from '../hooks/useGmailAuth'
import { useEmailShortcuts } from '../hooks/useEmailShortcuts'
import { useEmailFocusMode } from '../context/EmailFocusModeContext'
import { useEmailDensity } from '../context/EmailDensityContext'

export default function EmailHub() {
  const { isFocusMode, toggleFocusMode } = useEmailFocusMode()
  const { density, setDensity } = useEmailDensity()
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
        const counts = {}
        for (const label of res.data.labels) {
          if (label.messagesUnread) counts[label.id] = label.messagesUnread
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
    onReply: () => {},
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
    await fetchEmails()
  }

  const handleReplySent = () => {
    fetchEmails()
    if (selectedThread?.id) fetchThread(selectedThread.id)
  }

  const handlePageChange = (newPage) => {
    setPage(newPage)
    fetchEmails()
  }

  const containerClass = isFocusMode
    ? 'fixed inset-0 z-50 bg-nexo-bg flex overflow-hidden'
    : 'flex h-[calc(100vh-80px)] glass-card rounded-xl border border-nexo-border overflow-hidden'

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
    <div className={containerClass}>
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
        onFocusMode={toggleFocusMode}
        isFocusMode={isFocusMode}
      />

      {/* Lista de emails — redimensionável */}
      <ResizablePanel
        defaultWidth={320}
        minWidth={240}
        maxWidth={500}
        storageKey="nexo-email-list-width"
        side="right"
      >
        <div className="h-full flex flex-col border-r border-nexo-border">
          {/* Barra de busca + controles */}
          <div className="p-3 border-b border-nexo-border space-y-2">
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
            <div className="flex items-center justify-between">
              {/* Filtros rápidos */}
              <div className="flex gap-1.5">
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
              {/* Densidade */}
              <div className="flex items-center gap-0.5">
                {[
                  { key: 'compact', icon: AlignJustify, label: 'Compacto' },
                  { key: 'normal', icon: LayoutList, label: 'Normal' },
                  { key: 'comfortable', icon: LayoutTemplate, label: 'Confortável' },
                ].map(({ key, icon: Icon, label }) => (
                  <button
                    key={key}
                    onClick={() => setDensity(key)}
                    className={`p-1 rounded-md transition-colors ${
                      density === key
                        ? 'bg-nexo-primary/20 text-nexo-primary'
                        : 'text-nexo-muted hover:text-nexo-text hover:bg-nexo-bg'
                    }`}
                    title={label}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
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
            density={density}
          />
        </div>
      </ResizablePanel>

      {/* Leitor / Compose */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {showCompose ? (
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-nexo-border">
              <h3 className="font-bold text-sm">Novo Email</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowLuna(!showLuna)}
                  className={`p-1.5 rounded-lg transition-colors ${showLuna ? 'text-nexo-primary bg-nexo-primary/10' : 'text-nexo-muted hover:bg-nexo-bg'}`}
                  title="Luna Assistant"
                >
                  {showLuna ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setShowCompose(false)}
                  className="p-1.5 rounded-lg text-nexo-muted hover:bg-nexo-bg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <EmailCompose onSent={() => { setShowCompose(false); fetchEmails() }} onCancel={() => setShowCompose(false)} />
            </div>
          </div>
        ) : (
          <>
            {/* Header do leitor com botão Luna */}
            <div className="absolute top-3 right-3 z-10">
              <button
                onClick={() => setShowLuna(!showLuna)}
                className={`p-1.5 rounded-lg transition-colors ${showLuna ? 'text-nexo-primary bg-nexo-primary/10' : 'text-nexo-muted hover:bg-nexo-bg'}`}
                title="Luna Assistant"
              >
                {showLuna ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
              </button>
            </div>
            <EmailReader
              thread={selectedThread}
              onAction={handleAction}
              onReplySent={handleReplySent}
            />
          </>
        )}
      </div>

      {/* Luna — painel lateral fixo */}
      {showLuna && (
        <div className="w-80 border-l border-nexo-border bg-nexo-card/30 flex flex-col flex-shrink-0">
          <div className="flex items-center justify-between p-3 border-b border-nexo-border">
            <h3 className="text-sm font-bold text-nexo-primary flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Luna
            </h3>
            <button
              onClick={() => setShowLuna(false)}
              className="p-1 rounded-lg text-nexo-muted hover:bg-nexo-bg transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <LunaEmailAssistant
              threadMessages={selectedThread?.messages || []}
              onApplyDraft={(text) => {
                setShowCompose(true)
              }}
              onClose={() => setShowLuna(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
