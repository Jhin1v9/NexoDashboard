import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'

export function useLinks() {
  const [links, setLinks] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const wsRef = useRef(null)

  // Conectar WebSocket para updates em tempo real
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'links:new') {
          setLinks(prev => [data.data, ...prev])
        }
        if (data.type === 'links:delete') {
          setLinks(prev => prev.filter(l => l.id !== data.data.id))
        }
        if (data.type === 'links:update') {
          setLinks(prev => prev.map(l => l.id === data.data.id ? data.data : l))
        }
      } catch {
        // ignorar mensagens não-JSON
      }
    }

    return () => ws.close()
  }, [])

  const fetchLinks = useCallback(async (filters = {}, offset = 0) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') params.append(key, value)
      })
      params.append('limit', '50')
      params.append('offset', offset.toString())

      const res = await axios.get(`/api/links?${params.toString()}`)
      if (res.data.success) {
        setLinks(prev => offset === 0 ? res.data.links : [...prev, ...res.data.links])
        setStats(res.data.stats)
      }
    } catch (e) {
      setError(e.response?.data?.error || e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const syncLinks = useCallback(async () => {
    try {
      const res = await axios.post('/api/links/sync')
      if (res.data.success) {
        await fetchLinks({}, 0)
        return res.data
      }
    } catch (e) {
      setError(e.response?.data?.error || e.message)
    }
  }, [fetchLinks])

  const enrichAll = useCallback(async () => {
    setLoading(true)
    try {
      await axios.post('/api/links/enrich')
      await fetchLinks({}, 0)
    } catch (e) {
      setError(e.response?.data?.error || e.message)
    } finally {
      setLoading(false)
    }
  }, [fetchLinks])

  return { links, stats, loading, error, fetchLinks, syncLinks, enrichAll, setError }
}
