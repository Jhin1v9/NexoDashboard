/**
 * ═════════════════════════════════════════════════════════════════════════════
 * LunaInlinePreview — Preview visual do que vai acontecer antes de confirmar.
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Mostra ao usuário EXATAMENTE o que será afetado pela ação antes dela
 * ser executada. Usado para ações destrutivas ou em lote.
 *
 * Exemplos:
 *   - "Você está prestes a EXCLUIR 3 tarefas"
 *   - "Email será enviado para: cliente@email.com"
 *   - "Tarefa 'Revisar contrato' será atribuída a: Nonoke"
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle, Trash2, Send, CheckCircle, X, User,
  Mail, FileText, DollarSign, Calendar, Tag, ArrowRight
} from 'lucide-react'

const INTENT_ICONS = {
  'tarefa.deletar': Trash2,
  'tarefa.excluir': Trash2,
  'email.enviar': Send,
  'email.mover_lixeira': Trash2,
  'email.arquivar': CheckCircle,
  'financeiro.excluir_despesa': Trash2,
  'financeiro.excluir_pagamento': Trash2,
  'orcamento.deletar': Trash2,
  'orcamento.enviar_cliente': Send,
  'projeto.deletar': Trash2,
  'cliente.deletar': Trash2,
  'lead.deletar': Trash2,
  'link.excluir': Trash2,
  'ideia.deletar': Trash2,
  'tarefa.atribuir': User,
  'email.responder': Mail,
  'default': ArrowRight,
}

const INTENT_COLORS = {
  'tarefa.deletar': 'text-red-400 bg-red-400/10 border-red-400/20',
  'tarefa.excluir': 'text-red-400 bg-red-400/10 border-red-400/20',
  'email.enviar': 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  'email.mover_lixeira': 'text-red-400 bg-red-400/10 border-red-400/20',
  'financeiro.excluir_despesa': 'text-red-400 bg-red-400/10 border-red-400/20',
  'financeiro.excluir_pagamento': 'text-red-400 bg-red-400/10 border-red-400/20',
  'projeto.deletar': 'text-red-400 bg-red-400/10 border-red-400/20',
  'cliente.deletar': 'text-red-400 bg-red-400/10 border-red-400/20',
  'lead.deletar': 'text-red-400 bg-red-400/10 border-red-400/20',
  'link.excluir': 'text-red-400 bg-red-400/10 border-red-400/20',
  'ideia.deletar': 'text-red-400 bg-red-400/10 border-red-400/20',
  'default': 'text-nexo-primary bg-nexo-primary/10 border-nexo-primary/20',
}

/**
 * Gera uma descrição amigável do que vai acontecer.
 * Retorna elementos React para evitar XSS.
 */
function PreviewDescription({ intent, values, count = 1 }) {
  const [domain, action] = (intent || '').split('.')

  // Ações destrutivas
  if (action?.includes('deletar') || action?.includes('excluir') || action?.includes('remover')) {
    const itemName = getItemName(domain)
    if (count > 1) {
      return (
        <span>
          Você está prestes a <strong>EXCLUIR {count} {itemName}</strong>. Esta ação não pode ser desfeita.
        </span>
      )
    }
    return (
      <span>
        Você está prestes a <strong>EXCLUIR</strong> este item. Não poderá desfazer.
      </span>
    )
  }

  // Envio
  if (action?.includes('enviar')) {
    const dest = values.destinatario || values.para || values.cliente || 'destinatário'
    return (
      <span>
        Email será <strong>ENVIADO</strong> para: <span className="text-nexo-primary">{dest}</span>
      </span>
    )
  }

  // Atribuição
  if (action?.includes('atribuir')) {
    const to = values.assignedTo || values.responsavel || 'responsável'
    return (
      <span>
        Tarefa será <strong>ATRIBUÍDA</strong> a: <span className="text-nexo-primary">{to}</span>
      </span>
    )
  }

  // Responder
  if (action?.includes('responder')) {
    return <span>Uma <strong>RESPOSTA</strong> será enviada para este email.</span>
  }

  // Pagamento/despesa
  if (action?.includes('pagar') || action?.includes('adicionar_despesa')) {
    const valor = values.valor || values.amount || '—'
    const desc = values.descricao || values.titulo || '—'
    return (
      <span>
        Será registrada uma despesa de <strong>R$ {valor}</strong> para: {desc}
      </span>
    )
  }

  // Receita
  if (action?.includes('adicionar_receita')) {
    const valor = values.valor || values.amount || '—'
    const desc = values.descricao || values.titulo || '—'
    return (
      <span>
        Será registrada uma receita de <strong>R$ {valor}</strong> para: {desc}
      </span>
    )
  }

  // Tarefa criar
  if (action?.includes('criar') && domain === 'tarefa') {
    const titulo = values.titulo || 'Nova Tarefa'
    const resp = values.assignedTo || 'sem responsável'
    return (
      <span>
        Será criada a tarefa <strong>"{titulo}"</strong> atribuída a <span className="text-nexo-primary">{resp}</span>
      </span>
    )
  }

  return <span>A ação <strong>{intent}</strong> será executada com os dados informados.</span>
}

function getItemName(domain) {
  const names = {
    tarefa: 'tarefas',
    email: 'emails',
    financeiro: 'transações',
    projeto: 'projetos',
    cliente: 'clientes',
    lead: 'leads',
    link: 'links',
    ideia: 'ideias',
    orcamento: 'orçamentos',
  }
  return names[domain] || 'itens'
}

function formatValue(val) {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

export default function LunaInlinePreview({
  intent,
  values = {},
  affectedItems = [], // array de { id, label, detail? }
  onConfirm,
  onCancel,
  disabled = false, // quando true, desabilita o botão de confirmar
  className = '',
}) {
  const Icon = INTENT_ICONS[intent] || INTENT_ICONS.default
  const colorClass = INTENT_COLORS[intent] || INTENT_COLORS.default
  const isDestructive = intent?.includes('deletar') || intent?.includes('excluir') || intent?.includes('remover')
  const count = affectedItems.length || 1

  const [confirmed, setConfirmed] = useState(false)

  const handleConfirm = () => {
    if (disabled) return
    setConfirmed(true)
    onConfirm?.()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`rounded-xl border ${colorClass} p-4 space-y-3 ${className}`}
    >
      {/* Cabeçalho */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {isDestructive ? (
            <AlertTriangle className="w-5 h-5 text-red-400" />
          ) : (
            <Icon className="w-5 h-5" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm leading-relaxed">
            <PreviewDescription intent={intent} values={values} count={count} />
          </p>
        </div>
      </div>

      {/* Lista de itens afetados */}
      {affectedItems.length > 0 && (
        <div className="bg-black/20 rounded-lg p-2 max-h-40 overflow-y-auto">
          <p className="text-xs text-nexo-muted mb-1.5 px-1">
            {affectedItems.length} {getItemName(intent?.split('.')[0])} selecionados:
          </p>
          <ul className="space-y-1">
            {affectedItems.map((item, i) => (
              <li
                key={item.id || i}
                className="flex items-center gap-2 text-sm px-2 py-1 rounded hover:bg-white/5"
              >
                {isDestructive ? (
                  <Trash2 className="w-3.5 h-3.5 text-red-400 shrink-0" />
                ) : (
                  <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />
                )}
                <span className="truncate">{item.label}</span>
                {item.detail && (
                  <span className="text-xs text-nexo-muted ml-auto shrink-0">{item.detail}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Dados principais */}
      {Object.keys(values).length > 0 && affectedItems.length === 0 && (
        <div className="bg-black/20 rounded-lg p-2.5 space-y-1.5">
          {Object.entries(values).map(([key, val]) => {
            if (!val || key === 'confirmar') return null
            return (
              <div key={key} className="flex justify-between text-sm">
                <span className="text-nexo-muted capitalize">{key.replace(/_/g, ' ')}</span>
                <span className="text-nexo-text font-medium truncate max-w-[60%]">{formatValue(val)}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Botões */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleConfirm}
          disabled={confirmed || disabled}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
            ${isDestructive
              ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30'
              : 'bg-nexo-primary/20 hover:bg-nexo-primary/30 text-nexo-primary border border-nexo-primary/30'
            }
            disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {confirmed ? (
            <>
              <CheckCircle className="w-4 h-4" />
              Executando...
            </>
          ) : (
            <>
              {isDestructive ? <Trash2 className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
              {isDestructive ? 'Sim, excluir' : 'Confirmar'}
            </>
          )}
        </button>
        <button
          onClick={onCancel}
          disabled={confirmed}
          className="px-4 py-2 rounded-lg text-sm text-nexo-muted hover:text-nexo-text hover:bg-white/5 transition-all border border-transparent hover:border-nexo-border"
        >
          <X className="w-4 h-4 inline mr-1" />
          Cancelar
        </button>
      </div>
    </motion.div>
  )
}
