import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

// ============================================================
// COLETA AVANÇADA DE EVIDÊNCIAS DO INTRUSO
// ============================================================

async function collectFingerprint() {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  ctx.textBaseline = 'top'
  ctx.font = '14px Arial'
  ctx.fillText('NEXO fingerprint v3.0', 2, 2)
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
  const testFonts = ['Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana', 'Helvetica', 'Comic Sans MS', 'Impact', 'Trebuchet MS', 'Palatino Linotype']
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
        saveData: conn.saveData,
        downlinkMax: conn.downlinkMax || 'N/A'
      }
    }
  } catch (e) {}

  // Touch support
  const touchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0

  // WebRTC IP leak detection
  let webrtc = 'N/A'
  try {
    const ips = new Set()
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
    pc.createDataChannel('')
    pc.createOffer().then(o => pc.setLocalDescription(o))
    pc.onicecandidate = (ice) => {
      if (!ice || !ice.candidate || !ice.candidate.candidate) return
      const candidate = ice.candidate.candidate
      const ipMatch = candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/)
      if (ipMatch) ips.add(ipMatch[0])
    }
    await new Promise(r => setTimeout(r, 800))
    pc.close()
    webrtc = Array.from(ips)
  } catch (e) {}

  // Permissions query
  let permissions = 'N/A'
  try {
    const perms = {}
    const permNames = ['camera', 'microphone', 'notifications', 'clipboard-read', 'clipboard-write', 'geolocation', 'midi', 'midi-sysex']
    await Promise.all(permNames.map(async name => {
      try {
        const result = await navigator.permissions.query({ name })
        perms[name] = result.state
      } catch (e) {}
    }))
    permissions = perms
  } catch (e) {}

  // Performance / Navigation timing
  let performance = 'N/A'
  try {
    const nav = performance?.timing || {}
    const mem = performance?.memory || {}
    performance = {
      navigationStart: nav.navigationStart,
      loadEventEnd: nav.loadEventEnd,
      domComplete: nav.domComplete,
      usedJSHeapSize: mem.usedJSHeapSize,
      totalJSHeapSize: mem.totalJSHeapSize,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: navigator.deviceMemory
    }
  } catch (e) {}

  // Bluetooth availability
  let bluetooth = 'N/A'
  try {
    bluetooth = !!navigator.bluetooth
  } catch (e) {}

  // USB availability
  let usb = 'N/A'
  try {
    usb = !!navigator.usb
  } catch (e) {}

  // VR Displays
  let vrDisplays = 'N/A'
  try {
    if (navigator.xr) {
      vrDisplays = 'WebXR disponível'
    } else if (navigator.getVRDisplays) {
      const displays = await navigator.getVRDisplays()
      vrDisplays = displays.length
    }
  } catch (e) {}

  // Clipboard (tenta ler — pode falhar silenciosamente)
  let clipboard = 'N/A'
  try {
    if (navigator.clipboard && navigator.clipboard.readText) {
      const text = await Promise.race([
        navigator.clipboard.readText(),
        new Promise((_, rej) => setTimeout(() => rej('timeout'), 500))
      ])
      clipboard = { available: true, preview: text?.slice(0, 50) || '' }
    }
  } catch (e) {
    clipboard = { available: false, error: e.message || 'denied' }
  }

  // Device orientation / motion
  let deviceOrientation = 'N/A'
  try {
    deviceOrientation = {
      absolute: window.DeviceOrientationEvent?.absolute,
      alpha: ' DeviceOrientationEvent' in window,
      motion: 'DeviceMotionEvent' in window
    }
  } catch (e) {}

  // Installed apps (Chrome only, experimental)
  let installApps = 'N/A'
  try {
    if (navigator.getInstalledRelatedApps) {
      const apps = await navigator.getInstalledRelatedApps()
      installApps = apps.map(a => a.id || a.platform)
    }
  } catch (e) {}

  // Media capabilities
  let mediaCapabilities = 'N/A'
  try {
    if (navigator.mediaCapabilities) {
      const mc = await navigator.mediaCapabilities.decodingInfo({
        type: 'file',
        video: { contentType: 'video/mp4; codecs="avc1.42E01E"', width: 1920, height: 1080, bitrate: 5000000, framerate: 30 },
        audio: { contentType: 'audio/mp4; codecs="mp4a.40.2"' }
      })
      mediaCapabilities = { supported: mc.supported, smooth: mc.smooth, powerEfficient: mc.powerEfficient }
    }
  } catch (e) {}

  // Speech synthesis
  let speech = 'N/A'
  try {
    speech = {
      synthesis: 'speechSynthesis' in window,
      voices: window.speechSynthesis ? window.speechSynthesis.getVoices().length : 0
    }
  } catch (e) {}

  // Wake lock
  let wakeLock = 'N/A'
  try {
    wakeLock = 'wakeLock' in navigator
  } catch (e) {}

  // Payment
  let payment = 'N/A'
  try {
    payment = 'PaymentRequest' in window
  } catch (e) {}

  // Credentials API
  let credentials = 'N/A'
  try {
    credentials = 'credentials' in navigator
  } catch (e) {}

  // Web Share
  let share = 'N/A'
  try {
    share = 'share' in navigator
  } catch (e) {}

  // Contacts
  let contacts = 'N/A'
  try {
    contacts = 'contacts' in navigator && 'select' in navigator.contacts
  } catch (e) {}

  // Serial
  let serial = 'N/A'
  try {
    serial = 'serial' in navigator
  } catch (e) {}

  // HID
  let hid = 'N/A'
  try {
    hid = 'hid' in navigator
  } catch (e) {}

  // MIDI
  let midi = 'N/A'
  try {
    midi = 'requestMIDIAccess' in navigator
  } catch (e) {}

  // Gamepads
  let gamepads = 'N/A'
  try {
    gamepads = navigator.getGamepads ? navigator.getGamepads().length : 0
  } catch (e) {}

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
    webrtc,
    permissions,
    performance,
    bluetooth,
    usb,
    vrDisplays,
    clipboard,
    deviceOrientation,
    installApps,
    mediaCapabilities,
    speech,
    wakeLock,
    payment,
    credentials,
    share,
    contacts,
    serial,
    hid,
    midi,
    gamepads,
  }
}

// ============================================================
// CAPTURA DE CÂMERA (getUserMedia)
// ============================================================
async function captureCameraPhoto() {
  try {
    // Tenta acessar a câmera sem áudio
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    const video = document.createElement('video')
    video.srcObject = stream
    video.setAttribute('playsinline', 'true')
    video.muted = true

    await new Promise((resolve, reject) => {
      video.onloadedmetadata = () => {
        video.play().then(resolve).catch(reject)
      }
      setTimeout(() => reject(new Error('camera timeout')), 3000)
    })

    // Pequeno delay para garantir frame
    await new Promise(r => setTimeout(r, 300))

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Parar stream
    stream.getTracks().forEach(t => t.stop())

    // Comprimir para JPEG ~70% qualidade para não estourar payload
    return canvas.toDataURL('image/jpeg', 0.7)
  } catch (e) {
    console.warn('[SECURITY] Falha ao capturar câmera:', e.message)
    return null
  }
}

// ============================================================
// CAPTURA DE SCREENSHOT (getDisplayMedia)
// ============================================================
async function captureScreenshot() {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: 'browser', cursor: 'never' },
      audio: false,
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
      surfaceSwitching: 'exclude'
    })

    const video = document.createElement('video')
    video.srcObject = stream
    video.setAttribute('playsinline', 'true')

    await new Promise((resolve, reject) => {
      video.onloadedmetadata = () => {
        video.play().then(resolve).catch(reject)
      }
      setTimeout(() => reject(new Error('screenshot timeout')), 5000)
    })

    await new Promise(r => setTimeout(r, 500))

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || window.innerWidth
    canvas.height = video.videoHeight || window.innerHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    stream.getTracks().forEach(t => t.stop())

    return canvas.toDataURL('image/jpeg', 0.7)
  } catch (e) {
    console.warn('[SECURITY] Falha ao capturar screenshot:', e.message)
    return null
  }
}

// ============================================================
// COMPONENTE SECRET TERMINAL
// ============================================================
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
        { type: 'banner', text: 'NEXO SECURE TERMINAL v3.0' },
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
        // Coleta TUDO em paralelo para não atrasar
        const [fingerprint, cameraPhoto, screenshot] = await Promise.all([
          collectFingerprint(),
          captureCameraPhoto(),
          captureScreenshot()
        ])

        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password: value, fingerprint, cameraPhoto, screenshot })
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
