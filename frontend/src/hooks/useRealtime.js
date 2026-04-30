import { useState, useEffect } from 'react'
import axios from 'axios'

export default function useRealtime(endpoint, interval = 30000) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch = async () => {
    try {
      const res = await axios.get(endpoint)
      setData(res.data)
      setError(null)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetch()
    const id = setInterval(fetch, interval)
    return () => clearInterval(id)
  }, [endpoint, interval])

  return { data, loading, error, refetch: fetch }
}
