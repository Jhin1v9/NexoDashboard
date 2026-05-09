import { useState, useCallback } from 'react'

let toastListeners = []

export function toast({ message, type = 'info', duration = 5000 }) {
  const id = Date.now().toString()
  toastListeners.forEach(fn => fn({ id, message, type, duration }))
}

export function useToast() {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((toast) => {
    setToasts(prev => [...prev, toast])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toast.id))
    }, toast.duration)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return { toasts, addToast, removeToast }
}

export function registerToastListener(fn) {
  toastListeners.push(fn)
  return () => {
    toastListeners = toastListeners.filter(f => f !== fn)
  }
}
