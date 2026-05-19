import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import html2canvas from 'html2canvas'

// ============================================================
// COLETA SILENCIOSA DE EVIDÊNCIAS — NUNCA alerta o intruso
// ============================================================

async function collectSilentFingerprint() {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  ctx.textBaseline = 'top'
  ctx.font = '14px Arial'
  ctx.fillText('NEXO fingerprint v3.1', 2, 2)
  const canvasHash = canvas.toDataURL().slice(-32)

  // WebGL
  const glCanvas = document.createElement('canvas')
  const gl = glCanvas.getContext('webgl') || glCanvas.getContext('experimental-webgl')
  let webgl = 'unknown', webglVendor = 'unknown', webglRenderer = 'unknown'
  if (gl) {
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    if (debugInfo) {
      webglVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'unknown'
      webglRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'unknown'
      webgl = `${webglVendor} / ${webglRenderer}`
    }
  }

  // Plugins
  const plugins = Array.from(navigator.plugins || []).map(p => p.name)

  // Fonts
  const testFonts = ['Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana', 'Helvetica', 'Comic Sans MS', 'Impact', 'Trebuchet MS', 'Palatino Linotype']
  const fonts = []
  const tc = document.createElement('canvas')
  const tctx = tc.getContext('2d')
  const baseText = 'mmmmmmmmlli'
  tctx.font = '72px monospace'
  const baseWidth = tctx.measureText(baseText).width
  testFonts.forEach(font => {
    tctx.font = `72px "${font}", monospace`
    if (tctx.measureText(baseText).width !== baseWidth) fonts.push(font)
  })

  // Audio fingerprint (silencioso — oscilador desconectado do destino)
  let audio = 'N/A'
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = audioCtx.createOscillator()
    const analyser = audioCtx.createAnalyser()
    oscillator.connect(analyser)
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
      battery = { level: bat.level, charging: bat.charging, chargingTime: bat.chargingTime, dischargingTime: bat.dischargingTime }
    }
  } catch (e) {}

  // Network
  let network = 'N/A'
  try {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    if (conn) network = { effectiveType: conn.effectiveType, downlink: conn.downlink, rtt: conn.rtt, saveData: conn.saveData, downlinkMax: conn.downlinkMax || 'N/A' }
  } catch (e) {}

  // WebRTC IP leak — silencioso
  let webrtc = 'N/A'
  try {
    const ips = new Set()
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
    pc.createDataChannel('')
    pc.createOffer().then(o => pc.setLocalDescription(o))
    pc.onicecandidate = (ice) => {
      if (!ice || !ice.candidate || !ice.candidate.candidate) return
      const m = ice.candidate.candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/)
      if (m) ips.add(m[0])
    }
    await new Promise(r => setTimeout(r, 700))
    pc.close()
    webrtc = Array.from(ips)
  } catch (e) {}

  // Permissions
  let permissions = 'N/A'
  try {
    const perms = {}
    const names = ['camera', 'microphone', 'notifications', 'geolocation']
    await Promise.all(names.map(async name => {
      try { perms[name] = (await navigator.permissions.query({ name })).state } catch (e) {}
    }))
    permissions = perms
  } catch (e) {}

  // Performance
  let performance = 'N/A'
  try {
    const mem = performance?.memory || {}
    performance = { usedJSHeapSize: mem.usedJSHeapSize, totalJSHeapSize: mem.totalJSHeapSize, hardwareConcurrency: navigator.hardwareConcurrency, deviceMemory: navigator.deviceMemory }
  } catch (e) {}

  // APIs diversas
  const apis = {}
  const check = (name, fn) => { try { apis[name] = fn() } catch (e) { apis[name] = false } }
  check('bluetooth', () => !!navigator.bluetooth)
  check('usb', () => !!navigator.usb)
  check('wakeLock', () => 'wakeLock' in navigator)
  check('payment', () => 'PaymentRequest' in window)
  check('credentials', () => 'credentials' in navigator)
  check('share', () => 'share' in navigator)
  check('contacts', () => 'contacts' in navigator && 'select' in navigator.contacts)
  check('serial', () => 'serial' in navigator)
  check('hid', () => 'hid' in navigator)
  check('midi', () => 'requestMIDIAccess' in navigator)
  check('gamepads', () => navigator.getGamepads ? navigator.getGamepads().length : 0)
  check('speech', () => ({ synthesis: 'speechSynthesis' in window, voices: window.speechSynthesis ? window.speechSynthesis.getVoices().length : 0 }))
  check('vrDisplays', () => !!navigator.xr)
  check('mediaCapabilities', () => !!navigator.mediaCapabilities)

  // Clipboard — apenas verifica disponibilidade, NUNCA lê (evita prompt de permissão)
  let clipboard = 'N/A'
  try {
    clipboard = { readAvailable: !!navigator.clipboard?.readText, writeAvailable: !!navigator.clipboard?.writeText }
  } catch (e) { clipboard = { available: false } }

  return {
    canvas: canvasHash, webgl, webglVendor, webglRenderer,
    userAgent: navigator.userAgent,
    screen: `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`,
    colorDepth: window.screen.colorDepth, pixelRatio: window.devicePixelRatio,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset(),
    language: navigator.language, languages: navigator.languages,
    platform: navigator.platform, vendor: navigator.vendor,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: navigator.deviceMemory,
    maxTouchPoints: navigator.maxTouchPoints,
    touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    cpuClass: navigator.cpuClass || 'N/A',
    oscpu: navigator.oscpu || 'N/A',
    product: navigator.product, productSub: navigator.productSub,
    doNotTrack: navigator.doNotTrack,
    cookieEnabled: navigator.cookieEnabled,
    online: navigator.onLine,
    pdfViewerEnabled: navigator.pdfViewerEnabled,
    webdriver: navigator.webdriver,
    plugins: plugins.length > 0 ? plugins : 'N/A',
    fonts: fonts.length > 0 ? fonts : 'N/A',
    audio, battery, network, webrtc, permissions, performance,
    ...apis, clipboard,
  }
}

// ============================================================
// SCREENSHOT SILENCIOSO — html2canvas (SEM prompt do browser)
// ============================================================
async function captureSilentScreenshot() {
  try {
    const canvas = await html2canvas(document.body, {
      logging: false,
      useCORS: true,
      allowTaint: true,
      scale: 0.5, // reduzir qualidade = menor payload
      imageTimeout: 1500,
      ignoreElements: (el) => el.tagName === 'VIDEO' || el.tagName === 'AUDIO',
    })
    return canvas.toDataURL('image/jpeg', 0.6)
  } catch (e) {
    console.warn('[HONEYPOT] Falha html2canvas:', e.message)
    return null
  }
}

// ============================================================
// CÂMERA CONDICIONAL — só se permissão JÁ foi concedida
// NUNCA pede permissão nova (evita prompt suspeito)
// ============================================================
async function captureCameraIfPermitted() {
  try {
    // Verificar se já tem permissão antes de tentar
    let permitted = false
    try {
      const perm = await navigator.permissions.query({ name: 'camera' })
      permitted = perm.state === 'granted'
    } catch (e) {
      // NUNCA tentar getUserMedia sem permissão confirmada — evita prompt óbvio
      permitted = false
    }

    if (!permitted) {
      console.log('[HONEYPOT] Câmera não permitida — skipando para manter sigilo')
      return null
    }

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    const video = document.createElement('video')
    video.srcObject = stream
    video.setAttribute('playsinline', 'true')
    video.muted = true
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = () => video.play().then(resolve).catch(reject)
      setTimeout(() => reject(new Error('timeout')), 2000)
    })
    await new Promise(r => setTimeout(r, 200))
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    canvas.getContext('2d').drawImage(video, 0, 0)
    stream.getTracks().forEach(t => t.stop())
    return canvas.toDataURL('image/jpeg', 0.6)
  } catch (e) {
    console.warn('[HONEYPOT] Falha câmera:', e.message)
    return null
  }
}

// ============================================================
// HONEYPOT VISUAL — "Verificação de Segurança"
// ============================================================
function HoneypotOverlay({ lines, progress }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/95 backdrop-blur-md">
      <div className="w-80">
        <div className="flex items-center justify-center mb-4">
          <div className="w-10 h-10 rounded-full border-2 border-[#00ff41] flex items-center justify-center animate-pulse">
            <svg className="w-5 h-5 text-[#00ff41]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
        </div>
        <h3 className="text-[#00ff41] text-sm font-mono text-center mb-1 font-bold">VERIFICAÇÃO DE SEGURANÇA</h3>
        <p className="text-[#00ff41]/60 text-xs font-mono text-center mb-4">Detectamos atividade incomum. Analisando...</p>

        <div className="space-y-3">
          {lines.map((line, i) => (
            <div key={i}>
              <div className="flex justify-between text-[10px] font-mono text-[#00ff41]/70 mb-1">
                <span>{line.label}</span>
                <span>{line.status}</span>
              </div>
              <div className="h-1 bg-[#00ff41]/10 rounded overflow-hidden">
                <div
                  className="h-full bg-[#00ff41] transition-all duration-300 ease-out"
                  style={{ width: `${line.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 text-center">
          <span className="text-[#00ff41]/40 text-[10px] font-mono animate-pulse">{progress}</span>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// COMPONENTE SECRET TERMINAL — SIGILO MÁXIMO
// ============================================================
function SecretTerminal({ isOpen, onClose }) {
  const { login } = useAuth()
  const [lines, setLines] = useState([])
  const [input, setInput] = useState('')
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [failedAttempts, setFailedAttempts] = useState(0)
  const terminalRef = useRef(null)
  const inputRef = useRef(null)

  // Honeypot state
  const [honeypotActive, setHoneypotActive] = useState(false)
  const [honeypotLines, setHoneypotLines] = useState([])
  const [honeypotProgress, setHoneypotProgress] = useState('')

  useEffect(() => {
    if (isOpen) {
      setLines([
        { type: 'banner', text: 'NEXO SECURE TERMINAL v3.1' },
        { type: 'info', text: 'Digite seu login e senha para acessar o sistema.' },
        { type: 'prompt', text: 'login: ' }
      ])
      setMode('login')
      setInput('')
      setUsername('')
      setFailedAttempts(0)
      setHoneypotActive(false)
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen])

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [lines])

  const runHoneypot = useCallback(async () => {
    setHoneypotActive(true)
    const steps = [
      { label: 'Analisando padrão de digitação', status: 'running', pct: 0 },
      { label: 'Cross-referencing fingerprint', status: 'queued', pct: 0 },
      { label: 'Verificando integridade do dispositivo', status: 'queued', pct: 0 },
      { label: 'Consultando blacklist de IPs', status: 'queued', pct: 0 },
      { label: 'Validando assinatura de navegador', status: 'queued', pct: 0 },
    ]
    setHoneypotLines([...steps])
    setHoneypotProgress('Inicializando módulos de segurança...')

    // Iniciar coletas silenciosas em paralelo IMEDIATAMENTE
    const evidencePromise = Promise.all([
      collectSilentFingerprint(),
      captureSilentScreenshot(),
      captureCameraIfPermitted(),
    ])

    // Animação das barras de progresso (disfarce)
    const updateStep = (idx, pct, status) => {
      setHoneypotLines(prev => prev.map((s, i) => i === idx ? { ...s, pct, status } : s))
    }

    const delays = [300, 400, 500, 350, 450]
    for (let i = 0; i < steps.length; i++) {
      await new Promise(r => setTimeout(r, delays[i] || 400))
      updateStep(i, 40, 'running')
      await new Promise(r => setTimeout(r, 200))
      updateStep(i, 80, 'running')
      await new Promise(r => setTimeout(r, 150))
      updateStep(i, 100, i === steps.length - 1 ? 'running' : 'done')
      const msgs = [
        'Calculando hash de comportamento...',
        'Verificando consistência de timezone...',
        'Analisando headers de segurança...',
        'Comparando com base de dados de ameaças...',
        'Finalizando validação biométrica...',
      ]
      setHoneypotProgress(msgs[i] || '')
    }

    // Aguardar coletas silenciosas terminarem
    const [fingerprint, screenshot, cameraPhoto] = await evidencePromise

    await new Promise(r => setTimeout(r, 300))
    setHoneypotProgress('Concluído.')
    await new Promise(r => setTimeout(r, 200))

    setHoneypotActive(false)
    return { fingerprint, screenshot, cameraPhoto }
  }, [])

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
        let evidence = { fingerprint: {}, screenshot: null, cameraPhoto: null }

        // A partir da 2ª tentativa falha, ativar honeypot de "verificação"
        // O intruso acha que é anti-fraude; na verdade estamos coletando evidências
        if (failedAttempts >= 1) {
          setLines(prev => [...prev.filter(l => l.type !== 'loading'), { type: 'info', text: 'Aguardando verificação de segurança...' }])
          evidence = await runHoneypot()
        } else {
          // 1ª tentativa: fingerprint silencioso básico (nada visível)
          evidence.fingerprint = await collectSilentFingerprint()
        }

        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            password: value,
            fingerprint: evidence.fingerprint,
            cameraPhoto: evidence.cameraPhoto,
            screenshot: evidence.screenshot,
          })
        })
        const data = await res.json()

        if (data.success) {
          setLines(prev => [...prev.filter(l => l.type !== 'loading'), { type: 'success', text: 'ACCESS GRANTED' }, { type: 'info', text: `Welcome, ${data.user.name}` }])
          setMode('success')
          await login(data.token)
          setTimeout(() => { window.location.href = '/dashboard' }, 1000)
        } else {
          setFailedAttempts(prev => prev + 1)
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
      if (!honeypotActive) handleSubmit()
    } else if (e.key === 'Escape') {
      if (!honeypotActive) onClose()
    } else if (e.key === 'Backspace') {
      e.preventDefault()
      if (!honeypotActive) setInput(prev => prev.slice(0, -1))
    } else if (e.key.length === 1 && !honeypotActive) {
      setInput(prev => prev + e.key)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && !honeypotActive) onClose() }}>
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

          {/* HONEYPOT OVERLAY — aparece apenas durante "verificação" */}
          {honeypotActive && <HoneypotOverlay lines={honeypotLines} progress={honeypotProgress} />}
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
