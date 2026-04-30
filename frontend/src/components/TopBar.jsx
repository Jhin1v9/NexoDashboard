import { useState, useEffect } from 'react'
import { Menu, Search, Wifi, WifiOff, Clock, User } from 'lucide-react'
import axios from 'axios'

export default function TopBar({ onMenuClick, onSearchClick }) {
  const [connected, setConnected] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [activeUser, setActiveUser] = useState('abner')
  const [users, setUsers] = useState({})

  useEffect(() => {
    fetchUsers()
    const interval = setInterval(() => setLastUpdate(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  const fetchUsers = async () => {
    try {
      const res = await axios.get('/api/users')
      setActiveUser(res.data.active)
      setUsers(res.data.users)
    } catch {
      setConnected(false)
    }
  }

  const switchUser = async (user) => {
    try {
      await axios.post('/api/users/switch', { user })
      setActiveUser(user)
    } catch {}
  }

  const user = users[activeUser] || { name: 'Abner', color: '#3742fa' }

  return (
    <header className="h-14 glass flex items-center justify-between px-4 border-b border-nexo-border">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="p-2 hover:bg-nexo-card rounded-lg transition-colors">
          <Menu size={20} />
        </button>
        <button onClick={onSearchClick} className="flex items-center gap-2 px-3 py-1.5 bg-nexo-card rounded-lg text-nexo-muted text-sm hover:text-white transition-colors">
          <Search size={14} />
          <span>Buscar... (Ctrl+K)</span>
        </button>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs text-nexo-muted">
          {connected ? <Wifi size={14} className="text-nexo-success" /> : <WifiOff size={14} className="text-nexo-danger" />}
          <span>{connected ? 'Online' : 'Offline'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-nexo-muted">
          <Clock size={14} />
          <span>Atualizado {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div className="relative group">
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-nexo-card transition-colors">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white font-bold" style={{ backgroundColor: user.color }}>
              <User size={14} />
            </div>
            <span className="text-sm font-medium">{user.name}</span>
          </button>
          <div className="absolute right-0 top-full mt-1 w-40 glass-card py-1 hidden group-hover:block z-50">
            {Object.entries(users).map(([key, u]) => (
              <button key={key} onClick={() => switchUser(key)} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-nexo-card transition-colors">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: u.color }} />
                <span>{u.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  )
}
