import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Github, Globe, FolderOpen, Plus, ArrowUpRight,
  CreditCard, Banknote, Wallet, Smartphone
} from 'lucide-react'

/**
 * @typedef {Object} Amount
 * @property {number} value
 * @property {string} currency
 *
 * @typedef {Object} RevenueSplitItem
 * @property {string} personId
 * @property {string} name
 * @property {number} percent
 * @property {number} amount
 * @property {boolean} received
 * @property {string} [type]
 *
 * @typedef {Object} Transaction
 * @property {string} id
 * @property {string} date
 * @property {Amount} amount
 * @property {string} method
 * @property {string} paidBy
 * @property {number} phase
 * @property {string} [notes]
 *
 * @typedef {Object} PaymentLinks
 * @property {string} [github]
 * @property {string} [vercel]
 * @property {string} [localPath]
 * @property {string} [domain]
 *
 * @typedef {Object} Payment
 * @property {string} id
 * @property {string} clientName
 * @property {string} projectName
 * @property {Amount} totalAmount
 * @property {string} status
 * @property {RevenueSplitItem[]} revenueSplit
 * @property {Transaction[]} transactions
 * @property {PaymentLinks} [links]
 *
 * @typedef {Object} PaymentCardProps
 * @property {Payment} payment
 * @property {() => void} [onAddTransaction]
 * @property {() => void} [onClick]
 */

const STATUS_CONFIG = {
  pending:  { label: 'Pendente',  color: '#ffa502', bg: 'rgba(255,165,2,0.12)' },
  partial:  { label: 'Parcial',   color: '#3742fa', bg: 'rgba(55,66,250,0.12)' },
  paid:     { label: 'Pago',      color: '#2ed573', bg: 'rgba(46,213,115,0.12)' },
  overdue:  { label: 'Atrasado',  color: '#ff4757', bg: 'rgba(255,71,87,0.12)' },
  cancelled:{ label: 'Cancelado', color: '#747d8c', bg: 'rgba(116,125,140,0.12)' },
}

const METHOD_COLORS = {
  card: '#5f27cd',
  transfer: '#10ac84',
  cash: '#f9ca24',
  bizum: '#22a6b3',
  other: '#95afc0',
}

/** @param {PaymentCardProps} props */
export default function PaymentCard({ payment, onAddTransaction, onClick }) {
  const [hovered, setHovered] = useState(false)

  const status = STATUS_CONFIG[payment.status] || STATUS_CONFIG.pending

  const received = useMemo(() => {
    return payment.transactions?.reduce((sum, tx) => sum + (tx.amount?.value || 0), 0) || 0
  }, [payment.transactions])

  const total = payment.totalAmount?.value || 0
  const percent = total > 0 ? Math.round((received / total) * 100) : 0
  const currency = payment.totalAmount?.currency || 'EUR'

  const formatCurrency = (val, cur) => {
    const symbol = cur === 'BRL' ? 'R$' : cur === 'EUR' ? '€' : cur === 'USD' ? '$' : cur
    return `${symbol} ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="glass-card p-5 relative cursor-pointer group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      {/* Status Badge — top right */}
      <div
        className="absolute top-4 right-4 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide"
        style={{ color: status.color, background: status.bg, border: `1px solid ${status.color}30` }}
      >
        {status.label}
      </div>

      {/* Client + Project */}
      <div className="pr-24 mb-3">
        <h3 className="font-heading text-lg font-bold text-white leading-tight">
          {payment.clientName}
        </h3>
        <p className="text-sm text-nexo-muted mt-0.5">
          {payment.projectName}
        </p>
      </div>

      {/* Amount */}
      <div className="mb-4">
        <span className="text-2xl font-heading font-bold text-white">
          {formatCurrency(total, currency)}
        </span>
        <span className="text-sm text-nexo-muted ml-2">
          {received > 0 && `${formatCurrency(received, currency)} recebido`}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-nexo-muted">Progresso</span>
          <span className="font-semibold" style={{ color: percent === 100 ? '#2ed573' : percent > 0 ? '#3742fa' : '#ffa502' }}>
            {percent}%
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-nexo-border overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: percent === 100
                ? 'linear-gradient(90deg, #2ed573, #26c66b)'
                : percent > 0
                ? 'linear-gradient(90deg, #3742fa, #5352ed)'
                : '#ffa502'
            }}
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Quick Links */}
      {payment.links && (
        <div className="flex items-center gap-2 mb-4">
          {payment.links.github && (
            <a
              href={payment.links.github}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded-md bg-nexo-card hover:bg-nexo-border transition-colors"
              title="GitHub"
            >
              <Github size={14} className="text-nexo-muted" />
            </a>
          )}
          {payment.links.vercel && (
            <a
              href={payment.links.vercel}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded-md bg-nexo-card hover:bg-nexo-border transition-colors"
              title="Vercel"
            >
              <Globe size={14} className="text-nexo-muted" />
            </a>
          )}
          {payment.links.localPath && (
            <button
              onClick={(e) => { e.stopPropagation(); /* openFolder(payment.links.localPath) */ }}
              className="p-1.5 rounded-md bg-nexo-card hover:bg-nexo-border transition-colors"
              title="Abrir pasta local"
            >
              <FolderOpen size={14} className="text-nexo-muted" />
            </button>
          )}
          {payment.links.domain && (
            <a
              href={`https://${payment.links.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded-md bg-nexo-card hover:bg-nexo-border transition-colors"
              title={payment.links.domain}
            >
              <ArrowUpRight size={14} className="text-nexo-muted" />
            </a>
          )}
        </div>
      )}

      {/* Add Transaction Button */}
      {onAddTransaction && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={(e) => { e.stopPropagation(); onAddTransaction() }}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-nexo-info/10 text-nexo-info text-sm font-medium hover:bg-nexo-info/20 transition-colors border border-nexo-info/20"
        >
          <Plus size={14} />
          Transação
        </motion.button>
      )}
    </motion.div>
  )
}

