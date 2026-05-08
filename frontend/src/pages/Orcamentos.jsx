import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  FileText, Eye, CheckCircle, Clock, AlertCircle,
  ChevronDown, ChevronUp, ExternalLink, Euro, Calendar,
  Package, Shield, ArrowRight
} from 'lucide-react'
import useRealtime from '../hooks/useRealtime'

function StatusBadge({ status, label }) {
  const colors = {
    sent: 'bg-nexo-info/20 text-nexo-info border-nexo-info/30',
    accepted: 'bg-nexo-success/20 text-nexo-success border-nexo-success/30',
    rejected: 'bg-nexo-danger/20 text-nexo-danger border-nexo-danger/30',
    waiting_quote: 'bg-nexo-warning/20 text-nexo-warning border-nexo-warning/30',
    pending: 'bg-nexo-muted/20 text-nexo-muted border-nexo-muted/30'
  }
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${colors[status] || colors.pending}`}>
      {label || status}
    </span>
  )
}

function QuoteCard({ quote, expanded, onToggle }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card border border-nexo-border rounded-xl overflow-hidden"
    >
      <div className="p-5 cursor-pointer" onClick={onToggle}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-nexo-primary/20 flex items-center justify-center">
              <FileText size={22} className="text-nexo-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-nexo-text">{quote.projectName}</h3>
              <p className="text-sm text-nexo-muted">{quote.clientName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={quote.status} label={quote.statusLabel} />
            <button className="text-nexo-muted hover:text-nexo-text transition-colors">
              {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="text-center p-3 rounded-lg bg-nexo-card/50">
            <Euro size={16} className="mx-auto text-nexo-primary mb-1" />
            <div className="text-lg font-bold text-nexo-text">{quote.totalAmount?.value?.toLocaleString('pt-BR')}</div>
            <div className="text-xs text-nexo-muted">Total Setup</div>
          </div>
          {quote.monthlyFee && (
            <div className="text-center p-3 rounded-lg bg-nexo-card/50">
              <Calendar size={16} className="mx-auto text-nexo-warning mb-1" />
              <div className="text-lg font-bold text-nexo-text">{quote.monthlyFee.value}</div>
              <div className="text-xs text-nexo-muted">/mês</div>
            </div>
          )}
          {quote.discountUpfront && (
            <div className="text-center p-3 rounded-lg bg-nexo-card/50">
              <Shield size={16} className="mx-auto text-nexo-success mb-1" />
              <div className="text-lg font-bold text-nexo-success">{quote.discountUpfront.percent}%</div>
              <div className="text-xs text-nexo-muted">À vista</div>
            </div>
          )}
          <div className="text-center p-3 rounded-lg bg-nexo-card/50">
            <Clock size={16} className="mx-auto text-nexo-info mb-1" />
            <div className="text-lg font-bold text-nexo-text">
              {quote.validUntil ? Math.ceil((new Date(quote.validUntil) - new Date()) / (1000 * 60 * 60 * 24)) : '-'}d
            </div>
            <div className="text-xs text-nexo-muted">Válido</div>
          </div>
        </div>
      </div>

      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="border-t border-nexo-border"
        >
          <div className="p-5 space-y-4">
            {/* Items */}
            <div>
              <h4 className="text-sm font-semibold text-nexo-muted mb-3 flex items-center gap-2">
                <Package size={14} /> Itens do Orçamento
              </h4>
              <div className="space-y-2">
                {quote.items?.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-nexo-bg/50">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{item.category}</div>
                      <div className="text-xs text-nexo-muted">{item.description}</div>
                      {item.details && (
                        <ul className="mt-1 space-y-0.5">
                          {item.details.map((d, i) => (
                            <li key={i} className="text-xs text-nexo-muted flex items-center gap-1">
                              <CheckCircle size={8} className="text-nexo-success" /> {d}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <div className="font-bold text-nexo-text">€ {item.total?.toLocaleString('pt-BR')}</div>
                      <div className="text-xs text-nexo-muted">{item.quantity}x € {item.unitPrice}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Schedule */}
            {quote.paymentSchedule && (
              <div>
                <h4 className="text-sm font-semibold text-nexo-muted mb-3">Cronograma de Pagamento</h4>
                <div className="flex gap-2">
                  {quote.paymentSchedule.map((p, idx) => (
                    <div key={idx} className={`flex-1 p-3 rounded-lg border ${p.status === 'paid' ? 'bg-nexo-success/10 border-nexo-success/30' : 'bg-nexo-card/50 border-nexo-border'}`}>
                      <div className="text-xs text-nexo-muted">{p.phase}</div>
                      <div className="font-bold text-nexo-text">€ {p.amount}</div>
                      <div className="text-xs text-nexo-muted">{p.percent}%</div>
                      {p.status === 'paid' && <CheckCircle size={12} className="text-nexo-success mt-1" />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SLA */}
            {quote.sla && (
              <div className="flex gap-4 text-xs text-nexo-muted">
                <span className="flex items-center gap-1"><Shield size={12} /> SLA: {quote.sla.criticalResponse}</span>
                <span className="flex items-center gap-1"><CheckCircle size={12} /> Garantia: {quote.sla.guarantee}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              {quote.githubUrl && (
                <a
                  href={quote.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-nexo-primary/20 text-nexo-primary text-sm font-medium hover:bg-nexo-primary/30 transition-colors"
                >
                  <ExternalLink size={14} /> Ver no GitHub
                </a>
              )}
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-nexo-card text-nexo-text text-sm font-medium hover:bg-nexo-border transition-colors">
                <Eye size={14} /> Ver Detalhes
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}

export default function Orcamentos() {
  const { data: quotes, loading } = useRealtime('/api/quotes', 30000)
  const [expandedId, setExpandedId] = useState(null)
  const [filter, setFilter] = useState('all')

  const filteredQuotes = quotes?.filter(q => {
    if (filter === 'all') return true
    if (filter === 'pending') return q.status === 'sent' || q.status === 'waiting_quote'
    if (filter === 'active') return q.status === 'accepted'
    return true
  }) || []

  const stats = {
    total: quotes?.reduce((sum, q) => sum + (q.totalAmount?.value || 0), 0) || 0,
    pending: quotes?.filter(q => q.status === 'sent' || q.status === 'waiting_quote').length || 0,
    active: quotes?.filter(q => q.status === 'accepted').length || 0,
    monthly: quotes?.reduce((sum, q) => sum + (q.monthlyFee?.value || 0), 0) || 0
  }

  if (loading) return <div className="text-nexo-muted">Carregando orçamentos...</div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-nexo-text">Orçamentos</h1>
          <p className="text-nexo-muted text-sm">Propostas e pressupostos dos clientes</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-xl border border-nexo-border">
          <div className="text-2xl font-bold text-nexo-text">€ {stats.total.toLocaleString('pt-BR')}</div>
          <div className="text-xs text-nexo-muted">Total em Orçamentos</div>
        </div>
        <div className="glass-card p-4 rounded-xl border border-nexo-border">
          <div className="text-2xl font-bold text-nexo-warning">{stats.pending}</div>
          <div className="text-xs text-nexo-muted">Pendentes</div>
        </div>
        <div className="glass-card p-4 rounded-xl border border-nexo-border">
          <div className="text-2xl font-bold text-nexo-success">{stats.active}</div>
          <div className="text-xs text-nexo-muted">Aprovados</div>
        </div>
        <div className="glass-card p-4 rounded-xl border border-nexo-border">
          <div className="text-2xl font-bold text-nexo-info">€ {stats.monthly}</div>
          <div className="text-xs text-nexo-muted">Mensalidade/mês</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {[
          { key: 'all', label: 'Todos' },
          { key: 'pending', label: 'Pendentes' },
          { key: 'active', label: 'Aprovados' }
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f.key
                ? 'bg-nexo-primary text-white'
                : 'bg-nexo-card text-nexo-muted hover:text-nexo-text'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Quotes List */}
      <div className="space-y-4">
        {filteredQuotes.map(quote => (
          <QuoteCard
            key={quote.quoteId}
            quote={quote}
            expanded={expandedId === quote.quoteId}
            onToggle={() => setExpandedId(expandedId === quote.quoteId ? null : quote.quoteId)}
          />
        ))}
        {filteredQuotes.length === 0 && (
          <div className="text-center py-12 text-nexo-muted">
            <FileText size={48} className="mx-auto mb-4 opacity-30" />
            <p>Nenhum orçamento encontrado</p>
          </div>
        )}
      </div>
    </div>
  )
}

