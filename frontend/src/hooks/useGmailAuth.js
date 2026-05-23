import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'

export function useGmailAuth() {
  const [status, setStatus] = useState({ connected: false, loading: true })

  const checkStatus = useCallback(async () => {
    try {
      const res = await axios.get('/api/email/auth/status')
      setStatus({ ...res.data, loading: false })
    } catch (e) {
      setStatus({ connected: false, loading: false, error: e.message })
    }
  }, [])

  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  const connect = useCallback(async () => {
    try {
      const res = await axios.get('/api/email/auth/url')
      if (res.data.success && res.data.authUrl) {
        window.location.href = res.data.authUrl
      } else {
        alert('Erro ao conectar com Google: ' + (res.data.error || 'URL de autenticação não disponível'))
      }
    } catch (e) {
      const msg = e.response?.data?.error || e.message || 'Erro desconhecido'
      console.error('Erro ao iniciar OAuth:', e)
      alert('Erro ao conectar com Google: ' + msg)
    }
  }, [])

  const disconnect = useCallback(async () => {
    try {
      await axios.post('/api/email/auth/revoke')
      setStatus({ connected: false, loading: false })
    } catch (e) {
      console.error('Erro ao revogar:', e)
    }
  }, [])

  return { status, connect, disconnect, refresh: checkStatus }
}
