'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import PageHeader from '@/components/layout/PageHeader'
import Link from 'next/link'

interface Alert {
  id: string
  type: 'danger' | 'warning' | 'info'
  category: 'commercial' | 'customer' | 'target' | 'visit'
  title: string
  message: string
  commercialId?: string
  commercialName?: string
  customerId?: string
  customerName?: string
  createdAt: string
}

const categoryConfig = {
  visit:      { label: 'Visitas',   icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z', color: 'text-purple-500' },
  customer:   { label: 'Clientes',  icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', color: 'text-blue-500' },
  target:     { label: 'Metas',     icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', color: 'text-green-500' },
  commercial: { label: 'Comerciais',icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', color: 'text-indigo-500' },
}

export default function AlertasPage() {
  const { data: session } = useSession()
  const [data, setData] = useState<{ alerts: Alert[]; counts: { danger: number; warning: number; total: number } } | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'danger' | 'warning' | 'visit' | 'customer' | 'target'>('all')

  const fetchAlerts = useCallback(() => {
    setLoading(true)
    fetch('/api/alertas').then(r => r.json()).then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  useEffect(() => { fetchAlerts() }, [fetchAlerts])

  const alerts = (data?.alerts || []).filter(a => {
    if (filter === 'all') return true
    if (filter === 'danger' || filter === 'warning') return a.type === filter
    return a.category === filter
  })

  const counts = data?.counts || { danger: 0, warning: 0, total: 0 }

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Centro de Alertas"
        subtitle="Monitorização em tempo real de situações que requerem atenção"
        actions={
          <button onClick={fetchAlerts} className="flex items-center gap-2 border border-gray-200 bg-white text-gray-600 px-3 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Atualizar
          </button>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="kpi-card text-center">
          <p className="text-2xl font-bold text-gray-900">{counts.total}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total de alertas</p>
        </div>
        <button onClick={() => setFilter(filter === 'danger' ? 'all' : 'danger')} className={`kpi-card text-center transition cursor-pointer ${filter === 'danger' ? 'ring-2 ring-red-400' : ''}`}>
          <p className="text-2xl font-bold text-red-600">{counts.danger}</p>
          <p className="text-xs text-gray-500 mt-0.5">Críticos</p>
        </button>
        <button onClick={() => setFilter(filter === 'warning' ? 'all' : 'warning')} className={`kpi-card text-center transition cursor-pointer ${filter === 'warning' ? 'ring-2 ring-amber-400' : ''}`}>
          <p className="text-2xl font-bold text-amber-600">{counts.warning}</p>
          <p className="text-xs text-gray-500 mt-0.5">Avisos</p>
        </button>
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(['all', 'visit', 'customer', 'target'] as const).map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filter === cat ? 'bg-blue-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {cat === 'all' ? 'Todos' : categoryConfig[cat].label}
          </button>
        ))}
      </div>

      {/* Alerts list */}
      <div className="space-y-3">
        {loading ? Array(5).fill(0).map((_, i) => (
          <div key={i} className="h-16 bg-white rounded-xl border border-gray-100 animate-pulse" />
        )) : alerts.map(alert => {
          const cat = categoryConfig[alert.category]
          const borderColor = alert.type === 'danger' ? 'border-l-red-500' : 'border-l-amber-500'
          const bgPing = alert.type === 'danger' ? 'bg-red-500' : 'bg-amber-500'

          return (
            <div key={alert.id} className={`bg-white border border-gray-100 border-l-4 ${borderColor} shadow-sm rounded-xl px-4 py-3 flex items-start gap-3`}>
              <div className="mt-0.5 flex-shrink-0">
                <svg className={`w-5 h-5 ${cat.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={cat.icon} />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${alert.type === 'danger' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    {alert.type === 'danger' ? '🔴 Crítico' : '🟡 Aviso'}
                  </span>
                  <span className="text-xs text-gray-400">{cat.label}</span>
                </div>
                <p className="text-sm font-medium text-gray-900">{alert.title}</p>
                <p className="text-xs text-gray-600 mt-0.5">{alert.message}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  {alert.commercialName && (
                    <span className="text-xs text-gray-400">👤 {alert.commercialName}</span>
                  )}
                  {alert.customerId && (
                    <Link href={`/clientes/${alert.customerId}`} className="text-xs text-blue-600 hover:underline">
                      Ver cliente →
                    </Link>
                  )}
                </div>
              </div>
              <div className={`w-2 h-2 rounded-full ${bgPing} flex-shrink-0 mt-1.5 ${alert.type === 'danger' ? 'animate-pulse' : ''}`} />
            </div>
          )
        })}

        {!loading && alerts.length === 0 && (
          <div className="text-center py-16">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="font-semibold text-gray-700">Nenhum alerta ativo</p>
            <p className="text-sm text-gray-400 mt-1">Tudo em ordem por agora.</p>
          </div>
        )}
      </div>
    </div>
  )
}
