import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Zap } from 'lucide-react'
import axios from 'axios'

const USERS = [
  { id: 'abner', name: 'Abner', color: '#3742fa' },
  { id: 'nonoke', name: 'Nonoke', color: '#2ed573' },
  { id: 'elias', name: 'Elias', color: '#ffa502' },
]

export default function SyncSessionModal({ open, onClose }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) {
      setError(null)
      setLoading(false)
    }
  }, [open])

  const handleSelect = async (userId) => {
    setLoading(true)
    setError(null)
    try {
      const res = await axios.post('/api/auth/sync', { userId }, {
        headers: { 'X-Sync-Token': 'nexo-tap-7x-2026' }
      })
      if (res.data.success) {
        localStorage.setItem('nexo_token', res.data.token)
        window.location.href = '/dashboard'
      } else {
        setError('Falha ao sincronizar')
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Erro de rede')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-nexo-card border border-nexo-border rounded-2xl p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap size={18} className="text-nexo-warning" />
                <h3 className="font-bold text-sm">Sessão Rápida</h3>
              </div>
              <button onClick={onClose} className="p-1 hover:bg-nexo-bg rounded-lg transition-colors">
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-nexo-muted mb-4">
              Selecione o perfil para continuar.
            </p>

            <div className="space-y-2">
              {USERS.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleSelect(u.id)}
                  disabled={loading}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-nexo-bg hover:bg-nexo-border/50 border border-nexo-border transition-all disabled:opacity-50"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: u.color }}
                  >
                    {u.name[0]}
                  </div>
                  <span className="text-sm font-medium">{u.name}</span>
                </button>
              ))}
            </div>

            {error && (
              <p className="mt-3 text-xs text-nexo-danger text-center">{error}</p>
            )}

            {loading && (
              <p className="mt-3 text-xs text-nexo-muted text-center">Sincronizando…</p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
