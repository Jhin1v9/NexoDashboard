/**
 * ═════════════════════════════════════════════════════════════════════════════
 * LunaVoiceInput — Neural Uplink
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Interface de uplink neural. Não é um botão de microfone.
 * É um campo de ondas sonoras vivas que pulsam com a voz do usuário.
 *
 * Comportamento:
 *   • Clique no ícone de microfone → ativa o uplink neural
 *   • Waveform de barras verticais pulsa em tempo real (Web Audio API)
 *   • Transcrição aparece caractere por caractere em verde neon
 *   • Indicador de confiança pulsa conforme o reconhecimento
 *   • Ao parar, waveform colapsa e texto vai para o input
 *   • Fallback: botão some com fade-out se SpeechRecognition não suportado
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff } from 'lucide-react'

// Check browser support
const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
const isSupported = !!SpeechRecognitionAPI

export default function LunaVoiceInput({ onTranscript, disabled }) {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [confidence, setConfidence] = useState(0)
  const [bars, setBars] = useState(Array(32).fill(2))
  const [showFallback, setShowFallback] = useState(false)

  const recognitionRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const animationFrameRef = useRef(null)
  const streamRef = useRef(null)

  // Waveform animation loop
  const animateWaveform = useCallback(() => {
    if (!analyserRef.current) return
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(dataArray)

    // Sample 32 bars from the frequency data
    const barCount = 32
    const step = Math.floor(dataArray.length / barCount)
    const newBars = Array.from({ length: barCount }, (_, i) => {
      const value = dataArray[i * step] || 0
      // Map 0-255 to 2-32px height
      return Math.max(2, Math.min(32, (value / 255) * 32))
    })
    setBars(newBars)
    animationFrameRef.current = requestAnimationFrame(animateWaveform)
  }, [])

  const startListening = useCallback(async () => {
    if (!isSupported) return

    setIsListening(true)
    setTranscript('')
    setConfidence(0)

    try {
      // Initialize SpeechRecognition
      const recognition = new SpeechRecognitionAPI()
      recognition.lang = 'pt-BR'
      recognition.continuous = true
      recognition.interimResults = true
      recognition.maxAlternatives = 1

      recognition.onresult = (event) => {
        let finalTranscript = ''
        let interimTranscript = ''
        let maxConfidence = 0

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) {
            finalTranscript += result[0].transcript
            maxConfidence = Math.max(maxConfidence, result[0].confidence)
          } else {
            interimTranscript += result[0].transcript
          }
        }

        setTranscript(finalTranscript + interimTranscript)
        if (maxConfidence > 0) {
          setConfidence(maxConfidence)
        }
      }

      recognition.onerror = (event) => {
        console.warn('[LunaVoiceInput] Speech recognition error:', event.error)
        if (event.error === 'not-allowed') {
          setShowFallback(true)
          setTimeout(() => setShowFallback(false), 3000)
        }
      }

      recognition.onend = () => {
        // Auto-restart if still listening (unless explicitly stopped)
        if (isListening && recognitionRef.current) {
          try { recognition.start() } catch (e) {}
        }
      }

      recognition.start()
      recognitionRef.current = recognition

      // Initialize AudioContext for waveform
      const audioContext = new AudioContext()
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      audioContextRef.current = audioContext
      analyserRef.current = analyser
      animationFrameRef.current = requestAnimationFrame(animateWaveform)

    } catch (e) {
      console.error('[LunaVoiceInput] Error starting voice input:', e.message)
      setIsListening(false)
      setShowFallback(true)
      setTimeout(() => setShowFallback(false), 3000)
    }
  }, [animateWaveform])

  const stopListening = useCallback(() => {
    setIsListening(false)

    // Stop recognition
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch (e) {}
      recognitionRef.current = null
    }

    // Stop audio context
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    if (analyserRef.current) {
      analyserRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    // Send transcript
    const finalText = transcript.trim()
    if (finalText) {
      onTranscript(finalText)
    }
    setTranscript('')
    setConfidence(0)
    setBars(Array(32).fill(2))
  }, [transcript, onTranscript])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
      if (audioContextRef.current) audioContextRef.current.close()
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop())
      if (recognitionRef.current) {
        try { recognitionRef.current.stop() } catch (e) {}
      }
    }
  }, [])

  // Keyboard shortcut: Ctrl+Shift+V
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'V') {
        e.preventDefault()
        if (isListening) {
          stopListening()
        } else {
          startListening()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isListening, startListening, stopListening])

  if (!isSupported) {
    return null // Elegantly disappear
  }

  return (
    <div className="relative flex items-center">
      {/* Fallback warning */}
      <AnimatePresence>
        {showFallback && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute bottom-full mb-2 right-0 px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap z-50"
            style={{
              background: 'rgba(255,71,87,0.1)',
              border: '1px solid rgba(255,71,87,0.2)',
              color: '#ff6b81',
            }}
          >
            Permissão de microfone negada
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mic button */}
      {!isListening ? (
        <motion.button
          onClick={startListening}
          disabled={disabled}
          className="p-2 rounded-lg transition-colors disabled:opacity-30"
          style={{
            border: '1px solid rgba(0,240,255,0.1)',
          }}
          whileHover={{ scale: 1.1, borderColor: 'rgba(0,240,255,0.3)' }}
          whileTap={{ scale: 0.95 }}
          title="Uplink neural (Ctrl+Shift+V)"
        >
          <Mic className="w-4 h-4 text-cyan-400/60" />
        </motion.button>
      ) : (
        <motion.button
          onClick={stopListening}
          className="p-2 rounded-lg"
          style={{
            background: 'rgba(46,213,115,0.1)',
            border: '1px solid rgba(46,213,115,0.3)',
          }}
          animate={{ boxShadow: ['0 0 0px rgba(46,213,115,0)', '0 0 12px rgba(46,213,115,0.2)', '0 0 0px rgba(46,213,115,0)'] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          whileTap={{ scale: 0.95 }}
          title="Parar uplink"
        >
          <MicOff className="w-4 h-4 text-emerald-400" />
        </motion.button>
      )}

      {/* Waveform + Transcript overlay */}
      <AnimatePresence>
        {isListening && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-2 ml-2 overflow-hidden"
          >
            {/* Waveform */}
            <div className="flex items-center gap-[2px] h-8">
              {bars.map((height, i) => (
                <motion.div
                  key={i}
                  className="w-[3px] rounded-full"
                  style={{
                    background: `linear-gradient(to top, rgba(46,213,115,0.3), rgba(46,213,115,${0.5 + (height / 64)}))`,
                    height: `${height}px`,
                  }}
                  animate={{ height: `${height}px` }}
                  transition={{ duration: 0.05 }}
                />
              ))}
            </div>

            {/* Confidence bar */}
            <div className="w-16 h-1 rounded-full overflow-hidden bg-white/5">
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #2ed573, #00f0ff)' }}
                animate={{ width: `${confidence * 100}%` }}
                transition={{ duration: 0.2 }}
              />
            </div>

            {/* Live transcript */}
            {transcript && (
              <span className="text-xs font-mono text-emerald-400/80 truncate max-w-[150px]">
                {transcript}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
