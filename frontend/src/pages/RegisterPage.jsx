import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, ArrowLeft, Zap, Shield, Clock, CheckCircle2, AlertTriangle, Users, Building2, Mail, Phone, MessageSquare, User } from 'lucide-react'
import axios from 'axios'

/* ═══════════════════════════════════════════════════════════════════════════
   RegisterPage — NEXO Dashboard PRO
   Lead Capture / Demo Request
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   • Formulário em 2 steps (dados pessoais → empresa)
   • Split-screen, dark mode, design Linear/Stripe/Vercel
   • Após envio: tela de "obrigado / demo em preparação"
   • Leads vão direto para o Kanban do dashboard (tabela leads existente)
   ═══════════════════════════════════════════════════════════════════════════ */

const COMPANY_SIZES = [
  { value: '1-10', label: '1-10 funcionários' },
  { value: '11-50', label: '11-50 funcionários' },
  { value: '51-200', label: '51-200 funcionários' },
  { value: '200+', label: '200+ funcionários' },
  { value: 'other', label: 'Outros' }
];

export default function RegisterPage() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [leadId, setLeadId] = useState('')
  const [focusedField, setFocusedField] = useState(null)

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    companyName: '',
    companySize: '',
    customCompanySize: '',
    message: ''
  })

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (error) setError('')
  }

  const validateStep1 = () => {
    if (!form.name.trim() || form.name.trim().length < 2) return 'Nome completo é obrigatório'
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Email válido é obrigatório'
    return ''
  }

  const validateStep2 = () => {
    if (!form.companyName.trim()) return 'Nome da empresa é obrigatório'
    if (!form.companySize) return 'Selecione o tamanho da equipe'
    if (form.companySize === 'other' && (!form.customCompanySize || form.customCompanySize.trim() === '')) {
      return 'Informe o número de funcionários'
    }
    return ''
  }

  const handleNext = () => {
    const err = validateStep1()
    if (err) { setError(err); return }
    setError('')
    setStep(2)
  }

  const handleBack = () => {
    setError('')
    setStep(1)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const err = validateStep2()
    if (err) { setError(err); return }

    setLoading(true)
    setError('')

    try {
      const companySizeValue = form.companySize === 'other'
        ? form.customCompanySize.trim()
        : form.companySize

      const res = await axios.post('/api/demo-leads', {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        companyName: form.companyName.trim(),
        companySize: companySizeValue,
        message: form.message.trim()
      })

      if (res.data.success) {
        setLeadId(res.data.leadId)
        setSuccess(true)
      } else {
        setError(res.data.error || 'Erro ao enviar. Tente novamente.')
      }
    } catch (err) {
      if (err.response?.status === 429) {
        setError('Muitas tentativas. Aguarde 15 minutos.')
      } else {
        setError(err.response?.data?.error || 'Erro de conexão. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  // Se já estiver logado, redireciona
  useEffect(() => {
    const token = localStorage.getItem('nexo_token')
    if (token) {
      window.location.href = '/dashboard'
    }
  }, [])

  const inputStyle = (fieldName) => ({
    background: focusedField === fieldName
      ? 'rgba(0, 240, 255, 0.04)'
      : 'rgba(15, 15, 22, 0.6)',
    boxShadow: focusedField === fieldName
      ? 'inset 0 0 0 1px rgba(0, 240, 255, 0.3), 0 0 0 3px rgba(0, 240, 255, 0.05)'
      : 'inset 0 0 0 1px rgba(255, 255, 255, 0.06)'
  })

  return (
    <div className="min-h-screen w-full flex bg-nexo-bg text-nexo-text font-body overflow-hidden">
      {/* ═══════════════════════════════════════════════════════════════════════
          LADO ESQUERDO — Branding
          ═══════════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="hidden lg:flex lg:w-1/2 xl:w-[45%] relative flex-col justify-between p-12 xl:p-16"
        style={{ background: 'linear-gradient(165deg, #0a0a12 0%, #08080c 40%, #0d1117 100%)' }}
      >
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0,240,255,0.8) 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}
        />

        <div className="relative z-10">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }}
            className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-lg"
              style={{
                background: 'linear-gradient(135deg, #00f0ff 0%, #6c5ce7 100%)',
                boxShadow: '0 0 20px rgba(0,240,255,0.15)'
              }}>
              N
            </div>
            <span className="font-heading font-bold text-xl tracking-tight">NEXO</span>
          </motion.div>
        </div>

        <div className="relative z-10 max-w-md">
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.7 }}
            className="font-heading text-4xl xl:text-5xl font-bold leading-[1.1] tracking-tight mb-6">
            Sua demo{' '}
            <span className="bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(135deg, #00f0ff 0%, #6c5ce7 50%, #2ed573 100%)' }}>
              personalizada
            </span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.7 }}
            className="text-nexo-muted text-base leading-relaxed mb-10">
            Preencha os dados da sua empresa e nossa equipe preparará um dashboard
            demonstrativo sob medida para o seu negócio.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.7 }}
            className="flex flex-wrap gap-3">
            {[
              { icon: Clock, label: 'Resposta em 24h' },
              { icon: Shield, label: 'Sem compromisso' },
              { icon: Zap, label: 'Setup gratuito' }
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs text-nexo-muted"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <item.icon size={12} className="text-nexo-muted" />
                {item.label}
              </div>
            ))}
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7, duration: 0.6 }}
          className="relative z-10 text-xs text-nexo-muted/60">
          <p>© 2026 NEXO Digital S.L. — Barcelona, Espanha</p>
        </motion.div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════════
          LADO DIREITO — Formulário
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="w-full lg:w-1/2 xl:w-[55%] flex items-center justify-center p-6 sm:p-12 relative">
        <div className="lg:hidden absolute top-8 left-8 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white text-base"
            style={{ background: 'linear-gradient(135deg, #00f0ff 0%, #6c5ce7 100%)', boxShadow: '0 0 15px rgba(0,240,255,0.12)' }}>
            N
          </div>
          <span className="font-heading font-bold text-lg tracking-tight">NEXO</span>
        </div>

        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm">

          {/* ═══ TELA DE SUCESSO ═══ */}
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.5 }}
                className="text-center py-8">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring' }}
                  className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #00f0ff 0%, #2ed573 100%)' }}>
                  <CheckCircle2 size={32} className="text-white" />
                </motion.div>
                <h2 className="font-heading text-2xl font-bold tracking-tight mb-3">
                  Obrigado, {form.name.split(' ')[0]}!
                </h2>
                <p className="text-nexo-muted text-sm leading-relaxed mb-6">
                  Recebemos sua solicitação. Nossa equipe está preparando uma demo
                  personalizada para <strong className="text-nexo-text">{form.companyName}</strong>.
                </p>
                <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm mb-8"
                  style={{ background: 'rgba(0,240,255,0.05)', border: '1px solid rgba(0,240,255,0.1)' }}>
                  <Clock size={14} className="text-nexo-muted" />
                  <span className="text-nexo-muted">Entraremos em contato em até <strong className="text-nexo-text">24 horas</strong></span>
                </div>
                <div className="space-y-3">
                  <Link to="/" className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm text-nexo-muted hover:text-nexo-text transition-colors"
                    style={{ background: 'rgba(15,15,22,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    ← Voltar para o site
                  </Link>
                  <Link to="/login" className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm text-nexo-muted hover:text-nexo-text transition-colors"
                    style={{ background: 'rgba(15,15,22,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    Já tem conta? Entrar
                  </Link>
                </div>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {/* Header */}
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex gap-1">
                      {[1, 2].map(s => (
                        <div key={s} className="h-1 rounded-full transition-all duration-300"
                          style={{
                            width: step === s ? 32 : 16,
                            background: step >= s ? '#00f0ff' : 'rgba(255,255,255,0.1)'
                          }} />
                      ))}
                    </div>
                    <span className="text-[10px] text-nexo-muted uppercase tracking-wider ml-2">
                      Passo {step} de 2
                    </span>
                  </div>
                  <h2 className="font-heading text-2xl font-bold tracking-tight mb-2">
                    {step === 1 ? 'Seus dados' : 'Sua empresa'}
                  </h2>
                  <p className="text-nexo-muted text-sm">
                    {step === 1 ? 'Como podemos entrar em contato?' : 'Conte-nos sobre seu negócio'}
                  </p>
                </div>

                {/* Step 1 — Dados Pessoais */}
                <AnimatePresence mode="wait">
                  {step === 1 && (
                    <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="space-y-5">

                      {/* Nome */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-nexo-muted uppercase tracking-wider flex items-center gap-1.5">
                          <User size={12} /> Nome completo
                        </label>
                        <div className="relative rounded-xl overflow-hidden transition-all duration-300" style={inputStyle('name')}>
                          <input type="text" value={form.name} onChange={e => updateField('name', e.target.value)}
                            onFocus={() => setFocusedField('name')} onBlur={() => setFocusedField(null)}
                            placeholder="Seu nome" autoFocus
                            className="w-full bg-transparent px-4 py-3 text-sm text-nexo-text placeholder:text-nexo-muted/40 outline-none" />
                        </div>
                      </div>

                      {/* Email */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-nexo-muted uppercase tracking-wider flex items-center gap-1.5">
                          <Mail size={12} /> Email
                        </label>
                        <div className="relative rounded-xl overflow-hidden transition-all duration-300" style={inputStyle('email')}>
                          <input type="email" value={form.email} onChange={e => updateField('email', e.target.value)}
                            onFocus={() => setFocusedField('email')} onBlur={() => setFocusedField(null)}
                            placeholder="voce@empresa.com"
                            className="w-full bg-transparent px-4 py-3 text-sm text-nexo-text placeholder:text-nexo-muted/40 outline-none" />
                        </div>
                      </div>

                      {/* Telefone */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-nexo-muted uppercase tracking-wider flex items-center gap-1.5">
                          <Phone size={12} /> Telefone <span className="text-nexo-muted/50 normal-case">(opcional)</span>
                        </label>
                        <div className="relative rounded-xl overflow-hidden transition-all duration-300" style={inputStyle('phone')}>
                          <input type="tel" value={form.phone} onChange={e => updateField('phone', e.target.value)}
                            onFocus={() => setFocusedField('phone')} onBlur={() => setFocusedField(null)}
                            placeholder="+34 600 000 000"
                            className="w-full bg-transparent px-4 py-3 text-sm text-nexo-text placeholder:text-nexo-muted/40 outline-none" />
                        </div>
                      </div>

                      <motion.button onClick={handleNext} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                        className="w-full rounded-xl py-3 px-4 text-sm font-semibold text-white flex items-center justify-center gap-2 group transition-all"
                        style={{
                          background: 'linear-gradient(135deg, #00f0ff 0%, #00c8d6 50%, #6c5ce7 100%)',
                          boxShadow: '0 4px 20px rgba(0, 240, 255, 0.2)'
                        }}>
                        <span>Continuar</span>
                        <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                      </motion.button>
                    </motion.div>
                  )}

                  {/* Step 2 — Empresa */}
                  {step === 2 && (
                    <motion.form key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}
                      onSubmit={handleSubmit} className="space-y-5">

                      {/* Nome da empresa */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-nexo-muted uppercase tracking-wider flex items-center gap-1.5">
                          <Building2 size={12} /> Nome da empresa
                        </label>
                        <div className="relative rounded-xl overflow-hidden transition-all duration-300" style={inputStyle('companyName')}>
                          <input type="text" value={form.companyName} onChange={e => updateField('companyName', e.target.value)}
                            onFocus={() => setFocusedField('companyName')} onBlur={() => setFocusedField(null)}
                            placeholder="Sua empresa" autoFocus
                            className="w-full bg-transparent px-4 py-3 text-sm text-nexo-text placeholder:text-nexo-muted/40 outline-none" />
                        </div>
                      </div>

                      {/* Tamanho da equipe */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-nexo-muted uppercase tracking-wider flex items-center gap-1.5">
                          <Users size={12} /> Tamanho da equipe
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {COMPANY_SIZES.map((size) => (
                            <button key={size.value} type="button" onClick={() => updateField('companySize', size.value)}
                              className="relative py-2.5 px-3 rounded-xl text-xs font-medium text-left transition-all"
                              style={{
                                background: form.companySize === size.value
                                  ? 'rgba(0, 240, 255, 0.08)'
                                  : 'rgba(15, 15, 22, 0.6)',
                                border: form.companySize === size.value
                                  ? '1px solid rgba(0, 240, 255, 0.3)'
                                  : '1px solid rgba(255, 255, 255, 0.06)',
                                color: form.companySize === size.value ? '#00f0ff' : '#6c757d'
                              }}>
                              {size.label}
                            </button>
                          ))}
                        </div>
                        {/* Input livre para "Outros" */}
                        <AnimatePresence>
                          {form.companySize === 'other' && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.25 }}
                              className="overflow-hidden"
                            >
                              <div className="relative rounded-xl overflow-hidden transition-all duration-300 mt-2" style={inputStyle('customCompanySize')}>
                                <input
                                  type="number"
                                  min="1"
                                  value={form.customCompanySize}
                                  onChange={e => updateField('customCompanySize', e.target.value)}
                                  onFocus={() => setFocusedField('customCompanySize')}
                                  onBlur={() => setFocusedField(null)}
                                  placeholder="Número de funcionários"
                                  className="w-full bg-transparent px-4 py-3 text-sm text-nexo-text placeholder:text-nexo-muted/40 outline-none"
                                />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Mensagem */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-nexo-muted uppercase tracking-wider flex items-center gap-1.5">
                          <MessageSquare size={12} /> O que você precisa? <span className="text-nexo-muted/50 normal-case">(opcional)</span>
                        </label>
                        <div className="relative rounded-xl overflow-hidden transition-all duration-300" style={inputStyle('message')}>
                          <textarea value={form.message} onChange={e => updateField('message', e.target.value)}
                            onFocus={() => setFocusedField('message')} onBlur={() => setFocusedField(null)}
                            placeholder="Conte-nos sobre seu projeto, desafios ou o que espera da demo..."
                            rows={4}
                            className="w-full bg-transparent px-4 py-3 text-sm text-nexo-text placeholder:text-nexo-muted/40 outline-none resize-none" />
                        </div>
                      </div>

                      {/* Erro */}
                      <AnimatePresence>
                        {error && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs"
                            style={{ background: 'rgba(255, 71, 87, 0.08)', border: '1px solid rgba(255, 71, 87, 0.15)', color: '#ff6b81' }}>
                            <AlertTriangle size={14} />
                            {error}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Botões */}
                      <div className="flex gap-3">
                        <button type="button" onClick={handleBack}
                          className="flex items-center justify-center gap-1 px-4 py-3 rounded-xl text-sm text-nexo-muted hover:text-nexo-text transition-colors"
                          style={{ background: 'rgba(15,15,22,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <ArrowLeft size={14} />
                        </button>
                        <motion.button type="submit" disabled={loading}
                          whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                          className="flex-1 rounded-xl py-3 px-4 text-sm font-semibold text-white flex items-center justify-center gap-2 group transition-all disabled:opacity-60"
                          style={{
                            background: 'linear-gradient(135deg, #00f0ff 0%, #00c8d6 50%, #6c5ce7 100%)',
                            boxShadow: '0 4px 20px rgba(0, 240, 255, 0.2)'
                          }}>
                          <span>{loading ? 'Enviando...' : 'Solicitar demo'}</span>
                          {!loading && <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />}
                        </motion.button>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>

                {/* Footer */}
                <div className="flex items-center gap-4 my-8">
                  <div className="flex-1 h-px bg-nexo-border/50" />
                  <span className="text-[10px] uppercase tracking-widest text-nexo-muted/50">ou</span>
                  <div className="flex-1 h-px bg-nexo-border/50" />
                </div>

                <div className="space-y-3">
                  <Link to="/" className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm text-nexo-muted hover:text-nexo-text transition-colors"
                    style={{ background: 'rgba(15,15,22,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    ← Voltar para o site
                  </Link>
                  <Link to="/login" className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-[11px] text-nexo-muted/40 hover:text-nexo-muted/70 transition-colors">
                    Já tem conta? Entrar
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}
