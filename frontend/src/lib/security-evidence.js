/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Security Evidence Collector — NEXO Dashboard PRO
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Coleta silenciosa de evidências no login. Sem prompts, sem alerts.
 * Extraído do antigo SecretTerminal (removido).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import html2canvas from 'html2canvas'

/**
 * Coleta fingerprint completo do navegador — silencioso
 */
export async function collectSilentFingerprint() {
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

  // Audio fingerprint
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

  // WebRTC IP leak
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
    const mem = window.performance?.memory || {}
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

  // Clipboard
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

/**
 * Screenshot silencioso do body (sem prompt do browser)
 */
export async function captureSilentScreenshot() {
  try {
    const canvas = await html2canvas(document.body, {
      logging: false,
      useCORS: true,
      allowTaint: true,
      scale: 0.5,
      imageTimeout: 1500,
      ignoreElements: (el) => el.tagName === 'VIDEO' || el.tagName === 'AUDIO',
    })
    return canvas.toDataURL('image/jpeg', 0.6)
  } catch (e) {
    console.warn('[SecurityEvidence] Falha html2canvas:', e.message)
    return null
  }
}

/**
 * Foto da câmera — SÓ se permissão JÁ foi concedida (nunca pede)
 */
export async function captureCameraIfPermitted() {
  try {
    let permitted = false
    try {
      const perm = await navigator.permissions.query({ name: 'camera' })
      permitted = perm.state === 'granted'
    } catch (e) {
      permitted = false
    }

    if (!permitted) {
      console.log('[SecurityEvidence] Câmera não permitida — skipando')
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
    console.warn('[SecurityEvidence] Falha câmera:', e.message)
    return null
  }
}
