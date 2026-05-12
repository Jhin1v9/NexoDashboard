import { useState, useEffect, useCallback } from 'react'
import SecretTerminal from '../components/SecretTerminal'

const KONAMI_CODE = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
  'b', 'a'
]

function LandingPage() {
  const [position, setPosition] = useState(0)
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [showHint, setShowHint] = useState(false)

  const handleKeyDown = useCallback((e) => {
    if (terminalOpen) return

    const key = e.key.toLowerCase()
    const expected = KONAMI_CODE[position].toLowerCase()

    if (key === expected) {
      const next = position + 1
      setPosition(next)
      if (next === KONAMI_CODE.length) {
        setTerminalOpen(true)
        setPosition(0)
      }
    } else {
      if (key === KONAMI_CODE[0].toLowerCase()) {
        setPosition(1)
      } else {
        setPosition(0)
      }
    }
  }, [position, terminalOpen])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Mostrar hint sutil após 10 segundos (apenas para teste/debug)
  useEffect(() => {
    const timer = setTimeout(() => setShowHint(true), 10000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white relative overflow-hidden">
      {/* Background particles effect */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 py-4 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center font-bold text-lg">
            N
          </div>
          <span className="font-bold text-xl tracking-tight">NEXO Digital</span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm text-white/70">
          <a href="#features" className="hover:text-white transition-colors">Funcionalidades</a>
          <a href="#precos" className="hover:text-white transition-colors">Preços</a>
          <a href="#contato" className="hover:text-white transition-colors">Contato</a>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative z-10 px-6 py-20 md:py-32 text-center">
        <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          Gestão Empresarial Completa
        </h1>
        <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-10">
          CRM, financeiro, projetos, comunicação e muito mais — tudo em um único dashboard inteligente.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl font-semibold hover:opacity-90 transition-opacity">
            Solicitar Demonstração
          </button>
          <button className="px-8 py-3 border border-white/20 rounded-xl font-semibold hover:bg-white/5 transition-colors">
            Conhecer Planos
          </button>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 px-6 py-16">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">Tudo que sua empresa precisa</h2>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {[
            { icon: '📊', title: 'Financeiro', desc: 'Controle de caixa, receitas, despesas e relatórios em tempo real.' },
            { icon: '👥', title: 'CRM & Leads', desc: 'Pipeline completo de vendas com Kanban e follow-up automático.' },
            { icon: '💬', title: 'Comunicação', desc: 'WhatsApp, Email e Instagram integrados em um só lugar.' },
            { icon: '📋', title: 'Projetos', desc: 'Gestão de tarefas com prioridades, prazos e responsáveis.' },
            { icon: '🤖', title: 'IA Integrada', desc: 'Assistente inteligente para automatizar tarefas repetitivas.' },
            { icon: '📈', title: 'Relatórios', desc: 'Dashboards interativos com métricas de performance.' },
          ].map((f, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors">
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="font-bold text-lg mb-2">{f.title}</h3>
              <p className="text-white/50 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="precos" className="relative z-10 px-6 py-16">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">Planos Simples</h2>
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            { name: 'Starter', price: '€49/mês', features: ['Até 5 usuários', 'CRM básico', 'Financeiro', 'Suporte por email'] },
            { name: 'Pro', price: '€99/mês', features: ['Até 20 usuários', 'CRM completo', 'Todas integrações', 'Suporte prioritário'], popular: true },
            { name: 'Enterprise', price: '€199/mês', features: ['Usuários ilimitados', 'IA completa', 'API privada', 'Suporte 24/7'] },
          ].map((plan, i) => (
            <div key={i} className={`rounded-2xl p-6 border ${plan.popular ? 'border-purple-500 bg-purple-500/10' : 'border-white/10 bg-white/5'}`}>
              {plan.popular && <div className="text-xs font-bold text-purple-400 mb-2">MAIS POPULAR</div>}
              <h3 className="font-bold text-xl mb-2">{plan.name}</h3>
              <div className="text-2xl font-bold mb-4">{plan.price}</div>
              <ul className="space-y-2 text-sm text-white/60">
                {plan.features.map((feat, j) => (
                  <li key={j} className="flex items-center gap-2">✓ {feat}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section id="contato" className="relative z-10 px-6 py-16 text-center">
        <h2 className="text-2xl md:text-3xl font-bold mb-6">Vamos conversar</h2>
        <p className="text-white/50 mb-8">Entre em contato e descubra como o NEXO pode transformar sua empresa.</p>
        <button className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl font-semibold hover:opacity-90 transition-opacity">
          Falar com Especialista
        </button>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-8 border-t border-white/10 text-center text-sm text-white/40">
        © 2026 NEXO Digital S.L. — Barcelona, Espanha. Todos os direitos reservados.
      </footer>

      {/* Hint sutil (apenas para debug/teste) */}
      {showHint && !terminalOpen && (
        <div className="fixed bottom-4 right-4 text-[10px] text-white/10 select-none">
          ↑↑↓↓←→←→BA
        </div>
      )}

      {/* Terminal Secreto */}
      <SecretTerminal isOpen={terminalOpen} onClose={() => { setTerminalOpen(false); setPosition(0) }} />
    </div>
  )
}

export default LandingPage
