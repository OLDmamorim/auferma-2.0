'use client'
import { useEffect, useState } from 'react'
import PageHeader from '@/components/layout/PageHeader'
import Link from 'next/link'
import type { CustomerBehavior } from '@/app/api/customers/behavior/route'

type BehaviorFilter = 'all' | 'positive' | 'risk' | 'negative'
type CategoryFilter = 'all' | 'A' | 'B' | 'C'
type ViewMode = 'analysis' | 'projection'

const behaviorConfig = {
  positive: {
    label: 'Positivo',
    dot: 'bg-green-500',
    badge: 'bg-green-100 text-green-800 border border-green-200',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    iconColor: 'text-green-500',
  },
  risk: {
    label: 'Em Risco',
    dot: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-800 border border-amber-200',
    icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    iconColor: 'text-amber-500',
  },
  negative: {
    label: 'Negativo',
    dot: 'bg-red-500',
    badge: 'bg-red-100 text-red-800 border border-red-200',
    icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
    iconColor: 'text-red-500',
  },
}

const categoryConfig = {
  A: { bg: 'bg-blue-700 text-white', label: 'Cliente A — Alto valor' },
  B: { bg: 'bg-blue-400 text-white', label: 'Cliente B — Médio valor' },
  C: { bg: 'bg-gray-300 text-gray-700', label: 'Cliente C — Baixo valor' },
}

export default function AnaliseComportamentoPage() {
  const [data, setData] = useState<{
    customers: CustomerBehavior[]
    summary: Record<string, number>
    priorityVisits: CustomerBehavior[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [behaviorFilter, setBehaviorFilter] = useState<BehaviorFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<ViewMode>('analysis')

  useEffect(() => {
    fetch('/api/customers/behavior')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = (data?.customers || []).filter((c: CustomerBehavior) => {
    if (behaviorFilter !== 'all' && c.behavior !== behaviorFilter) return false
    if (categoryFilter !== 'all' && c.category !== categoryFilter) return false
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const s = data?.summary || {}

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Análise de Comportamento"
        subtitle="Monitorização inteligente do comportamento de compra dos clientes"
      />

      {/* View toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setView('analysis')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${view === 'analysis' ? 'bg-blue-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Análise Geral
        </button>
        <button
          onClick={() => setView('projection')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${view === 'projection' ? 'bg-blue-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Projeção de Visitas
          {data && (s.risk + s.negative) > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-5 text-center">
              {s.risk + s.negative}
            </span>
          )}
        </button>
      </div>

      {view === 'analysis' && (
        <>
          {/* KPI summary */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-5">
            <div className="kpi-card text-center col-span-1">
              <p className="text-2xl font-bold text-gray-900">{s.total || 0}</p>
              <p className="text-xs text-gray-500 mt-0.5">Clientes</p>
            </div>
            <button
              onClick={() => setBehaviorFilter(behaviorFilter === 'positive' ? 'all' : 'positive')}
              className={`kpi-card text-center transition cursor-pointer ${behaviorFilter === 'positive' ? 'ring-2 ring-green-400' : ''}`}
            >
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <p className="text-xl font-bold text-green-700">{s.positive || 0}</p>
              </div>
              <p className="text-xs text-gray-500">Positivo</p>
            </button>
            <button
              onClick={() => setBehaviorFilter(behaviorFilter === 'risk' ? 'all' : 'risk')}
              className={`kpi-card text-center transition cursor-pointer ${behaviorFilter === 'risk' ? 'ring-2 ring-amber-400' : ''}`}
            >
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <p className="text-xl font-bold text-amber-700">{s.risk || 0}</p>
              </div>
              <p className="text-xs text-gray-500">Em Risco</p>
            </button>
            <button
              onClick={() => setBehaviorFilter(behaviorFilter === 'negative' ? 'all' : 'negative')}
              className={`kpi-card text-center transition cursor-pointer ${behaviorFilter === 'negative' ? 'ring-2 ring-red-400' : ''}`}
            >
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <p className="text-xl font-bold text-red-700">{s.negative || 0}</p>
              </div>
              <p className="text-xs text-gray-500">Negativo</p>
            </button>
            <div className="kpi-card text-center">
              <p className="text-xl font-bold text-blue-700">{s.catA || 0}</p>
              <p className="text-xs text-gray-500 mt-0.5">Categoria A</p>
            </div>
            <div className="kpi-card text-center">
              <p className="text-xl font-bold text-gray-600">{(s.catB || 0) + (s.catC || 0)}</p>
              <p className="text-xs text-gray-500 mt-0.5">Categoria B+C</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <input
              type="text"
              placeholder="Pesquisar cliente..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
            />
            <div className="flex gap-1">
              {(['all', 'A', 'B', 'C'] as const).map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition ${categoryFilter === cat ? 'bg-blue-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  {cat === 'all' ? 'Todos' : `Cat. ${cat}`}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Cat.</th>
                    <th>Comportamento</th>
                    <th className="hidden md:table-cell">Zona</th>
                    <th className="hidden md:table-cell">Comercial</th>
                    <th className="hidden lg:table-cell">Vendas 12m</th>
                    <th className="hidden lg:table-cell">Crescimento</th>
                    <th className="hidden lg:table-cell">Dias s/ compra</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array(10).fill(0).map((_, i) => (
                        <tr key={i}>
                          {Array(9).fill(0).map((_, j) => <td key={j}><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}
                        </tr>
                      ))
                    : filtered.map(c => {
                        const bc = behaviorConfig[c.behavior]
                        const cc = categoryConfig[c.category]
                        return (
                          <tr key={c.id}>
                            <td>
                              <Link href={`/clientes/${c.id}`} className="font-medium text-gray-900 hover:text-blue-700 text-sm">
                                {c.name}
                              </Link>
                              {c.alerts.length > 0 && (
                                <p className="text-xs text-red-500 mt-0.5 truncate max-w-48">{c.alerts[0]}</p>
                              )}
                            </td>
                            <td>
                              <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-bold ${cc.bg}`}>
                                {c.category}
                              </span>
                            </td>
                            <td>
                              <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${bc.dot} ${c.behavior !== 'positive' ? 'animate-pulse' : ''}`} />
                                <span className={`badge text-xs px-2 py-0.5 ${bc.badge}`}>{bc.label}</span>
                              </div>
                            </td>
                            <td className="hidden md:table-cell text-sm text-gray-500">{c.zone || '—'}</td>
                            <td className="hidden md:table-cell text-sm text-gray-600">{c.commercialName || '—'}</td>
                            <td className="hidden lg:table-cell text-sm text-gray-900">
                              €{c.totalLast12m.toFixed(0)}
                            </td>
                            <td className="hidden lg:table-cell">
                              <span className={`text-sm font-medium ${c.growthRate > 0 ? 'text-green-600' : c.growthRate < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                {c.growthRate > 0 ? '+' : ''}{c.growthRate}%
                              </span>
                            </td>
                            <td className="hidden lg:table-cell text-sm text-gray-600">
                              {c.daysWithoutPurchase !== null ? (
                                <span className={c.daysWithoutPurchase > 60 ? 'text-red-600 font-medium' : c.daysWithoutPurchase > 30 ? 'text-amber-600' : 'text-gray-600'}>
                                  {c.daysWithoutPurchase}d
                                </span>
                              ) : '—'}
                            </td>
                            <td>
                              <ScoreBar score={c.score} />
                            </td>
                          </tr>
                        )
                      })}
                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center text-gray-400 py-12 text-sm">
                        Nenhum cliente encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {view === 'projection' && (
        <VisitProjection customers={data?.priorityVisits || []} loading={loading} />
      )}
    </div>
  )
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 65 ? 'bg-green-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs text-gray-600 w-6">{score}</span>
    </div>
  )
}

function VisitProjection({ customers, loading }: { customers: CustomerBehavior[]; loading: boolean }) {
  const negative = customers.filter(c => c.behavior === 'negative')
  const risk = customers.filter(c => c.behavior === 'risk')

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (customers.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
        <svg className="w-10 h-10 text-green-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="font-semibold text-green-800">Todos os clientes em comportamento positivo!</p>
        <p className="text-sm text-green-600 mt-1">Não há visitas urgentes a agendar neste momento.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-800 font-medium">
          Com base na análise de comportamento, o sistema identificou <strong>{customers.length} clientes</strong> que requerem visita prioritária.
        </p>
        <p className="text-xs text-blue-600 mt-1">
          {negative.length} clientes com comportamento negativo · {risk.length} em situação de risco
        </p>
      </div>

      {negative.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <h3 className="font-semibold text-gray-900 text-sm">Prioridade Máxima — Comportamento Negativo</h3>
            <span className="text-xs text-gray-400">({negative.length})</span>
          </div>
          <div className="space-y-3">
            {negative.map((c, i) => (
              <VisitCard key={c.id} customer={c} rank={i + 1} />
            ))}
          </div>
        </div>
      )}

      {risk.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <h3 className="font-semibold text-gray-900 text-sm">Prioridade Alta — Em Risco</h3>
            <span className="text-xs text-gray-400">({risk.length})</span>
          </div>
          <div className="space-y-3">
            {risk.map((c, i) => (
              <VisitCard key={c.id} customer={c} rank={negative.length + i + 1} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function VisitCard({ customer: c, rank }: { customer: CustomerBehavior; rank: number }) {
  const bc = behaviorConfig[c.behavior]
  const cc = categoryConfig[c.category]

  return (
    <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-4 flex items-start gap-4">
      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-bold text-gray-500 flex-shrink-0">
        {rank}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/clientes/${c.id}`} className="font-semibold text-gray-900 hover:text-blue-700 text-sm">
            {c.name}
          </Link>
          <span className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-xs font-bold flex-shrink-0 ${cc.bg}`}>
            {c.category}
          </span>
          <span className={`badge text-xs px-2 py-0.5 ${bc.badge}`}>{bc.label}</span>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-500">
          {c.zone && <span>📍 {c.zone}</span>}
          {c.commercialName && <span>👤 {c.commercialName}</span>}
          <span>€{c.totalLast12m.toFixed(0)} últimos 12m</span>
          {c.daysWithoutPurchase !== null && (
            <span className={c.daysWithoutPurchase > 60 ? 'text-red-600 font-medium' : 'text-amber-600'}>
              ⏱ {c.daysWithoutPurchase} dias sem comprar
            </span>
          )}
          {c.growthRate !== 0 && (
            <span className={c.growthRate < 0 ? 'text-red-600' : 'text-green-600'}>
              {c.growthRate > 0 ? '↑' : '↓'} {Math.abs(c.growthRate)}% vs ano anterior
            </span>
          )}
        </div>

        {c.alerts.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {c.alerts.map((alert, i) => (
              <span key={i} className="text-xs bg-red-50 text-red-700 border border-red-100 rounded px-2 py-0.5">
                {alert}
              </span>
            ))}
          </div>
        )}
      </div>

      <Link
        href={`/visitas`}
        className="flex-shrink-0 text-xs bg-blue-700 text-white px-3 py-1.5 rounded-lg hover:bg-blue-800 transition"
      >
        Agendar
      </Link>
    </div>
  )
}
