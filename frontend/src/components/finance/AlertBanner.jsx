import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle, AlertCircle, Info, XCircle, X
} from 'lucide-react'

/**
 * @typedef {Object} AlertItem
 * @property {string} id
 * @property {string} type
 * @property {string} message
 * @property {string} severity
 *
 * @typedef {Object} AlertBannerProps
 * @property {AlertItem[]} alerts
 * @property {boolean} [dismissible]
 * @property {(id:string) => void} [onDismiss]
 */

const SEVERITY_CONFIG = {
  high:   { icon: XCircle,       color: '#ff4757', bg: 'rgba(255,71,87,0.10)', border: 'rgba(255,71,87,0.25)' },
  medium: { icon: AlertTriangle, color: '#ffa502', bg: 'rgba(255,165,2,0.10)',  border: 'rgba(255,165,2,0.25)' },
  low:    { icon: Info,          color: '#6c5ce7', bg: 'rgba(108,92,231,0.10)', border: 'rgba(108,92,231,0.25)' },
}

/** @param {AlertBannerProps} props */
export default function AlertBanner({ alerts = [], dismissible = true, onDismiss }) {
  const [dismissed, setDismissed] = useState(new Set())

  const handleDismiss = (id) => {
    setDismissed(prev => new Set(prev).add(id))
    onDismiss?.(id)
  }

  const visible = alerts.filter(a => !dismissed.has(a.id))

  if (visible.length === 0) return null

  return (
    <AnimatePresence>
      {visible.map((alert, idx) => {
        const sev = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.low
        const Icon = sev.icon

        return (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, y: -16, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
            className="mb-2"
          >
            <div
              className="flex items-start gap-3 px-4 py-3 rounded-lg"
              style={{
                background: sev.bg,
                border: `1px solid ${sev.border}`,
              }}
            >
              <Icon size={18} style={{ color: sev.color }} className="shrink-0 mt-0.5" />
              <span className="text-sm font-medium" style={{ color: sev.color }}>
                {alert.message}
              </span>
              {dismissible && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleDismiss(alert.id)}
                  className="ml-auto shrink-0 p-0.5 rounded hover:bg-white/10 transition-colors"
                >
                  <X size={14} style={{ color: sev.color }} />
                </motion.button>
              )}
            </div>
          </motion.div>
        )
      })}
    </AnimatePresence>
  )
}
