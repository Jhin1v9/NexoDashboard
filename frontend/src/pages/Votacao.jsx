import { useState, useEffect, useCallback, useRef } from 'react'
import { useVoting } from '../hooks/useVoting'
import useWebSocket from '../hooks/useWebSocket'
import VotingSessionList from '../components/voting/VotingSessionList'
import VotingCreateModal from '../components/voting/VotingCreateModal'
import VotingStatsPanel from '../components/voting/VotingStatsPanel'
import VotingFilterPanel from '../components/voting/VotingFilterPanel'
import { Vote, Search, RefreshCw, BarChart3 } from 'lucide-react'

const CURRENT_USER = localStorage.getItem('voting_user') || 'abner'

export default function Votacao() {
  const voting = useVoting()
  const { lastMessage } = useWebSocket()
  const [activeFilter, setActiveFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCollapsed, setFilterCollapsed] = useState(false)
  const createBtnRef = useRef(null)

  useEffect(() => {
    if (!lastMessage) return
    if (lastMessage.type === 'voting:session:new' || lastMessage.type === 'voting:session:updated' || lastMessage.type === 'voting:session:deleted') {
      voting.fetchSessions()
      voting.fetchStats()
    }
  }, [lastMessage])

  useEffect(() => {
    const timer = setTimeout(() => {
      const newFilters = { ...voting.filters, search: searchQuery || undefined }
      voting.setFilters(newFilters)
      voting.fetchSessions(1, newFilters)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const handleFilterChange = useCallback((key) => {
    setActiveFilter(key)
    const newFilters = { ...voting.filters }
    if (key === 'open') {
      newFilters.status = undefined
      newFilters.createdBy = undefined
    } else if (key === 'approved') {
      newFilters.status = 'approved'
    } else if (key === 'rejected') {
      newFilters.status = 'rejected'
    } else {
      newFilters.status = undefined
      newFilters.createdBy = undefined
    }
    voting.setFilters(newFilters)
    voting.fetchSessions(1, newFilters)
  }, [voting.filters])

  const handleVote = useCallback(async (sessionId, voteValue) => {
    try {
      await voting.vote(sessionId, voteValue)
      voting.fetchStats()
    } catch (err) {
      console.error('Vote error:', err)
    }
  }, [])

  const handleDelete = useCallback(async (sessionId) => {
    if (!confirm('Tem certeza que deseja cancelar esta votação?')) return
    try {
      await voting.deleteSession(sessionId)
      voting.fetchStats()
    } catch (err) {
      console.error('Delete error:', err)
    }
  }, [])

  const handleUpdate = useCallback(async (sessionId, data) => {
    try {
      await voting.updateSession(sessionId, data)
      voting.fetchStats()
    } catch (err) {
      console.error('Update error:', err)
    }
  }, [])

  const handleCreate = useCallback(async (data) => {
    await voting.createSession(data)
    voting.fetchStats()
  }, [])

  const filteredSessions = voting.sessions.filter(s => {
    if (activeFilter === 'open') return s.status === 'open' || s.status === 'voting'
    if (activeFilter === 'approved') return s.status === 'approved'
    if (activeFilter === 'rejected') return s.status === 'rejected'
    return true
  })

  return (
    <div className="flex h-full">
      {/* Painel de filtros lateral */}
      <div className="hidden md:flex border-r border-nexo-border">
        <VotingFilterPanel
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
          onCreateVoting={() => createBtnRef.current?.click()}
          stats={voting.stats}
          collapsed={filterCollapsed}
          onToggleCollapse={() => setFilterCollapsed(!filterCollapsed)}
        />
      </div>

      {/* Conteúdo principal */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 glass flex items-center justify-between px-4 border-b border-nexo-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-nexo-info/10 flex items-center justify-center">
              <Vote className="w-4 h-4 text-nexo-info" />
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-none">Votações</h1>
              <p className="text-[10px] text-nexo-muted mt-0.5">Governança NEXO</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-48 sm:w-64 hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nexo-muted" />
              <input
                placeholder="Buscar votações..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 h-8 rounded-lg bg-nexo-card border border-nexo-border text-sm text-nexo-text placeholder-nexo-muted focus:outline-none focus:border-nexo-info transition-colors"
              />
            </div>
            <button
              onClick={() => voting.fetchSessions()}
              className="p-2 rounded-lg border border-nexo-border text-nexo-muted hover:text-white hover:bg-nexo-card transition-colors"
              title="Atualizar"
            >
              <RefreshCw className={`w-4 h-4 ${voting.loading && 'animate-spin'}`} />
            </button>
            <div id="voting-create-btn-wrapper">
              <VotingCreateModal onCreate={handleCreate}>
                <button ref={createBtnRef} className="btn-primary flex items-center gap-1.5 text-sm">
                  <BarChart3 className="w-4 h-4" />
                  Nova
                </button>
              </VotingCreateModal>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {voting.stats && <VotingStatsPanel stats={voting.stats} />}

          {/* Filtros mobile */}
          <div className="flex md:hidden gap-2 overflow-x-auto pb-2">
            {[
              { key: 'all', label: 'Todas' },
              { key: 'open', label: 'Abertas' },
              { key: 'approved', label: 'Aprovadas' },
              { key: 'rejected', label: 'Rejeitadas' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => handleFilterChange(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap border transition-colors ${
                  activeFilter === f.key
                    ? 'bg-nexo-info/10 text-nexo-info border-nexo-info/30'
                    : 'bg-nexo-card text-nexo-muted border-nexo-border'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <VotingSessionList
            sessions={filteredSessions}
            currentUser={CURRENT_USER}
            loading={voting.loading}
            onVote={handleVote}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
          />

          {voting.pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                className="px-3 py-1.5 rounded-lg border border-nexo-border text-sm text-nexo-muted hover:text-white hover:bg-nexo-card transition-colors disabled:opacity-50"
                disabled={voting.pagination.page <= 1}
                onClick={() => voting.fetchSessions(voting.pagination.page - 1)}
              >
                Anterior
              </button>
              <span className="text-sm text-nexo-muted">
                Página {voting.pagination.page} de {voting.pagination.pages}
              </span>
              <button
                className="px-3 py-1.5 rounded-lg border border-nexo-border text-sm text-nexo-muted hover:text-white hover:bg-nexo-card transition-colors disabled:opacity-50"
                disabled={voting.pagination.page >= voting.pagination.pages}
                onClick={() => voting.fetchSessions(voting.pagination.page + 1)}
              >
                Próxima
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
