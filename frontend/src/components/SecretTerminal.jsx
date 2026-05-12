import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

// Coletar device fingerprint no frontend
function collectFingerprint() {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  ctx.textBaseline = 'top'
  ctx.font = '14px Arial'
  ctx.fillText('NEXO fingerprint', 2, 2)
  const canvasHash = canvas.toDataURL().slice(-32)

  const gl = document.createElement('canvas').getContext('webgl')
  const debugInfo = gl?.getExtension('WEBGL_debug_renderer_info')
  const gpu = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown'

  return {
    canvas: canvasHash,
    webgl: gpu,
    userAgent: navigator.userAgent,
    screen: `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language
  }
}

function SecretTerminal({ isOpen, onClose }) {
  const { login } = useAuth()
  const [lines, setLines] = useState([])
  const [input, setInput] = useState('')
  const [mode, setMode] = useState('login') // 'login' | 'password' | 'loading' | 'success' | 'error'
  const [username, setUsername] = useState('')
  const terminalRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setLines([
        { type: 'banner', text: 'NEXO SECURE TERMINAL v1.0' },
        { type: 'info', text: 'Digite seu login e senha para acessar o sistema.' },
        { type: 'prompt', text: 'login: ' }
      ])
      setMode('login')
      setInput('')
      setUsername('')
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen])

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [lines])

  const handleSubmit = async () => {
    const value = input.trim()
    if (!value) return

    if (mode === 'login') {
      setLines(prev => [...prev, { type: 'input', text: value }])
      setUsername(value)
      setMode('password')
      setInput('')
      setLines(prev => [...prev, { type: 'prompt', text: 'password: ' }])
    } else if (mode === 'password') {
      setLines(prev => [...prev, { type: 'input', text: '*'.repeat(value.length) }])
      setMode('loading')
      setInput('')
      setLines(prev => [...prev, { type: 'loading', text: 'Authenticating...' }])

      try {
        const fingerprint = collectFingerprint()
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password: value, fingerprint })
        })
        const data = await res.json()

        if (data.success) {
          setLines(prev => [...prev.filter(l => l.type !== 'loading'), { type: 'success', text: 'ACCESS GRANTED' }, { type: 'info', text: `Welcome, ${data.user.name}` }])
          setMode('success')
          await login(data.token)
          setTimeout(() => {
            window.location.href = '/dashboard'
          }, 1000)
        } else {
          setLines(prev => [
            ...prev.filter(l => l.type !== 'loading'),
            { type: 'error', text: 'ACCESS DENIED' },
            { type: 'error', text: data.error || 'Invalid credentials' },
            { type: 'info', text: '' },
            { type: 'prompt', text: 'login: ' }
          ])
          setMode('login')
          setUsername('')
        }
      } catch (e) {
        setLines(prev => [
          ...prev.filter(l => l.type !== 'loading'),
          { type: 'error', text: 'SYSTEM ERROR' },
          { type: 'error', text: 'Connection failed' },
          { type: 'info', text: '' },
          { type: 'prompt', text: 'login: ' }
        ])
        setMode('login')
        setUsername('')
      }
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'Backspace') {
      e.preventDefault()
      setInput(prev => prev.slice(0, -1))
    } else if (e.key.length === 1) {
      setInput(prev => prev + e.key)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="relative w-full max-w-lg mx-4">
        {/* CRT effects overlay */}
        <div className="absolute inset-0 pointer-events-none z-10 rounded-lg overflow-hidden">
          <div className="absolute inset-0 opacity-20"
            style={{ background: 'linear-gradient(to bottom, rgba(18,16,16,0) 50%, rgba(0,0,0,0.25) 50%)', backgroundSize: '100% 4px' }} />
          <div className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 100%)' }} />
        </div>

        {/* Terminal container */}
        <div className="relative bg-[#0a0a0a] rounded-lg border border-[#00ff41]/30 overflow-hidden"
          style={{ boxShadow: '0 0 30px rgba(0,255,65,0.15), inset 0 0 30px rgba(0,255,65,0.05)' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 bg-[#0a0a0a] border-b border-[#00ff41]/20">
            <span className="text-[#00ff41] text-xs font-mono">nexo@secure:~$</span>
            <button onClick={onClose} className="text-[#00ff41]/60 hover:text-[#00ff41] text-xs font-mono">
              [ESC] fechar
            </button>
          </div>

          {/* Terminal content */}
          <div ref={terminalRef} className="p-4 h-72 overflow-y-auto font-mono text-sm"
            style={{ background: '#0a0a0a' }}>
            {lines.map((line, i) => {
              if (line.type === 'banner') return (
                <div key={i} className="text-[#00ff41] font-bold mb-1">{line.text}</div>
              )
              if (line.type === 'info') return (
                <div key={i} className="text-[#00ff41]/60 text-xs mb-1">{line.text}</div>
              )
              if (line.type === 'prompt') return (
                <div key={i} className="flex items-center">
                  <span className="text-[#00ff41] font-bold">{line.text}</span>
                  {i === lines.length - 1 && (
                    <span className="text-[#00ff41]">
                      {mode === 'password' ? '*'.repeat(input.length) : input}
                      <span className="inline-block w-2 h-4 bg-[#00ff41] ml-0.5 animate-pulse" />
                    </span>
                  )}
                </div>
              )
              if (line.type === 'input') return (
                <div key={i} className="text-[#00ff41]">{line.text}</div>
              )
              if (line.type === 'loading') return (
                <div key={i} className="text-[#ff6b35] animate-pulse">{line.text}</div>
              )
              if (line.type === 'success') return (
                <div key={i} className="text-[#00ff41] font-bold">{line.text}</div>
              )
              if (line.type === 'error') return (
                <div key={i} className="text-red-400">{line.text}</div>
              )
              return null
            })}
          </div>
        </div>

        {/* Hidden input for keyboard capture */}
        <input
          ref={inputRef}
          type="text"
          className="absolute opacity-0 w-1 h-1"
          autoFocus
          onKeyDown={handleKeyDown}
          value={input}
          onChange={() => {}}
        />
      </div>
    </div>
  )
}

export default SecretTerminal
