'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import PageHeader from '@/components/layout/PageHeader'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Sale {
  id: string
  date: string
  total: number
  margin: number | null
  customer: { id: string; name: string; zone: string | null }
  brand: { id: string; name: string } | null
  items: { id: string; quantity: number; product: { name: string } | null }[]
}

export default function VendasPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [totalValue, setTotalValue] = useState(0)

  const fetchSales = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '25' })
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    fetch(`/api/sales?${params}`)
      .then(r => r.json())
      .then(d => {
        setSales(d.sales || [])
        setTotal(d.total || 0)
        setPages(d.pages || 1)
        setTotalValue((d.sales || []).reduce((s: number, sale: Sale) => s + sale.total, 0))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [page, from, to])

  useEffect(() => { fetchSales() }, [fetchSales])

  // Set default date range to current month
  useEffect(() => {
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
    setFrom(firstDay)
    setTo(lastDay)
  }, [])

  return (
    <div className="p-6">
      <PageHeader title="Vendas" subtitle={`${total} registos encontrados`} />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div className="kpi-card">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Período</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalValue)}</p>
        </div>
        <div className="kpi-card">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Nº Vendas</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{total}</p>
        </div>
        <div className="kpi-card">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Média por Venda</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(total > 0 ? totalValue / total : 0)}</p>
        </div>
        <div className="kpi-card">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Maior Venda</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {formatCurrency(sales.length > 0 ? Math.max(...sales.map(s => s.total)) : 0)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 font-medium">De:</label>
          <input
            type="date"
            value={from}
            onChange={e => { setFrom(e.target.value); setPage(1) }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 font-medium">Até:</label>
          <input
            type="date"
            value={to}
            onChange={e => { setTo(e.target.value); setPage(1) }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => {
            const now = new Date()
            setFrom(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0])
            setTo(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0])
            setPage(1)
          }}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          Este mês
        </button>
        <button
          onClick={() => {
            const now = new Date()
            setFrom(new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().split('T')[0])
            setTo(now.toISOString().split('T')[0])
            setPage(1)
          }}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          Últimos 3 meses
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Cliente</th>
                <th>Zona</th>
                <th>Marca</th>
                <th>Produtos</th>
                <th className="text-right">Valor</th>
                <th className="text-right">Margem</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array(10).fill(0).map((_, i) => (
                    <tr key={i}>
                      {Array(7).fill(0).map((_, j) => (
                        <td key={j}><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                : sales.map(sale => (
                    <tr key={sale.id}>
                      <td className="text-sm text-gray-600">{formatDate(sale.date)}</td>
                      <td>
                        <Link href={`/clientes/${sale.customer.id}`} className="font-medium text-gray-900 hover:text-blue-700 text-sm">
                          {sale.customer.name}
                        </Link>
                      </td>
                      <td className="text-sm text-gray-500">{sale.customer.zone || '—'}</td>
                      <td>
                        {sale.brand ? (
                          <span className="badge badge-blue">{sale.brand.name}</span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="text-xs text-gray-500">{sale.items.length} itens</td>
                      <td className="text-right font-semibold text-gray-900">{formatCurrency(sale.total)}</td>
                      <td className="text-right text-sm text-green-600">
                        {sale.margin ? formatCurrency(sale.margin) : '—'}
                      </td>
                    </tr>
                  ))}
              {!loading && sales.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-gray-400 py-12">
                    Nenhuma venda encontrada no período selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Página {page} de {pages} · {total} registos</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >← Anterior</button>
              <button
                onClick={() => setPage(p => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >Próxima →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
