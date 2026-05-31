import React from 'react'
﻿import { motion } from 'framer-motion'
import { Wallet, TrendingUp, TrendingDown, BarChart3, ArrowRight } from 'lucide-react'

/**
 * @typedef {Object} CashBoxAmount
 * @property {number} value
 * @property {string} currency
 *
 * @typedef {Object} CashBox
 * @property {CashBoxAmount} balance
 * @property {CashBoxAmount} monthlyIncome
 * @property {CashBoxAmount} monthlyExpenses
 * @property {CashBoxAmount} projectedBalance
 * @property {number} projectionMonths
 * @property {string} lastUpdated
 *
 * @typedef {Object} CashBoxWidgetProps
 * @property {CashBox} cashBox
 * @property {() => void} [onViewProjection]
 */

/** @param {CashBoxWidgetProps} props */
export default function CashBoxWidget({ cashBox, onViewProjection }) {
  const formatCurrency = (val, cur) => {
    const symbol = cur === 'BRL' ? 'R$' : cur === 'EUR' ? '€' : cur === 'USD' ? '$' : cur
    return `${symbol} ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  }

  const balance = cashBox?.balance?.value || 0
  const currency = cashBox?.balance?.currency || 'EUR'
  const income = cashBox?.monthlyIncome?.value || 0
  const expenses = cashBox?.monthlyExpenses?.value || 0
  const projected = cashBox?.projectedBalance?.value || 0
  const months = cashBox?.projectionMonths || 3

  const isPositive = balance >= 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-card p-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div
          className="p-2 rounded-lg"
          style={{ background: isPositive ? 'rgba(46,213,115,0.12)' : 'rgba(255,71,87,0.12)' }}
        >
          <Wallet
            size={20}
            style={{ color: isPositive ? '#2ed573' : '#ff4757' }}
          />
        </div>
        <div>
          <h3 className="text-sm font-medium text-nexo-muted font-heading">Caixa da Empresa</h3>
          <p className="text-[10px] text-nexo-muted">
            Atualizado {cashBox?.lastUpdated
              ? new Date(cashBox.lastUpdated).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })
              : 'recentemente'}
          </p>
        </div>
      </div>

      {/* Balance — big */}
      <div className="mb-5">
        <span
          className="text-3xl font-heading font-bold"
          style={{ color: isPositive ? '#2ed573' : '#ff4757' }}
        >
          {formatCurrency(balance, currency)}
        </span>
        <span className="text-xs text-nexo-muted ml-2">saldo atual</span>
      </div>

      {/* Grid 2x2 */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {/* Income */}
        <div className="p-3 rounded-lg bg-nexo-card/60 border border-nexo-border/30">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={12} className="text-nexo-success" />
            <span className="text-[10px] text-nexo-muted uppercase tracking-wide">Receitas/mês</span>
          </div>
          <span className="text-sm font-semibold text-white">
            {formatCurrency(income, currency)}
          </span>
        </div>

        {/* Expenses */}
        <div className="p-3 rounded-lg bg-nexo-card/60 border border-nexo-border/30">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingDown size={12} className="text-nexo-danger" />
            <span className="text-[10px] text-nexo-muted uppercase tracking-wide">Gastos/mês</span>
          </div>
          <span className="text-sm font-semibold text-white">
            {formatCurrency(expenses, currency)}
          </span>
        </div>

        {/* Projection */}
        <div className="p-3 rounded-lg bg-nexo-card/60 border border-nexo-border/30">
          <div className="flex items-center gap-1.5 mb-1">
            <BarChart3 size={12} className="text-nexo-info" />
            <span className="text-[10px] text-nexo-muted uppercase tracking-wide">Projeção {months}m</span>
          </div>
          <span className="text-sm font-semibold text-white">
            {formatCurrency(projected, currency)}
          </span>
        </div>

        {/* Net */}
        <div className="p-3 rounded-lg bg-nexo-card/60 border border-nexo-border/30">
          <div className="flex items-center gap-1.5 mb-1">
            <Wallet size={12} className="text-nexo-warning" />
            <span className="text-[10px] text-nexo-muted uppercase tracking-wide">Fluxo líquido</span>
          </div>
          <span
            className="text-sm font-semibold"
            style={{ color: income - expenses >= 0 ? '#2ed573' : '#ff4757' }}
          >
            {formatCurrency(income - expenses, currency)}
          </span>
        </div>
      </div>

      {/* CTA */}
      {onViewProjection && (
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={onViewProjection}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-nexo-info/10 text-nexo-info text-sm font-medium hover:bg-nexo-info/20 transition-colors border border-nexo-info/20"
        >
          Ver Projeção Completa
          <ArrowRight size={14} />
        </motion.button>
      )}
    </motion.div>
  )
}

