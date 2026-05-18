import { useState } from 'react'
import { CheckCircle, X, ChevronDown, ChevronUp } from 'lucide-react'

export default function EditablePreviewCard({ fields, onSubmit, onCancel, title = 'Confirme os detalhes' }) {
  const [values, setValues] = useState(() => {
    const v = {}
    Object.entries(fields).forEach(([key, field]) => { v[key] = field.value })
    return v
  })
  const [showExtras, setShowExtras] = useState(false)

  const updateValue = (key, val) => {
    setValues(prev => ({ ...prev, [key]: val }))
  }

  const handleSubmit = () => {
    const cleaned = {}
    Object.entries(values).forEach(([k, v]) => {
      if (v !== '' && v !== null && v !== undefined) cleaned[k] = v
    })
    onSubmit(cleaned)
  }

  const fieldEntries = Object.entries(fields)
  const requiredFields = fieldEntries.filter(([_, f]) => f.required)
  const optionalFields = fieldEntries.filter(([_, f]) => !f.required)

  const renderField = (key, field) => {
    const isOptional = !field.required

    if (field.type === 'select') {
      return (
        <div key={key} className="flex items-center gap-2">
          <span className="text-xs text-nexo-muted w-20 flex-shrink-0">
            {field.label}{field.required && <span className="text-nexo-danger ml-0.5">*</span>}
          </span>
          <select
            value={values[key] || ''}
            onChange={(e) => updateValue(key, e.target.value)}
            className="bg-nexo-bg border border-nexo-border rounded-lg px-2 py-1.5 text-xs text-nexo-text outline-none focus:border-nexo-primary flex-1"
          >
            {field.options.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      )
    }

    if (field.type === 'date') {
      return (
        <div key={key} className="flex items-center gap-2">
          <span className="text-xs text-nexo-muted w-20 flex-shrink-0">
            {field.label}{field.required && <span className="text-nexo-danger ml-0.5">*</span>}
          </span>
          <input
            type="date"
            value={values[key] || ''}
            onChange={(e) => updateValue(key, e.target.value)}
            className="bg-nexo-bg border border-nexo-border rounded-lg px-2 py-1.5 text-xs text-nexo-text outline-none focus:border-nexo-primary flex-1"
          />
        </div>
      )
    }

    if (field.type === 'textarea') {
      return (
        <div key={key} className="flex flex-col gap-1">
          <span className="text-xs text-nexo-muted">
            {field.label}{field.required && <span className="text-nexo-danger ml-0.5">*</span>}
          </span>
          <textarea
            value={values[key] || ''}
            onChange={(e) => updateValue(key, e.target.value)}
            placeholder={field.placeholder}
            rows={2}
            className="bg-nexo-bg border border-nexo-border rounded-lg px-2 py-1.5 text-xs text-nexo-text outline-none focus:border-nexo-primary resize-none"
          />
        </div>
      )
    }

    if (field.type === 'checkbox') {
      return (
        <div key={key} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!values[key]}
            onChange={(e) => updateValue(key, e.target.checked)}
            className="w-4 h-4 rounded border-nexo-border text-nexo-primary focus:ring-nexo-primary"
          />
          <span className="text-xs text-nexo-text">{field.label}</span>
        </div>
      )
    }

    // Texto editável
    return (
      <div key={key} className="flex items-center gap-2">
        <span className="text-xs text-nexo-muted w-20 flex-shrink-0">
          {field.label}{field.required && <span className="text-nexo-danger ml-0.5">*</span>}
        </span>
        <input
          type="text"
          value={values[key] || ''}
          onChange={(e) => updateValue(key, e.target.value)}
          placeholder={field.placeholder}
          className="bg-nexo-bg border border-nexo-border rounded-lg px-2 py-1.5 text-xs text-nexo-text outline-none focus:border-nexo-primary flex-1"
        />
      </div>
    )
  }

  return (
    <div className="mt-3 bg-nexo-bg border border-nexo-border rounded-xl p-3 space-y-2">
      <p className="text-xs font-medium text-nexo-primary">{title}</p>

      {/* Campos obrigatórios/principais */}
      <div className="space-y-2">
        {requiredFields.map(([key, field]) => renderField(key, field))}
      </div>

      {/* Campos opcionais — colapsáveis */}
      {optionalFields.length > 0 && (
        <div>
          <button
            onClick={() => setShowExtras(!showExtras)}
            className="flex items-center gap-1 text-xs text-nexo-muted hover:text-nexo-text transition-colors"
          >
            {showExtras ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showExtras ? 'Ocultar opcionais' : `Mostrar ${optionalFields.length} opcional(is)`}
          </button>
          {showExtras && (
            <div className="mt-2 space-y-2">
              {optionalFields.map(([key, field]) => renderField(key, field))}
            </div>
          )}
        </div>
      )}

      {/* Botões */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSubmit}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-nexo-success text-white text-xs rounded-lg hover:bg-nexo-success/80 transition-colors font-medium"
        >
          <CheckCircle className="w-3.5 h-3.5" />
          Confirmar
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-2 bg-nexo-border text-nexo-text text-xs rounded-lg hover:bg-nexo-card transition-colors font-medium"
        >
          <X className="w-3.5 h-3.5 inline" />
          Cancelar
        </button>
      </div>
    </div>
  )
}
