import { Target } from 'lucide-react'

export default function Leads() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-nexo-muted">
      <Target size={48} className="mb-4 opacity-50 text-nexo-primary" />
      <h2 className="text-xl font-bold text-nexo-text mb-2">Pipeline de Leads</h2>
      <p className="text-sm">Modulo em desenvolvimento (FASE 2)</p>
      <p className="text-xs mt-2">Leads existentes: Onadance, Gesse, Lucas</p>
    </div>
  )
}
