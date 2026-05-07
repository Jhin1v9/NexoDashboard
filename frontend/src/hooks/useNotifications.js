import { useState, useEffect, useCallback } from 'react'

export default function useNotifications() {
  const [permission, setPermission] = useState('default')
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    if ('Notification' in window) {
      setSupported(true)
      setPermission(Notification.permission)
    }
  }, [])

  const requestPermission = useCallback(async () => {
    if (!supported) return false
    const result = await Notification.requestPermission()
    setPermission(result)
    return result === 'granted'
  }, [supported])

  const notify = useCallback((title, options = {}) => {
    if (!supported || permission !== 'granted') {
      // Fallback: usa o ToastContext se disponível
      console.log('[Push]', title, options.body)
      return false
    }
    
    const notification = new Notification(title, {
      icon: '/vite.svg',
      badge: '/vite.svg',
      tag: options.tag || 'nexo-notification',
      requireInteraction: options.requireInteraction || false,
      ...options,
    })
    
    notification.onclick = () => {
      window.focus()
      if (options.onClick) options.onClick()
      notification.close()
    }
    
    return notification
  }, [supported, permission])

  return { supported, permission, requestPermission, notify }
}

