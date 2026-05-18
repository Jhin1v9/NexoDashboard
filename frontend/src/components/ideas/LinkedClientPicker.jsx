import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, FolderKanban, Search, X, ChevronDown, Loader2 } from 'lucide-react'
import axios from 'axios'

/**
 * LinkedClientPicker - Dropdown com busca para vincular cliente/projeto
 *
 * Carrega clientes de /api/schema/clients
 * Carrega projetos de /api/schema/projects
 * Secoes: Clientes, Projetos
 * Selecao mostra nome do cliente/projeto
 * Botao X para limpar selecao
 *
 * Props:
 *  value {object} - { clientId?, clientName?, projectId?, projectName? }
 *  onChange {function} - Callback ao selecionar: (value) => void
 */

export default function LinkedClientPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [clients, setClients] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(false)
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  // Load data when opened
  useEffect(() => {
    if (open) {
      loadData()
      // Focus input when opening
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Load clients
      try {
        const clientsRes = await axios.get('/api/schema/clients')
        if (clientsRes.data) {
          const clientsData = clientsRes.data.data || clientsRes.data
          if (clientsData && typeof clientsData === 'object') {
            const clientsList = Object.entries(clientsData).map(([id, c]) => ({
              id,
              name: c.name || c.company || c.nome || c.razaoSocial || 'Sem nome',
              type: 'client',
            }))
            setClients(clientsList)
          }
        }
      } catch (err) {
        console.warn('[LinkedClientPicker] Failed to load clients:', err.message)
        setClients([])
      }

      // Load projects
      try {
        const projectsRes = await axios.get('/api/schema/projects')
        if (projectsRes.data) {
          const projectsData = projectsRes.data.data || projectsRes.data
          if (projectsData && typeof projectsData === 'object') {
            const projectsList = Object.entries(projectsData).map(([id, p]) => ({
              id,
              name: p.name || p.nome || p.title || 'Sem nome',
              type: 'project',
              clientId: p.clientId || null,
            }))
            setProjects(projectsList)
          }
        }
      } catch (err) {
        console.warn('[LinkedClientPicker] Failed to load projects:', err.message)
        setProjects([])
      }
    } catch (err) {
      console.error('[LinkedClientPicker] loadData error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  // Filter by query
  const filteredClients = query
    ? clients.filter(c =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.id.toLowerCase().includes(query.toLowerCase())
      )
    : clients

  const filteredProjects = query
    ? projects.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.id.toLowerCase().includes(query.toLowerCase())
      )
    : projects

  const handleSelectClient = (client) => {
    onChange({
      ...value,
      clientId: client.id,
      clientName: client.name,
    })
    setOpen(false)
    setQuery('')
  }

  const handleSelectProject = (project) => {
    onChange({
      ...value,
      projectId: project.id,
      projectName: project.name,
    })
    setOpen(false)
    setQuery('')
  }

  const handleClear = (e) => {
    e.stopPropagation()
    onChange({})
  }

  // Display text
  const displayText = value?.clientName || value?.projectName || null
  const hasValue = value?.clientId || value?.projectId

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all w-full ${
          hasValue
            ? 'bg-nexo-primary/10 border-nexo-primary/30 text-nexo-primary'
            : 'bg-nexo-bg border-nexo-border text-nexo-muted hover:text-nexo-text hover:border-nexo-muted'
        }`}
      >
        {hasValue ? (
          <>
            {value?.clientId && <Building2 className="w-3.5 h-3.5 flex-shrink-0" />}
            {value?.projectId && !value?.clientId && <FolderKanban className="w-3.5 h-3.5 flex-shrink-0" />}
            <span className="flex-1 truncate text-left">{displayText}</span>
            <span
              onClick={handleClear}
              className="p-0.5 hover:bg-nexo-primary/20 rounded transition-colors flex-shrink-0"
            >
              <X className="w-3 h-3" />
            </span>
          </>
        ) : (
          <>
            <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="flex-1 text-left">Vincular a cliente ou projeto...</span>
            <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute z-[9990] mt-1 w-80 bg-nexo-card border border-nexo-border rounded-xl shadow-xl shadow-black/20 overflow-hidden"
          >
            {/* Search input */}
            <div className="p-2 border-b border-nexo-border/50">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-nexo-muted" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Buscar cliente ou projeto..."
                  className="w-full pl-8 pr-3 py-1.5 bg-nexo-bg rounded-lg border border-nexo-border outline-none focus:border-nexo-primary text-xs text-nexo-text placeholder:text-nexo-muted/40"
                />
              </div>
            </div>

            {/* Loading */}
            {loading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-4 h-4 text-nexo-primary animate-spin" />
                <span className="ml-2 text-xs text-nexo-muted">Carregando...</span>
              </div>
            )}

            {/* Content */}
            {!loading && (
              <div className="max-h-72 overflow-y-auto">
                {/* Clients Section */}
                <div className="py-1">
                  <div className="flex items-center gap-2 px-3 py-1.5">
                    <Building2 className="w-3 h-3 text-nexo-muted" />
                    <span className="text-[10px] font-semibold text-nexo-muted uppercase tracking-wider">
                      Clientes ({filteredClients.length})
                    </span>
                  </div>

                  {filteredClients.length === 0 && (
                    <p className="px-3 py-2 text-[11px] text-nexo-muted italic">
                      {query ? 'Nenhum cliente encontrado' : 'Nenhum cliente disponivel'}
                    </p>
                  )}

                  {filteredClients.map(client => (
                    <button
                      key={client.id}
                      onClick={() => handleSelectClient(client)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                        value?.clientId === client.id
                          ? 'bg-nexo-primary/10 text-nexo-primary'
                          : 'text-nexo-text hover:bg-nexo-bg'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        value?.clientId === client.id ? 'bg-nexo-primary/20' : 'bg-nexo-bg'
                      }`}>
                        <Building2 className={`w-3.5 h-3.5 ${
                          value?.clientId === client.id ? 'text-nexo-primary' : 'text-nexo-muted'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{client.name}</p>
                        <p className="text-[10px] text-nexo-muted truncate">{client.id}</p>
                      </div>
                      {value?.clientId === client.id && (
                        <span className="text-[10px] text-nexo-primary font-medium">Selecionado</span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Divider */}
                {filteredClients.length > 0 && filteredProjects.length > 0 && (
                  <div className="border-t border-nexo-border/30" />
                )}

                {/* Projects Section */}
                <div className="py-1">
                  <div className="flex items-center gap-2 px-3 py-1.5">
                    <FolderKanban className="w-3 h-3 text-nexo-muted" />
                    <span className="text-[10px] font-semibold text-nexo-muted uppercase tracking-wider">
                      Projetos ({filteredProjects.length})
                    </span>
                  </div>

                  {filteredProjects.length === 0 && (
                    <p className="px-3 py-2 text-[11px] text-nexo-muted italic">
                      {query ? 'Nenhum projeto encontrado' : 'Nenhum projeto disponivel'}
                    </p>
                  )}

                  {filteredProjects.map(project => (
                    <button
                      key={project.id}
                      onClick={() => handleSelectProject(project)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                        value?.projectId === project.id
                          ? 'bg-nexo-primary/10 text-nexo-primary'
                          : 'text-nexo-text hover:bg-nexo-bg'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        value?.projectId === project.id ? 'bg-nexo-primary/20' : 'bg-nexo-bg'
                      }`}>
                        <FolderKanban className={`w-3.5 h-3.5 ${
                          value?.projectId === project.id ? 'text-nexo-primary' : 'text-nexo-muted'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{project.name}</p>
                        <p className="text-[10px] text-nexo-muted truncate">{project.id}</p>
                      </div>
                      {value?.projectId === project.id && (
                        <span className="text-[10px] text-nexo-primary font-medium">Selecionado</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="px-3 py-2 border-t border-nexo-border/50 bg-nexo-bg/30 flex items-center justify-between">
              <span className="text-[9px] text-nexo-muted">
                {filteredClients.length + filteredProjects.length} itens
              </span>
              {hasValue && (
                <button
                  onClick={() => {
                    onChange({})
                    setOpen(false)
                  }}
                  className="text-[10px] text-nexo-danger hover:underline"
                >
                  Limpar vinculo
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
