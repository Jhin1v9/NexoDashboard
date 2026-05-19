import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

// Coletar device fingerprint AVANÇADO no frontend
// Coleta TUDO que é possível para identificar o intruso
async function collectFingerprint() {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  ctx.textBaseline = 'top'
  ctx.font = '14px Arial'
  ctx.fillText('NEXO fingerprint v2.0', 2, 2)
  const canvasHash = canvas.toDataURL().slice(-32)

  // WebGL detalhado
  const glCanvas = document.createElement('canvas')
  const gl = glCanvas.getContext('webgl') || glCanvas.getContext('experimental-webgl')
  let webgl = 'unknown'
  let webglVendor = 'unknown'
  let webglRenderer = 'unknown'
  if (gl) {
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    if (debugInfo) {
      webglVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'unknown'
      webglRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'unknown'
      webgl = `${webglVendor} / ${webglRenderer}`
    }
  }

  // Plugins
  const plugins = Array.from(navigator.plugins || []).map(p => ({
    name: p.name,
    filename: p.filename,
    description: p.description,
    version: p.version || 'N/A'
  }))

  // Font detection básica
  const testFonts = ['Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana', 'Helvetica', 'Comic Sans MS']
  const fonts = []
  const testCanvas = document.createElement('canvas')
  const testCtx = testCanvas.getContext('2d')
  const baseText = 'mmmmmmmmlli'
  testCtx.font = '72px monospace'
  const baseWidth = testCtx.measureText(baseText).width
  testFonts.forEach(font => {
    testCtx.font = `72px "${font}", monospace`
    if (testCtx.measureText(baseText).width !== baseWidth) {
      fonts.push(font)
    }
  })

  // Audio fingerprint
  let audio = 'N/A'
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = audioCtx.createOscillator()
    const analyser = audioCtx.createAnalyser()
    const gainNode = audioCtx.createGain()
    oscillator.connect(analyser)
    analyser.connect(gainNode)
    gainNode.connect(audioCtx.destination)
    oscillator.type = 'sine'
    oscillator.frequency.value = 1000
    oscillator.start()
    const buffer = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteFrequencyData(buffer)
    audio = Array.from(buffer.slice(0, 10)).join(',')
    oscillator.stop()
    audioCtx.close()
  } catch (e) {}

  // Battery
  let battery = 'N/A'
  try {
    if (navigator.getBattery) {
      const bat = await navigator.getBattery()
      battery = {
        level: bat.level,
        charging: bat.charging,
        chargingTime: bat.chargingTime,
        dischargingTime: bat.dischargingTime
      }
    }
  } catch (e) {}

  // Network info
  let network = 'N/A'
  try {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    if (conn) {
      network = {
        effectiveType: conn.effectiveType,
        downlink: conn.downlink,
        rtt: conn.rtt,
        saveData: conn.saveData
      }
    }
  } catch (e) {}

  // Touch support
  const touchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0

  return {
    canvas: canvasHash,
    webgl,
    webglVendor,
    webglRenderer,
    userAgent: navigator.userAgent,
    screen: `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`,
    colorDepth: window.screen.colorDepth,
    pixelRatio: window.devicePixelRatio,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset(),
    language: navigator.language,
    languages: navigator.languages,
    platform: navigator.platform,
    vendor: navigator.vendor,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: navigator.deviceMemory,
    maxTouchPoints: navigator.maxTouchPoints,
    touchSupport,
    cpuClass: navigator.cpuClass || 'N/A',
    oscpu: navigator.oscpu || 'N/A',
    product: navigator.product,
    productSub: navigator.productSub,
    doNotTrack: navigator.doNotTrack,
    cookieEnabled: navigator.cookieEnabled,
    online: navigator.onLine,
    pdfViewerEnabled: navigator.pdfViewerEnabled,
    webdriver: navigator.webdriver,
    plugins: plugins.length > 0 ? plugins.map(p => p.name) : 'N/A',
    fonts: fonts.length > 0 ? fonts : 'N/A',
    audio,
    battery,
    network,
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
        const fingerprint = await collectFingerprint()
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
