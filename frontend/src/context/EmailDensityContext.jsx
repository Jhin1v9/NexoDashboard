import { createContext, useContext, useState, useEffect } from 'react'

const DENSITY_KEY = 'nexo-email-density'

const EmailDensityContext = createContext(null)

export function EmailDensityProvider({ children }) {
  const [density, setDensity] = useState(() => {
    try {
      const stored = localStorage.getItem(DENSITY_KEY)
      return ['compact', 'normal', 'comfortable'].includes(stored) ? stored : 'normal'
    } catch {
      return 'normal'
    }
  })

  useEffect(() => {
    localStorage.setItem(DENSITY_KEY, density)
  }, [density])

  return (
    <EmailDensityContext.Provider value={{ density, setDensity }}>
      {children}
    </EmailDensityContext.Provider>
  )
}

export const useEmailDensity = () => {
  const ctx = useContext(EmailDensityContext)
  if (!ctx) throw new Error('useEmailDensity must be used within EmailDensityProvider')
  return ctx
}
