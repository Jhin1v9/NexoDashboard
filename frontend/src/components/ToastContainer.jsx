import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, AlertCircle, Info, XCircle, X } from 'lucide-react'
import { registerToastListener } from '../hooks/useToast'

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info
}

const COLORS = {
  success: 'text-nexo-success border-nexo-success/30 bg-nexo-success/10',
  error: 'text-nexo-danger border-nexo-danger/30 bg-nexo-danger/10',
  warning: 'text-nexo-warning border-nexo-warning/30 bg-nexo-warning/10',
  info: 'text-nexo-info border-nexo-info/30 bg-nexo-info/10'
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    return registerToastListener((toast) => {
      setToasts(prev => [...prev, toast])
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id))
      }, toast.duration)
    })
  }, [])

  return (
    <div className="fixed bottom-4 right-4 z-[100] space-y-2">
      <AnimatePresence>
        {toasts.map(t => {
          const Icon = ICONS[t.type] || Info
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.95 }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm min-w-[280px] max-w-[400px] ${COLORS[t.type] || COLORS.info}`}
            >
              <Icon size={18} />
              <span className="text-sm flex-1">{t.message}</span>
              <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} className="opacity-60 hover:opacity-100">
                <X size={14} />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
