import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUpDown, ArrowUp, ArrowDown, Archive, MessageSquare, Building2 } from 'lucide-react'
import axios from 'axios'
import { STATUS_CONFIG, PRIORITY_CONFIG } from './IdeaCard'

export default function IdeasTable({ ideas, onRefresh }) {
  const navigate = useNavigate()
  const [sortField, setSortField] = useState('updatedAt')
  const [sortOrder, setSortOrder] = useState('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const sorted = useMemo(() => {
    const list = [...ideas]
    list.sort((a, b) => {
      let aVal = a[sortField]
      let bVal = b[sortField]

      if (sortField === 'linkedTo') {
        aVal = a.linkedTo?.clientName || ''
        bVal = b.linkedTo?.clientName || ''
      }

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase()
        bVal = bVal.toLowerCase()
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [ideas, sortField, sortOrder])

  const totalPages = Math.ceil(sorted.length / itemsPerPage)
  const paginated = sorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-nexo-muted opacity-40" />
    return sortOrder === 'asc'
      ? <ArrowUp className="w-3 h-3 text-nexo-primary" />
      : <ArrowDown className="w-3 h-3 text-nexo-primary" />
  }

  const handleArchive = async (e, id) => {
    e.stopPropagation()
    if (!confirm('Arquivar esta ideia?')) return
    try {
      await axios.put(`/api/ideas/${id}`, { status: 'arquivada' })
      onRefresh()
    } catch (err) {
      console.error('[IdeasTable] archive error:', err)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  const columns = [
    { key: 'title', label: 'Titulo' },
    { key: 'status', label: 'Status' },
    { key: 'type', label: 'Tipo' },
    { key: 'priority', label: 'Prioridade' },
    { key: 'linkedTo', label: 'Cliente' },
    { key: 'createdByName', label: 'Autor' },
    { key: 'updatedAt', label: 'Atualizado' }
  ]

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-nexo-border">
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="text-left p-3 text-[11px] uppercase tracking-wide text-nexo-muted font-semibold cursor-pointer hover:text-nexo-text transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    <SortIcon field={col.key} />
                  </div>
                </th>
              ))}
              <th className="text-left p-3 text-[11px] uppercase tracking-wide text-nexo-muted font-semibold">Acoes</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {paginated.map((idea, i) => {
                const statusCfg = STATUS_CONFIG[idea.status] || STATUS_CONFIG.rascunho
                const priorityCfg = PRIORITY_CONFIG[idea.priority] || PRIORITY_CONFIG.media
                return (
                  <motion.tr
                    key={idea.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    onClick={() => navigate(`/ideias/${idea.id}`)}
                    className="border-b border-nexo-border/50 hover:bg-nexo-card/50 cursor-pointer transition-colors group"
                  >
                    <td className="p-3">
                      <span className="font-medium text-nexo-text">{idea.title}</span>
                      {idea.comments?.length > 0 && (
                        <span className="inline-flex items-center gap-0.5 ml-2 text-[10px] text-nexo-muted">
                          <MessageSquare className="w-3 h-3" />
                          {idea.comments.length}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded ${statusCfg.className}`}>
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="p-3 text-nexo-muted capitalize">{idea.type?.replace(/-/g, ' ') || '-'}</td>
                    <td className="p-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded ${priorityCfg.className}`}>
                        {priorityCfg.label}
                      </span>
                    </td>
                    <td className="p-3">
                      {idea.linkedTo?.clientName ? (
                        <span className="flex items-center gap-1 text-nexo-muted">
                          <Building2 className="w-3 h-3" />
                          {idea.linkedTo.clientName}
                        </span>
                      ) : (
                        <span className="text-nexo-muted opacity-40">-</span>
                      )}
                    </td>
                    <td className="p-3 text-nexo-muted">{idea.createdByName || '-'}</td>
                    <td className="p-3 text-nexo-muted text-xs">{formatDate(idea.updatedAt)}</td>
                    <td className="p-3">
                      <button
                        onClick={(e) => handleArchive(e, idea.id)}
                        className="p-1.5 hover:bg-nexo-danger/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="Arquivar"
                      >
                        <Archive className="w-3.5 h-3.5 text-nexo-muted hover:text-nexo-danger" />
                      </button>
                    </td>
                  </motion.tr>
                )
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {paginated.length === 0 && (
        <div className="text-center py-12 text-nexo-muted text-sm">
          Nenhuma ideia encontrada
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-nexo-muted">
            Mostrando {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, sorted.length)} de {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2 py-1 rounded-lg text-xs text-nexo-muted hover:bg-nexo-card disabled:opacity-30 transition-colors"
            >
              Anterior
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                  page === currentPage
                    ? 'bg-nexo-primary text-white'
                    : 'text-nexo-muted hover:bg-nexo-card'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2 py-1 rounded-lg text-xs text-nexo-muted hover:bg-nexo-card disabled:opacity-30 transition-colors"
            >
              Proxima
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
