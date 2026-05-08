import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Zap, Server, Brain, Code, Megaphone, MoreHorizontal, Trash2 } from 'lucide-react'
import axios from 'axios'

const CATEGORIES = [
  { id: 'hosting', label: 'Hosting', icon: Server, color: '#e056fd', examples: 'Hostinger, Vercel, Netlify' },
  { id: 'ai_tools', label: 'IA / Tools', icon: Brain, color: '#686de0', examples: 'Kimi, ChatGPT, Claude' },
  { id: 'software', label: 'Software', icon: Code, color: '#7bed9f', examples: 'VS Code, Figma, GitHub' },
  { id: 'marketing', label: 'Marketing', icon: Megaphone, color: '#ff6b81', examples: 'Ads, SEO, Redes' },
  { id: 'others', label: 'Outros', icon: MoreHorizontal, color: '#95afc0', examples: 'Material, Transporte' },
]

export default function QuickExpenseFab({ onAdded }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(false)

  const reset = () => {
    setOpen(false)
    setStep(1)
    setName('')
    setAmount('')
    setCategory('')
  }

  const handleSubmit = async () => {
    if (!name || !amount || !category) return
    setLoading(true)
    try {
      await axios.post('/api/expenses/quick', {
        name,
        amount: parseFloat(amount),
        category,
        categoryLabel: CATEGORIES.find(c => c.id === category)?.label,
        note: '',
        deductFromCashBox: true
      })
      reset()
      onAdded?.()
    } catch (e) {
      alert('Erro ao salvar: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-nexo-danger flex items-center justify-center shadow-lg shadow-nexo-danger/30 hover:scale-110 transition-transform z-40"
      >
        <Plus size={24} className="text-white" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4"
            onClick={reset}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="glass-card w-full max-w-md overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-nexo-border">
                <h3 className="font-bold">
                  {step === 1 && '💸 O que gastou?'}
                  {step === 2 && '💶 Quanto?'}
                  {step === 3 && '📂 Qual categoria?'}
                </h3>
                <button onClick={reset} className="p-1 hover:bg-nexo-card rounded"><X size={18} /></button>
              </div>

              <div className="p-4 space-y-4">
                {/* Step 1: Name */}
                {step === 1 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                    <input
                      autoFocus
                      className="w-full px-4 py-3 bg-nexo-card rounded-xl border border-nexo-border outline-none focus:border-nexo-danger text-lg"
                      placeholder="Ex: Hostinger, Kimi, etc"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && name && setStep(2)}
                    />
                    <p className="text-xs text-nexo-muted mt-2">Digite e pressione Enter</p>
                  </motion.div>
                )}

                {/* Step 2: Amount */}
                {step === 2 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-nexo-muted text-lg">€</span>
                      <input
                        autoFocus
                        type="number"
                        step="0.01"
                        className="w-full pl-10 pr-4 py-3 bg-nexo-card rounded-xl border border-nexo-border outline-none focus:border-nexo-danger text-lg"
                        placeholder="0.00"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && amount && setStep(3)}
                      />
                    </div>
                    <div className="flex gap-2 mt-3">
                      {['10', '25', '50', '100', '120'].map(v => (
                        <button key={v} onClick={() => { setAmount(v); setStep(3); }}
                          className="px-3 py-1.5 bg-nexo-card rounded-lg text-xs hover:bg-nexo-border transition-colors">
                          €{v}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Category */}
                {step === 3 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-2">
                    {CATEGORIES.map(cat => {
                      const Icon = cat.icon
                      return (
                        <button
                          key={cat.id}
                          onClick={() => setCategory(cat.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                            category === cat.id 
                              ? 'bg-nexo-danger/20 border border-nexo-danger/50' 
                              : 'bg-nexo-card hover:bg-nexo-border'
                          }`}
                        >
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: cat.color + '20' }}>
                            <Icon size={18} style={{ color: cat.color }} />
                          </div>
                          <div className="text-left">
                            <div className="text-sm font-medium">{cat.label}</div>
                            <div className="text-[10px] text-nexo-muted">{cat.examples}</div>
                          </div>
                        </button>
                      )
                    })}
                  </motion.div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between p-4 border-t border-nexo-border">
                {step > 1 && (
                  <button onClick={() => setStep(step - 1)} className="text-sm text-nexo-muted hover:text-white">
                    ← Voltar
                  </button>
                )}
                <div className="flex-1" />
                {step === 3 ? (
                  <button
                    onClick={handleSubmit}
                    disabled={!category || loading}
                    className="px-6 py-2 bg-nexo-danger rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {loading ? 'Salvando...' : '✓ Confirmar'}
                  </button>
                ) : (
                  <button
                    onClick={() => setStep(step + 1)}
                    disabled={step === 1 ? !name : !amount}
                    className="px-6 py-2 bg-nexo-info rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    Próximo →
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

