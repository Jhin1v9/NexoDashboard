/**
 * ═════════════════════════════════════════════════════════════════════════════
 * LunaProactiveToast — Toasts proativos da Luna (Modo D parcial)
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Mostra notificações automáticas quando há pendências críticas no sistema,
 * sem o usuário precisar clicar no botão flutuante.
 *
 * Regras:
 *   - Apenas 1 toast por vez, não spam
 *   - Prioridade: CRITICAL > WARNING > INFO
 *   - Dismiss manual ou auto-hide após 8s
 *   - Clique abre o minichat da Luna com sugestão contextual
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle, AlertCircle, Info, X, ArrowRight,
  Flame, Mail, ClipboardList, DollarSign
} from 'lucide-react'
import { lunaEventBus } from '../../lib/lunaEventBus'
import axios from 'axios'

const ICONS = {
  critical: Flame,
  warning: AlertTriangle,
  info: Info,
}

const COLORS = {
  critical: 'border-red-500/30 bg-red-500/10 text-red-300',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  info: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
}

const PROGRESS_COLORS = {
  critical: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
}

function buildToastFromData(data) {
  if (!data || data.total === 0) return null

  const { breakdown = {} } = data

  // IDs estáveis baseados no tipo + contagem — assim dismissed funciona corretamente
  // Se a contagem mudar, o ID muda e o toast reaparece (comportamento correto)

  // CRITICAL: tarefas P0 ou alerts ativos
  if (breakdown.tasksCritical > 0) {
    return {
      id: `critical-tasks-${breakdown.tasksCritical}`,
      type: 'critical',
      icon: Flame,
      title: `${breakdown.tasksCritical} tarefa(s) P0 crítica(s)`,
      message: 'Requer atenção imediata. Toque para ver.',
      action: 'tarefas P0',
    }
  }
  if (breakdown.alertsActive > 0) {
    return {
      id: `critical-alerts-${breakdown.alertsActive}`,
      type: 'critical',
      icon: AlertTriangle,
      title: `${breakdown.alertsActive} alerta(s) ativo(s)`,
      message: 'Verifique o centro de operações.',
      action: 'status das operações',
    }
  }

  // WARNING: tarefas atrasadas
  if (breakdown.tasksOverdue > 0) {
    return {
      id: `warning-overdue-${breakdown.tasksOverdue}`,
      type: 'warning',
      icon: ClipboardList,
      title: `${breakdown.tasksOverdue} tarefa(s) atrasada(s)`,
      message: 'Prazos vencidos precisam de atenção.',
      action: 'tarefas atrasadas',
    }
  }

  // INFO: emails pendentes
  if (breakdown.emailsPending > 0) {
    return {
      id: `info-emails-${breakdown.emailsPending}`,
      type: 'info',
      icon: Mail,
      title: `${breakdown.emailsPending} rascunho(s) pendente(s)`,
      message: 'Há drafts da Luna aguardando aprovação.',
      action: 'rascunhos pendentes',
    }
  }

  // INFO: leads novos
  if (breakdown.leadsNew > 0) {
    return {
      id: `info-leads-${breakdown.leadsNew}`,
      type: 'info',
      icon: DollarSign,
      title: `${breakdown.leadsNew} lead(s) novo(s)`,
      message: 'Novos prospects entraram no pipeline.',
      action: 'leads novos',
    }
  }

  return null
}

const MAX_DISMISSED_IDS = 50

export default function LunaProactiveToast() {
  const [toast, setToast] = useState(null)
  const [dismissedIds, setDismissedIds] = useState(new Set())
  const lastShownRef = useRef(null)
  const timerRef = useRef(null)
  const isFetchingRef = useRef(false)
  const dismissedIdsRef = useRef(dismissedIds)
  const toastRef = useRef(toast)

  // Manter refs sincronizadas para evitar recriação de callbacks
  useEffect(() => { dismissedIdsRef.current = dismissedIds }, [dismissedIds])
  useEffect(() => { toastRef.current = toast }, [toast])

  const fetchAndShow = useCallback(async () => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true
    try {
      const token = localStorage.getItem('nexo_token') || ''
      const res = await axios.get('/api/luna/proactive', {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000,
      })
      const data = res.data
      if (!data.success || data.total === 0) {
        setToast(null)
        return
      }

      const newToast = buildToastFromData(data)
      if (!newToast) {
        setToast(null)
        return
      }

      // Não mostra se já foi dismissado recentemente
      if (dismissedIdsRef.current.has(newToast.id)) return

      // Não mostra o mesmo tipo se já está visível
      if (lastShownRef.current?.type === newToast.type && toastRef.current) return

      lastShownRef.current = newToast
      setToast(newToast)

      // Auto-hide após 8s
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setToast(null)
      }, 8000)
    } catch {
      // Silencioso — não queremos spam de erro
    } finally {
      isFetchingRef.current = false
    }
  }, []) // sem dependências — usa refs

  // Busca a cada 60s, e também na montagem (setTimeout recursivo evita overlapping)
  useEffect(() => {
    let timeoutId = null
    const schedule = () => {
      fetchAndShow()
      timeoutId = setTimeout(schedule, 60000)
    }
    schedule()
    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [fetchAndShow])

  const handleDismiss = (e) => {
    e?.stopPropagation()
    setToast((current) => {
      if (current) {
        setDismissedIds(prev => {
          const next = new Set(prev)
          next.add(current.id)
          // Evita crescimento infinito
          if (next.size > MAX_DISMISSED_IDS) {
            const arr = Array.from(next)
            return new Set(arr.slice(arr.length - MAX_DISMISSED_IDS))
          }
          return next
        })
      }
      return null
    })
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  const handleClick = () => {
    if (!toast) return
    // Abre o Luna Action Center em vez de jogar texto no chat
    lunaEventBus.emit('luna:openActionCenter')
    setToast(null)
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  const Icon = toast?.icon || ICONS[toast?.type] || Info
  const colorClass = toast ? COLORS[toast.type] : ''
  const progressColor = toast ? PROGRESS_COLORS[toast.type] : ''

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-24 right-6 left-6 sm:left-auto sm:w-[380px] z-[95] cursor-pointer"
          onClick={handleClick}
        >
          <div className={`rounded-xl border ${colorClass} p-4 shadow-xl backdrop-blur-sm relative overflow-hidden`}>
            {/* Glow sutil */}
            <div className={`absolute -top-10 -right-10 w-20 h-20 rounded-full blur-2xl opacity-20
              ${toast.type === 'critical' ? 'bg-red-500' : toast.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'}`}
            />

            <div className="flex items-start gap-3 relative">
              <div className="mt-0.5 shrink-0">
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{toast.title}</p>
                <p className="text-xs opacity-80 mt-0.5">{toast.message}</p>
                <div className="flex items-center gap-1 mt-2 text-xs opacity-70">
                  <span>Clique para abrir</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors -mt-1 -mr-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Barra de progresso (auto-hide) */}
            <motion.div
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: 8, ease: 'linear' }}
              className={`absolute bottom-0 left-0 h-0.5 rounded-full ${progressColor}`}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
