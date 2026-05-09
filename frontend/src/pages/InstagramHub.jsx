import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Instagram, MessageCircle, User, Heart, ExternalLink,
  Upload, Filter, Image, Bookmark, Users, Camera
} from 'lucide-react'
import axios from 'axios'

export default function InstagramHub() {
  const [activeTab, setActiveTab] = useState('profile')
  const [profile, setProfile] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProfile()
    fetchMessages()
  }, [])

  const fetchProfile = async () => {
    try {
      const res = await axios.get('/api/instagram/profile')
      if (res.data.success) setProfile(res.data.profile)
    } catch (e) {}
  }

  const fetchMessages = async () => {
    try {
      const res = await axios.get('/api/instagram/messages')
      if (res.data.success) setMessages(res.data.messages)
    } catch (e) {} finally {
      setLoading(false)
    }
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result)
        const msgs = Array.isArray(data) ? data : (data.messages || [])
        const res = await axios.post('/api/instagram/messages/import', { messages: msgs })
        if (res.data.success) {
          fetchMessages()
          alert(`${res.data.added} mensagens importadas!`)
        }
      } catch (e) {
        alert('Erro ao importar: ' + e.message)
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-nexo-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Instagram className="w-6 h-6 text-pink-500" />
          <h2 className="text-xl font-bold">Instagram</h2>
        </div>
        <div className="flex bg-nexo-card rounded-lg p-1">
          <button onClick={() => setActiveTab('profile')} className={`px-3 py-1.5 rounded-md text-sm ${activeTab === 'profile' ? 'bg-nexo-border text-nexo-text' : 'text-nexo-muted'}`}>
            Perfil
          </button>
          <button onClick={() => setActiveTab('messages')} className={`px-3 py-1.5 rounded-md text-sm ${activeTab === 'messages' ? 'bg-nexo-border text-nexo-text' : 'text-nexo-muted'}`}>
            Mensagens
          </button>
        </div>
      </div>

      {activeTab === 'profile' ? (
        <ProfileView profile={profile} />
      ) : (
        <MessagesView messages={messages} onImport={handleImport} />
      )}
    </div>
  )
}

function ProfileView({ profile }) {
  return (
    <div className="flex-1 flex flex-col">
      {/* Profile Header */}
      {profile && (
        <div className="p-6 border-b border-nexo-border">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-3xl">
              <Camera className="w-10 h-10 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-xl font-bold">{profile.displayName}</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-nexo-card text-nexo-muted border border-nexo-border">{profile.category}</span>
              </div>
              <p className="text-sm text-nexo-muted mb-3">@{profile.username}</p>
              <p className="text-sm text-nexo-text mb-3">{profile.bio}</p>
              <div className="flex items-center gap-6 text-sm">
                <div className="text-center">
                  <div className="font-bold">{profile.posts}</div>
                  <div className="text-xs text-nexo-muted">Publicações</div>
                </div>
                <div className="text-center">
                  <div className="font-bold">{profile.followers.toLocaleString('pt-BR')}</div>
                  <div className="text-xs text-nexo-muted">Seguidores</div>
                </div>
                <div className="text-center">
                  <div className="font-bold">{profile.following}</div>
                  <div className="text-xs text-nexo-muted">Seguindo</div>
                </div>
              </div>
            </div>
            <a href={profile.profileUrl} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-nexo-card border border-nexo-border rounded-lg text-sm hover:bg-nexo-border transition-colors flex items-center gap-2">
              <ExternalLink size={14} /> Abrir
            </a>
          </div>
        </div>
      )}

      {/* Iframe */}
      <div className="flex-1 relative">
        <iframe
          src="https://www.instagram.com/nexodigital/embed"
          className="w-full h-full border-0"
          title="NEXO Digital Instagram"
        />
        <a href="https://instagram.com/nexodigital" target="_blank" rel="noopener noreferrer" className="absolute top-4 right-4 px-3 py-2 bg-black/80 backdrop-blur text-white rounded-lg flex items-center gap-2 hover:bg-black transition-colors text-sm">
          <ExternalLink className="w-4 h-4" /> Abrir no Instagram
        </a>
      </div>
    </div>
  )
}

function MessagesView({ messages, onImport }) {
  const [filter, setFilter] = useState('all')

  const filtered = messages.filter(m => {
    if (filter === 'all') return true
    if (filter === 'unread') return !m.isRead
    if (filter === 'clients') return m.isClient
    return true
  })

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-72 border-r border-nexo-border flex flex-col">
        <div className="p-3 border-b border-nexo-border">
          <h3 className="font-medium text-sm">Mensagens</h3>
          <div className="flex gap-1 mt-2">
            {['all', 'unread', 'clients'].map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`px-2 py-1 rounded text-xs ${filter === f ? 'bg-pink-600/20 text-pink-400' : 'text-nexo-muted'}`}>
                {f === 'all' && 'Todas'}
                {f === 'unread' && 'Nao Lidas'}
                {f === 'clients' && 'Clientes'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.map(msg => (
            <div key={msg.id} className="p-3 border-b border-nexo-border hover:bg-nexo-card/50 transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium">{msg.username || msg.sender}</span>
                {msg.isClient && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-nexo-success/20 text-nexo-success">Cliente</span>}
              </div>
              <p className="text-xs text-nexo-muted truncate">{msg.text || msg.body || '(sem texto)'}</p>
              <span className="text-[10px] text-nexo-muted">{msg.importedAt ? new Date(msg.importedAt).toLocaleDateString('pt-BR') : ''}</span>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="p-8 text-center text-nexo-muted">
              <Upload className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Importe mensagens do Instagram</p>
              <p className="text-xs mt-1">Exporte do app e faça upload aqui</p>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-nexo-border">
          <label className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-nexo-card border border-nexo-border rounded-lg text-sm hover:bg-nexo-border transition-colors cursor-pointer">
            <Upload size={14} />
            Importar JSON
            <input type="file" accept=".json" onChange={onImport} className="hidden" />
          </label>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 flex items-center justify-center text-nexo-muted">
        <div className="text-center">
          <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>Selecione uma conversa para visualizar</p>
          <p className="text-xs mt-2">ou importe mensagens do Instagram</p>
        </div>
      </div>
    </div>
  )
}
