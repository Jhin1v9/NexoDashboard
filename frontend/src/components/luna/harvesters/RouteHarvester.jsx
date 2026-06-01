import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { lunaEventBus } from '../../../lib/lunaEventBus'

/**
 * RouteHarvester — Componente invisível que detecta mudanças de rota
 * e emite eventos para a Luna saber em qual módulo o usuário está.
 */

const ROUTE_TO_MODULE = {
  '/': 'dashboard',
  '/dashboard': 'dashboard',
  '/operacoes': 'operations',
  '/orcamentos': 'budgets',
  '/clientes': 'clients',
  '/workspace': 'workspace',
  '/projetos': 'projects',
  '/tarefas': 'tasks',
  '/ideias': 'ideas',
  '/email': 'email',
  '/relatorios': 'reports',
  '/github': 'github',
  '/vercel': 'vercel',
  '/ferramentas': 'tools',
  '/financeiro': 'finance',
  '/financeiro/receitas/:id': 'finance',
  '/financeiro/caixa': 'finance',
  '/caixa': 'finance',
  '/financeiro/gastos': 'finance',
  '/gastos': 'finance',
  '/financeiro/gastos/meus': 'finance',
  '/leads': 'leads',
  '/luna': 'luna',
  '/sistema': 'system',
  '/settings': 'settings',
  '/seguranca': 'security',
  '/changelog': 'changelog',
}

function resolveModule(pathname) {
  // Match exato primeiro
  if (ROUTE_TO_MODULE[pathname]) {
    return ROUTE_TO_MODULE[pathname]
  }
  // Match parcial (para rotas dinâmicas como /workspace/:clientId)
  const base = '/' + pathname.split('/')[1]
  return ROUTE_TO_MODULE[base] || 'unknown'
}

function extractParams(pathname) {
  const parts = pathname.split('/').filter(Boolean)
  const params = {}
  if (parts.length >= 2) {
    params.id = parts[parts.length - 1]
  }
  return params
}

export default function RouteHarvester() {
  const location = useLocation()

  useEffect(() => {
    const moduleId = resolveModule(location.pathname)
    const params = extractParams(location.pathname)

    lunaEventBus.emit('luna:routeChanged', {
      route: location.pathname,
      module: moduleId,
      params,
    })
  }, [location.pathname])

  return null
}
