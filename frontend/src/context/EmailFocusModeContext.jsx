import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const EmailFocusModeContext = createContext({
  isFocusMode: false,
  enterFocusMode: () => {},
  exitFocusMode: () => {},
  toggleFocusMode: () => {},
})

export function EmailFocusModeProvider({ children }) {
  const [isFocusMode, setIsFocusMode] = useState(() => {
    try {
      return localStorage.getItem('nexo-email-focus-mode') === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('nexo-email-focus-mode', String(isFocusMode))
    } catch {}
  }, [isFocusMode])

  // Esc para sair do modo foco
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' && isFocusMode) {
        e.preventDefault()
        setIsFocusMode(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isFocusMode])

  const enterFocusMode = useCallback(() => setIsFocusMode(true), [])
  const exitFocusMode = useCallback(() => setIsFocusMode(false), [])
  const toggleFocusMode = useCallback(() => setIsFocusMode((v) => !v), [])

  return (
    <EmailFocusModeContext.Provider
      value={{ isFocusMode, enterFocusMode, exitFocusMode, toggleFocusMode }}
    >
      {children}
    </EmailFocusModeContext.Provider>
  )
}

export function useEmailFocusMode() {
  const ctx = useContext(EmailFocusModeContext)
  if (!ctx) {
    throw new Error('useEmailFocusMode must be used within EmailFocusModeProvider')
  }
  return ctx
}

export default EmailFocusModeContext
