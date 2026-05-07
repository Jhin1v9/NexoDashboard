import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowDownLeft, ArrowUpRight, Clock, Filter, Calendar,
  Printer, Download, Search, TrendingUp, TrendingDown,
  Wallet, AlertCircle, CheckCircle2, XCircle
} from 'lucide-react'
import axios from 'axios'
import useRealtime from '../../hooks/useRealtime'

const TYPE_CONFIG = {
  income: { color: '#22c55e', bg: 'bg-nexo-success/10', text: 'text-nexo-success', icon: ArrowDownLeft, label: 'Entrada' },
  expense: { color: '#ef4444', bg: 'bg-nexo-danger/10', text: 'text-nexo-danger', icon: ArrowUpRight, label: 'Saída' },
  expected_income: { color: '#3b82f6', bg: 'bg-nexo-info/10', text: 'text-nexo-info', icon: Clock, label: 'Entrada Prevista' },
  expected_expense: { color: '#f59e0b', bg: 'bg-nexo-warning/10', text: 'text-nexo-warning', icon: Clock, label: 'Saída Prevista' }
}

const CATEGORY_CONFIG = {
  receita: { label: 'Receita', color: '#22c55e' },
  despesa: { label: 'Despesa', color: '#ef4444' },
  hosting: { label: 'Hosting', color: '#e056fd' },
  ai_tools: { label: 'IA/Tools', color: '#686de0' },
  software: { label: 'Software', color: '#7bed9f' },
  marketing: { label: 'Marketing', color: '#ff6b81' },
  others: { label: 'Outros', color: '#95afc0' }
}

const amountValue = (amount) => {
  if (typeof amount === 'number') return amount
  if (typeof amount === 'string') return Number(amount) || 0
  return Number(amount?.value) || 0
}

const entryDescription = (entry) =>
  entry.description || entry.source || entry.name || 'Lancamento pendente'

export default function StatementSection() {
  const { data: statementData, loading, refetch } = useRealtime('/api/cash-box/statement', 30000)
  const [filterType, setFilterType] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const entries = statementData?.entries || []
  const currency = statementData?.currency || 'EUR'

  const filtered = useMemo(() => {
    let result = [...entries]
    if (filterType !== 'all') {
      result = result.filter(e => {
        if (filterType === 'income') return e.type === 'income' || e.type === 'expected_income'
        if (filterType === 'expense') return e.type === 'expense' || e.type === 'expected_expense'
        return e.type === filterType
      })
    }
    if (filterCategory !== 'all') result = result.filter(e => e.category === filterCategory)
    if (dateFrom) result = result.filter(e => e.date >= dateFrom)
    if (dateTo) result = result.filter(e => e.date <= dateTo)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(e => entryDescription(e).toLowerCase().includes(q) || e.note?.toLowerCase().includes(q))
    }
    return result
  }, [entries, filterType, filterCategory, dateFrom, dateTo, searchQuery])

  const stats = useMemo(() => {
    const income = filtered.filter(e => e.type === 'income').reduce((s, e) => s + amountValue(e.amount), 0)
    const expense = filtered.filter(e => e.type === 'expense').reduce((s, e) => s + amountValue(e.amount), 0)
    const pendingIn = filtered.filter(e => e.type === 'expected_income').reduce((s, e) => s + amountValue(e.amount), 0)
    const pendingOut = filtered.filter(e => e.type === 'expected_expense').reduce((s, e) => s + amountValue(e.amount), 0)
    return { income, expense, pendingIn, pendingOut, net: income - expense }
  }, [filtered])

  const fmt = (v) => `€ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  const fmtDate = (d) => new Date(d).toLocaleDateString('pt-BR')

  const handlePrint = () => window.print()
  
  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank')
    const html = generatePrintHTML(filtered, stats, currency)
    printWindow.document.write(html)
    printWindow.document.close()
    setTimeout(() => printWindow.print(), 500)
  }

  const handleExportTicket = () => {
    const printWindow = window.open('', '_blank')
    const html = generateTicketHTML(filtered, stats, currency)
    printWindow.document.write(html)
    printWindow.document.close()
    setTimeout(() => printWindow.print(), 500)
  }

  if (loading) {
    return (
      <div className="glass-card p-12 text-center">
        <div className="w-8 h-8 border-2 border-nexo-info border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-nexo-muted">Carregando extrato...</p>
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-card p-3 text-center">
          <div className="text-xs text-nexo-muted mb-1">Entradas</div>
          <div className="text-lg font-bold text-nexo-success">{fmt(stats.income)}</div>
        </div>
        <div className="glass-card p-3 text-center">
          <div className="text-xs text-nexo-muted mb-1">Saídas</div>
          <div className="text-lg font-bold text-nexo-danger">{fmt(stats.expense)}</div>
        </div>
        <div className="glass-card p-3 text-center">
          <div className="text-xs text-nexo-muted mb-1">Saldo do Período</div>
          <div className={`text-lg font-bold ${stats.net >= 0 ? 'text-nexo-success' : 'text-nexo-danger'}`}>
            {fmt(stats.net)}
          </div>
        </div>
        <div className="glass-card p-3 text-center">
          <div className="text-xs text-nexo-muted mb-1">Saldo Atual</div>
          <div className="text-lg font-bold text-nexo-info">{fmt(statementData?.currentBalance || 0)}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexo-muted" />
          <input
            className="w-full pl-9 pr-4 py-2 bg-nexo-card rounded-lg border border-nexo-border outline-none focus:border-nexo-info text-sm"
            placeholder="Buscar transação..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2 px-3 py-2 bg-nexo-card rounded-lg text-xs hover:bg-nexo-border transition-colors">
          <Filter size={14} /> Filtros
        </button>
        <button onClick={handleExportPDF} className="flex items-center gap-2 px-3 py-2 bg-nexo-card rounded-lg text-xs hover:bg-nexo-border transition-colors">
          <Download size={14} /> PDF
        </button>
        <button onClick={handleExportTicket} className="flex items-center gap-2 px-3 py-2 bg-nexo-card rounded-lg text-xs hover:bg-nexo-border transition-colors">
          <Printer size={14} /> Ticket
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="glass-card p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-nexo-muted mb-1 block">Tipo</label>
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-full px-3 py-2 bg-nexo-card rounded-lg border border-nexo-border text-sm">
                <option value="all">Todos</option>
                <option value="income">Entradas</option>
                <option value="expense">Saídas</option>
                <option value="expected_income">Previstas (Entrada)</option>
                <option value="expected_expense">Previstas (Saída)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-nexo-muted mb-1 block">Categoria</label>
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="w-full px-3 py-2 bg-nexo-card rounded-lg border border-nexo-border text-sm">
                <option value="all">Todas</option>
                {Object.entries(CATEGORY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-nexo-muted mb-1 block">De</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full px-3 py-2 bg-nexo-card rounded-lg border border-nexo-border text-sm" />
            </div>
            <div>
              <label className="text-xs text-nexo-muted mb-1 block">Até</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full px-3 py-2 bg-nexo-card rounded-lg border border-nexo-border text-sm" />
            </div>
          </div>
        </motion.div>
      )}

      {/* Statement List — Visual Nubank Style */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="glass-card p-8 text-center">
            <Wallet size={32} className="text-nexo-muted mx-auto mb-3" />
            <p className="text-nexo-muted text-sm">Nenhuma transação encontrada</p>
          </div>
        )}
        
        {filtered.map((entry, idx) => {
          const cfg = TYPE_CONFIG[entry.type] || TYPE_CONFIG.expense
          const Icon = cfg.icon
          const isPending = entry.status === 'pending' || entry.status === 'recurring'
          
          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className={`glass-card p-4 flex items-center gap-4 ${isPending ? 'opacity-70' : ''}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${cfg.bg}`}>
                <Icon size={18} style={{ color: cfg.color }} />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{entryDescription(entry)}</span>
                  {isPending && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-nexo-warning/20 text-nexo-warning">Previsto</span>}
                  {entry.status === 'completed' && <CheckCircle2 size={12} className="text-nexo-success shrink-0" />}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-nexo-muted">
                  <span>{fmtDate(entry.date)}</span>
                  {entry.category && (
                    <span className="px-1.5 py-0.5 rounded-full bg-nexo-card" style={{ color: CATEGORY_CONFIG[entry.category]?.color || '#95afc0' }}>
                      {CATEGORY_CONFIG[entry.category]?.label || entry.category}
                    </span>
                  )}
                  {entry.note && <span className="truncate max-w-[200px]">• {entry.note}</span>}
                </div>
              </div>
              
              <div className="text-right shrink-0">
                <div className={`text-sm font-bold ${entry.type === 'income' || entry.type === 'expected_income' ? 'text-nexo-success' : 'text-nexo-danger'}`}>
                  {entry.type === 'income' || entry.type === 'expected_income' ? '+' : '-'}{fmt(amountValue(entry.amount))}
                </div>
                {entry.displayBalance !== null && entry.displayBalance !== undefined && (
                  <div className="text-[11px] text-nexo-muted">
                    Saldo: {fmt(entry.displayBalance)}
                  </div>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}

// Generate print-friendly HTML for PDF export
function generatePrintHTML(entries, stats, currency) {
  const fmt = (v) => `€ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  const fmtDate = (d) => new Date(d).toLocaleDateString('pt-BR')
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Extrato NEXO</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #333; padding: 40px; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #6366f1; padding-bottom: 20px; }
    .header h1 { font-size: 24px; color: #6366f1; margin-bottom: 5px; }
    .header p { color: #666; font-size: 12px; }
    .stats { display: flex; justify-content: space-around; margin-bottom: 30px; }
    .stat { text-align: center; }
    .stat-value { font-size: 18px; font-weight: bold; }
    .stat-label { font-size: 11px; color: #666; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f8f9fa; padding: 10px; text-align: left; font-size: 11px; text-transform: uppercase; color: #666; border-bottom: 2px solid #dee2e6; }
    td { padding: 10px; border-bottom: 1px solid #eee; font-size: 12px; }
    .income { color: #22c55e; }
    .expense { color: #ef4444; }
    .pending { opacity: 0.6; }
    .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #999; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>📊 NEXO Digital — Extrato Financeiro</h1>
    <p>Gerado em ${new Date().toLocaleString('pt-BR')}</p>
  </div>
  <div class="stats">
    <div class="stat"><div class="stat-value income">${fmt(stats.income)}</div><div class="stat-label">Entradas</div></div>
    <div class="stat"><div class="stat-value expense">${fmt(stats.expense)}</div><div class="stat-label">Saídas</div></div>
    <div class="stat"><div class="stat-value">${fmt(stats.net)}</div><div class="stat-label">Saldo do Período</div></div>
  </div>
  <table>
    <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Status</th><th>Valor</th><th>Saldo</th></tr></thead>
    <tbody>
      ${entries.map(e => `
        <tr class="${e.status !== 'completed' ? 'pending' : ''}">
          <td>${fmtDate(e.date)}</td>
          <td>${entryDescription(e)}</td>
          <td>${e.category || '-'}</td>
          <td>${e.status === 'completed' ? '✓ Concluído' : e.status === 'pending' ? '⏳ Pendente' : '🔄 Recorrente'}</td>
          <td class="${e.type === 'income' || e.type === 'expected_income' ? 'income' : 'expense'}">
            ${e.type === 'income' || e.type === 'expected_income' ? '+' : '-'}${fmt(amountValue(e.amount))}
          </td>
          <td>${e.displayBalance !== null ? fmt(e.displayBalance) : '-'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <div class="footer">NEXO Digital — Extrato gerado automaticamente</div>
</body>
</html>`
}

// Generate thermal printer ticket HTML (58mm/80mm compatible)
function generateTicketHTML(entries, stats, currency) {
  const fmt = (v) => `€${v.toFixed(2)}`
  const fmtDate = (d) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Ticket NEXO</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Courier New', monospace; 
      background: #fff; 
      color: #000; 
      padding: 10px; 
      max-width: 80mm; 
      margin: 0 auto;
      font-size: 11px;
    }
    .center { text-align: center; }
    .header { border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
    .header h1 { font-size: 14px; margin-bottom: 4px; }
    .line { display: flex; justify-content: space-between; margin: 3px 0; }
    .dashed { border-top: 1px dashed #000; margin: 8px 0; }
    .bold { font-weight: bold; }
    .small { font-size: 9px; }
    @media print { 
      @page { size: 80mm auto; margin: 0; }
      body { padding: 5px; }
    }
  </style>
</head>
<body>
  <div class="header center">
    <h1>NEXO DIGITAL</h1>
    <p class="small">Extrato Financeiro</p>
    <p class="small">${new Date().toLocaleString('pt-BR')}</p>
  </div>
  
  <div class="line bold"><span>ENTRADAS:</span><span>${fmt(stats.income)}</span></div>
  <div class="line bold"><span>SAIDAS:</span><span>${fmt(stats.expense)}</span></div>
  <div class="dashed"></div>
  <div class="line bold"><span>SALDO:</span><span>${fmt(stats.net)}</span></div>
  <div class="dashed"></div>
  
  <p class="center small" style="margin: 8px 0;">--- TRANSACOES ---</p>
  
  ${entries.slice(0, 20).map(e => `
    <div class="line">
      <span>${fmtDate(e.date)} ${entryDescription(e).substring(0, 15)}</span>
      <span>${e.type === 'income' ? '+' : '-'}${fmt(amountValue(e.amount))}</span>
    </div>
  `).join('')}
  
  <div class="dashed"></div>
  <p class="center small">Obrigado!</p>
  <p class="center small">www.nexodigital.com</p>
</body>
</html>`
}

