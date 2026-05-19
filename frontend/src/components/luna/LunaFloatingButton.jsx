import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, X, Send, Loader2, MessageSquare } from 'lucide-react'
import { useLunaNLU } from '../../hooks/useLunaNLU'
import SmartFormModal from './SmartFormModal'

/**
 * LunaFloatingButton — Botão flutuante global para acessar a Luna via NLU.
 *
 * Posicionado no canto inferior direito da tela.
 * Ao clicar, abre um input overlay para o usuário digitar comandos.
 */

export default function LunaFloatingButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [text, setText] = useState('')
  const [modalResult, setModalResult] = useState(null)
  const inputRef = useRef(null)
  const { understand, isLoading, error } = useLunaNLU()

  // Foca no input quando abre
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Fecha com ESC
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        setModalResult(null)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!text.trim() || isLoading) return

    const result = await understand(text.trim())
    if (result) {
      setModalResult(result)
      setText('')
      setIsOpen(false)
    }
  }

  const handleSuccess = (data) => {
    // Ação executada com sucesso — pode mostrar toast aqui no futuro
    console.log('[Luna] Ação executada:', data)
  }

  return (
    <>
      {/* Input Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute bottom-24 right-6 left-6 sm:left-auto sm:w-[420px]"
              onClick={e => e.stopPropagation()}
            >
              <div className="glass-card p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-nexo-primary" />
                  <span className="text-xs font-medium text-nexo-text">O que você precisa?</span>
                </div>

                <form onSubmit={handleSubmit} className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder='Ex: "cria tarefa urgente", "quanto temos no caixa"...'
                    className="flex-1 bg-nexo-bg border border-nexo-border rounded-lg px-3 py-2 text-sm text-nexo-text placeholder:text-nexo-muted/50 outline-none focus:border-nexo-primary transition-colors"
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !text.trim()}
                    className="p-2 bg-nexo-primary text-white rounded-lg hover:bg-nexo-primary/80 transition-colors disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </form>

                {error && (
                  <p className="text-xs text-nexo-danger">{error}</p>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {['cria tarefa', 'quanto temos no caixa', 'manda zap', 'faz proposta'].map(suggestion => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setText(suggestion)
                        inputRef.current?.focus()
                      }}
                      className="px-2 py-1 text-[10px] rounded-full bg-nexo-card border border-nexo-border text-nexo-muted hover:text-nexo-text hover:border-nexo-primary/50 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botão flutuante */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-4 py-3 rounded-full shadow-lg shadow-nexo-primary/20 transition-all ${
          isOpen
            ? 'bg-nexo-danger text-white'
            : 'bg-nexo-primary text-white hover:bg-nexo-primary/90'
        }`}
      >
        {isOpen ? <X className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
        <span className="text-sm font-medium hidden sm:inline">{isOpen ? 'Fechar' : 'Luna'}</span>
      </motion.button>

      {/* Smart Form Modal */}
      {modalResult && (
        <SmartFormModal
          result={modalResult}
          onClose={() => setModalResult(null)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  )
}
