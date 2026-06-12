'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import PageHeader from '@/components/layout/PageHeader'

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MONTH_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function fmt(n: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}
function fmtK(n: number) {
  if (n >= 1000) return `€${(n / 1000).toFixed(1)}k`
  return `€${n.toFixed(0)}`
}

interface Commercial { id: string; name: string; email: string }
interface Insight { type: 'positive' | 'warning' | 'danger'; title: string; body: string }

export default function RadiografiaPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const sessionUserId = (session?.user as any)?.id

  const [commercials, setCommercials] = useState<Commercial[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const isDirector = role === 'ADMIN' || role === 'DIRECTOR'

  useEffect(() => {
    if (!isDirector) {
      setSelectedId(sessionUserId || '')
      return
    }
    fetch('/api/users?role=COMMERCIAL')
      .then(r => r.json())
      .then(d => {
        const list: Commercial[] = d.users || d || []
        setCommercials(list)
        if (list.length > 0) setSelectedId(list[0].id)
      })
  }, [isDirector, sessionUserId])

  useEffect(() => {
    if (!selectedId) return
    setLoading(true)
    setData(null)
    fetch(`/api/radiografia?userId=${selectedId}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [selectedId])

  const maxSale = data ? Math.max(...data.monthlySales.map((m: any) => m.total), 1) : 1
  const maxVisit = data ? Math.max(...data.monthlyVisits.map((m: any) => m.count), 1) : 1

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl">
      <PageHeader
        title="Radiografia Comercial"
        subtitle="Análise completa da atividade e performance de um comercial"
      />

      {/* Selector */}
      {isDirector && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Comercial</label>
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-48"
          >
            {commercials.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {data && (
            <span className="text-xs text-gray-400">{data.commercial?.email}</span>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-sm text-gray-500">A gerar radiografia...</p>
          </div>
        </div>
      )}

      {data && !loading && (
        <>
          {/* ── Identity Banner ── */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-6 text-white flex items-center gap-5 shadow-lg">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-2xl font-bold shrink-0">
              {data.commercial.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold">{data.commercial.name}</h2>
              <p className="text-blue-200 text-sm">{data.commercial.email}</p>
            </div>
            <div className="hidden md:flex gap-6 text-center">
              <div>
                <p className="text-2xl font-bold">{fmt(data.summary.salesThisYear)}</p>
                <p className="text-blue-200 text-xs">Vendas {new Date().getFullYear()}</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{data.summary.activeCustomers}</p>
                <p className="text-blue-200 text-xs">Clientes ativos</p>
              </div>
              <div>
                <p className={`text-2xl font-bold ${data.summary.salesGrowthYoY >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  {data.summary.salesGrowthYoY >= 0 ? '+' : ''}{data.summary.salesGrowthYoY.toFixed(1)}%
                </p>
                <p className="text-blue-200 text-xs">vs ano anterior</p>
              </div>
            </div>
          </div>

          {/* ── KPI Row ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Ticket Médio', value: fmt(data.summary.avgOrderValue), sub: `${data.summary.salesCount} vendas`, color: 'blue' },
              { label: 'Visitas/mês', value: data.summary.visitFreqPerMonth.toFixed(1), sub: `${data.summary.visitsThisYear} total no ano`, color: 'indigo' },
              { label: 'Conclusão tarefas', value: `${data.summary.taskCompletionRate.toFixed(0)}%`, sub: `${data.summary.completedTasks}/${data.summary.totalTasks} concluídas`, color: data.summary.taskCompletionRate >= 70 ? 'green' : 'amber' },
              { label: 'Clientes em risco', value: data.summary.atRiskCustomers, sub: `${data.summary.atRiskPct.toFixed(0)}% da carteira ativa`, color: data.summary.atRiskPct > 20 ? 'red' : 'orange' },
            ].map(k => (
              <div key={k.label} className="bg-white border border-gray-100 shadow-sm rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">{k.label}</p>
                <p className={`text-2xl font-bold text-${k.color}-600`}>{k.value}</p>
                <p className="text-xs text-gray-400 mt-1">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* ── Main Grid ── */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Monthly Sales Chart */}
            <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-5 md:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Vendas Mensais {new Date().getFullYear()}</h3>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500 inline-block" />Vendas</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-200 inline-block border-2 border-dashed border-gray-400" />Meta</span>
                </div>
              </div>
              <div className="flex items-end gap-1 h-36">
                {data.monthlySales.map((ms: any, i: number) => {
                  const target = data.monthlyTargets[i]?.target || 0
                  const targetPct = target > 0 ? Math.min((target / maxSale) * 100, 100) : 0
                  const barPct = Math.min((ms.total / maxSale) * 100, 100)
                  const isCurrentMonth = i === new Date().getMonth()
                  const isPast = i < new Date().getMonth()
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-10">
                        <div className="bg-gray-800 text-white text-xs rounded-lg px-2 py-1 whitespace-nowrap shadow-lg">
                          <div>{MONTH_FULL[i]}: {fmt(ms.total)}</div>
                          {target > 0 && <div className="text-gray-300">Meta: {fmt(target)}</div>}
                          <div className="text-gray-300">{ms.count} vendas</div>
                        </div>
                        <div className="w-2 h-2 bg-gray-800 rotate-45 -mt-1" />
                      </div>
                      <div className="w-full relative flex items-end" style={{ height: '120px' }}>
                        {/* Target line */}
                        {target > 0 && (
                          <div
                            className="absolute w-full border-t-2 border-dashed border-gray-400"
                            style={{ bottom: `${targetPct}%` }}
                          />
                        )}
                        {/* Bar */}
                        <div
                          className={`w-full rounded-t transition-all ${
                            isCurrentMonth ? 'bg-blue-500' :
                            isPast && ms.total >= (target || 0) && target > 0 ? 'bg-green-400' :
                            isPast && ms.total < target && target > 0 ? 'bg-red-400' :
                            'bg-blue-300'
                          }`}
                          style={{ height: `${Math.max(barPct, ms.total > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                      <span className={`text-xs ${isCurrentMonth ? 'font-bold text-blue-600' : 'text-gray-400'}`}>{MONTHS[i]}</span>
                    </div>
                  )
                })}
              </div>
              {/* Best month callout */}
              {data.summary.bestMonthTotal > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-2 text-xs text-gray-500">
                  <span className="text-yellow-500">★</span>
                  <span>Melhor mês: <strong>{MONTH_FULL[data.summary.bestMonth - 1]}</strong> com {fmt(data.summary.bestMonthTotal)}</span>
                </div>
              )}
            </div>

            {/* Brand Breakdown */}
            <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Vendas por Marca</h3>
              {data.brandBreakdown.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Sem dados de marca</p>
              ) : (
                <div className="space-y-3">
                  {data.brandBreakdown.map((b: any, i: number) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-gray-700">{b.name}</span>
                        <span className="text-gray-500">{fmt(b.total)} · {b.pct.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${b.pct}%`, backgroundColor: ['#3b82f6','#6366f1','#8b5cf6','#a78bfa','#c4b5fd','#ddd6fe'][i] }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Visits by Month */}
            <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Visitas por Mês</h3>
              <div className="flex items-end gap-1 h-28">
                {data.monthlyVisits.map((mv: any, i: number) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                    {mv.count > 0 && (
                      <div className="absolute bottom-full mb-1 hidden group-hover:block">
                        <div className="bg-gray-800 text-white text-xs rounded px-2 py-0.5 whitespace-nowrap">{mv.count}</div>
                      </div>
                    )}
                    <div className="w-full bg-gray-100 rounded-t overflow-hidden" style={{ height: '96px' }}>
                      <div
                        className="w-full bg-indigo-400 rounded-t transition-all mt-auto"
                        style={{ height: `${Math.min((mv.count / maxVisit) * 100, 100)}%`, marginTop: `${100 - Math.min((mv.count / maxVisit) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400">{MONTHS[i]}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">{data.summary.visitsThisYear} visitas · {data.summary.visitFreqPerMonth.toFixed(1)}/mês média</p>
            </div>

            {/* Proposals */}
            <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Propostas</h3>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center p-3 bg-amber-50 rounded-xl">
                  <p className="text-2xl font-bold text-amber-600">{data.proposalStats.sent}</p>
                  <p className="text-xs text-amber-500">Enviadas</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-xl">
                  <p className="text-2xl font-bold text-green-600">{data.proposalStats.accepted}</p>
                  <p className="text-xs text-green-500">Aceites</p>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-xl">
                  <p className="text-2xl font-bold text-red-500">{data.proposalStats.lost}</p>
                  <p className="text-xs text-red-400">Perdidas</p>
                </div>
              </div>
              <div className="space-y-2 text-xs text-gray-600">
                <div className="flex justify-between py-1.5 border-b border-gray-50">
                  <span className="text-gray-500">Taxa de conversão</span>
                  <span className="font-semibold">{isNaN(data.proposalStats.winRate) ? '—' : `${data.proposalStats.winRate.toFixed(0)}%`}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-500">Valor aceite</span>
                  <span className="font-semibold text-green-600">{fmt(data.proposalStats.totalValue)}</span>
                </div>
              </div>
            </div>

            {/* Customer Map */}
            <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Carteira de Clientes</h3>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center p-3 bg-blue-50 rounded-xl">
                  <p className="text-2xl font-bold text-blue-600">{data.summary.totalCustomers}</p>
                  <p className="text-xs text-blue-400">Total</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-xl">
                  <p className="text-2xl font-bold text-green-600">{data.summary.activeCustomers}</p>
                  <p className="text-xs text-green-400">Ativos</p>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-xl">
                  <p className="text-2xl font-bold text-red-500">{data.summary.atRiskCustomers}</p>
                  <p className="text-xs text-red-400">Em risco</p>
                </div>
              </div>
              {data.zones.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Por zona</p>
                  <div className="space-y-1.5">
                    {data.zones.map((z: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="text-gray-600 flex-1 truncate">{z.zone}</span>
                        <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(z.count / data.summary.totalCustomers) * 100}%` }} />
                        </div>
                        <span className="text-gray-400 w-6 text-right">{z.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Target Performance Row ── */}
          <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Performance vs Meta Mensal</h3>
              {data.summary.targetAvgPct > 0 && (
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${data.summary.targetAvgPct >= 100 ? 'bg-green-100 text-green-700' : data.summary.targetAvgPct >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                  Média: {data.summary.targetAvgPct.toFixed(0)}%
                </span>
              )}
            </div>
            <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
              {data.monthlyTargets.map((mt: any, i: number) => {
                const pct = mt.pct
                const hasTarget = mt.target > 0
                const isPast = i < new Date().getMonth()
                return (
                  <div key={i} className="text-center group relative">
                    <div className="absolute bottom-full mb-2 hidden group-hover:block left-1/2 -translate-x-1/2 z-10">
                      <div className="bg-gray-800 text-white text-xs rounded-lg px-2 py-1 whitespace-nowrap shadow-lg">
                        <div>{MONTH_FULL[i]}</div>
                        <div>Vendido: {fmtK(mt.achieved)}</div>
                        {hasTarget && <div>Meta: {fmtK(mt.target)}</div>}
                        {pct !== null && <div className={pct >= 100 ? 'text-green-400' : 'text-red-400'}>{pct.toFixed(0)}%</div>}
                      </div>
                    </div>
                    <div className={`w-full h-2 rounded-full mb-1 ${
                      !hasTarget ? 'bg-gray-100' :
                      !isPast ? 'bg-gray-100' :
                      pct >= 100 ? 'bg-green-400' :
                      pct >= 70 ? 'bg-amber-400' :
                      'bg-red-400'
                    }`} />
                    <span className="text-xs text-gray-400">{MONTHS[i]}</span>
                    {hasTarget && isPast && pct !== null && (
                      <span className={`block text-xs font-semibold ${pct >= 100 ? 'text-green-600' : pct >= 70 ? 'text-amber-500' : 'text-red-500'}`}>
                        {pct.toFixed(0)}%
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── AI Insights ── */}
          <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 001.5 2.121m-1.5-2.121c.251.023.501.05.75.082M15 14.5l-4.091 4.091M15 14.5l.659 1.591a2.25 2.25 0 01-1.591 3.182L5 21" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-gray-900">Análise IA</h3>
              <span className="text-xs text-gray-400 ml-auto">Gerado automaticamente com base nos dados reais</span>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {data.aiInsights.map((ins: Insight, i: number) => (
                <div key={i} className={`flex gap-3 p-4 rounded-xl border-l-4 ${
                  ins.type === 'positive' ? 'bg-green-50 border-green-400' :
                  ins.type === 'warning' ? 'bg-amber-50 border-amber-400' :
                  'bg-red-50 border-red-400'
                }`}>
                  <div className={`text-lg ${ins.type === 'positive' ? 'text-green-500' : ins.type === 'warning' ? 'text-amber-500' : 'text-red-500'}`}>
                    {ins.type === 'positive' ? '↑' : ins.type === 'warning' ? '⚠' : '⚡'}
                  </div>
                  <div>
                    <p className={`text-xs font-semibold mb-1 ${ins.type === 'positive' ? 'text-green-700' : ins.type === 'warning' ? 'text-amber-700' : 'text-red-700'}`}>
                      {ins.title}
                    </p>
                    <p className="text-xs text-gray-600 leading-relaxed">{ins.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Bottom Row: Visits + Tasks ── */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Recent Visits */}
            <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Últimas Visitas</h3>
              {data.recentVisits.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Sem visitas registadas</p>
              ) : (
                <div className="space-y-3">
                  {data.recentVisits.map((v: any) => (
                    <div key={v.id} className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{v.customer?.name || '—'}</p>
                        <p className="text-xs text-gray-400">{new Date(v.date).toLocaleDateString('pt-PT')}</p>
                        {v.notes && <p className="text-xs text-gray-500 truncate mt-0.5">{v.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pending Tasks */}
            <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Tarefas Pendentes</h3>
              {data.pendingTasks.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Sem tarefas pendentes</p>
              ) : (
                <div className="space-y-2">
                  {data.pendingTasks.map((t: any) => (
                    <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${
                        t.priority === 'HIGH' ? 'bg-red-400' :
                        t.priority === 'MEDIUM' ? 'bg-amber-400' :
                        'bg-gray-300'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 truncate">{t.title}</p>
                        <p className="text-xs text-gray-400 truncate">{t.customer?.name}</p>
                      </div>
                      {t.dueDate && (
                        <span className={`text-xs shrink-0 ${new Date(t.dueDate) < new Date() ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                          {new Date(t.dueDate).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!loading && !data && selectedId && (
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-400 text-sm">Nenhum dado disponível para este comercial.</p>
        </div>
      )}
    </div>
  )
}
