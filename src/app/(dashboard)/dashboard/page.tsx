'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { formatCurrency } from '@/lib/utils'
import KpiCard from '@/components/ui/KpiCard'
import PageHeader from '@/components/layout/PageHeader'
import Link from 'next/link'

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#7c3aed', '#db2777', '#0891b2']

interface Insight { type: 'positive' | 'warning' | 'danger'; title: string; body: string }

interface DashboardData {
  aiInsights?: Insight[]
  lastSaleDate?: string | null
  kpis: {
    totalSalesMonth: number
    totalSalesLastMonth: number
    monthChange: number
    totalCustomers: number
    activeCustomers: number
    atRiskCustomers: number
    inactiveCustomers: number
    pendingTasks: number
    recentVisits: number
  }
  salesByBrand: { name: string; total: number; units: number }[]
  salesByCommercial: { name: string; total: number }[]
  monthlySales: { month: string; total: number; homologo: number; orcamento: number }[]
  topCustomers: { id: string; name: string; zone: string | null; commercial: string | null; total: number; lastYear: number; desvio: number | null }[]
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded-lg ${className}`} />
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [familyMetric, setFamilyMetric] = useState<'valor' | 'unidades'>('unidades')
  const role = (session?.user as any)?.role

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <div className="p-6">
      <PageHeader
        title={`${greeting}, ${session?.user?.name?.split(' ')[0] || 'utilizador'} 👋`}
        subtitle={`Dashboard comercial — ${new Date().toLocaleDateString('pt-PT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}
        actions={
          <div className="flex items-center gap-2">
            {data?.lastSaleDate && (
              <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 text-gray-600 px-3 py-2 rounded-lg text-xs font-medium">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Dados até {new Date(data.lastSaleDate).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </div>
            )}
            <Link href="/assistente" className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 transition">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
              Assistente IA
            </Link>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {loading ? Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-28" />) : (
          <>
            <KpiCard
              title="Vendas este mês"
              value={formatCurrency(data?.kpis.totalSalesMonth || 0)}
              change={data?.kpis.monthChange}
              color="blue"
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            />
            <KpiCard
              title="Clientes ativos"
              value={data?.kpis.activeCustomers || 0}
              subtitle={`de ${data?.kpis.totalCustomers || 0} total`}
              color="green"
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
            />
            <KpiCard
              title="Clientes em risco"
              value={data?.kpis.atRiskCustomers || 0}
              color="red"
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
            />
            <KpiCard
              title="Clientes inativos"
              value={data?.kpis.inactiveCustomers || 0}
              color="orange"
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>}
            />
            <KpiCard
              title="Tarefas pendentes"
              value={data?.kpis.pendingTasks || 0}
              color="purple"
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
            />
            <KpiCard
              title="Visitas (30 dias)"
              value={data?.kpis.recentVisits || 0}
              color="blue"
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>}
            />
          </>
        )}
      </div>

      {/* AI Analysis */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 bg-purple-100 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 001.5 2.121m-1.5-2.121c.251.023.501.05.75.082M15 14.5l-4.091 4.091M15 14.5l.659 1.591a2.25 2.25 0 01-1.591 3.182L5 21" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-gray-900">Análise IA</h2>
          <span className="text-xs text-gray-400 ml-auto">Gerado automaticamente com base nos dados reais</span>
        </div>
        {loading ? (
          <Skeleton className="h-24" />
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {(data?.aiInsights || []).map((ins, i) => (
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
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Monthly Sales Chart */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Evolução de Vendas vs Ano Anterior e Orçamento</h2>
          {loading ? <Skeleton className="h-56" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data?.monthlySales || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} labelStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" name="Este ano" dataKey="total" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" name="Ano anterior" dataKey="homologo" stroke="#dc2626" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                <Line type="monotone" name="Orçamento" dataKey="orcamento" stroke="#16a34a" strokeWidth={2} dot={false} strokeDasharray="6 3" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Sales by Family */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Vendas por Família (este ano)</h2>
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setFamilyMetric('valor')}
                className={`px-3 py-1 text-xs font-medium transition ${familyMetric === 'valor' ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >€</button>
              <button
                onClick={() => setFamilyMetric('unidades')}
                className={`px-3 py-1 text-xs font-medium transition ${familyMetric === 'unidades' ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >Unidades</button>
            </div>
          </div>
          {loading ? <Skeleton className="h-56" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={[...(data?.salesByBrand || [])].sort((a, b) =>
                  familyMetric === 'valor' ? b.total - a.total : b.units - a.units
                )}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11 }}
                  tickFormatter={v => familyMetric === 'valor' ? `€${(v/1000).toFixed(0)}k` : `${v}`}
                />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => familyMetric === 'valor' ? formatCurrency(v) : `${v.toLocaleString('pt-PT')} un.`} />
                <Bar dataKey={familyMetric === 'valor' ? 'total' : 'units'} radius={[0, 4, 4, 0]}>
                  {(data?.salesByBrand || []).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Customers */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Clientes por Desvio vs Ano Anterior</h2>
            <Link href="/clientes" className="text-xs text-blue-600 hover:text-blue-800 font-medium">Ver todos →</Link>
          </div>
          {loading ? <Skeleton className="h-48" /> : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Cliente</th>
                  <th>Vendedor</th>
                  <th className="text-right">Desvio</th>
                </tr>
              </thead>
              <tbody>
                {(data?.topCustomers || []).map((c, i) => (
                  <tr key={c.id} className="cursor-pointer">
                    <td className="text-gray-400 font-medium">{i + 1}</td>
                    <td>
                      <Link href={`/clientes/${c.id}`} className="font-medium text-gray-900 hover:text-blue-700">
                        {c.name}
                      </Link>
                    </td>
                    <td className="text-gray-500">{c.commercial || '—'}</td>
                    <td className={`text-right font-semibold ${
                      c.desvio === null ? 'text-gray-400'
                        : c.desvio >= 0 ? 'text-green-600' : 'text-red-500'
                    }`}>
                      {c.desvio === null ? '—' : `${c.desvio >= 0 ? '+' : ''}${c.desvio.toFixed(1)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Sales by Commercial - only for director/admin */}
        {role !== 'COMMERCIAL' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Vendas por Comercial (este mês)</h2>
            {loading ? <Skeleton className="h-48" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data?.salesByCommercial || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="total" fill="#16a34a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}

        {/* Quick Actions for Commercial role */}
        {role === 'COMMERCIAL' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Ações Rápidas</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { href: '/tarefas', label: 'Ver Tarefas', color: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
                { href: '/visitas', label: 'Registar Visita', color: 'bg-green-50 text-green-700 hover:bg-green-100' },
                { href: '/clientes', label: 'Os Meus Clientes', color: 'bg-purple-50 text-purple-700 hover:bg-purple-100' },
                { href: '/assistente', label: 'Assistente IA', color: 'bg-orange-50 text-orange-700 hover:bg-orange-100' },
              ].map(a => (
                <Link key={a.href} href={a.href} className={`${a.color} rounded-xl p-4 text-sm font-medium text-center transition`}>
                  {a.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
