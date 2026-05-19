/**
 * ═════════════════════════════════════════════════════════════════════════════
 * LunaBatchAction — Modo C: Transformação de Interface
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Permite ao usuário selecionar múltiplos itens da página atual
 * e aplicar uma ação em lote. Exemplos:
 *   - "excluir tarefas atrasadas" → checkboxes nas tarefas da lista
 *   - "arquivar emails" → seleção múltipla na inbox
 *   - "marcar como concluído" → checkboxes nas tarefas pendentes
 *
 * Integra com o LunaContext para ler os dados visíveis da página atual.
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckSquare, Square, Trash2, CheckCircle, Archive,
  X, ArrowRight, AlertTriangle, Loader2, User, Mail
} from 'lucide-react'
import { useLunaContext } from '../../hooks/useLunaContext'
import { useToast } from '../../context/ToastContext'
import axios from 'axios'

const ACTION_CONFIG = {
  'tarefa.deletar': { icon: Trash2, label: 'Excluir selecionadas', color: 'red', confirm: true },
  'tarefa.concluir': { icon: CheckCircle, label: 'Concluir selecionadas', color: 'green', confirm: false },
  'tarefa.atribuir': { icon: User, label: 'Atribuir selecionadas', color: 'blue', confirm: false },
  'email.arquivar': { icon: Archive, label: 'Arquivar selecionados', color: 'slate', confirm: false },
  'email.mover_lixeira': { icon: Trash2, label: 'Mover para lixeira', color: 'red', confirm: true },
  'email.marcar_lido': { icon: CheckCircle, label: 'Marcar como lidos', color: 'green', confirm: false },
  'email.marcar_spam': { icon: Trash2, label: 'Marcar como spam', color: 'red', confirm: true },
}

// Tailwind purge-safe color maps
const COLOR_MAP = {
  red: { text: 'text-red-400', bg: 'bg-red-500', border: 'border-red-500' },
  green: { text: 'text-green-400', bg: 'bg-green-500', border: 'border-green-500' },
  blue: { text: 'text-blue-400', bg: 'bg-blue-500', border: 'border-blue-500' },
  slate: { text: 'text-slate-400', bg: 'bg-slate-500', border: 'border-slate-500' },
  primary: { text: 'text-nexo-primary', bg: 'bg-nexo-primary', border: 'border-nexo-primary' },
}

export default function LunaBatchAction({
  intent,
  onClose,
  onSuccess,
}) {
  const { pageContext } = useLunaContext()
  const { addToast } = useToast()
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const config = ACTION_CONFIG[intent] || { icon: ArrowRight, label: 'Executar', color: 'primary', confirm: false }
  const colors = COLOR_MAP[config.color] || COLOR_MAP.primary
  const ActionIcon = config.icon

  // Extrai itens do pageContext (vindo dos harvesters)
  const items = pageContext?.items || pageContext?.data?.items || []

  // Se o usuário desmarcar todos, cancela a confirmação para evitar estado órfão
  useEffect(() => {
    if (selectedIds.size === 0 && showConfirm) {
      setShowConfirm(false)
    }
  }, [selectedIds.size, showConfirm])

  const toggleItem = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(items.map(i => i.id)))
    }
  }, [items, selectedIds.size])

  const handleExecute = async () => {
    if (isSubmitting) return
    if (selectedIds.size === 0) {
      addToast('Selecione pelo menos um item', 'warning')
      return
    }

    if (config.confirm && !showConfirm) {
      setShowConfirm(true)
      return
    }

    setIsSubmitting(true)
    try {
      const token = localStorage.getItem('nexo_token') || ''
      await axios.post('/api/luna/batch', {
        intent,
        ids: Array.from(selectedIds),
      }, {
        headers: { Authorization: `Bearer ${token}` },
      })

      addToast(`${selectedIds.size} itens processados com sucesso ✓`, 'success')
      onSuccess?.({ intent, count: selectedIds.size })
      onClose?.()
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Erro ao processar'
      addToast(msg, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (items.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-nexo-border bg-nexo-card p-6 text-center"
      >
        <AlertTriangle className="w-8 h-8 text-nexo-warning mx-auto mb-2" />
        <p className="text-nexo-text font-medium">Nenhum item visível nesta página</p>
        <p className="text-sm text-nexo-muted mt-1">
          Navegue para a página correta e tente novamente.
        </p>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 rounded-lg text-sm bg-nexo-bg border border-nexo-border hover:border-nexo-primary transition-all"
        >
          Fechar
        </button>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="rounded-xl border border-nexo-border bg-nexo-card overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-nexo-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ActionIcon className={`w-4 h-4 ${colors.text}`} />
          <span className="text-sm font-medium text-nexo-text">
            {config.label}
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-nexo-bg text-nexo-muted">
            {selectedIds.size}/{items.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-nexo-muted hover:text-nexo-text transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Toolbar */}
      <div className="px-4 py-2 border-b border-nexo-border bg-nexo-bg/50 flex items-center gap-3">
        <button
          onClick={toggleAll}
          className="flex items-center gap-1.5 text-xs text-nexo-muted hover:text-nexo-text transition-colors"
        >
          {selectedIds.size === items.length ? (
            <CheckSquare className="w-3.5 h-3.5" />
          ) : (
            <Square className="w-3.5 h-3.5" />
          )}
          {selectedIds.size === items.length ? 'Desmarcar todos' : 'Selecionar todos'}
        </button>
      </div>

      {/* Lista de itens */}
      <div className="max-h-64 overflow-y-auto">
        {items.map((item) => {
          const isSelected = selectedIds.has(item.id)
          return (
            <button
              key={item.id}
              onClick={() => toggleItem(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all border-b border-nexo-border/50 last:border-0
                ${isSelected ? 'bg-nexo-primary/5' : 'hover:bg-white/5'}`}
            >
              <div className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors
                ${isSelected
                  ? `${colors.bg} ${colors.border}`
                  : 'border-nexo-border bg-nexo-bg'
                }`}
              >
                {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm truncate ${isSelected ? 'text-nexo-text font-medium' : 'text-nexo-muted'}`}>
                  {item.title || item.label || item.name || item.subject || `Item #${item.id}`}
                </p>
                {item.detail && (
                  <p className="text-xs text-nexo-muted truncate">{item.detail}</p>
                )}
              </div>
              {item.meta && (
                <span className="text-xs text-nexo-muted shrink-0">{item.meta}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Footer / Confirm */}
      <AnimatePresence>
        {showConfirm && selectedIds.size > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-red-500/20 bg-red-500/5 px-4 py-3"
          >
            <p className="text-sm text-red-300 mb-2">
              <AlertTriangle className="w-4 h-4 inline mr-1" />
              Tem certeza? Esta ação afeta <strong>{selectedIds.size}</strong> itens e não pode ser desfeita.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-3 py-1.5 rounded-lg text-sm border border-nexo-border hover:bg-white/5 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleExecute}
                disabled={isSubmitting}
                className="flex-1 px-3 py-1.5 rounded-lg text-sm bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition-all disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Sim, excluir'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      {!showConfirm && (
        <div className="px-4 py-3 border-t border-nexo-border flex items-center justify-between">
          <span className="text-xs text-nexo-muted">
            {selectedIds.size === 0
              ? 'Selecione os itens'
              : `${selectedIds.size} selecionado${selectedIds.size > 1 ? 's' : ''}`
            }
          </span>
          <button
            onClick={handleExecute}
            disabled={selectedIds.size === 0 || isSubmitting}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${selectedIds.size > 0
                ? `${colors.bg}/20 ${colors.text} border ${colors.border}/30 hover:${colors.bg}/30`
                : 'bg-nexo-bg text-nexo-muted border border-nexo-border cursor-not-allowed'
              } disabled:opacity-50`}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ActionIcon className="w-4 h-4" />
            )}
            {config.label}
          </button>
        </div>
      )}
    </motion.div>
  )
}
