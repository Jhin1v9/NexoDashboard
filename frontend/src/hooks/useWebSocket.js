import { useState, useEffect } from 'react'

export default function useWebSocket(url = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`) {
  const [connected, setConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState(null)

  useEffect(() => {
    const wsUrl = url.startsWith('ws') ? url : url.replace(/^http/, window.location.protocol === 'https:' ? 'wss' : 'ws')
    const ws = new WebSocket(wsUrl)
    
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
