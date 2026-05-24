import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import CountUp from 'react-countup'
import {
  Menu,
  X,
  ArrowRight,
  Play,
  MessageSquare,
  Building2,
  TrendingUp,
  Clock,
  MessageCircle,
  Mail,
  Wallet,
  ClipboardList,
  BadgeCheck,
  Bot,
  KanbanSquare,
  Link2,
  Settings,
  Plug,
  LayoutDashboard,
  Star,
  Quote,
  ChevronDown,
  Sparkles,
  Check,
  MapPin,
  Phone,
} from 'lucide-react'
import useSyncTap from '../hooks/useSyncTap'
import SyncSessionModal from '../components/SyncSessionModal'

/* ============================================================
   NAVBAR
   ============================================================ */
function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollTo = (id) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
      setIsMobileMenuOpen(false)
    }
  }

  const navLinks = [
    { label: 'Features', id: 'features' },
    { label: 'How It Works', id: 'how-it-works' },
    { label: 'Pricing', id: 'comparison' },
    { label: 'Contact', id: 'faq' },
  ]

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-500 ${
        isScrolled
          ? 'bg-[#0a0a0f]/90 backdrop-blur-xl border-b border-white/[0.06]'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-cyan-400 flex items-center justify-center">
              <span className="text-white font-bold text-sm">N</span>
            </div>
            <span className="text-white font-bold text-xl tracking-tight">
              NEXO<span className="text-zinc-400 font-normal"> Digital</span>
            </span>
          </a>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => scrollTo(link.id)}
                className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-white/[0.04]"
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* Right side */}
          <div className="hidden lg:flex items-center gap-3">
            <Link
              to="/login"
              className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-white/[0.04] border border-white/[0.06]"
            >
              Entrar
            </Link>
            <Link
              to="/register"
              className="text-white font-semibold px-5 py-2 rounded-full shadow-lg transition-all hover:scale-105 hover:shadow-xl text-sm"
              style={{
                background: 'linear-gradient(135deg, #00f0ff 0%, #6c5ce7 100%)',
                boxShadow: '0 4px 20px rgba(0, 240, 255, 0.2)'
              }}
            >
              Registrar
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="flex lg:hidden items-center gap-2">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-zinc-400 hover:text-white"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden py-4 border-t border-white/[0.06]">
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <button
                  key={link.id}
                  onClick={() => scrollTo(link.id)}
                  className="px-4 py-3 text-sm font-medium text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-white/[0.04] text-left"
                >
                  {link.label}
                </button>
              ))}
              <Link
                to="/register"
                className="mt-2 text-white font-semibold rounded-full px-5 py-3 text-sm text-center block"
                style={{ background: 'linear-gradient(135deg, #00f0ff 0%, #6c5ce7 100%)' }}
              >
                Registrar
              </Link>
              <Link
                to="/login"
                className="text-zinc-400 hover:text-white font-medium px-5 py-3 text-sm text-center block transition-colors"
              >
                Entrar
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

/* ============================================================
   HERO
   ============================================================ */
function Hero() {
  const stats = [
    { icon: Building2, value: 50, suffix: '+', label: 'Companies Managed' },
    { icon: MessageSquare, value: 10000, suffix: '+', label: 'Messages Processed' },
    { icon: TrendingUp, value: 2, suffix: 'M', prefix: '€', label: 'In Transactions Tracked' },
    { icon: Clock, value: 15, suffix: 'h', label: 'Hours Saved Weekly' },
  ]

  const scrollToDemo = () => {
    const el = document.getElementById('demo')
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden mesh-gradient">
      {/* Animated background orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, rgba(124,58,237,0.4) 0%, transparent 70%)',
            top: '-10%',
            left: '-5%',
          }}
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full opacity-15"
          style={{
            background: 'radial-gradient(circle, rgba(34,211,238,0.4) 0%, transparent 70%)',
            top: '20%',
            right: '-10%',
          }}
          animate={{ x: [0, -20, 0], y: [0, 30, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute w-[400px] h-[400px] rounded-full opacity-10"
          style={{
            background: 'radial-gradient(circle, rgba(16,185,129,0.4) 0%, transparent 70%)',
            bottom: '10%',
            left: '30%',
          }}
          animate={{ x: [0, 20, 0], y: [0, -15, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Text */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="text-center lg:text-left"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-sm font-medium mb-6"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              NEXO Dashboard v4.0 — Now Available
            </motion.div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold tracking-tight text-white leading-[1.1] mb-6">
              Your Entire Business{' '}
              <span className="gradient-text">in One Dashboard</span>
            </h1>

            <p className="text-lg sm:text-xl text-zinc-400 leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0">
              WhatsApp, Email, Finance, Tasks & Leads — all connected. With an AI agent that reads, organizes, and executes for you.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-10">
              <a
                href="https://wa.me/34685093192"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white font-bold px-8 py-4 rounded-full text-base shadow-xl shadow-violet-500/30 transition-all hover:scale-105 hover:shadow-2xl hover:shadow-violet-500/40"
              >
                Transform My Business
                <ArrowRight className="ml-2 w-5 h-5" />
              </a>
              <button
                onClick={scrollToDemo}
                className="inline-flex items-center justify-center border border-white/10 bg-white/[0.03] text-cyan-400 hover:text-cyan-300 hover:bg-white/[0.06] hover:border-cyan-500/30 px-8 py-4 rounded-full text-base font-semibold transition-all"
              >
                <Play className="mr-2 w-5 h-5" />
                Watch Live Demo
              </button>
            </div>

            {/* Social proof */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-sm text-zinc-500"
            >
              Already trusted by businesses across Spain & Portugal
            </motion.p>
          </motion.div>

          {/* Right: Dashboard mockup */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
            className="relative"
          >
            <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl shadow-violet-500/10">
              <img
                src="/hero-dashboard.jpg"
                alt="NEXO Dashboard"
                className="w-full h-auto"
              />
              {/* Overlay gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f]/60 via-transparent to-transparent pointer-events-none" />
              {/* Glow effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-violet-600/20 via-cyan-400/10 to-emerald-400/20 rounded-2xl blur-xl -z-10" />
            </div>

            {/* Floating badges */}
            <motion.div
              className="absolute -left-4 top-1/4 glass-card rounded-xl px-4 py-3 shadow-xl"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-zinc-500">WhatsApp</p>
                  <p className="text-sm font-bold text-white">84 messages</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="absolute -right-4 top-1/2 glass-card rounded-xl px-4 py-3 shadow-xl"
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-violet-400" />
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Balance</p>
                  <p className="text-sm font-bold text-emerald-400">€24,500</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="mt-16 lg:mt-20"
        >
          <div className="glass-card rounded-2xl p-6 sm:p-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
              {stats.map((stat, i) => (
                <div key={i} className={`text-center ${i < 3 ? 'lg:border-r lg:border-white/[0.06]' : ''}`}>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <stat.icon className="w-5 h-5 text-violet-400" />
                    <span className="text-3xl sm:text-4xl font-bold font-mono gradient-text-purple-cyan">
                      {stat.prefix}
                      <CountUp end={stat.value} duration={2.5} separator="," />
                      {stat.suffix}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-zinc-500 uppercase tracking-wider">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

/* ============================================================
   PROBLEM
   ============================================================ */
function Problem() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  const painCards = [
    { icon: MessageCircle, title: 'Chaotic WhatsApp', desc: '200+ unread messages, lost groups, missed clients. Your biggest communication channel is a mess.', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
    { icon: Mail, title: 'Forgotten Emails', desc: '500+ emails in the inbox. Nobody responds on time. Opportunities slip through the cracks.', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    { icon: Wallet, title: 'Cash in the Dark', desc: "You don't know if you are profitable today. The cash register is a mystery until month-end.", color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
    { icon: ClipboardList, title: 'Tasks on Paper', desc: 'Notes get lost, deadlines forgotten, team members out of sync. No accountability.', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  ]

  return (
    <section id="problem" className="relative py-24 lg:py-32 bg-[#0d0d14]" ref={ref}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6 tracking-tight">
            Still Running Your Business from a Notebook?
          </h2>
          <p className="text-lg text-zinc-400 leading-relaxed">
            Business owners lose 15+ hours every week switching between WhatsApp, spreadsheets, email, and notes. Leads die in the inbox. Payments get lost. And nobody knows the cash balance.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {painCards.map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.15 * i }}
              className={`group relative bg-[#111118] border ${card.border} rounded-2xl p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-xl`}
            >
              <div className={`w-12 h-12 rounded-xl ${card.bg} flex items-center justify-center mb-5`}>
                <card.icon className={`w-6 h-6 ${card.color}`} />
              </div>
              <h3 className="text-lg font-bold text-white mb-3">{card.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{card.desc}</p>
              <div className={`absolute inset-0 rounded-2xl ${card.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-xl`} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   SOLUTION
   ============================================================ */
function Solution() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  const screenshots = [
    { src: '/dashboard-whatsapp.jpg', label: 'WhatsApp Hub', badge: '+84 messages processed' },
    { src: '/dashboard-finance.jpg', label: 'Cash & Finance', badge: 'Protected balance, immutable history' },
    { src: '/dashboard-luna.jpg', label: 'Luna AI Agent', badge: 'Auto-distribution 25% per partner' },
  ]

  return (
    <section id="solution" className="relative py-24 lg:py-32 bg-[#0a0a0f]" ref={ref}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6 tracking-tight">
            One AI Agent. One Dashboard.{' '}
            <span className="gradient-text">Zero Chaos.</span>
          </h2>
          <p className="text-lg text-zinc-400 leading-relaxed">
            NEXO connects your communication, finances, and tasks in one place. Our Luna agent reads your WhatsApps and emails, extracts tasks automatically, updates your cash flow, and alerts you when something needs attention.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6 mb-12">
          {screenshots.map((shot, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.2 * i }}
              className="group"
            >
              <div className="relative rounded-xl overflow-hidden border border-white/[0.08] bg-[#111118] transition-all duration-300 group-hover:border-violet-500/30 group-hover:shadow-lg group-hover:shadow-violet-500/10">
                <div className="relative overflow-hidden">
                  <img
                    src={shot.src}
                    alt={shot.label}
                    className="w-full h-auto transition-transform duration-500 group-hover:scale-[1.02]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#111118] via-transparent to-transparent opacity-60" />
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <BadgeCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-semibold text-white">{shot.label}</span>
                  </div>
                  <p className="text-xs text-zinc-500">{shot.badge}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gradient-to-r from-violet-600/5 via-cyan-400/5 to-emerald-400/5 rounded-full blur-3xl pointer-events-none -z-10" />
      </div>
    </section>
  )
}

/* ============================================================
   FEATURES
   ============================================================ */
function Features() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  const featureDefs = [
    { key: 'whatsapp', icon: MessageCircle, iconColor: 'text-emerald-400', iconBg: 'from-emerald-500/20 to-emerald-500/5', title: 'Smart WhatsApp Business', desc: 'Two-way chat, group monitoring, automatic author resolution, link extraction, and persistent history. Never miss a client message again.', span: '' },
    { key: 'email', icon: Mail, iconColor: 'text-blue-400', iconBg: 'from-blue-500/20 to-blue-500/5', title: 'Integrated IMAP/SMTP Email', desc: 'Read, send, and organize emails directly from the dashboard. Automatic sync with your account. Rich composition with attachments.', span: '' },
    { key: 'finance', icon: Wallet, iconColor: 'text-amber-400', iconBg: 'from-amber-500/20 to-amber-500/5', title: 'Real-time Cash & Finance', desc: 'Complete CRUD of entries, automatic reconciliation, payment received mode with 25% split between partners, balance alerts.', span: '' },
    { key: 'luna', icon: Bot, iconColor: 'text-violet-400', iconBg: 'from-violet-500/20 to-cyan-500/10', title: 'Luna — Your AI Agent', desc: 'She reads your WhatsApps and emails, classifies automatically, extracts tasks, alerts about pending payments, and can execute system commands. Like having a secretary who never sleeps.', isWide: true, span: 'lg:col-span-3' },
    { key: 'leads', icon: KanbanSquare, iconColor: 'text-rose-400', iconBg: 'from-rose-500/20 to-rose-500/5', title: 'Lead Pipeline', desc: 'Kanban with 6 columns, movable cards, filters, and complete CRUD. Your visual and organized sales funnel.', span: '' },
    { key: 'links', icon: Link2, iconColor: 'text-cyan-400', iconBg: 'from-cyan-500/20 to-cyan-500/5', title: 'Smart Link Extractor', desc: 'Links from WhatsApp automatically extracted, with OGP preview, platform classification, and 24h cache.', span: '' },
    { key: 'system', icon: Settings, iconColor: 'text-zinc-400', iconBg: 'from-zinc-500/20 to-zinc-500/5', title: 'Total System Control', desc: 'Start, stop, restart backend and frontend. Real-time logs. Complete infrastructure supervision.', span: '' },
  ]

  return (
    <section id="features" className="relative py-24 lg:py-32 bg-[#0d0d14]" ref={ref}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6 tracking-tight">
            Everything You Need.{' '}
            <span className="text-zinc-500">Nothing You Don't.</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {featureDefs.map((feat, i) => {
            const isLuna = feat.key === 'luna'
            return (
              <motion.div
                key={feat.key}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.1 * i }}
                className={`${feat.span} ${isLuna ? 'lg:col-span-3' : ''}`}
              >
                <div className={`group relative h-full bg-[#111118] border border-white/[0.08] rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/30 overflow-hidden card-hover ${isLuna ? 'lg:p-8' : ''}`}>
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-600/5 via-transparent to-cyan-400/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                  <div className={`relative ${isLuna ? 'lg:flex lg:items-start lg:gap-8' : ''}`}>
                    <div className={isLuna ? 'lg:flex-1' : ''}>
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feat.iconBg} flex items-center justify-center mb-5`}>
                        <feat.icon className={`w-6 h-6 ${feat.iconColor}`} />
                      </div>
                      <h3 className="text-lg font-bold text-white mb-3">{feat.title}</h3>
                      <p className="text-sm text-zinc-400 leading-relaxed">{feat.desc}</p>
                      {isLuna && (
                        <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-medium">
                          <Bot className="w-3 h-3" />
                          Classifier v16.1 — 16 categories
                        </div>
                      )}
                    </div>
                    {isLuna && (
                      <div className="hidden lg:block lg:flex-1 mt-6 lg:mt-0">
                        <div className="bg-[#0a0a0f] rounded-xl border border-white/[0.06] p-4 font-mono text-xs">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                            <span className="text-zinc-600 ml-2">luna-cto-agent.cjs</span>
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-emerald-400"><span className="text-zinc-600">$</span> luna scan --whatsapp</p>
                            <p className="text-zinc-500">Scanning WhatsApp messages... <span className="text-cyan-400">84 processed</span></p>
                            <p className="text-zinc-500">Tasks extracted: <span className="text-amber-400">12</span></p>
                            <p className="text-zinc-500">Alerts generated: <span className="text-rose-400">3</span></p>
                            <p className="text-violet-400">Cash updated: <span className="text-emerald-400">€24,500.00</span></p>
                            <p className="text-zinc-600 mt-2">_</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   HOW IT WORKS
   ============================================================ */
function HowItWorks() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  const steps = [
    { icon: Plug, num: '01', title: 'Connect', desc: 'Connect your WhatsApp Web, IMAP email, and define your partners in the cash flow. NEXO imports everything automatically.', gradient: 'from-violet-600 to-violet-400' },
    { icon: Bot, num: '02', title: 'Let Luna Work', desc: 'Luna reads every message, extracts links, identifies tasks, updates the cash flow, and alerts when something needs attention.', gradient: 'from-cyan-500 to-cyan-300' },
    { icon: LayoutDashboard, num: '03', title: 'Manage Everything in One Place', desc: 'Your single dashboard with communication, finance, leads, and tasks. Make decisions with data, not guesswork.', gradient: 'from-emerald-500 to-emerald-300' },
  ]

  return (
    <section id="how-it-works" className="relative py-24 lg:py-32 bg-[#0a0a0f]" ref={ref}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center max-w-3xl mx-auto mb-20"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6 tracking-tight">
            From Chaotic to Organized in 3 Steps
          </h2>
        </motion.div>

        <div className="relative">
          <div className="hidden lg:block absolute top-16 left-[16.67%] right-[16.67%] h-0.5 bg-gradient-to-r from-violet-600/40 via-cyan-500/40 to-emerald-500/40" />
          <div className="lg:hidden absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-violet-600/40 via-cyan-500/40 to-emerald-500/40" />

          <div className="grid lg:grid-cols-3 gap-12 lg:gap-8">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.2 * i }}
                className="relative flex lg:flex-col items-start lg:items-center gap-6 lg:gap-8"
              >
                <div className={`relative z-10 flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br ${step.gradient} flex items-center justify-center shadow-lg`}>
                  <step.icon className="w-7 h-7 text-white" />
                </div>
                <div className="lg:text-center">
                  <span className="text-xs font-mono font-bold text-zinc-600 mb-2 block">{step.num}</span>
                  <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed max-w-xs">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   TESTIMONIALS
   ============================================================ */
function Testimonials() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  const testimonials = [
    { quote: "Before I used WhatsApp on my phone, Excel spreadsheets, and a notebook for tasks. Now everything is in NEXO. Luna alerts me when a client messaged and I missed it. I save 2 hours every day.", author: 'Carlos M.', company: 'ConstruMart SL, Barcelona', color: 'bg-violet-500' },
    { quote: "The cash flow control is sensational. Before, my partners and I argued about how much each was entitled to. Now NEXO calculates automatically and distributes when a payment comes in. Zero arguments.", author: 'Ana R.', company: 'TechStart, Madrid', color: 'bg-cyan-500' },
    { quote: "Our lead pipeline was a messy WhatsApp group. We migrated to NEXO's kanban and our closing rate went up 40%. We know exactly at which stage each lead is.", author: 'Pedro L.', company: 'Agencia Nova, Lisboa', color: 'bg-emerald-500' },
  ]

  return (
    <section id="testimonials" className="relative py-24 lg:py-32 bg-[#0d0d14]" ref={ref}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6 tracking-tight">
            Business Owners Who Left Chaos Behind
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((tData, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.2 * i }}
            >
              <div className="group h-full bg-[#111118] border border-white/[0.08] rounded-2xl p-6 lg:p-8 transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/20 card-hover">
                <Quote className="w-10 h-10 text-violet-500/30 mb-4" />
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-zinc-300 text-sm leading-relaxed italic mb-6">
                  "{tData.quote}"
                </p>
                <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
                  <div className={`w-10 h-10 rounded-full ${tData.color} flex items-center justify-center text-white font-bold text-sm`}>
                    {tData.author.charAt(0)}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{tData.author}</p>
                    <p className="text-zinc-500 text-xs">{tData.company}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   METRICS
   ============================================================ */
function Metrics() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  const metrics = [
    { icon: MessageSquare, value: 10000, suffix: '+', prefix: '', label: 'Messages Processed by Luna' },
    { icon: Building2, value: 50, suffix: '+', prefix: '', label: 'Connected Businesses' },
    { icon: TrendingUp, value: 2, suffix: 'M', prefix: '€', label: 'In Transactions Tracked' },
    { icon: Clock, value: 15, suffix: 'h', prefix: '', label: 'Hours Saved Per Week' },
  ]

  return (
    <section id="metrics" className="relative py-20 lg:py-24 bg-[#0a0a0f]" ref={ref}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Real Results in Real Time
          </h2>
        </motion.div>

        <div className="glass-card rounded-2xl p-8 lg:p-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {metrics.map((metric, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.15 * i }}
                className={`text-center ${i < 3 ? 'lg:border-r lg:border-white/[0.06]' : ''}`}
              >
                <metric.icon className="w-6 h-6 text-violet-400 mx-auto mb-3" />
                <div className="text-3xl sm:text-4xl lg:text-5xl font-bold font-mono gradient-text-purple-cyan mb-2">
                  {metric.prefix}
                  {isInView && (
                    <CountUp end={metric.value} duration={2.5} separator="," />
                  )}
                  {!isInView && '0'}
                  {metric.suffix}
                </div>
                <p className="text-xs sm:text-sm text-zinc-500 uppercase tracking-wider">
                  {metric.label}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   DEMO
   ============================================================ */
function Demo() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section id="demo" className="relative py-24 lg:py-32 bg-[#0d0d14]" ref={ref}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl overflow-hidden border border-white/[0.08] bg-[#111118]">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 via-transparent to-cyan-400/10 pointer-events-none" />

          <div className="relative z-10 grid lg:grid-cols-2 gap-10 p-8 lg:p-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.7 }}
            >
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6 tracking-tight">
                See NEXO in Action
              </h2>
              <p className="text-lg text-zinc-400 leading-relaxed mb-8 max-w-lg">
                2 minutes. That is all you need to understand why business owners are replacing 5 tools with NEXO.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href="https://wa.me/34685093192"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white font-bold px-8 py-4 rounded-full text-base shadow-xl shadow-violet-500/30 transition-all hover:scale-105"
                >
                  I Want to See More
                  <ArrowRight className="ml-2 w-5 h-5" />
                </a>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="relative"
            >
              <div className="relative rounded-xl overflow-hidden border border-white/[0.08] shadow-2xl">
                <img
                  src="/hero-dashboard.jpg"
                  alt="NEXO Dashboard Demo"
                  className="w-full h-auto"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <motion.div
                    className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center cursor-pointer hover:bg-white/20 transition-colors"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Play className="w-8 h-8 text-white fill-white ml-1" />
                  </motion.div>
                </div>
              </div>
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-violet-500/10 rounded-full blur-2xl" />
              <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl" />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   COMPARISON
   ============================================================ */
function Comparison() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  const tools = [
    { name: 'WhatsApp Business', cost: '€15' },
    { name: 'Gmail / Outlook', cost: '€6' },
    { name: 'Excel / Sheets', cost: '€10' },
    { name: 'Trello / Asana', cost: '€12' },
    { name: 'Basic CRM', cost: '€30' },
    { name: 'Accountant (hourly)', cost: '€200' },
  ]

  return (
    <section id="comparison" className="relative py-24 lg:py-32 bg-[#0a0a0f]" ref={ref}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6 tracking-tight">
            Why Pay for 5 Tools When One Solves Everything?
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="glass-card rounded-2xl overflow-hidden"
        >
          <div className="grid grid-cols-3 gap-4 p-5 border-b border-white/[0.08] bg-white/[0.02]">
            <div className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Separate Tools</div>
            <div className="text-sm font-semibold text-zinc-400 uppercase tracking-wider text-center">Monthly Cost</div>
            <div className="text-sm font-semibold text-zinc-400 uppercase tracking-wider text-center">Integration</div>
          </div>

          {tools.map((tool, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.3, delay: 0.05 * i }}
              className="grid grid-cols-3 gap-4 p-4 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
            >
              <div className="text-sm text-zinc-300">{tool.name}</div>
              <div className="text-sm text-zinc-400 text-center font-mono">{tool.cost}/month</div>
              <div className="flex justify-center">
                <X className="w-5 h-5 text-rose-400/70" />
              </div>
            </motion.div>
          ))}

          <div className="grid grid-cols-3 gap-4 p-4 border-b border-white/[0.06] bg-rose-500/5">
            <div className="text-sm font-bold text-rose-300">Total</div>
            <div className="text-sm font-bold text-rose-300 text-center font-mono">€273/month</div>
            <div className="flex justify-center">
              <X className="w-5 h-5 text-rose-400" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 p-5 bg-gradient-to-r from-violet-600/10 to-cyan-500/10 border-t-2 border-violet-500/40">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-400" />
              <div>
                <div className="text-sm font-bold text-white">NEXO DASHBOARD</div>
                <div className="text-xs text-violet-300">All-in-One</div>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <span className="text-lg font-bold gradient-text font-mono">Custom</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Check className="w-5 h-5 text-emerald-400" />
              <span className="text-xs text-emerald-400 font-medium hidden sm:inline">Total + Luna AI</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-8 text-center"
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm font-medium">
            <Sparkles className="w-4 h-4" />
            Save €200+/month and 15h/week
          </span>
        </motion.div>
      </div>
    </section>
  )
}

/* ============================================================
   CTA
   ============================================================ */
function CTA() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section id="cta" className="relative py-24 lg:py-32 bg-[#0d0d14]" ref={ref}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-r from-violet-600/15 via-cyan-400/10 to-emerald-400/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-white mb-6 tracking-tight">
            Ready to Leave Chaos Behind?
          </h2>
          <p className="text-lg sm:text-xl text-zinc-400 leading-relaxed mb-10 max-w-2xl mx-auto">
            Talk to NEXO Digital today. Personalized demo, no commitment. See how NEXO adapts to YOUR business.
          </p>

          <motion.div
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="mb-10"
          >
            <a
              href="https://wa.me/34685093192"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center bg-gradient-to-r from-violet-600 via-cyan-500 to-emerald-400 hover:from-violet-500 hover:via-cyan-400 hover:to-emerald-300 text-white font-bold text-lg px-12 py-7 rounded-full shadow-2xl shadow-violet-500/40 transition-all hover:scale-105 hover:shadow-violet-500/50"
            >
              Get My Free Demo
              <ArrowRight className="ml-3 w-6 h-6" />
            </a>
          </motion.div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-zinc-500">
            <a
              href="mailto:contacto@nexo-digital.app"
              className="flex items-center gap-2 hover:text-cyan-400 transition-colors"
            >
              <Mail className="w-4 h-4" />
              Prefer email? contacto@nexo-digital.app
            </a>
            <span className="hidden sm:inline text-zinc-700">|</span>
            <a
              href="tel:+34685093192"
              className="flex items-center gap-2 hover:text-cyan-400 transition-colors"
            >
              <Phone className="w-4 h-4" />
              Or call: +34 685 093 192
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

/* ============================================================
   FAQ
   ============================================================ */
function FAQ() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })
  const [openIndex, setOpenIndex] = useState(null)

  const faqItems = [
    { q: 'Does NEXO work with my personal WhatsApp?', a: 'Yes. Just scan the QR code in WhatsApp Web. NEXO monitors authorized groups and extracts data automatically.' },
    { q: 'Is my data secure?', a: 'Absolutely. Your data stays on your own server (localhost) or the infrastructure you choose. We do not sell data. You have total control.' },
    { q: 'Do I need to know programming?', a: 'No. NEXO is a web interface. If you use WhatsApp and Excel, you can use NEXO. Luna (AI) handles the technical part for you.' },
    { q: 'Can I use just one module? (cash only, WhatsApp only)', a: 'Yes. NEXO is modular. Activate only the modules you need. Add more as your business grows.' },
    { q: 'How long does implementation take?', a: 'On average 2 hours. We connect your WhatsApp, email, and cash flow. You start using it the same day.' },
    { q: 'Does it work on mobile?', a: 'Yes. NEXO is responsive and has optimized mobile navigation. Access from anywhere.' },
  ]

  return (
    <section id="faq" className="relative py-24 lg:py-32 bg-[#0a0a0f]" ref={ref}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6 tracking-tight">
            Questions? Here Are the Answers.
          </h2>
        </motion.div>

        <div className="space-y-3">
          {faqItems.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.08 * i }}
              className="border-b border-white/[0.08]"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between py-5 text-left group"
              >
                <span className={`text-base sm:text-lg font-semibold transition-colors ${
                  openIndex === i ? 'text-cyan-400' : 'text-white group-hover:text-cyan-400'
                }`}>
                  {item.q}
                </span>
                <ChevronDown
                  className={`w-5 h-5 flex-shrink-0 ml-4 transition-transform duration-300 ${
                    openIndex === i ? 'rotate-180 text-cyan-400' : 'text-zinc-500'
                  }`}
                />
              </button>
              <motion.div
                initial={false}
                animate={{
                  height: openIndex === i ? 'auto' : 0,
                  opacity: openIndex === i ? 1 : 0,
                }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <p className="text-zinc-400 text-sm sm:text-base leading-relaxed pb-5">
                  {item.a}
                </p>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   FOOTER
   ============================================================ */
function Footer() {
  const scrollTo = (id) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <footer className="relative bg-[#050508] border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">
          {/* Brand */}
          <div className="col-span-2 lg:col-span-1">
            <a href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-cyan-400 flex items-center justify-center">
                <span className="text-white font-bold text-sm">N</span>
              </div>
              <span className="text-white font-bold text-xl tracking-tight">
                NEXO<span className="text-zinc-500 font-normal"> Digital</span>
              </span>
            </a>
            <p className="text-sm text-zinc-500 mb-4 leading-relaxed">
              Intelligent Management for Real Businesses
            </p>
            <div className="flex items-center gap-2 text-sm text-zinc-600">
              <MapPin className="w-4 h-4" />
              Barcelona, Spain
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-5">Product</h4>
            <ul className="space-y-3">
              {[
                { icon: Settings, label: 'Dashboard', id: 'hero' },
                { icon: MessageSquare, label: 'WhatsApp Hub', id: 'features' },
                { icon: Mail, label: 'Email Hub', id: 'features' },
                { icon: Wallet, label: 'Cash & Finance', id: 'features' },
                { icon: Bot, label: 'Luna AI Agent', id: 'features' },
                { icon: KanbanSquare, label: 'Leads Pipeline', id: 'features' },
              ].map((item, i) => (
                <li key={i}>
                  <button onClick={() => scrollTo(item.id)} className="flex items-center gap-2 text-sm text-zinc-500 hover:text-cyan-400 transition-colors">
                    <item.icon className="w-3.5 h-3.5" /> {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-5">Company</h4>
            <ul className="space-y-3">
              <li>
                <a href="https://nexo-digital.app/" target="_blank" rel="noopener noreferrer" className="text-sm text-zinc-500 hover:text-cyan-400 transition-colors">About Us</a>
              </li>
              <li>
                <a href="https://nexo-digital.app/" target="_blank" rel="noopener noreferrer" className="text-sm text-zinc-500 hover:text-cyan-400 transition-colors">Blog</a>
              </li>
              <li>
                <span className="text-sm text-zinc-600 cursor-default">Careers</span>
              </li>
              <li>
                <a href="mailto:contacto@nexo-digital.app" className="text-sm text-zinc-500 hover:text-cyan-400 transition-colors">Contact</a>
              </li>
            </ul>
          </div>

          {/* Legal & Contact */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-5">Legal & Contact</h4>
            <ul className="space-y-3">
              <li><span className="text-sm text-zinc-600 cursor-default">Privacy</span></li>
              <li><span className="text-sm text-zinc-600 cursor-default">Terms</span></li>
              <li><a href="mailto:contacto@nexo-digital.app" className="text-sm text-zinc-500 hover:text-cyan-400 transition-colors">contacto@nexo-digital.app</a></li>
              <li><a href="tel:+34685093192" className="text-sm text-zinc-500 hover:text-cyan-400 transition-colors">+34 685 093 192</a></li>
              <li><a href="tel:+34689135159" className="text-sm text-zinc-500 hover:text-cyan-400 transition-colors">+34 689 135 159</a></li>
              <li><a href="tel:+34672953062" className="text-sm text-zinc-500 hover:text-cyan-400 transition-colors">+34 672 953 062</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-zinc-600">
            &copy; 2026 NEXO Digital S.L. All rights reserved.
          </p>
          <p className="text-xs text-zinc-700">
            Made with care in Barcelona by Abner, Enoque & Elias.
          </p>
        </div>
      </div>
    </footer>
  )
}

/* ============================================================
   MAIN LANDING PAGE
   ============================================================ */
export default function LandingPage() {
  const navigate = useNavigate()
  const [syncOpen, setSyncOpen] = useState(false)
  const tapRef = useRef(null)

  // Redirect logged-in users to dashboard
  useEffect(() => {
    const token = localStorage.getItem('nexo_token')
    if (token) {
      navigate('/dashboard', { replace: true })
    }
  }, [navigate])

  useSyncTap({ targetRef: tapRef, threshold: 7, timeout: 1500, onTrigger: () => setSyncOpen(true) })

  return (
    <div ref={tapRef} className="min-h-screen bg-[#0a0a0f]">
      <Navbar />
      <Hero />
      <Problem />
      <Solution />
      <Features />
      <HowItWorks />
      <Testimonials />
      <Metrics />
      <Demo />
      <Comparison />
      <CTA />
      <FAQ />
      <Footer />
      <SyncSessionModal open={syncOpen} onClose={() => setSyncOpen(false)} />
    </div>
  )
}
