import { NavLink } from 'react-router-dom'
import { Command, LayoutDashboard, FileText, Users, Rocket, CheckSquare, MessageCircle, Github, Triangle, Wrench, DollarSign } from 'lucide-react'

const navItems = [
  { path: '/', icon: Command, label: 'Operações' },
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/orcamentos', icon: FileText, label: 'Orçamentos' },
  { path: '/financeiro', icon: DollarSign, label: 'Financeiro' },
  { path: '/clientes', icon: Users, label: 'Clientes' },
  { path: '/projetos', icon: Rocket, label: 'Projetos' },
  { path: '/tarefas', icon: CheckSquare, label: 'Tarefas' },
  { path: '/whatsapp', icon: MessageCircle, label: 'WhatsApp' },
  { path: '/github', icon: Github, label: 'GitHub' },
  { path: '/vercel', icon: Triangle, label: 'Vercel' },
  { path: '/ferramentas', icon: Wrench, label: 'Ferramentas' },
]

export default function Sidebar({ open, setOpen }) {
  return (
    <aside className={`${open ? 'w-60' : 'w-16'} glass flex flex-col transition-all duration-300`}>
      <div className="p-4 flex items-center gap-3 border-b border-nexo-border">
        <div className="w-8 h-8 rounded-lg bg-nexo-info flex items-center justify-center font-bold text-white text-sm">N</div>
        {open && <span className="font-heading font-bold text-lg">NEXO</span>}
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            title={!open ? item.label : ''}
          >
            <item.icon size={20} />
            {open && <span className="text-sm font-medium">{item.label}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-nexo-border text-xs text-nexo-muted text-center">
        {open && <span>v1.0.0 · VPN Only</span>}
      </div>
    </aside>
  )
}
