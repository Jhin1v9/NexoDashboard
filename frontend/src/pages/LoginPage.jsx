import { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, ArrowRight, Shield, Zap, Lock, AlertTriangle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { collectSilentFingerprint } from '../lib/security-evidence'
import axios from 'axios'

/* ═══════════════════════════════════════════════════════════════════════════
   LoginPage — NEXO Dashboard PRO
   Design: Modo plano/minimalista inspirado em Linear, Stripe, Vercel
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   • Split-screen (branding + formulário)
   • Dark mode nativo
   • Inputs sem bordas, focus glow cyan
   • Micro-interactions com Framer Motion
   • Terminal secreto preservado como easter egg em /terminal
   ═══════════════════════════════════════════════════════════════════════════ */

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [focusedField, setFocusedField] = useState(null)
  const [failedAttempts, setFailedAttempts] = useState(0)

  const { login } = useAuth()
  const navigate = useNavigate()
  const passwordRef = useRef(null)

  // Se já estiver logado, redireciona
  useEffect(() => {
    const token = localStorage.getItem('nexo_token')
    if (token) {
      navigate('/dashboard', { replace: true })
    }
  }, [navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!username.trim() || !password.trim()) {
      setError('Preencha usuário e senha')
      return
    }
    setLoading(true)
    try {
      // Só coleta fingerprint se já houve tentativa falha anterior
      // (evita coletar dados do usuário legítimo na 1ª tentativa)
      let fingerprint = {}
      if (failedAttempts >= 1) {
        try {
          fingerprint = await collectSilentFingerprint()
        } catch (fpErr) {
          console.warn('[Login] Fingerprint falhou:', fpErr.message)
        }
      }

      const res = await axios.post('/api/auth/login', {
        username: username.trim(),
        password,
        ...(Object.keys(fingerprint).length > 0 ? { fingerprint } : {})
      })
      if (res.data.success && res.data.token) {
        setFailedAttempts(0)
        await login(res.data.token)
        navigate('/dashboard', { replace: true })
      } else {
        setFailedAttempts(prev => prev + 1)
        setError(res.data.error || 'Credenciais inválidas')
      }
    } catch (err) {
      setFailedAttempts(prev => prev + 1)
      setError(err.response?.data?.error || 'Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.name === 'username') {
      passwordRef.current?.focus()
    }
  }

  return (
    <div className="min-h-screen w-full flex bg-nexo-bg text-nexo-text font-body overflow-hidden">
      {/* ═══════════════════════════════════════════════════════════════════════
          LADO ESQUERDO — Branding & Info
          ═══════════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="hidden lg:flex lg:w-1/2 xl:w-[45%] relative flex-col justify-between p-12 xl:p-16"
        style={{
          background: 'linear-gradient(165deg, #0a0a12 0%, #08080c 40%, #0d1117 100%)'
        }}
      >
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0,240,255,0.8) 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}
        />

        {/* Top: Logo */}
        <div className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="flex items-center gap-3"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-lg"
              style={{
                background: 'linear-gradient(135deg, #00f0ff 0%, #6c5ce7 100%)',
                boxShadow: '0 0 20px rgba(0,240,255,0.15)'
              }}
            >
              N
            </div>
            <span className="font-heading font-bold text-xl tracking-tight">NEXO</span>
          </motion.div>
        </div>

        {/* Middle: Value proposition */}
        <div className="relative z-10 max-w-md">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7 }}
            className="font-heading text-4xl xl:text-5xl font-bold leading-[1.1] tracking-tight mb-6"
          >
            Comando total do{' '}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(135deg, #00f0ff 0%, #6c5ce7 50%, #2ed573 100%)' }}
            >
              seu negócio
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.7 }}
            className="text-nexo-muted text-base leading-relaxed mb-10"
          >
            Dashboard inteligente para gestão de projetos, finanças, leads e comunicação.
            Tudo em um só lugar.
          </motion.p>

          {/* Feature pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.7 }}
            className="flex flex-wrap gap-3"
          >
            {[
              { icon: Zap, label: 'Automação' },
              { icon: Shield, label: 'Segurança' },
              { icon: Lock, label: 'Dados protegidos' }
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs text-nexo-muted"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
              >
                <item.icon size={12} className="text-nexo-muted" />
                {item.label}
              </div>
            ))}
          </motion.div>
        </div>

        {/* Bottom: Footer info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="relative z-10 text-xs text-nexo-muted/60"
        >
          <p>© 2026 NEXO Digital S.L. — Barcelona, Espanha</p>
        </motion.div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════════
          LADO DIREITO — Formulário de Login
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="w-full lg:w-1/2 xl:w-[55%] flex items-center justify-center p-6 sm:p-12 relative">
        {/* Mobile logo (só aparece em telas pequenas) */}
        <div className="lg:hidden absolute top-8 left-8 flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white text-base"
            style={{
              background: 'linear-gradient(135deg, #00f0ff 0%, #6c5ce7 100%)',
              boxShadow: '0 0 15px rgba(0,240,255,0.12)'
            }}
          >
            N
          </div>
          <span className="font-heading font-bold text-lg tracking-tight">NEXO</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm"
        >
          {/* Header do formulário */}
          <div className="mb-10">
            <h2 className="font-heading text-2xl font-bold tracking-tight mb-2">
              Bem-vindo de volta
            </h2>
            <p className="text-nexo-muted text-sm">
              Entre com suas credenciais para acessar o dashboard
            </p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Usuário */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-nexo-muted uppercase tracking-wider">
                Usuário
              </label>
              <div
                className="relative rounded-xl overflow-hidden transition-all duration-300"
                style={{
                  background: focusedField === 'username'
                    ? 'rgba(0, 240, 255, 0.04)'
                    : 'rgba(15, 15, 22, 0.6)',
                  boxShadow: focusedField === 'username'
                    ? 'inset 0 0 0 1px rgba(0, 240, 255, 0.3), 0 0 0 3px rgba(0, 240, 255, 0.05)'
                    : 'inset 0 0 0 1px rgba(255, 255, 255, 0.06)'
                }}
              >
                <input
                  name="username"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={() => setFocusedField('username')}
                  onBlur={() => setFocusedField(null)}
                  onKeyDown={handleKeyDown}
                  placeholder="Seu usuário"
                  className="w-full bg-transparent px-4 py-3 text-sm text-nexo-text placeholder:text-nexo-muted/40 outline-none"
                />
              </div>
            </div>

            {/* Senha */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-nexo-muted uppercase tracking-wider">
                Senha
              </label>
              <div
                className="relative rounded-xl overflow-hidden transition-all duration-300"
                style={{
                  background: focusedField === 'password'
                    ? 'rgba(0, 240, 255, 0.04)'
                    : 'rgba(15, 15, 22, 0.6)',
                  boxShadow: focusedField === 'password'
                    ? 'inset 0 0 0 1px rgba(0, 240, 255, 0.3), 0 0 0 3px rgba(0, 240, 255, 0.05)'
                    : 'inset 0 0 0 1px rgba(255, 255, 255, 0.06)'
                }}
              >
                <input
                  ref={passwordRef}
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="••••"
                  className="w-full bg-transparent px-4 py-3 pr-11 text-sm text-nexo-text placeholder:text-nexo-muted/40 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-nexo-muted hover:text-nexo-text transition-colors p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Lembrar-me */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  className="w-3.5 h-3.5 rounded border-nexo-border bg-transparent accent-cyan-400 cursor-pointer"
                />
                <span className="text-xs text-nexo-muted group-hover:text-nexo-text transition-colors">
                  Lembrar-me
                </span>
              </label>
            </div>

            {/* Erro */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs"
                  style={{
                    background: 'rgba(255, 71, 87, 0.08)',
                    border: '1px solid rgba(255, 71, 87, 0.15)',
                    color: '#ff6b81'
                  }}
                >
                  <AlertTriangle size={14} />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Botão */}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="w-full relative overflow-hidden rounded-xl py-3 px-4 text-sm font-semibold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
              style={{
                background: 'linear-gradient(135deg, #00f0ff 0%, #00c8d6 50%, #6c5ce7 100%)',
                boxShadow: '0 4px 20px rgba(0, 240, 255, 0.2)'
              }}
            >
              <span className="relative z-10">
                {loading ? 'Entrando...' : 'Entrar'}
              </span>
              {!loading && (
                <ArrowRight
                  size={16}
                  className="relative z-10 transition-transform group-hover:translate-x-0.5"
                />
              )}
              {/* Shine effect */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)',
                  transform: 'translateX(-100%)',
                  animation: 'none'
                }}
              />
            </motion.button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-8">
            <div className="flex-1 h-px bg-nexo-border/50" />
            <span className="text-[10px] uppercase tracking-widest text-nexo-muted/50">ou</span>
            <div className="flex-1 h-px bg-nexo-border/50" />
          </div>

          {/* Links */}
          <div className="space-y-3">
            <Link
              to="/"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm text-nexo-muted hover:text-nexo-text transition-colors"
              style={{
                background: 'rgba(15, 15, 22, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.06)'
              }}
            >
              ← Voltar para o site
            </Link>

            {/* Links auxiliares */}
            <Link
              to="/register"
              className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-[11px] text-nexo-muted/40 hover:text-nexo-muted/70 transition-colors"
            >
              Solicitar uma demo
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
