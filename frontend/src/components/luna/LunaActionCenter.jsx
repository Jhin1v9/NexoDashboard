/**
 * ═════════════════════════════════════════════════════════════════════════════
 * LunaActionCenter — Inbox de ações pendentes da Luna
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Painel fixo que aparece quando o usuário clica no toast proativo
 * ou no badge vermelho do botão flutuante. Cada item é um card
 * acionável com botões de executar, ver ou ignorar.
 *
 * Regras:
 *   - Cards agrupados por prioridade (Crítico / Atenção / Info)
 *   - Cada card tem ações rápidas derivadas do tipo de entidade
 *   - Ignorar = some por 24h (persistido no backend)
 *   - Após executar uma ação, o card some da lista
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, CheckCircle, Trash2, AlertTriangle, Flame, Info,
  Mail, ClipboardList, DollarSign, Bell, ArrowRight,
  Loader2, Eye, Send, UserCheck, AlertOctagon,
} from 'lucide-react'
import axios from 'axios'
import { useToast } from '../../context/ToastContext'
import { lunaEventBus } from '../../lib/lunaEventBus'

const TYPE_ICONS = {
  task: ClipboardList,
  email: Mail,
  lead: DollarSign,
  finance: DollarSign,
  alert: AlertOctagon,
}

const TYPE_LABELS = {
  task: 'Tarefa',
  email: 'Email',
  lead: 'Lead',
  finance: 'Financeiro',
  alert: 'Alerta',
}

const PRIORITY_CONFIG = {
  critical: {
    label: 'Crítico',
    icon: Flame,
    color: 'border-red-500/30 bg-red-500/10 text-red-300',
    badge: 'bg-red-500/20 text-red-300 border-red-500/30',
    glow: 'bg-red-500',
  },
  warning: {
    label: 'Atenção',
    icon: AlertTriangle,
    color: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    glow: 'bg-amber-500',
  },
  info: {
    label: 'Info',
    icon: Info,
    color: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    glow: 'bg-blue-500',
  },
}

function ActionCard({ item, onDismiss, onActionDone }) {
  const [isExecuting, setIsExecuting] = useState(false)
  const { addToast } = useToast()

  const TypeIcon = TYPE_ICONS[item.type] || Bell
  const priority = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.info

  const handlePrimaryAction = async (action) => {
    if (action.href) {
      // Navegação SPA via eventBus — evita full reload e unmount prematuro
      lunaEventBus.emit('luna:actionCompleted', {
        actions: [{ type: 'navigate', params: { destino: action.href } }]
      })
      // Delay pra garantir que o navigate aconteça antes do card sumir
      setTimeout(() => onActionDone?.(item.id), 300)
      return
    }
    if (action.intent) {
      setIsExecuting(true)
      try {
        const token = localStorage.getItem('nexo_token') || ''
        await axios.post('/api/luna/batch', {
          intent: action.intent,
          ids: [item.entityId].filter(Boolean),
        }, {
          headers: { Authorization: `Bearer ${token}` },
        })
        addToast(`${item.title} — concluído ✓`, 'success')
        onActionDone?.(item.id)
      } catch (err) {
        const msg = err.response?.data?.error || err.message || 'Erro'
        addToast(msg, 'error')
      } finally {
        setIsExecuting(false)
      }
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 50, scale: 0.95 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={`rounded-xl border ${priority.color} p-3.5 relative overflow-hidden`}
    >
      {/* Glow sutil */}
      <div className={`absolute -top-6 -right-6 w-16 h-16 rounded-full blur-2xl opacity-15 ${priority.glow}`} />

      <div className="flex items-start gap-3 relative">
        <div className="mt-0.5 shrink-0 w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
          <TypeIcon className="w-4 h-4 opacity-80" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{item.title}</p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${priority.badge}`}>
              {priority.label}
            </span>
          </div>
          <p className="text-xs opacity-70 mt-0.5">{item.description}</p>

          {/* Ações rápidas */}
          <div className="flex items-center gap-2 mt-2.5">
            {item.actions?.map((action, i) => (
              <button
                key={i}
                onClick={() => handlePrimaryAction(action)}
                disabled={isExecuting}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all
                  ${action.primary
                    ? 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
                    : 'bg-transparent hover:bg-white/5 text-white/70 border border-transparent hover:border-white/10'
                  } disabled:opacity-50`}
              >
                {isExecuting && action.primary ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : action.label === 'Concluir' ? (
                  <CheckCircle className="w-3 h-3" />
                ) : action.label === 'Ver' || action.label === 'Ver lead' || action.label === 'Ver caixa' || action.label === 'Ver operações' ? (
                  <Eye className="w-3 h-3" />
                ) : action.label === 'Aprovar' ? (
                  <Send className="w-3 h-3" />
                ) : action.label === 'Contatar' ? (
                  <UserCheck className="w-3 h-3" />
                ) : null}
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {/* Ignorar individual */}
        {item.dismissable && (
          <button
            onClick={() => onDismiss(item.id)}
            disabled={isExecuting}
            className="shrink-0 p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white/70 -mt-1 -mr-1"
            title="Ignorar por 24h"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  )
}

export default function LunaActionCenter({ onClose }) {
  const { addToast } = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [dismissingAll, setDismissingAll] = useState(false)

  const fetchItems = useCallback(async () => {
    try {
      const token = localStorage.getItem('nexo_token') || ''
      const res = await axios.get('/api/luna/action-center', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.data.success) {
        setItems(res.data.items || [])
      }
    } catch (err) {
      addToast('Erro ao carregar ações pendentes', 'error')
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const handleDismiss = async (id) => {
    try {
      const token = localStorage.getItem('nexo_token') || ''
      await axios.post('/api/luna/action-center/dismiss', { id }, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setItems(prev => prev.filter(i => i.id !== id))
      lunaEventBus.emit('luna:actionDismissed', { id })
    } catch (err) {
      addToast('Erro ao ignorar ação', 'error')
    }
  }

  const handleDismissAll = async () => {
    if (!items.length) return
    setDismissingAll(true)
    try {
      const token = localStorage.getItem('nexo_token') || ''
      await axios.post('/api/luna/action-center/dismiss', { dismissAll: true }, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setItems([])
      lunaEventBus.emit('luna:actionDismissed', { dismissAll: true })
      addToast('Todas as ações foram ignoradas', 'info')
    } catch (err) {
      addToast('Erro ao ignorar ações', 'error')
    } finally {
      setDismissingAll(false)
    }
  }

  const handleActionDone = (id) => {
    setItems(prev => prev.filter(i => i.id !== id))
    lunaEventBus.emit('luna:actionDismissed', { id })
  }

  const critical = items.filter(i => i.priority === 'critical')
  const warning = items.filter(i => i.priority === 'warning')
  const info = items.filter(i => i.priority === 'info')

  const totalCount = items.length

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 420, opacity: 0.8 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 420, opacity: 0.8 }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="fixed top-0 right-0 bottom-0 w-[420px] z-[110] bg-nexo-card border-l border-nexo-border shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-nexo-border shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-nexo-primary to-purple-600 flex items-center justify-center">
            <Bell className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-nexo-text">Ações Pendentes da Luna</h3>
            <p className="text-[10px] text-nexo-muted">
              {totalCount === 0 ? 'Tudo em ordem ✨' : `${totalCount} ação(ões) requer(em) atenção`}
            </p>
          </div>
          {totalCount > 0 && (
            <button
              onClick={handleDismissAll}
              disabled={dismissingAll}
              className="text-[10px] px-2 py-1 rounded-lg bg-nexo-bg border border-nexo-border text-nexo-muted hover:text-nexo-text hover:border-nexo-primary/50 transition-all disabled:opacity-50"
            >
              {dismissingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Ignorar tudo'}
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-nexo-border/50 transition-colors text-nexo-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-nexo-primary animate-spin" />
            </div>
          )}

          {!loading && items.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 space-y-3"
            >
              <div className="w-16 h-16 rounded-full bg-nexo-primary/10 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-nexo-primary" />
              </div>
              <p className="text-sm text-nexo-text font-medium">Tudo em ordem!</p>
              <p className="text-xs text-nexo-muted">Nenhuma ação pendente no momento.</p>
            </motion.div>
          )}

          {/* Críticos */}
          {critical.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <Flame className="w-3.5 h-3.5 text-red-400" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-red-400">
                  Crítico · {critical.length}
                </span>
              </div>
              <AnimatePresence>
                {critical.map(item => (
                  <ActionCard
                    key={item.id}
                    item={item}
                    onDismiss={handleDismiss}
                    onActionDone={handleActionDone}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Atenção */}
          {warning.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                  Atenção · {warning.length}
                </span>
              </div>
              <AnimatePresence>
                {warning.map(item => (
                  <ActionCard
                    key={item.id}
                    item={item}
                    onDismiss={handleDismiss}
                    onActionDone={handleActionDone}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Info */}
          {info.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <Info className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">
                  Info · {info.length}
                </span>
              </div>
              <AnimatePresence>
                {info.map(item => (
                  <ActionCard
                    key={item.id}
                    item={item}
                    onDismiss={handleDismiss}
                    onActionDone={handleActionDone}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-3 border-t border-nexo-border">
          <button
            onClick={() => lunaEventBus.emit('luna:openChat')}
            className="flex items-center justify-center gap-1.5 w-full text-[10px] text-nexo-muted hover:text-nexo-primary transition-colors py-1"
          >
            Abrir chat completo da Luna <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
