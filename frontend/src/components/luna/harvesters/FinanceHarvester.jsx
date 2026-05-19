import { useEffect } from 'react'
import { lunaEventBus } from '../../../lib/lunaEventBus'
import { useLunaDOM } from '../../../hooks/useLunaDOM'

/**
 * FinanceHarvester — Componente invisível que expõe o contexto
 * da página de Financeiro para a Luna.
 */

export default function FinanceHarvester({
  activeTab,
  summary,
  payments,
  expenses,
  cashBox,
  isLoading,
}) {
  useLunaDOM('finance')

  useEffect(() => {
    const alerts = [
      ...(summary?.alerts || []),
      ...(cashBox?.alerts || []),
    ]

    lunaEventBus.emit('luna:dataUpdated', {
      module: 'finance',
      data: {
        tab: activeTab,
        summary: summary
          ? {
              totalExpected: summary.totalExpected,
              totalReceived: summary.totalReceived,
              totalPending: summary.totalPending,
              cashBalance: summary.cashBalance,
            }
          : null,
        payments: {
          count: payments?.length || 0,
        },
        expenses: {
          count: expenses?.length || 0,
        },
        cashBox: cashBox
          ? {
              balance: cashBox.balance,
              monthlyIncome: cashBox.monthlyIncome,
              monthlyExpenses: cashBox.monthlyExpenses,
              projectedBalance: cashBox.projectedBalance,
            }
          : null,
        alerts,
        isLoading,
        capabilities: {
          canAddPayment: true,
          canAddExpense: true,
          canViewCash: true,
        },
      },
    })
  }, [activeTab, summary, payments, expenses, cashBox, isLoading])

  return null
}
