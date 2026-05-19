import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Copy, Trash2, Terminal, Maximize2, Minimize2 } from 'lucide-react'

export default function DevLogTerminal({ serverId, onClose }) {
  const [logs, setLogs] = useState([])
  const [connected, setConnected] = useState(false)
  const [maximized, setMaximized] = useState(false)
  const bottomRef = useRef(null)
  const containerRef = useRef(null)
  const token = localStorage.getItem('nexo_token') || ''

  useEffect(() => {
    if (!serverId) return
    const url = `/api/workspace/servers/${serverId}/logs/stream?token=${encodeURIComponent(token)}`
    const es = new EventSource(url)

    es.onopen = () => setConnected(true)
    es.onerror = () => setConnected(false)

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.connected) return
        setLogs(prev => {
          const next = [...prev, data]
          if (next.length > 2000) next.splice(0, next.length - 2000)
          return next
        })
      } catch {
        setLogs(prev => [...prev, { line: event.data, isError: false, time: new Date().toISOString() }])
      }
    }

    return () => {
      es.close()
      setConnected(false)
    }
  }, [serverId])

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [logs])

  const handleCopy = () => {
    const text = logs.map(l => l.line).join('\n')
    navigator.clipboard.writeText(text)
  }

  const handleClear = () => setLogs([])

  return (
    <AnimatePresence>
      {serverId && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className={`fixed z-[9999] ${maximized ? 'inset-4' : 'bottom-4 right-4 w-[640px] h-[380px]'}`}
        >
          <div className="w-full h-full glass-card rounded-xl border border-nexo-border flex flex-col overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-nexo-border bg-nexo-card/60">
              <div className="flex items-center gap-2">
                <Terminal size={14} className="text-nexo-info" />
                <span className="text-xs font-medium">Logs — {serverId}</span>
                <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-nexo-success animate-pulse' : 'bg-nexo-danger'}`} />
              </div>
              <div className="flex items-center gap-1">
                <button onClick={handleCopy} className="p-1 hover:bg-nexo-card rounded text-nexo-muted hover:text-nexo-text" title="Copiar"><Copy size={12} /></button>
                <button onClick={handleClear} className="p-1 hover:bg-nexo-card rounded text-nexo-muted hover:text-nexo-text" title="Limpar"><Trash2 size={12} /></button>
                <button onClick={() => setMaximized(!maximized)} className="p-1 hover:bg-nexo-card rounded text-nexo-muted hover:text-nexo-text" title={maximized ? 'Minimizar' : 'Maximizar'}>
                  {maximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                </button>
                <button onClick={onClose} className="p-1 hover:bg-nexo-danger/20 text-nexo-muted hover:text-nexo-danger rounded"><X size={14} /></button>
              </div>
            </div>

            {/* Logs */}
            <div ref={containerRef} className="flex-1 overflow-y-auto p-2 font-mono text-[11px] leading-relaxed space-y-0.5 bg-black/40">
              {logs.length === 0 && (
                <div className="text-nexo-muted opacity-50 text-center py-8">Aguardando logs...</div>
              )}
              {logs.map((entry, i) => (
                <div key={i} className={`break-all ${entry.isError ? 'text-nexo-danger' : 'text-nexo-text/80'}`}>
                  <span className="text-nexo-muted opacity-40 mr-1.5">{new Date(entry.time).toLocaleTimeString()}</span>
                  {entry.line}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
