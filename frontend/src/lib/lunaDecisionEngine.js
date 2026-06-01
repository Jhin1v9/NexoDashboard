/**
 * ═════════════════════════════════════════════════════════════════════════════
 * LUNA DECISION ENGINE — Determina COMO executar uma ação baseado em
 * confiança, completude de dados e risco.
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Retorna um dos 5 modos de execução:
 *   - 'auto'      → Executa direto (alta confiança, dados OK, não destrutivo)
 *   - 'collect'   → Drawer com campos vazios (dados incompletos)
 *   - 'confirm'   → Drawer + safety delay 1.5s (alta confiança, mas destrutivo)
 *   - 'preview'   → Drawer com dados preenchidos, 1 clique confirma (média confiança)
 *   - 'transform' → Interface muda para seleção múltipla (baixa confiança/ambiguidade)
 *
 * Decision Matrix:
 *   ┌─────────────────────┬─────────────────────┬─────────────────────┐
 *   │                     │ DADOS COMPLETOS     │ DADOS INCOMPLETOS   │
 *   ├─────────────────────┼─────────────────────┼─────────────────────┤
 *   │ ALTA (≥85%)         │ auto                │ collect             │
 *   │                     │ (sem delay se safe) │ (coleta faltante)   │
 *   ├─────────────────────┼─────────────────────┼─────────────────────┤
 *   │ MÉDIA (50-84%)      │ preview             │ collect             │
 *   │                     │ (drawer + confirm)  │ (coleta + confirma) │
 *   ├─────────────────────┼─────────────────────┼─────────────────────┤
 *   │ BAIXA (<50%)        │ transform           │ transform           │
 *   │                     │ (interface muda)    │ (interface muda)    │
 *   └─────────────────────┴─────────────────────┴─────────────────────┘
 *
 * Eixo adicional — RISCO:
 *   - Destrutivo (apagar, deletar, excluir, remover, cancelar) → safety delay
 *   - Irreversível (enviar email) → preview obrigatório
 */

const DESTRUCTIVE_KEYWORDS = ['apagar', 'deletar', 'excluir', 'remover', 'cancelar']
const IRREVERSIBLE_INTENTS = ['email.enviar']

/**
 * Verifica se um intent ou texto indica ação destrutiva.
 */
export function isDestructive(intent, text = '') {
  const combined = `${intent || ''} ${text || ''}`.toLowerCase()
  return DESTRUCTIVE_KEYWORDS.some(kw => combined.includes(kw))
}

/**
 * Verifica se o intent é irreversível (email enviado, zap enviado).
 */
export function isIrreversible(intent) {
  return IRREVERSIBLE_INTENTS.some(i => (intent || '').startsWith(i))
}

/**
 * Verifica se todos os campos obrigatórios do schema estão preenchidos.
 * @param {object} schema — retorno de getSchema(intent)
 * @param {object} values — valores atuais dos campos
 */
export function hasAllRequiredFields(schema, values = {}) {
  if (!schema?.fields) return true
  return Object.entries(schema.fields).every(([key, field]) => {
    if (!field.required) return true
    const val = values[key]
    return val !== undefined && val !== '' && val !== null
  })
}

/**
 * Extrai quais campos obrigatórios estão faltando.
 */
export function getMissingFields(schema, values = {}) {
  if (!schema?.fields) return []
  return Object.entries(schema.fields)
    .filter(([key, field]) => {
      if (!field.required) return false
      const val = values[key]
      return val === undefined || val === '' || val === null
    })
    .map(([key, field]) => ({ key, label: field.label, type: field.type }))
}

/**
 * Calcula a completude dos dados (0.0 a 1.0).
 */
export function calculateDataCompleteness(schema, values = {}) {
  if (!schema?.fields) return 1.0
  const requiredFields = Object.entries(schema.fields).filter(([, f]) => f.required)
  if (requiredFields.length === 0) return 1.0
  const filled = requiredFields.filter(([key]) => {
    const val = values[key]
    return val !== undefined && val !== '' && val !== null
  }).length
  return filled / requiredFields.length
}

/**
 * Decide o modo de execução baseado no resultado do NLU + schema + valores.
 *
 * @param {object} params
 * @param {number} params.score — confiança do NLU (0-1)
 * @param {string} params.intent — intent detectado
 * @param {string} params.text — texto original do usuário
 * @param {object} params.schema — schema do intent
 * @param {object} params.values — valores extraídos/pre-preenchidos
 * @param {boolean} params.hasSelection — usuário já selecionou algo na UI?
 * @returns {object} { mode, reason, meta }
 */
export function decideExecution({
  score = 0,
  intent = '',
  text = '',
  schema = null,
  values = {},
  hasSelection = false,
}) {
  const destructive = isDestructive(intent, text)
  const irreversible = isIrreversible(intent)
  const complete = hasAllRequiredFields(schema, values)
  const completeness = calculateDataCompleteness(schema, values)
  const missing = getMissingFields(schema, values)

  // ── Alto Risco: irreversível SEMPRE requer preview/confirm ──
  if (irreversible) {
    return {
      mode: 'preview',
      reason: 'Ação irreversível requer confirmação visual',
      meta: { destructive: false, irreversible: true, completeness, missing },
    }
  }

  // ── ALTA CONFIANÇA (≥85%) ──
  if (score >= 0.85) {
    if (!complete) {
      return {
        mode: 'collect',
        reason: 'Alta confiança, mas dados incompletos',
        meta: { destructive, completeness, missing },
      }
    }

    if (destructive) {
      return {
        mode: 'confirm',
        reason: 'Alta confiança, mas ação destrutiva requer safety delay',
        meta: { destructive: true, completeness, missing, delayMs: 1500 },
      }
    }

    return {
      mode: 'auto',
      reason: 'Alta confiança + dados completos + ação segura',
      meta: { destructive: false, completeness, missing },
    }
  }

  // ── MÉDIA CONFIANÇA (50-84%) ──
  if (score >= 0.50) {
    if (destructive) {
      return {
        mode: 'confirm',
        reason: 'Média confiança + ação destrutiva = confirmação obrigatória',
        meta: { destructive: true, completeness, missing, delayMs: 1500 },
      }
    }

    return {
      mode: 'preview',
      reason: 'Média confiança: preview antes de executar',
      meta: { destructive: false, completeness, missing },
    }
  }

  // ── BAIXA CONFIANÇA (<50%) ──
  return {
    mode: 'transform',
    reason: 'Baixa confiança: transformar interface para seleção manual',
    meta: { destructive, completeness, missing, hasSelection },
  }
}

/**
 * Builder fluente para criar decisões (útil para testes e debug).
 */
export class DecisionBuilder {
  constructor() {
    this.params = {}
  }

  score(v) { this.params.score = v; return this }
  intent(v) { this.params.intent = v; return this }
  text(v) { this.params.text = v; return this }
  schema(v) { this.params.schema = v; return this }
  values(v) { this.params.values = v; return this }
  hasSelection(v) { this.params.hasSelection = v; return this }

  decide() {
    return decideExecution(this.params)
  }
}

// ── Helpers de debug ──

export function describeDecision(decision) {
  const labels = {
    auto: '🟢 Execução Direta',
    collect: '🟡 Coleta de Dados',
    confirm: '🔴 Confirmação + Safety Delay',
    preview: '🟠 Preview de Ação',
    transform: '🔵 Transformação de Interface',
  }
  return `${labels[decision.mode] || decision.mode}: ${decision.reason}`
}

export function logDecision(decision, source = 'LunaDecisionEngine') {
  // eslint-disable-next-line no-console
  console.log(`[${source}] ${describeDecision(decision)}`, decision.meta)
}
