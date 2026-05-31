import React from 'react'
﻿import { motion } from 'framer-motion'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area
} from 'recharts'

/**
 * @typedef {Object} ProjectionPoint
 * @property {string} month
 * @property {number} projectedBalance
 *
 * @typedef {Object} CashFlowProjectionProps
 * @property {ProjectionPoint[]} projection
 * @property {string} [currency]
 */

/** @param {CashFlowProjectionProps} props */
export default function CashFlowProjection({ projection = [], currency = 'EUR' }) {
  const formatCurrency = (val) => {
    const symbol = currency === 'BRL' ? 'R$' : currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency
    return `${symbol} ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    const value = payload[0].value
    return (
      <div className="glass-card px-3 py-2 text-xs border border-white/10">
        <div className="font-semibold text-white mb-0.5">{label}</div>
        <div style={{ color: '#2ed573' }}>{formatCurrency(value)}</div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-card p-5"
    >
      <h3 className="text-sm font-medium mb-4 text-nexo-muted font-heading">
        Projeção de Caixa
      </h3>

      {projection.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-sm text-nexo-muted">
          Sem dados de projeção disponíveis.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={projection} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="cashFlowGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2ed573" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#2ed573" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" />
            <XAxis
              dataKey="month"
              stroke="#6c757d"
              fontSize={12}
              tickLine={false}
              axisLine={{ stroke: '#1a1a2e' }}
            />
            <YAxis
              stroke="#6c757d"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#1a1a2e' }}
              tickFormatter={(v) => {
                const symbol = currency === 'BRL' ? 'R$' : currency === 'EUR' ? '€' : '$'
                return `${symbol}${v}`
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="projectedBalance"
              stroke="none"
              fill="url(#cashFlowGrad)"
            />
            <Line
              type="monotone"
              dataKey="projectedBalance"
              stroke="#2ed573"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#08080c', stroke: '#2ed573', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: '#2ed573', stroke: '#08080c', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  )
}

