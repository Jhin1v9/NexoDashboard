import { Settings as SettingsIcon } from 'lucide-react'

export default function Settings() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-nexo-muted">
      <SettingsIcon size={48} className="mb-4 opacity-50" />
      <h2 className="text-xl font-bold text-nexo-text mb-2">Configuracoes</h2>
      <p className="text-sm">Modulo em desenvolvimento</p>
    </div>
  )
}
