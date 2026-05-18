import { useState, useEffect } from 'react'
import { Bell, BellOff, BellRing } from 'lucide-react'
import useNotifications from '../hooks/useNotifications'

export default function PushNotificationButton() {
  const { supported, permission, requestPermission, notify } = useNotifications()
  const [showTooltip, setShowTooltip] = useState(false)

  if (!supported) return null

  const handleClick = async () => {
    if (permission === 'granted') {
      // Testa notificação
      notify('🔔 NEXO Notifications', {
        body: 'Notificações push ativadas! Você receberá alertas de tarefas urgentes e relatórios.',
        tag: 'test-notification',
      })
    } else {
      const granted = await requestPermission()
      if (granted) {
        notify('✅ Notificações Ativadas', {
          body: 'Você receberá alertas do NEXO Dashboard.',
          tag: 'enabled-notification',
        })
      }
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`p-2 rounded-lg transition-colors ${
          permission === 'granted' 
            ? 'bg-nexo-success/20 text-nexo-success hover:bg-nexo-success/30' 
            : 'bg-nexo-card text-nexo-muted hover:text-white'
        }`}
      >
        {permission === 'granted' ? <BellRing size={16} /> : permission === 'denied' ? <BellOff size={16} /> : <Bell size={16} />}
      </button>
      
      {showTooltip && (
        <div className="absolute right-0 top-full mt-1 w-48 glass-card p-2 text-xs text-nexo-muted z-[9990]">
          {permission === 'granted' 
            ? '🔔 Notificações ativas. Clique para testar.' 
            : permission === 'denied' 
              ? '❌ Notificações bloqueadas. Habilite no navegador.' 
              : '🔕 Clique para ativar notificações push'}
        </div>
      )}
    </div>
  )
}

