'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import PageHeader from '@/components/layout/PageHeader'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

interface CommercialData {
  id: string
  name: string
  email: string
  salesToday: number
  salesThisWeek: number
  salesThisMonth: number
  visitsToday: number
  visitsThisWeek: number
  tasksDoneThisWeek: number
  tasksPending: number
  customersTotal: number
  customersAtRisk: number
  monthTarget: { target: number; achieved: number } | null
  targetPct: number | null
  lastActivityDate: string | null
  status: 'active' | 'warning' | 'inactive'
}

interface TeamSummary {
  salesThisMonth: number
  salesThisWeek: number
  visitsThisWeek: number
  tasksDone: number
  customersAtRisk: number
  active: number
  warning: number
  inactive: number
}

const statusConfig = {
  active:   { label: 'Ativo',    dot: 'bg-green-500',  badge: 'bg-green-100 text-green-800',  avatar: 'bg-green-600' },
  warning:  { label: 'Alerta',   dot: 'bg-amber-500',  badge: 'bg-amber-100 text-amber-800',  avatar: 'bg-amber-500' },
  inactive: { label: 'Inativo',  dot: 'bg-red-500',    badge: 'bg-red-100 text-red-800',      avatar: 'bg-red-500'   },
}

export default function SupervisaoPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const [data, setData] = useState<{ commercials: CommercialData[]; team: TeamSummary } | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'cards' | 'table'>('cards')

  const fetchData = useCallback(() => {
    setLoading(true)
    fetch('/api/supervisao').then(r => r.json()).then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (role && role !== 'ADMIN' && role !== 'DIRECTOR') {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-500 text-lg">Acesso restrito a Diretores e Administradores.</p>
        </div>
      </div>
    )
  }

  const team = data?.team
  const commercials = data?.commercials || []

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Painel de Supervisão"
        subtitle="Atividade da equipa comercial em tempo real"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              <button onClick={() => setView('cards')} className={`px-3 py-1.5 text-xs font-medium transition ${view === 'cards' ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>Cards</button>
              <button onClick={() => setView('table')} className={`px-3 py-1.5 text-xs font-medium transition ${view === 'table' ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>Tabela</button>
            </div>
            <button onClick={fetchData} className="border border-gray-200 bg-white text-gray-600 px-3 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
          </div>
        }
      />

      {/* Team KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <div className="kpi-card text-center">
          <p className="text-xl font-bold text-gray-900">€{(team?.salesThisMonth || 0).toFixed(0)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Vendas este mês</p>
        </div>
        <div className="kpi-card text-center">
          <p className="text-xl font-bold text-gray-900">€{(team?.salesThisWeek || 0).toFixed(0)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Vendas esta semana</p>
        </div>
        <div className="kpi-card text-center">
          <p className="text-xl font-bold text-blue-700">{team?.visitsThisWeek || 0}</p>
          <p className="text-xs text-gray-500 mt-0.5">Visitas esta semana</p>
        </div>
        <div className="kpi-card text-center">
          <p className="text-xl font-bold text-green-600">{team?.tasksDone || 0}</p>
          <p className="text-xs text-gray-500 mt-0.5">Tarefas concluídas</p>
        </div>
        <div className="kpi-card text-center">
          <p className="text-xl font-bold text-red-500">{team?.customersAtRisk || 0}</p>
          <p className="text-xs text-gray-500 mt-0.5">Clientes em risco</p>
        </div>
      </div>

      {/* Status summary pills */}
      <div className="flex gap-3 mb-5">
        <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-3 py-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs font-medium text-green-800">{team?.active || 0} ativos</span>
        </div>
        <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-full px-3 py-1.5">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-xs font-medium text-amber-800">{team?.warning || 0} em alerta</span>
        </div>
        <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-full px-3 py-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-medium text-red-800">{team?.inactive || 0} inativos</span>
        </div>
      </div>

      {view === 'cards' ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-56 bg-white rounded-xl border border-gray-100 animate-pulse" />
          )) : commercials.map(c => {
            const sc = statusConfig[c.status]
            const targetColor = c.targetPct === null ? 'bg-gray-200' : c.targetPct >= 80 ? 'bg-green-500' : c.targetPct >= 50 ? 'bg-amber-500' : 'bg-red-500'
            return (
              <div key={c.id} className="bg-white border border-gray-100 shadow-sm rounded-xl p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative">
                    <div className={`w-11 h-11 rounded-xl ${sc.avatar} flex items-center justify-center text-white font-bold text-lg`}>
                      {c.name.charAt(0)}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${sc.dot} ${c.status === 'inactive' ? 'animate-pulse' : ''}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{c.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.badge}`}>{sc.label}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">€{c.salesThisMonth.toFixed(0)}</p>
                    <p className="text-xs text-gray-400">este mês</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="text-center bg-gray-50 rounded-lg p-2">
                    <p className="text-base font-bold text-gray-900">{c.visitsThisWeek}</p>
                    <p className="text-xs text-gray-500">Visitas/sem</p>
                  </div>
                  <div className="text-center bg-gray-50 rounded-lg p-2">
                    <p className="text-base font-bold text-gray-900">{c.tasksDoneThisWeek}</p>
                    <p className="text-xs text-gray-500">Tarefas/sem</p>
                  </div>
                  <div className="text-center bg-gray-50 rounded-lg p-2">
                    <p className={`text-base font-bold ${c.tasksPending > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{c.tasksPending}</p>
                    <p className="text-xs text-gray-500">Pendentes</p>
                  </div>
                </div>

                {/* Target bar */}
                <div className="mb-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">Meta mensal</span>
                    <span className={`font-medium ${c.targetPct === null ? 'text-gray-400' : c.targetPct >= 80 ? 'text-green-600' : c.targetPct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                      {c.targetPct !== null ? `${c.targetPct}%` : 'Não definida'}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${targetColor}`} style={{ width: `${Math.min(100, c.targetPct || 0)}%` }} />
                  </div>
                </div>

                {c.customersAtRisk > 0 && (
                  <p className="text-xs text-red-600 font-medium">⚠ {c.customersAtRisk} clientes em risco</p>
                )}

                {c.lastActivityDate && (
                  <p className="text-xs text-gray-400 mt-1">
                    {(() => {
                      const days = Math.floor((Date.now() - new Date(c.lastActivityDate!).getTime()) / 86400000)
                      return `Última atividade: ${days === 0 ? 'hoje' : `há ${days} dia${days !== 1 ? 's' : ''}`}`
                    })()}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Comercial</th>
                  <th>Estado</th>
                  <th>Vendas mês</th>
                  <th>Vendas semana</th>
                  <th>Visitas sem.</th>
                  <th>Tarefas feitas</th>
                  <th>Em risco</th>
                  <th>Meta %</th>
                  <th>Última ativ.</th>
                </tr>
              </thead>
              <tbody>
                {loading ? Array(4).fill(0).map((_, i) => (
                  <tr key={i}>{Array(9).fill(0).map((_, j) => <td key={j}><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}</tr>
                )) : commercials.map(c => {
                  const sc = statusConfig[c.status]
                  return (
                    <tr key={c.id}>
                      <td className="font-medium text-gray-900 text-sm">{c.name}</td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${sc.dot}`} />
                          <span className={`badge text-xs px-2 py-0.5 ${sc.badge}`}>{sc.label}</span>
                        </div>
                      </td>
                      <td className="text-sm font-semibold text-gray-900">€{c.salesThisMonth.toFixed(0)}</td>
                      <td className="text-sm text-gray-600">€{c.salesThisWeek.toFixed(0)}</td>
                      <td className="text-sm text-gray-600">{c.visitsThisWeek}</td>
                      <td className="text-sm text-gray-600">{c.tasksDoneThisWeek}</td>
                      <td className="text-sm">
                        {c.customersAtRisk > 0
                          ? <span className="text-red-600 font-medium">{c.customersAtRisk}</span>
                          : <span className="text-gray-400">0</span>
                        }
                      </td>
                      <td>
                        {c.targetPct !== null
                          ? <span className={`text-sm font-medium ${c.targetPct >= 80 ? 'text-green-600' : c.targetPct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{c.targetPct}%</span>
                          : <span className="text-xs text-gray-400">—</span>
                        }
                      </td>
                      <td className="text-xs text-gray-500">
                        {!c.lastActivityDate ? '—' : (() => { const d = Math.floor((Date.now() - new Date(c.lastActivityDate).getTime()) / 86400000); return d === 0 ? 'Hoje' : `${d}d` })()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
