import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Wallet, TrendingUp, TrendingDown, CreditCard,
  FolderOpen, Globe, MessageCircle, Plus, CheckCircle, Clock,
  AlertTriangle
} from 'lucide-react'
import useRealtime from '../hooks/useRealtime'
import AddTransactionModal from '../components/finance/AddTransactionModal'

const statusConfig = {
  pending:   { color: '#ffa502', label: 'Pendente',   icon: Clock },
  partial:   { color: '#3742fa', label: 'Parcial',    icon: TrendingUp },
  paid:      { color: '#2ed573', label: 'Pago',       icon: CheckCircle },
  overdue:   { color: '#ff4757', label: 'Atrasado',   icon: AlertTriangle },
  cancelled: { color: '#747d8c', label: 'Cancelado',  icon: Clock },
}

const methodConfig = {
  card:      { color: '#5f27cd', label: 'Cartao' },
  transfer:  { color: '#10ac84', label: 'Transferencia' },
  cash:      { color: '#f9ca24', label: 'Dinheiro' },
  bizum:     { color: '#22a6b3', label: 'Bizum' },
  other:     { color: '#95afc0', label: 'Outro' },
}

const TransactionRow = ({ tx }) => {
  const method = methodConfig[tx.method] || methodConfig.other
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-4 py-3 border-b border-nexo-border last:border-0"
    >
      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: method.color + '20' }}>
        <CreditCard size={16} style={{ color: method.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{tx.amount.currency === 'EUR' ? '€' : 'R$'} {tx.amount.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: method.color + '20', color: method.color }}>
            {method.label}
          </span>
        </div>
        <div className="text-xs text-nexo-muted mt-0.5">
          {new Date(tx.date).toLocaleDateString('pt-BR')} • Pago por: {tx.paidBy} • Parcela {tx.phase}
        </div>
        {tx.notes && <div className="text-xs text-nexo-muted mt-1 italic">{tx.notes}</div>}
      </div>
    </motion.div>
  )
}

export default function ReceitaDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [showAddTx, setShowAddTx] = useState(false)

  const { data: payment, loading, error } = useRealtime(`/api/payments/${id}`, 30000)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-nexo-info border-t-transparent" />
      </div>
    )
  }

  if (error || !payment) {
    return (
      <div className="glass-card p-6 text-center">
        <AlertTriangle size={32} className="mx-auto mb-3 text-nexo-danger" />
        <p className="text-nexo-muted">Erro ao carregar pagamento</p>
        <button onClick={() => navigate('/financeiro')} className="mt-4 btn-primary text-sm">
          Voltar
        </button>
      </div>
    )
  }

  const received = payment.transactions?.reduce((sum, tx) => sum + (tx.amount?.value || 0), 0) || 0
  const total = payment.totalAmount?.value || 0
  const pending = total - received
  const progress = total > 0 ? Math.round((received / total) * 100) : 0
  const currencySymbol = payment.totalAmount?.currency === 'EUR' ? '€' : 'R$'
  const status = statusConfig[payment.status] || statusConfig.pending
  const StatusIcon = status.icon

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/financeiro')}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-nexo-card text-nexo-muted hover:text-white transition-all"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Voltar</span>
        </button>
        <div>
          <h1 className="text-2xl font-bold font-heading">{payment.clientName || payment.projectName}</h1>
          <p className="text-sm text-nexo-muted">{payment.projectName}</p>
        </div>
        <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm" style={{ backgroundColor: status.color + '15', color: status.color }}>
          <StatusIcon size={14} />
          <span>{status.label}</span>
        </div>
      </div>

      {/* Valor Total */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6"
      >
        <div className="text-center mb-4">
          <div className="text-sm text-nexo-muted mb-1">VALOR TOTAL</div>
          <div className="text-4xl font-bold font-heading">
            {currencySymbol} {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center p-3 rounded-lg" style={{ backgroundColor: '#2ed57310' }}>
            <div className="flex items-center justify-center gap-1.5 text-nexo-success text-sm mb-1">
              <TrendingUp size={14} />
              <span>RECEBIDO</span>
            </div>
            <div className="text-xl font-bold text-nexo-success">
              {currencySymbol} {received.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="text-center p-3 rounded-lg" style={{ backgroundColor: '#ffa50210' }}>
            <div className="flex items-center justify-center gap-1.5 text-nexo-warning text-sm mb-1">
              <TrendingDown size={14} />
              <span>PENDENTE</span>
            </div>
            <div className="text-xl font-bold text-nexo-warning">
              {currencySymbol} {pending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-nexo-muted">
            <span>0%</span>
            <span className="font-medium text-white">{progress}%</span>
            <span>100%</span>
          </div>
          <div className="h-3 bg-nexo-card rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{
                backgroundColor: progress === 100 ? '#2ed573' : progress > 0 ? '#3742fa' : '#ffa502'
              }}
            />
          </div>
        </div>
      </motion.div>

      {/* Split de Receita */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-6"
      >
        <h2 className="text-sm font-medium text-nexo-muted mb-4 flex items-center gap-2">
          <Wallet size={16} />
          SPLIT DE RECEITA
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {payment.revenueSplit?.map((split, i) => (
            <motion.div
              key={split.personId}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 + i * 0.05 }}
              className="p-4 rounded-lg text-center"
              style={{ backgroundColor: split.received ? '#2ed57310' : '#ffa50210', border: `1px solid ${split.received ? '#2ed57330' : '#ffa50230'}` }}
            >
              <div className="text-sm font-medium mb-1">{split.name}</div>
              <div className="text-lg font-bold font-heading">
                {currencySymbol} {split.amount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-nexo-muted mt-1">({split.percent}%)</div>
              <div className="flex items-center justify-center gap-1 mt-2 text-xs" style={{ color: split.received ? '#2ed573' : '#ffa502' }}>
                {split.received ? <CheckCircle size={12} /> : <Clock size={12} />}
                <span>{split.received ? 'Recebido' : 'Pendente'}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Historico de Transacoes */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-nexo-muted flex items-center gap-2">
            <CreditCard size={16} />
            HISTORICO DE TRANSACOES
          </h2>
          <button
            onClick={() => setShowAddTx(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-nexo-info/20 text-nexo-info text-sm hover:bg-nexo-info/30 transition-all"
          >
            <Plus size={14} />
            Adicionar Transacao
          </button>
        </div>
        <div>
          <AnimatePresence>
            {payment.transactions?.length > 0 ? (
              payment.transactions.map(tx => <TransactionRow key={tx.id} tx={tx} />)
            ) : (
              <div className="text-center text-nexo-muted text-sm py-8">
                Nenhuma transacao registrada.
              </div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Links Rapidos */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card p-6"
      >
        <h2 className="text-sm font-medium text-nexo-muted mb-4 flex items-center gap-2">
          <Globe size={16} />
          LINKS RAPIDOS
        </h2>
        <div className="flex flex-wrap gap-3">
          {payment.links?.localPath && (
            <a
              href={`file://${payment.links.localPath}`}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-nexo-card text-sm text-nexo-muted hover:text-white hover:bg-nexo-border transition-all"
            >
              <FolderOpen size={16} />
              Abrir Pasta
            </a>
          )}
          {payment.links?.github && (
            <a
              href={payment.links.github}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-nexo-card text-sm text-nexo-muted hover:text-white hover:bg-nexo-border transition-all"
            >
              <Globe size={16} />
              GitHub
            </a>
          )}
          {payment.links?.vercel && (
            <a
              href={payment.links.vercel}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-nexo-card text-sm text-nexo-muted hover:text-white hover:bg-nexo-border transition-all"
            >
              <Globe size={16} />
              Vercel
            </a>
          )}
          {payment.links?.whatsapp && (
            <a
              href={`https://wa.me/${payment.links.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-nexo-card text-sm text-nexo-muted hover:text-white hover:bg-nexo-border transition-all"
            >
              <MessageCircle size={16} />
              WhatsApp Cliente
            </a>
          )}
          {!payment.links?.localPath && !payment.links?.github && !payment.links?.vercel && !payment.links?.whatsapp && (
            <span className="text-sm text-nexo-muted">Nenhum link configurado</span>
          )}
        </div>
      </motion.div>

      {/* Modal */}
      <AnimatePresence>
        {showAddTx && (
          <AddTransactionModal
            paymentId={id}
            phases={payment.paymentTerms?.splits || []}
            onClose={() => setShowAddTx(false)}
            onSaved={() => window.location.reload()}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

