import { createContext, useContext, useState, useCallback } from 'react'
import { X } from 'lucide-react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((msg, type = 'info') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`glass-card px-4 py-3 flex items-center gap-3 min-w-[280px] ${
            t.type === 'success' ? 'border-l-4 border-l-nexo-success' :
            t.type === 'error' ? 'border-l-4 border-l-nexo-danger' :
            t.type === 'warning' ? 'border-l-4 border-l-nexo-warning' :
            'border-l-4 border-l-nexo-info'
          }`}>
            <span className="text-sm flex-1">{t.msg}</span>
            <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>
              <X size={14} className="text-nexo-muted" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
