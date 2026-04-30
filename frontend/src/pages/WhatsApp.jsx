import { useState } from 'react'
import { MessageCircle, RefreshCw, Send } from 'lucide-react'
import axios from 'axios'
import useRealtime from '../hooks/useRealtime'

export default function WhatsApp() {
  const { data, refetch } = useRealtime('/api/whatsapp', 30000)
  const messages = data || []
  const [msg, setMsg] = useState('')

  const sendMsg = async () => {
    if (!msg.trim()) return
    await axios.post('/api/whatsapp', { text: msg, from: 'dashboard' })
    setMsg('')
    refetch()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-heading">WhatsApp</h1>
        <button onClick={refetch} className="p-2 bg-nexo-card rounded-lg hover:bg-nexo-border transition-colors">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-nexo-border">
          <div className="w-8 h-8 rounded-full bg-nexo-success/20 flex items-center justify-center">
            <MessageCircle size={16} className="text-nexo-success" />
          </div>
          <div>
            <div className="text-sm font-medium">Production 2026</div>
            <div className="text-xs text-nexo-muted">Grupo de produção</div>
          </div>
        </div>

        <div className="space-y-3 max-h-96 overflow-y-auto mb-4">
          {messages.map(m => (
            <div key={m.id} className={`flex ${m.from === 'dashboard' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] px-3 py-2 rounded-lg text-sm ${
                m.from === 'dashboard' ? 'bg-nexo-info text-white' : 'bg-nexo-card'
              }`}>
                <div>{m.text}</div>
                <div className="text-[10px] opacity-60 mt-1">{new Date(m.time).toLocaleTimeString('pt-BR')}</div>
              </div>
            </div>
          ))}
          {messages.length === 0 && (
            <div className="text-center text-nexo-muted text-sm py-8">
              Nenhuma mensagem. Configure o agente WhatsApp para sincronizar.
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            className="flex-1 px-3 py-2 bg-nexo-card rounded-lg border border-nexo-border outline-none text-sm"
            placeholder="Mensagem..."
            value={msg}
            onChange={e => setMsg(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMsg()}
          />
          <button onClick={sendMsg} className="p-2 bg-nexo-success rounded-lg hover:opacity-90">
            <Send size={16} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}
