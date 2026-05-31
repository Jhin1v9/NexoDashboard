import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { 
  Home, 
  Wallet, 
  Users, 
  FolderKanban, 
  CheckSquare, 
  BarChart3,
  Settings 
} from 'lucide-react'

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/financeiro', icon: Wallet, label: 'Caixa' },
  { to: '/clientes', icon: Users, label: 'Clientes' },
  { to: '/tarefas', icon: CheckSquare, label: 'Tarefas' },
  { to: '/operacoes', icon: BarChart3, label: 'Ops' },
]

export default function MobileBottomNav() {
  const location = useLocation()
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 sm:hidden safe-area-bottom">
      <div className="flex justify-around items-center h-16 pb-[env(safe-area-inset-bottom,0px)]">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to
          return (
            <NavLink
              key={to}
              to={to}
              className={`mobile-nav-btn ${isActive ? 'active' : ''}`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
