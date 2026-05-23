/**
 * ═════════════════════════════════════════════════════════════════════════════
 * useLunaVoice — Voice Settings + TTS Manager
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Gerencia configurações de voz da Luna e TTS (Text-to-Speech).
 * Persiste preferências no localStorage.
 *
 * Features:
 *   • TTS para respostas da Luna (speechSynthesis)
 *   • Toggle STT (Speech-to-Text)
 *   • Toggle TTS (Text-to-Speech)
 *   • Controle de velocidade (rate: 0.5 - 2.0)
 *   • Controle de volume (volume: 0 - 1)
 *   • Seleção automática de voz pt-BR
 *   • Indicador de "falando"
 */

import { useState, useCallback, useEffect, useRef } from 'react'

const STORAGE_KEY = 'luna-voice-settings'

const DEFAULT_SETTINGS = {
  sttEnabled: true,
  ttsEnabled: false, // opt-in por padrão
  rate: 1.1,
  volume: 1.0,
  pitch: 1.0,
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {}
  return DEFAULT_SETTINGS
}

function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {}
}

function getPtBrVoice() {
  const voices = window.speechSynthesis?.getVoices?.() || []
  // Preferência: Google pt-BR → Microsoft pt-BR → qualquer pt-BR → primeira voz
  const ptVoices = voices.filter(v => v.lang?.toLowerCase().startsWith('pt'))
  return (
    ptVoices.find(v => v.name.includes('Google') && v.name.includes('Brazil')) ||
    ptVoices.find(v => v.name.includes('Google') && v.lang?.includes('BR')) ||
    ptVoices.find(v => v.name.includes('Microsoft') && v.lang?.includes('BR')) ||
    ptVoices.find(v => v.lang?.includes('BR')) ||
    ptVoices[0] ||
    voices[0]
  )
}

export default function useLunaVoice() {
  const [settings, setSettings] = useState(loadSettings)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const utteranceRef = useRef(null)

  // Persist settings
  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  // Preload voices (Chrome loads them asynchronously)
  useEffect(() => {
    if (!window.speechSynthesis) return
    const loadVoices = () => getPtBrVoice()
    window.speechSynthesis.onvoiceschanged = loadVoices
    loadVoices()
    return () => { window.speechSynthesis.onvoiceschanged = null }
  }, [])

  const updateSetting = useCallback((key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }, [])

  const speak = useCallback((text) => {
    if (!window.speechSynthesis || !settings.ttsEnabled || !text?.trim()) return

    // Cancel any ongoing speech
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    const voice = getPtBrVoice()
    if (voice) utterance.voice = voice
    utterance.lang = 'pt-BR'
    utterance.rate = settings.rate
    utterance.pitch = settings.pitch
    utterance.volume = settings.volume

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }, [settings.ttsEnabled, settings.rate, settings.pitch, settings.volume])

  const stopSpeaking = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    setIsSpeaking(false)
  }, [])

  const toggleStt = useCallback(() => {
    setSettings(prev => ({ ...prev, sttEnabled: !prev.sttEnabled }))
  }, [])

  const toggleTts = useCallback(() => {
    setSettings(prev => ({ ...prev, ttsEnabled: !prev.ttsEnabled }))
  }, [])

  return {
    settings,
    isSpeaking,
    speak,
    stopSpeaking,
    toggleStt,
    toggleTts,
    updateSetting,
    // Helpers
    sttEnabled: settings.sttEnabled,
    ttsEnabled: settings.ttsEnabled,
    rate: settings.rate,
    volume: settings.volume,
    pitch: settings.pitch,
  }
}
