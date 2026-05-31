import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Target, Plus, Search, Filter, User, Euro, Tag,
  ArrowRight, ArrowLeft, Phone, Mail, Calendar,
  Trash2, CheckCircle, X, LayoutGrid, List
} from 'lucide-react'
import axios from 'axios'
import LeadModal from '../components/leads/LeadModal'

const PIPELINE_COLUMNS = [
  { id: 'novo', label: 'Novo', color: '#6B7280', icon: '🔵' },
  { id: 'contatado', label: 'Contatado', color: '#3B82F6', icon: '📞' },
  { id: 'proposta_enviada', label: 'Proposta', color: '#F59E0B', icon: '📄' },
  { id: 'negociacao', label: 'Negociacao', color: '#8B5CF6', icon: '🤝' },
  { id: 'ganho', label: 'Ganho', color: '#22C55E', icon: '✅' },
  { id: 'perdido', label: 'Perdido', color: '#EF4444', icon: '❌' },
]

const FOUNDERS = [
  { id: 'abner', name: 'Abner', color: '#3742fa', emoji: '🧠' },
  { id: 'enoque', name: 'Enoque', color: '#2ed573', emoji: '⚡' },
  { id: 'elias', name: 'Elias', color: '#ffa502', emoji: '🎯' },
]

export default function Leads() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterAssigned, setFilterAssigned] = useState('all')
  const [viewMode, setViewMode] = useState('kanban') // kanban | list
  const [showModal, setShowModal] = useState(false)
  const [selectedLead, setSelectedLead] = useState(null)
  const [convertingId, setConvertingId] = useState(null)

  const fetchLeads = async () => {
    try {
      setLoading(true)
      const res = await axios.get('/api/leads')
      if (res.data.success) {
        setLeads(res.data.leads)
      }
    } catch (e) {
      console.error('Erro ao carregar leads:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLeads()
  }, [])

  const filteredLeads = useMemo(() => {
    let result = [...leads]
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(l =>
        (l.displayName || '').toLowerCase().includes(q) ||
        (l.notes || '').toLowerCase().includes(q) ||
        (l.email || '').toLowerCase().includes(q)
      )
    }
    if (filterStatus !== 'all') {
      result = result.filter(l => l.pipelineStatus === filterStatus)
    }
    if (filterAssigned !== 'all') {
      result = result.filter(l => l.assignedTo === filterAssigned)
    }
    return result
  }, [leads, search, filterStatus, filterAssigned])

  const leadsByColumn = useMemo(() => {
    const map = {}
    for (const col of PIPELINE_COLUMNS) {
      map[col.id] = filteredLeads.filter(l => l.pipelineStatus === col.id)
    }
    return map
  }, [filteredLeads])

  const moveLead = async (leadId, newStatus) => {
    try {
      await axios.put(`/api/leads/${leadId}`, { pipelineStatus: newStatus })
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, pipelineStatus: newStatus } : l))
    } catch (e) {
      console.error('Erro ao mover lead:', e)
    }
  }

  const deleteLead = async (leadId) => {
    if (!confirm('Tem certeza que deseja remover este lead?')) return
    try {
      await axios.delete(`/api/leads/${leadId}`)
      setLeads(prev => prev.filter(l => l.id !== leadId))
    } catch (e) {
      console.error('Erro ao remover lead:', e)
    }
  }

  const convertLead = async (leadId) => {
    try {
      setConvertingId(leadId)
      const res = await axios.post(`/api/leads/${leadId}/convert`)
      if (res.data.success) {
        // Atualiza o lead na lista com os dados convertidos
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, type: 'cliente-externo', status: 'ativo', pipelineStatus: 'ganho', convertedAt: new Date().toISOString() } : l))
        setSelectedLead(null)
        alert('✅ Lead convertido em cliente com sucesso!')
      }
    } catch (e) {
      console.error('Erro ao converter lead:', e)
      alert('❌ Erro ao converter lead: ' + (e.response?.data?.error || e.message))
    } finally {
      setConvertingId(null)
    }
  }

  const totalValue = useMemo(() =>
    filteredLeads.reduce((sum, l) => sum + (l.estimatedValue || 0), 0),
    [filteredLeads]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-nexo-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
            <Target className="text-nexo-primary" />
            Pipeline de Leads
          </h1>
          <p className="text-xs text-nexo-muted mt-1">
            {leads.length} leads • €{totalValue.toLocaleString('pt-BR')} valor estimado
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'kanban' ? 'list' : 'kanban')}
            className="flex items-center gap-2 px-3 py-2 bg-nexo-card rounded-lg text-xs hover:bg-nexo-border transition-colors"
          >
            {viewMode === 'kanban' ? <List size={14} /> : <LayoutGrid size={14} />}
            {viewMode === 'kanban' ? 'Lista' : 'Kanban'}
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-nexo-primary rounded-lg text-xs hover:opacity-90 transition-opacity"
          >
            <Plus size={14} />
            Novo Lead
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexo-muted" />
          <input
            type="text"
            placeholder="Buscar leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 bg-nexo-card border border-nexo-border rounded-lg text-sm text-nexo-text placeholder-nexo-muted focus:outline-none focus:border-nexo-primary"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 bg-nexo-card border border-nexo-border rounded-lg text-sm text-nexo-text focus:outline-none focus:border-nexo-primary"
        >
          <option value="all">Todos os status</option>
          {PIPELINE_COLUMNS.map(col => (
            <option key={col.id} value={col.id}>{col.label}</option>
          ))}
        </select>
        <select
          value={filterAssigned}
          onChange={(e) => setFilterAssigned(e.target.value)}
          className="px-3 py-2 bg-nexo-card border border-nexo-border rounded-lg text-sm text-nexo-text focus:outline-none focus:border-nexo-primary"
        >
          <option value="all">Todos os responsáveis</option>
          {FOUNDERS.map(f => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </div>

      {/* Conteúdo */}
      {viewMode === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {PIPELINE_COLUMNS.map(col => (
            <div key={col.id} className="min-w-[260px] w-[260px] flex-shrink-0">
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{col.icon}</span>
                  <span className="text-sm font-medium">{col.label}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-nexo-card text-nexo-muted">
                    {leadsByColumn[col.id]?.length || 0}
                  </span>
                </div>
              </div>
              {/* Cards */}
              <div className="space-y-2">
                {leadsByColumn[col.id]?.map((lead, idx) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    index={idx}
                    onMove={moveLead}
                    onDelete={deleteLead}
                    onSelect={setSelectedLead}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card rounded-xl border border-nexo-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-nexo-card border-b border-nexo-border">
              <tr>
                <th className="text-left px-4 py-3 text-nexo-muted font-medium">Nome</th>
                <th className="text-left px-4 py-3 text-nexo-muted font-medium">Status</th>
                <th className="text-left px-4 py-3 text-nexo-muted font-medium">Valor</th>
                <th className="text-left px-4 py-3 text-nexo-muted font-medium">Responsável</th>
                <th className="text-left px-4 py-3 text-nexo-muted font-medium">Fonte</th>
                <th className="text-right px-4 py-3 text-nexo-muted font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map(lead => (
                <tr key={lead.id} className="border-b border-nexo-border hover:bg-nexo-card/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium">{lead.displayName}</div>
                    {lead.email && <div className="text-[11px] text-nexo-muted">{lead.email}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={lead.pipelineStatus} />
                  </td>
                  <td className="px-4 py-3">
                    {lead.estimatedValue > 0 ? `€${lead.estimatedValue.toLocaleString('pt-BR')}` : '-'}
                  </td>
                  <td className="px-4 py-3">
                    {lead.assignedTo ? (
                      <span className="text-xs">{FOUNDERS.find(f => f.id === lead.assignedTo)?.name || lead.assignedTo}</span>
                    ) : (
                      <span className="text-xs text-nexo-muted">Não atribuído</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-nexo-muted text-xs">{lead.source || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setSelectedLead(lead)} className="text-nexo-primary hover:opacity-80 text-xs mr-2">Editar</button>
                    <button onClick={() => deleteLead(lead.id)} className="text-nexo-danger hover:opacity-80 text-xs">Remover</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Novo Lead */}
      <AnimatePresence>
        {showModal && (
          <LeadModal
            onClose={() => setShowModal(false)}
            onSave={async (leadData) => {
              const res = await axios.post('/api/leads', leadData)
              if (res.data.success) {
                setLeads(prev => [...prev, res.data.lead])
                setShowModal(false)
              } else {
                throw new Error(res.data.error || 'Erro ao criar lead')
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Modal Editar Lead */}
      <AnimatePresence>
        {selectedLead && (
          <LeadModal
            lead={selectedLead}
            onClose={() => setSelectedLead(null)}
            onSave={async (leadData) => {
              const res = await axios.put(`/api/leads/${selectedLead.id}`, leadData)
              if (res.data.success) {
                setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, ...leadData } : l))
                setSelectedLead(null)
              } else {
                throw new Error(res.data.error || 'Erro ao atualizar lead')
              }
            }}
            onDelete={(id) => {
              deleteLead(id)
              setSelectedLead(null)
            }}
            onConvert={convertLead}
            isConverting={convertingId === selectedLead?.id}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function LeadCard({ lead, index, onMove, onDelete, onSelect }) {
  const colIdx = PIPELINE_COLUMNS.findIndex(c => c.id === lead.pipelineStatus)
  const prevCol = PIPELINE_COLUMNS[colIdx - 1]
  const nextCol = PIPELINE_COLUMNS[colIdx + 1]
  const founder = FOUNDERS.find(f => f.id === lead.assignedTo)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="glass-card p-3 rounded-lg border border-nexo-border hover:border-nexo-primary/30 transition-colors cursor-pointer"
      onClick={() => onSelect(lead)}
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-sm font-medium truncate flex-1">{lead.displayName}</h4>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(lead.id) }}
          className="text-nexo-muted hover:text-nexo-danger transition-colors ml-1"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {lead.estimatedValue > 0 && (
        <div className="flex items-center gap-1 text-xs text-nexo-success mb-1">
          <Euro size={10} />
          {lead.estimatedValue.toLocaleString('pt-BR')}
        </div>
      )}

      {lead.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {lead.tags.map((tag, i) => (
            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-nexo-card text-nexo-muted">{tag}</span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1">
          {founder ? (
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]" style={{ backgroundColor: founder.color + '30', color: founder.color }}>
              {founder.emoji}
            </div>
          ) : (
            <User size={12} className="text-nexo-muted" />
          )}
        </div>
        <div className="flex items-center gap-1">
          {prevCol && (
            <button
              onClick={(e) => { e.stopPropagation(); onMove(lead.id, prevCol.id) }}
              className="p-1 hover:bg-nexo-card rounded transition-colors"
              title={`Mover para ${prevCol.label}`}
            >
              <ArrowLeft size={12} className="text-nexo-muted" />
            </button>
          )}
          {nextCol && (
            <button
              onClick={(e) => { e.stopPropagation(); onMove(lead.id, nextCol.id) }}
              className="p-1 hover:bg-nexo-card rounded transition-colors"
              title={`Mover para ${nextCol.label}`}
            >
              <ArrowRight size={12} className="text-nexo-muted" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function StatusBadge({ status }) {
  const col = PIPELINE_COLUMNS.find(c => c.id === status)
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: (col?.color || '#6B7280') + '20', color: col?.color || '#6B7280' }}>
      {col?.icon} {col?.label || status}
    </span>
  )
}
