'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import PageHeader from '@/components/layout/PageHeader'

interface CommercialPerf {
  id: string
  name: string
  sales: number
  salesCount: number
  visits: number
  tasksDone: number
  avgOrderValue: number
  targetPct: number | null
  monthlyTotals: { month: number; year: number; total: number }[]
}

const MEDALS = ['🥇','🥈','🥉']
const MEDAL_COLORS = [
  { bg: 'bg-yellow-50 border-yellow-300', text: 'text-yellow-700', bar: 'bg-yellow-400' },
  { bg: 'bg-gray-100 border-gray-300', text: 'text-gray-600', bar: 'bg-gray-400' },
  { bg: 'bg-orange-50 border-orange-300', text: 'text-orange-700', bar: 'bg-orange-400' },
]
const MONTH_LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

type RankBy = 'sales' | 'visits' | 'tasksDone' | 'targetPct'
type Period = 'month' | 'quarter' | 'year'

export default function PerformancePage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const userId = (session?.user as any)?.id
  const now = new Date()
  const [period, setPeriod] = useState<Period>('month')
  const [rankBy, setRankBy] = useState<RankBy>('sales')
  const [data, setData] = useState<CommercialPerf[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(() => {
    setLoading(true)
    fetch(`/api/performance?period=${period}&year=${now.getFullYear()}&month=${now.getMonth() + 1}`)
      .then(r => r.json())
      .then(d => { setData(d.commercials || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [period])

  useEffect(() => { fetchData() }, [fetchData])

  const sorted = [...data].sort((a, b) => {
    if (rankBy === 'targetPct') return (b.targetPct || 0) - (a.targetPct || 0)
    return (b[rankBy] as number) - (a[rankBy] as number)
  })

  const leader = sorted[0]?.[rankBy === 'targetPct' ? 'targetPct' : rankBy] as number || 1

  const TABS: { key: RankBy; label: string }[] = [
    { key: 'sales', label: 'Vendas' },
    { key: 'visits', label: 'Visitas' },
    { key: 'tasksDone', label: 'Tarefas' },
    { key: 'targetPct', label: 'Meta %' },
  ]

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Comparativo de Performance"
        subtitle="Ranking e evolução dos comerciais"
        actions={
          <div className="flex gap-1 border border-gray-200 rounded-lg overflow-hidden">
            {([['month','Este Mês'],['quarter','Trimestre'],['year','Ano']] as const).map(([p, label]) => (
              <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 text-xs font-medium transition ${period === p ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{label}</button>
            ))}
          </div>
        }
      />

      {/* Podium — top 3 */}
      {!loading && sorted.length >= 2 && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Top 3 — {TABS.find(t => t.key === rankBy)?.label}</p>
          <div className="flex items-end justify-center gap-3">
            {/* 2nd */}
            {sorted[1] && (
              <div className={`flex flex-col items-center border rounded-xl p-4 w-32 ${MEDAL_COLORS[1].bg}`}>
                <span className="text-2xl mb-1">{MEDALS[1]}</span>
                <div className="w-10 h-10 bg-gray-500 rounded-xl flex items-center justify-center text-white font-bold mb-2">{sorted[1].name.charAt(0)}</div>
                <p className="text-xs font-semibold text-gray-700 text-center truncate w-full">{sorted[1].name.split(' ')[0]}</p>
                <p className={`text-sm font-bold mt-1 ${MEDAL_COLORS[1].text}`}>
                  {rankBy === 'sales' ? `€${sorted[1].sales.toFixed(0)}` : rankBy === 'targetPct' ? `${sorted[1].targetPct || 0}%` : sorted[1][rankBy]}
                </p>
              </div>
            )}
            {/* 1st — taller */}
            {sorted[0] && (
              <div className={`flex flex-col items-center border-2 rounded-xl p-4 w-36 -mt-4 ${MEDAL_COLORS[0].bg}`}>
                <span className="text-3xl mb-1">{MEDALS[0]}</span>
                <div className="w-12 h-12 bg-yellow-500 rounded-xl flex items-center justify-center text-white font-bold text-lg mb-2">{sorted[0].name.charAt(0)}</div>
                <p className="text-sm font-semibold text-gray-900 text-center truncate w-full">{sorted[0].name.split(' ')[0]}</p>
                <p className={`text-base font-bold mt-1 ${MEDAL_COLORS[0].text}`}>
                  {rankBy === 'sales' ? `€${sorted[0].sales.toFixed(0)}` : rankBy === 'targetPct' ? `${sorted[0].targetPct || 0}%` : sorted[0][rankBy]}
                </p>
              </div>
            )}
            {/* 3rd */}
            {sorted[2] && (
              <div className={`flex flex-col items-center border rounded-xl p-4 w-32 ${MEDAL_COLORS[2].bg}`}>
                <span className="text-2xl mb-1">{MEDALS[2]}</span>
                <div className="w-10 h-10 bg-orange-400 rounded-xl flex items-center justify-center text-white font-bold mb-2">{sorted[2].name.charAt(0)}</div>
                <p className="text-xs font-semibold text-gray-700 text-center truncate w-full">{sorted[2].name.split(' ')[0]}</p>
                <p className={`text-sm font-bold mt-1 ${MEDAL_COLORS[2].text}`}>
                  {rankBy === 'sales' ? `€${sorted[2].sales.toFixed(0)}` : rankBy === 'targetPct' ? `${sorted[2].targetPct || 0}%` : sorted[2][rankBy]}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ranking tabs + bars */}
      <div className="bg-white border border-gray-100 shadow-sm rounded-xl mb-5">
        <div className="flex border-b border-gray-100">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setRankBy(tab.key)} className={`flex-1 py-3 text-xs font-semibold transition ${rankBy === tab.key ? 'text-blue-700 border-b-2 border-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="p-4 space-y-3">
          {loading ? Array(4).fill(0).map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />) :
            sorted.map((c, i) => {
              const val = rankBy === 'targetPct' ? (c.targetPct || 0) : c[rankBy] as number
              const barPct = leader > 0 ? (val / leader) * 100 : 0
              const isMe = c.id === userId
              return (
                <div key={c.id} className={`flex items-center gap-3 ${isMe ? 'bg-blue-50 rounded-lg p-1 -mx-1' : ''}`}>
                  <span className="text-sm font-bold text-gray-400 w-5">{i + 1}</span>
                  <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {c.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900 truncate">{c.name.split(' ')[0]}</span>
                      <span className="text-sm font-bold text-gray-900 ml-2 flex-shrink-0">
                        {rankBy === 'sales' ? `€${val.toFixed(0)}` : rankBy === 'targetPct' ? `${val}%` : val}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${barPct}%` }} />
                    </div>
                  </div>
                </div>
              )
            })
          }
        </div>
      </div>

      {/* Evolution sparklines */}
      <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-4 mb-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Evolução — Vendas por Mês</h3>
        <div className="space-y-4">
          {loading ? Array(3).fill(0).map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />) :
            data.map(c => {
              const months = c.monthlyTotals || []
              const maxVal = Math.max(...months.map(m => m.total), 1)
              return (
                <div key={c.id}>
                  <p className="text-xs font-medium text-gray-600 mb-1">{c.name}</p>
                  <div className="flex items-end gap-1 h-10">
                    {months.map((m, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                        <div
                          className="w-full bg-blue-400 rounded-sm transition-all"
                          style={{ height: `${Math.max(4, (m.total / maxVal) * 32)}px` }}
                          title={`${MONTH_LABELS[m.month - 1]}: €${m.total.toFixed(0)}`}
                        />
                        <span className="text-[9px] text-gray-400">{MONTH_LABELS[m.month - 1]}</span>
                      </div>
                    ))}
                    {months.length === 0 && <p className="text-xs text-gray-400">Sem dados</p>}
                  </div>
                </div>
              )
            })
          }
        </div>
      </div>

      {/* Full comparison table */}
      <div className="bg-white border border-gray-100 shadow-sm rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Tabela Comparativa</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Comercial</th>
                <th>Vendas</th>
                <th>Encomendas</th>
                <th>Visitas</th>
                <th>Tarefas</th>
                <th>Ticket Médio</th>
                <th>Meta %</th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array(4).fill(0).map((_, i) => (
                <tr key={i}>{Array(7).fill(0).map((_, j) => <td key={j}><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}</tr>
              )) : sorted.map((c, i) => {
                const bestSales = sorted[0]?.sales || 0
                const bestVisits = Math.max(...sorted.map(r => r.visits))
                const bestTasks = Math.max(...sorted.map(r => r.tasksDone))
                const isMe = c.id === userId
                return (
                  <tr key={c.id} className={isMe ? 'bg-blue-50' : ''}>
                    <td className="font-medium text-gray-900 text-sm">
                      <span className="text-gray-400 mr-2">{i + 1}.</span>{c.name}
                    </td>
                    <td className={`text-sm font-semibold ${c.sales === bestSales && bestSales > 0 ? 'text-green-600' : 'text-gray-900'}`}>€{c.sales.toFixed(0)}</td>
                    <td className="text-sm text-gray-600">{c.salesCount}</td>
                    <td className={`text-sm ${c.visits === bestVisits && bestVisits > 0 ? 'text-green-600 font-semibold' : 'text-gray-600'}`}>{c.visits}</td>
                    <td className={`text-sm ${c.tasksDone === bestTasks && bestTasks > 0 ? 'text-green-600 font-semibold' : 'text-gray-600'}`}>{c.tasksDone}</td>
                    <td className="text-sm text-gray-600">€{c.avgOrderValue.toFixed(0)}</td>
                    <td>
                      {c.targetPct !== null
                        ? <span className={`text-sm font-medium ${c.targetPct >= 80 ? 'text-green-600' : c.targetPct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{c.targetPct}%</span>
                        : <span className="text-xs text-gray-400">—</span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
