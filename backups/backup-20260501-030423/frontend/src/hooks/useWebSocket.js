import { useState, useEffect } from 'react'

export default function useWebSocket(url = `ws://${window.location.host}/ws`) {
  const [connected, setConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState(null)

  useEffect(() => {
    const ws = new WebSocket(url.replace('http', 'ws'))
    
    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onmessage = (event) => {
      try {
        setLastMessage(JSON.parse(event.data))
      } catch {}
    }

    return () => ws.close()
  }, [url])

  return { connected, lastMessage }
}
