import { useState, useMemo, useEffect } from 'react'
import { X, Users, Wallet, CheckCircle, AlertCircle } from 'lucide-react'

const PAYMENT_KEYWORDS = [
  'pagamento', 'receber', 'cobrar', 'entrada', 'faturamento', 'fatura',
  'invoice', 'receita', 'venda', 'cliente pagou', 'pago', 'transferência recebida',
  'parcela', 'quota', 'honorarios', 'fee', 'comissao', 'deposito'
]

function detectPaymentKeywords(text = '') {
  const lower = text.toLowerCase()
  return PAYMENT_KEYWORDS.some(kw => lower.includes(kw))
}

const DEFAULT_PARTNERS = [
  { id: 'nexo-abner-001', name: 'Abner', emoji: '🧠', color: '#6B7280', active: true },
  { id: 'nexo-enoque-001', name: 'Enoque', emoji: '⚡', color: '#6B7280', active: true },
  { id: 'nexo-elias-pessoal', name: 'Elias', emoji: '🎯', color: '#6B7280', active: true },
  { id: 'nexo-digital', name: 'NEXO Digital', emoji: '🏢', color: '#3742fa', active: true, isCompany: true }
]

export default function PaymentModal({ onClose, onSubmit }) {
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [source, setSource] = useState('')
  const [partners, setPartners] = useState(DEFAULT_PARTNERS)
  const [applyImmediately, setApplyImmediately] = useState(false)
  const [loading, setLoading] = useState(false)

  const isPaymentDetected = useMemo(() => detectPaymentKeywords(description), [description])

  const activePartners = partners.filter(p => p.active)
  const splitCount = activePartners.length
  const splitAmount = useMemo(() => {
    const val = parseFloat(amount)
    if (isNaN(val) || val <= 0 || splitCount === 0) return 0
    return parseFloat((val / splitCount).toFixed(2))
  }, [amount, splitCount])

  const remainingAmount = useMemo(() => {
    const val = parseFloat(amount)
    if (isNaN(val) || val <= 0 || splitCount === 0) return 0
    return parseFloat((val - splitAmount * (splitCount - 1)).toFixed(2))
  }, [amount, splitAmount, splitCount])

  const togglePartner = (id) => {
    setPartners(prev => prev.map(p => {
      if (p.id === id) {
        // Não permite desativar todos
        const wouldBeActive = prev.filter(x => x.active && x.id !== id)
        if (!p.active || wouldBeActive.length > 0) {
          return { ...p, active: !p.active }
        }
      }
      return p
    }))
  }

  const handleSubmit = async (andApply = false) => {
    const val = parseFloat(amount)
    if (isNaN(val) || val <= 0) {
      alert('Informe um valor válido')
      return
    }
    if (!description.trim()) {
      alert('Informe uma descrição')
      return
    }
    setLoading(true)
    try {
      const payload = {
        amount: val,
        description,
        date,
        source: source || 'client',
        category: 'client-payment',
        note: '',
        applyImmediately: andApply || applyImmediately
      }
      const res = await fetch('/api/cash-box/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (data.success) {
        onSubmit?.(data)
        onClose()
      } else {
        alert(data.error || 'Erro ao criar pagamento')
      }
    } catch (e) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto border border-nexo-border rounded-xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Wallet size={18} className="text-nexo-success" />
            <h2 className="text-base font-semibold text-nexo-text">Novo Pagamento Recebido</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-nexo-border rounded-lg">
            <X size={18} className="text-nexo-muted" />
          </button>
        </div>

        {/* Detecção automática */}
        {isPaymentDetected && (
          <div className="mb-4 p-2.5 rounded-lg bg-nexo-success/10 border border-nexo-success/30 flex items-center gap-2">
            <CheckCircle size={14} className="text-nexo-success" />
            <span className="text-xs text-nexo-success">Detectado: Pagamento recebido</span>
          </div>
        )}

        {/* Valor */}
        <label className="block mb-4">
          <span className="text-xs text-nexo-muted mb-1 block">Valor Total (€)</span>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0,00"
            className="w-full bg-nexo-card border border-nexo-border rounded-lg px-3 py-2 text-sm text-nexo-text focus:border-nexo-success focus:outline-none"
            autoFocus
          />
        </label>

        {/* Descrição */}
        <label className="block mb-4">
          <span className="text-xs text-nexo-muted mb-1 block">Descrição</span>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Ex: Pagamento do Paulo — Site SantaFé"
            className="w-full bg-nexo-card border border-nexo-border rounded-lg px-3 py-2 text-sm text-nexo-text focus:border-nexo-success focus:outline-none"
          />
        </label>

        {/* Data + Fonte */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <label>
            <span className="text-xs text-nexo-muted mb-1 block">Data</span>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-nexo-card border border-nexo-border rounded-lg px-3 py-2 text-sm text-nexo-text focus:border-nexo-success focus:outline-none"
            />
          </label>
          <label>
            <span className="text-xs text-nexo-muted mb-1 block">Cliente/Fonte</span>
            <input
              type="text"
              value={source}
              onChange={e => setSource(e.target.value)}
              placeholder="Ex: Paulo (SantaFé)"
              className="w-full bg-nexo-card border border-nexo-border rounded-lg px-3 py-2 text-sm text-nexo-text focus:border-nexo-success focus:outline-none"
            />
          </label>
        </div>

        {/* Split Visual */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Users size={14} className="text-nexo-muted" />
            <span className="text-xs text-nexo-muted">Distribuição entre sócios</span>
          </div>

          {amount && parseFloat(amount) > 0 && splitCount > 0 && (
            <div className="mb-2 p-2 rounded-lg bg-nexo-primary/10 border border-nexo-primary/30">
              <p className="text-xs text-nexo-primary text-center">
                {splitCount === 4
                  ? 'Divisão igualitária: 25% cada'
                  : `Divisão proporcional: ${(100 / splitCount).toFixed(1)}% cada (${splitCount} participantes)`}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {partners.map((partner, idx) => {
              const isLast = idx === partners.length - 1
              const displayAmount = isLast && splitCount > 0
                ? remainingAmount
                : splitAmount
              return (
                <div
                  key={partner.id}
                  onClick={() => togglePartner(partner.id)}
                  className={`cursor-pointer p-3 rounded-lg border transition-all ${
                    partner.active
                      ? 'bg-nexo-card border-nexo-success/50 ring-1 ring-nexo-success/30'
                      : 'bg-nexo-card/50 border-nexo-border/50 opacity-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{partner.emoji}</span>
                      <span className="text-xs font-medium text-nexo-text">{partner.name}</span>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      partner.active
                        ? 'border-nexo-success bg-nexo-success'
                        : 'border-nexo-border'
                    }`}>
                      {partner.active && <CheckCircle size={10} className="text-white" />}
                    </div>
                  </div>
                  <div className="text-xs text-nexo-muted">
                    {splitCount > 0 && amount && parseFloat(amount) > 0
                      ? `€ ${displayAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                      : '—'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Checkbox aplicar imediatamente */}
        <label className="flex items-center gap-2 mb-5 cursor-pointer">
          <input
            type="checkbox"
            checked={applyImmediately}
            onChange={e => setApplyImmediately(e.target.checked)}
            className="w-4 h-4 rounded border-nexo-border bg-nexo-card text-nexo-success focus:ring-nexo-success"
          />
          <span className="text-xs text-nexo-muted">
            Aplicar distribuição automaticamente (gerar saídas de pagamento)
          </span>
        </label>

        {/* Aviso */}
        {!applyImmediately && (
          <div className="mb-4 p-2.5 rounded-lg bg-nexo-info/10 border border-nexo-info/30 flex items-start gap-2">
            <AlertCircle size={14} className="text-nexo-info mt-0.5" />
            <span className="text-xs text-nexo-info">
              Se não aplicar agora, o pagamento entra no caixa e você pode aplicar a distribuição depois.
            </span>
          </div>
        )}

        {/* Botões */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSubmit(false)}
            disabled={loading}
            className="flex-1 py-2.5 rounded-lg bg-nexo-card border border-nexo-border text-sm font-medium text-nexo-text hover:bg-nexo-border disabled:opacity-50"
          >
            {loading ? 'Salvando...' : 'Criar Pagamento'}
          </button>
          <button
            onClick={() => handleSubmit(true)}
            disabled={loading}
            className="flex-1 py-2.5 rounded-lg bg-nexo-success text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Aplicando...' : 'Criar e Aplicar'}
          </button>
        </div>
      </div>
    </div>
  )
}
