import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Command, LayoutDashboard, FileText, Users, Rocket,
  CheckSquare, MessageCircle, Github, Triangle, Wrench,
  DollarSign, Newspaper, ChevronDown,
  BarChart3, Wallet, Receipt
} from 'lucide-react'

const navItems = [
  { path: '/', icon: Command, label: 'Operacoes' },
  {
    id: 'negocio',
    icon: Rocket,
    label: 'Negocio',
    children: [
      { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { path: '/clientes', icon: Users, label: 'Clientes' },
      { path: '/projetos', icon: Rocket, label: 'Projetos' },
      { path: '/orcamentos', icon: FileText, label: 'Orcamentos' },
    ]
  },
  {
    id: 'comunicacao',
    icon: MessageCircle,
    label: 'Comunicacao',
    children: [
      { path: '/whatsapp', icon: MessageCircle, label: 'WhatsApp' },
      { path: '/relatorios', icon: BarChart3, label: 'Relatorios' },
    ]
  },
  {
    id: 'financeiro',
    icon: DollarSign,
    label: 'Financeiro',
    children: [
      { path: '/financeiro', icon: DollarSign, label: 'Resumo' },
      { path: '/financeiro/caixa', icon: Wallet, label: 'Caixa' },
      { path: '/financeiro/gastos', icon: Receipt, label: 'Gastos' },
    ]
  },
  {
    id: 'devops',
    icon: Github,
    label: 'DevOps',
    children: [
      { path: '/github', icon: Github, label: 'GitHub' },
      { path: '/vercel', icon: Triangle, label: 'Vercel' },
      { path: '/ferramentas', icon: Wrench, label: 'Ferramentas' },
    ]
  },
  { path: '/tarefas', icon: CheckSquare, label: 'Tarefas' },
  { path: '/changelog', icon: Newspaper, label: 'Changelog' },
]

function isSectionActive(children, pathname) {
  return children.some(c => pathname === c.path || pathname.startsWith(c.path + '/'))
}

function NavItem({ item, sidebarOpen }) {
  const location = useLocation()
  const hasChildren = !!item.children
  const isActive = hasChildren
    ? isSectionActive(item.children, location.pathname)
    : location.pathname === item.path

  if (!hasChildren) {
    return (
      <NavLink
        to={item.path}
        className={({ isActive: a }) => `nav-item ${a ? 'active' : ''}`}
        title={!sidebarOpen ? item.label : ''}
      >
        <item.icon size={20} />
        {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
      </NavLink>
    )
  }

  return <AccordionSection item={item} isActive={isActive} sidebarOpen={sidebarOpen} />
}

function AccordionSection({ item, isActive, sidebarOpen }) {
  const [expanded, setExpanded] = useState(isActive)

  useEffect(() => {
    if (isActive && !expanded) setExpanded(true)
  }, [isActive])

  useEffect(() => {
    if (!sidebarOpen) setExpanded(false)
  }, [sidebarOpen])

  if (!sidebarOpen) {
    return (
      <div className="relative group">
        <button className={`nav-item w-full ${isActive ? 'active' : ''}`} title={item.label} onClick={() => setExpanded(!expanded)}>
          <item.icon size={20} />
        </button>
        {expanded && (
          <div className="absolute left-full top-0 ml-2 w-48 glass-card rounded-lg border border-nexo-border shadow-xl z-50 py-1">
            <div className="px-3 py-2 text-xs font-semibold text-nexo-muted border-b border-nexo-border">{item.label}</div>
            {item.children.map(child => (
              <NavLink
                key={child.path}
                to={child.path}
                className={({ isActive: a }) => `flex items-center gap-2 px-3 py-2 text-sm transition-colors ${a ? 'text-nexo-primary bg-nexo-primary/10' : 'text-nexo-text hover:bg-nexo-card/50'}`}
              >
                <child.icon size={16} />
                <span>{child.label}</span>
              </NavLink>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      <button onClick={() => setExpanded(!expanded)} className={`nav-item w-full justify-between ${isActive ? 'active' : ''}`}>
        <div className="flex items-center gap-3">
          <item.icon size={20} />
          <span className="text-sm font-medium">{item.label}</span>
        </div>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={16} className="text-nexo-muted" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="ml-4 pl-4 border-l border-nexo-border space-y-0.5">
              {item.children.map(child => (
                <NavLink
                  key={child.path}
                  to={child.path}
                  className={({ isActive: a }) => `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${a ? 'text-nexo-primary bg-nexo-primary/10 border-l-2 border-nexo-primary' : 'text-nexo-muted hover:text-nexo-text hover:bg-nexo-card/50 border-l-2 border-transparent'}`}
                >
                  <child.icon size={16} />
                  <span>{child.label}</span>
                </NavLink>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function Sidebar({ open }) {
  return (
    <aside className={`${open ? 'w-60' : 'w-16'} glass flex flex-col transition-all duration-300`}>
      <div className="p-4 flex items-center gap-3 border-b border-nexo-border">
        <div className="w-8 h-8 rounded-lg bg-nexo-info flex items-center justify-center font-bold text-white text-sm">N</div>
        {open && <span className="font-heading font-bold text-lg">NEXO</span>}
      </div>
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {navItems.map(item => <NavItem key={item.path || item.id} item={item} sidebarOpen={open} />)}
      </nav>
      <div className="p-4 border-t border-nexo-border text-xs text-nexo-muted text-center">
        {open && <span>v1.0.0 - VPN Only</span>}
      </div>
    </aside>
  )
}