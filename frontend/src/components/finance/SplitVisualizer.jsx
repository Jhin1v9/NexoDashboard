import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { CheckCircle2 } from 'lucide-react'

/**
 * @typedef {Object} SplitItem
 * @property {string} personId
 * @property {string} name
 * @property {number} percent
 * @property {number} amount
 * @property {boolean} received
 * @property {string} [type]
 *
 * @typedef {Object} SplitVisualizerProps
 * @property {SplitItem[]} revenueSplit
 * @property {number} totalAmount
 * @property {string} [currency]
 */

const SPLIT_COLORS = {
  abner:   '#3742fa',
  nonoke:  '#2ed573',
  elias:   '#ffa502',
  empresa: '#6c5ce7',
}

/** @param {SplitVisualizerProps} props */
export default function SplitVisualizer({ revenueSplit = [], totalAmount = 0, currency = 'EUR' }) {
  const data = useMemo(() => {
    return revenueSplit.map(item => ({
      name: item.name,
      value: item.amount || 0,
      percent: item.percent || 0,
      received: item.received,
      personId: item.personId,
      color: SPLIT_COLORS[item.personId] || '#95afc0',
    }))
  }, [revenueSplit])

  const formatCurrency = (val) => {
    const symbol = currency === 'BRL' ? 'R$' : currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency
    return `${symbol} ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  }

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const p = payload[0].payload
    return (
      <div className="glass-card px-3 py-2 text-xs border border-white/10">
        <div className="font-semibold text-white mb-1">{p.name}</div>
        <div style={{ color: p.color }}>{formatCurrency(p.value)} ({p.percent}%)</div>
        <div className="text-nexo-muted mt-0.5">
          {p.received ? 'Recebido' : 'Pendente'}
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="glass-card p-5"
    >
      <h3 className="text-sm font-medium mb-4 text-nexo-muted font-heading">
        Split de Receita
      </h3>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Donut Chart */}
        <div className="w-40 h-40 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={70}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex-1 w-full">
          <div className="grid grid-cols-2 gap-3">
            {data.map((item, idx) => (
              <motion.div
                key={item.personId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="flex items-center gap-2 p-2 rounded-lg bg-nexo-card/50 border border-nexo-border/30"
              >
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: item.color }}
                />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-white truncate">
                    {item.name}
                  </div>
                  <div className="text-[10px] text-nexo-muted">
                    {formatCurrency(item.value)} · {item.percent}%
                  </div>
                </div>
                {item.received && (
                  <CheckCircle2 size={14} className="text-nexo-success shrink-0 ml-auto" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

