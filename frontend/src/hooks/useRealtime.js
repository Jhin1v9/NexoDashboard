import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'

export default function useRealtime(endpoint, interval = 30000) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const latestRequestRef = useRef(0)

  const fetch = useCallback(async () => {
    const requestId = ++latestRequestRef.current
    try {
      const res = await axios.get(endpoint)
      // Ignora respostas de requisições antigas (race condition protection)
      if (latestRequestRef.current === requestId) {
        setData(res.data)
        setError(null)
      }
    } catch (e) {
      if (latestRequestRef.current === requestId) {
        setError(e)
      }
    } finally {
      if (latestRequestRef.current === requestId) {
        setLoading(false)
      }
    }
  }, [endpoint])

  useEffect(() => {
    fetch()
    const id = setInterval(fetch, interval)
    return () => clearInterval(id)
  }, [fetch, interval])

  return { data, loading, error, refetch: fetch }
}
