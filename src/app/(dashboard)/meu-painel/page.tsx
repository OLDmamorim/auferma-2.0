'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { formatDate, formatCurrency, daysAgo } from '@/lib/utils'
import KpiCard from '@/components/ui/KpiCard'
import PageHeader from '@/components/layout/PageHeader'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MonthTarget {
  target: number
  achieved: number
}

interface AtRiskCustomer {
  id: string
  name: string
  lastPurchaseDate: string | null
  riskScore: number
}

interface PendingTask {
  id: string
  title: string
  priority: string
  dueDate: string | null
  status: string
  customer: { id: string; name: string } | null
}

interface Visit {
  id: string
  date: string
  type: string
  customer: { id: string; name: string }
}

interface RecentSale {
  id: string
  date: string
  total: number
  customer: { name: string } | null
  brand: { name: string } | null
}

interface PainelData {
  salesThisMonth: number
  salesLastMonth: number
  monthTarget: MonthTarget | null
  myCustomers: number
  atRiskCustomers: AtRiskCustomer[]
  pendingTasks: PendingTask[]
  visitsThisWeek: { count: number; items: Visit[] }
  recentSales: RecentSale[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded-lg ${className}`} />
}

const PRIORITY_BADGE: Record<string, string> = {
  URGENT: 'badge badge-red',
  HIGH: 'badge badge-orange',
  MEDIUM: 'badge badge-blue',
  LOW: 'badge badge-gray',
}

const PRIORITY_LABEL: Record<string, string> = {
  URGENT: 'Urgente',
  HIGH: 'Alta',
  MEDIUM: 'Média',
  LOW: 'Baixa',
}

const VISIT_TYPE_EMOJI: Record<string, string> = {
  VISIT: '🏢',
  CALL: '📞',
  EMAIL: '✉️',
  MEETING: '🤝',
  OTHER: '📋',
}

// ─── Target Card ──────────────────────────────────────────────────────────────

function TargetCard({
  salesThisMonth,
  salesLastMonth,
  monthTarget,
}: {
  salesThisMonth: number
  salesLastMonth: number
  monthTarget: MonthTarget | null
}) {
  if (!monthTarget) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Meta Mensal</p>
            <p className="text-xs text-gray-400">Meta não definida para este mês</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(salesThisMonth)}</p>
            <p className="text-xs text-gray-400">vendas este mês</p>
          </div>
        </div>
      </div>
    )
  }

  const pct = monthTarget.target > 0
    ? Math.min(100, Math.round((salesThisMonth / monthTarget.target) * 100))
    : 0
  const trend = salesLastMonth > 0 ? ((salesThisMonth - salesLastMonth) / salesLastMonth) * 100 : null
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (pct / 100) * circumference
  const progressColor = pct >= 100 ? '#16a34a' : pct >= 70 ? '#2563eb' : pct >= 40 ? '#d97706' : '#dc2626'

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
      <div className="flex flex-col md:flex-row items-center gap-6">
        {/* Circular progress */}
        <div className="relative flex-shrink-0">
          <svg width="140" height="140" viewBox="0 0 140 140">
            <circle cx="70" cy="70" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="12" />
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={progressColor}
              strokeWidth="12"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              transform="rotate(-90 70 70)"
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-gray-900">{pct}%</span>
            <span className="text-xs text-gray-400">da meta</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
          <div className="text-center sm:text-left">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Vendas este mês</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(salesThisMonth)}</p>
            {trend !== null && (
              <div className={`inline-flex items-center gap-1 mt-1 text-xs font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={trend >= 0 ? 'M5 10l7-7m0 0l7 7m-7-7v18' : 'M19 14l-7 7m0 0l-7-7m7 7V3'} />
                </svg>
                {Math.abs(trend).toFixed(1)}% vs mês anterior
              </div>
            )}
          </div>
          <div className="text-center">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Meta</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(monthTarget.target)}</p>
            <p className="text-xs text-gray-400 mt-1">objetivo mensal</p>
          </div>
          <div className="text-center sm:text-right">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Falta atingir</p>
            <p className={`text-2xl font-bold mt-1 ${pct >= 100 ? 'text-green-600' : 'text-gray-900'}`}>
              {pct >= 100 ? 'Meta atingida! 🎉' : formatCurrency(Math.max(0, monthTarget.target - salesThisMonth))}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {salesLastMonth > 0 ? `Mês anterior: ${formatCurrency(salesLastMonth)}` : 'Sem dados do mês anterior'}
            </p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className="h-2 rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, backgroundColor: progressColor }}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MeuPainelPage() {
  const { data: session } = useSession()
  const [data, setData] = useState<PainelData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/meu-painel')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const userName = session?.user?.name?.split(' ')[0] || 'Comercial'

  return (
    <div className="p-6">
      <PageHeader
        title={`O Meu Painel`}
        subtitle={`Bem-vindo, ${userName} — resumo da sua actividade comercial`}
        actions={
          <Link
            href="/visitas"
            className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Registar Visita
          </Link>
        }
      />

      {/* Target Card */}
      {loading ? (
        <Skeleton className="h-48 mb-6" />
      ) : (
        <TargetCard
          salesThisMonth={data?.salesThisMonth ?? 0}
          salesLastMonth={data?.salesLastMonth ?? 0}
          monthTarget={data?.monthTarget ?? null}
        />
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard
              title="Clientes na carteira"
              value={data?.myCustomers ?? 0}
              color="blue"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
            />
            <KpiCard
              title="Visitas esta semana"
              value={data?.visitsThisWeek.count ?? 0}
              color="green"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
              }
            />
            <KpiCard
              title="Tarefas pendentes"
              value={data?.pendingTasks.length ?? 0}
              color="orange"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              }
            />
            <KpiCard
              title="Vendas este mês"
              value={formatCurrency(data?.salesThisMonth ?? 0)}
              color="purple"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
          </>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Clientes em Risco */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Clientes em Risco</h2>
            <Link href="/clientes?status=AT_RISK" className="text-xs text-blue-600 hover:text-blue-800 font-medium">
              Ver todos →
            </Link>
          </div>
          {loading ? (
            <Skeleton className="h-48" />
          ) : data?.atRiskCustomers.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Nenhum cliente em risco 🎉</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {data?.atRiskCustomers.map(c => {
                const days = daysAgo(c.lastPurchaseDate)
                const riskHigh = c.riskScore > 60
                return (
                  <li key={c.id} className="py-3 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/clientes/${c.id}`}
                        className="text-sm font-medium text-gray-900 hover:text-blue-700 truncate block"
                      >
                        {c.name}
                      </Link>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {c.lastPurchaseDate
                          ? `Última compra há ${days} dias (${formatDate(c.lastPurchaseDate)})`
                          : 'Sem compras registadas'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      {riskHigh && (
                        <span className="badge badge-red">Risco Alto</span>
                      )}
                      {days > 30 && !riskHigh && (
                        <span className="badge badge-orange">Inativo</span>
                      )}
                      {!riskHigh && days <= 30 && (
                        <span className="badge badge-green">OK</span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Tarefas Pendentes */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Tarefas Pendentes</h2>
            <Link href="/tarefas" className="text-xs text-blue-600 hover:text-blue-800 font-medium">
              Ver todas →
            </Link>
          </div>
          {loading ? (
            <Skeleton className="h-48" />
          ) : data?.pendingTasks.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Sem tarefas pendentes ✅</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {data?.pendingTasks.map(task => (
                <li key={task.id} className="py-3">
                  <div className="flex items-start gap-2">
                    <span className={PRIORITY_BADGE[task.priority] ?? 'badge badge-gray'}>
                      {PRIORITY_LABEL[task.priority] ?? task.priority}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                        {task.customer && (
                          <span className="truncate">{task.customer.name}</span>
                        )}
                        {task.dueDate && (
                          <>
                            {task.customer && <span>·</span>}
                            <span>Prazo: {formatDate(task.dueDate)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Visitas Esta Semana */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Visitas Esta Semana</h2>
            <Link href="/visitas" className="text-xs text-blue-600 hover:text-blue-800 font-medium">
              Ver todas →
            </Link>
          </div>
          {loading ? (
            <Skeleton className="h-40" />
          ) : data?.visitsThisWeek.items.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Nenhuma visita esta semana</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {data?.visitsThisWeek.items.map(v => (
                <li key={v.id} className="py-3 flex items-center gap-3">
                  <span className="text-xl leading-none">
                    {VISIT_TYPE_EMOJI[v.type] ?? '📋'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/clientes/${v.customer.id}`}
                      className="text-sm font-medium text-gray-900 hover:text-blue-700 truncate block"
                    >
                      {v.customer.name}
                    </Link>
                    <p className="text-xs text-gray-400">{formatDate(v.date)}</p>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{v.type}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Últimas Vendas */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Últimas Vendas</h2>
            <Link href="/vendas" className="text-xs text-blue-600 hover:text-blue-800 font-medium">
              Ver todas →
            </Link>
          </div>
          {loading ? (
            <Skeleton className="h-40" />
          ) : data?.recentSales.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Sem vendas registadas</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Marca</th>
                  <th>Data</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {data?.recentSales.map(s => (
                  <tr key={s.id}>
                    <td className="font-medium text-gray-900 truncate max-w-[120px]">
                      {s.customer?.name ?? '—'}
                    </td>
                    <td className="text-gray-500">{s.brand?.name ?? '—'}</td>
                    <td className="text-gray-500">{formatDate(s.date)}</td>
                    <td className="text-right font-semibold text-gray-900">{formatCurrency(s.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
