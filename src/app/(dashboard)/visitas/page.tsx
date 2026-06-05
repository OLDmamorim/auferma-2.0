'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import PageHeader from '@/components/layout/PageHeader'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

interface Visit {
  id: string
  date: string
  type: string
  result: string | null
  nextAction: string | null
  notes: string | null
  customer: { id: string; name: string; zone: string | null }
  commercial: { id: string; name: string } | null
}

interface Customer {
  id: string
  name: string
}

interface Briefing {
  customer: any
  lastVisit: any
  salesThisYear: number
  salesLast12m: number
  salesCount: number
  monthlySales: { month: number; year: number; total: number }[]
  recentSales: any[]
  pendingTasks: any[]
  trend: number
  daysWithoutPurchase: number | null
  daysWithoutVisit: number | null
  analysis: {
    summary: string
    sentiment: 'positive' | 'neutral' | 'negative'
    alerts: { type: 'danger' | 'warning' | 'success' | 'info'; text: string }[]
    talking_points: string[]
    objectives: string[]
  }
}

const typeConfig: Record<string, { label: string; emoji: string; badgeClass: string }> = {
  VISIT: { label: 'Visita Presencial', emoji: '🏢', badgeClass: 'badge-blue' },
  CALL: { label: 'Chamada Telefónica', emoji: '📞', badgeClass: 'badge-green' },
  EMAIL: { label: 'Email', emoji: '📧', badgeClass: 'badge-gray' },
  WHATSAPP: { label: 'WhatsApp', emoji: '💬', badgeClass: 'badge-green' },
  OTHER: { label: 'Outro', emoji: '📋', badgeClass: 'badge-gray' },
}

type Mode = 'list' | 'prepare' | 'register'

export default function VisitasPage() {
  const { data: session } = useSession()
  const [mode, setMode] = useState<Mode>('list')
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)

  const fetchVisits = useCallback(() => {
    setLoading(true)
    fetch('/api/visits')
      .then(r => r.json())
      .then(d => { setVisits(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { fetchVisits() }, [fetchVisits])

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Visitas e Contactos"
        subtitle={`${visits.length} registos`}
      />

      {/* Mode selector */}
      {mode === 'list' && (
        <>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <button
              onClick={() => setMode('prepare')}
              className="flex flex-col items-center justify-center gap-3 bg-white border-2 border-blue-200 hover:border-blue-500 hover:shadow-md rounded-2xl p-6 transition group"
            >
              <div className="w-12 h-12 bg-blue-50 group-hover:bg-blue-100 rounded-xl flex items-center justify-center transition">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <div className="text-center">
                <p className="font-semibold text-gray-900">Preparar Visita</p>
                <p className="text-xs text-gray-500 mt-0.5">Análise IA antes da visita</p>
              </div>
            </button>

            <button
              onClick={() => setMode('register')}
              className="flex flex-col items-center justify-center gap-3 bg-white border-2 border-green-200 hover:border-green-500 hover:shadow-md rounded-2xl p-6 transition group"
            >
              <div className="w-12 h-12 bg-green-50 group-hover:bg-green-100 rounded-xl flex items-center justify-center transition">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="font-semibold text-gray-900">Registar Visita</p>
                <p className="text-xs text-gray-500 mt-0.5">Registar contacto realizado</p>
              </div>
            </button>
          </div>

          {/* Visits list */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Tipo</th>
                    <th>Cliente</th>
                    <th className="hidden md:table-cell">Zona</th>
                    <th className="hidden md:table-cell">Comercial</th>
                    <th>Resultado</th>
                    <th className="hidden lg:table-cell">Próxima Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array(8).fill(0).map((_, i) => (
                        <tr key={i}>
                          {Array(7).fill(0).map((_, j) => <td key={j}><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}
                        </tr>
                      ))
                    : visits.map(visit => {
                        const tc = typeConfig[visit.type] || typeConfig.OTHER
                        return (
                          <tr key={visit.id}>
                            <td className="text-sm text-gray-600 whitespace-nowrap">{formatDate(visit.date)}</td>
                            <td>
                              <span className={`badge ${tc.badgeClass}`}>
                                {tc.emoji} <span className="hidden sm:inline">{tc.label}</span>
                              </span>
                            </td>
                            <td>
                              <Link href={`/clientes/${visit.customer.id}`} className="font-medium text-gray-900 hover:text-blue-700 text-sm">
                                {visit.customer.name}
                              </Link>
                            </td>
                            <td className="hidden md:table-cell text-sm text-gray-500">{visit.customer.zone || '—'}</td>
                            <td className="hidden md:table-cell text-sm text-gray-600">{visit.commercial?.name || '—'}</td>
                            <td className="text-sm text-gray-600 max-w-xs">
                              <p className="truncate">{visit.result || '—'}</p>
                            </td>
                            <td className="hidden lg:table-cell text-sm text-blue-700">
                              <p className="truncate max-w-xs">{visit.nextAction || '—'}</p>
                            </td>
                          </tr>
                        )
                      })}
                  {!loading && visits.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center text-gray-400 py-12 text-sm">
                        Nenhum contacto registado ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {mode === 'prepare' && (
        <PrepareVisitView onBack={() => setMode('list')} />
      )}

      {mode === 'register' && (
        <RegisterVisitView
          onBack={() => setMode('list')}
          onSaved={() => { setMode('list'); fetchVisits() }}
          session={session}
        />
      )}
    </div>
  )
}

function PrepareVisitView({ onBack }: { onBack: () => void }) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerId, setCustomerId] = useState('')
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [loadingBriefing, setLoadingBriefing] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/customers?limit=200').then(r => r.json()).then(d => setCustomers(d.customers || []))
  }, [])

  useEffect(() => {
    if (!customerId) { setBriefing(null); return }
    setLoadingBriefing(true)
    fetch(`/api/visits/briefing?customerId=${customerId}`)
      .then(r => r.json())
      .then(d => { setBriefing(d); setLoadingBriefing(false) })
      .catch(() => setLoadingBriefing(false))
  }, [customerId])

  const filtered = search
    ? customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : customers

  const alertColors: Record<string, string> = {
    danger: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    success: 'bg-green-50 border-green-200 text-green-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  }
  const alertIcons: Record<string, string> = {
    danger: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    success: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  }

  const sentimentConfig = {
    positive: { label: 'Cliente Positivo', bg: 'bg-green-500', dot: 'bg-green-400' },
    neutral: { label: 'Cliente Estável', bg: 'bg-blue-500', dot: 'bg-blue-400' },
    negative: { label: 'Requer Atenção', bg: 'bg-red-500', dot: 'bg-red-400' },
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-700 transition">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Preparar Visita</h2>
          <p className="text-xs text-gray-500">Selecione um cliente para ver a análise IA</p>
        </div>
      </div>

      {/* Customer search */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">Cliente a visitar</label>
        <input
          type="text"
          placeholder="Pesquisar cliente..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
        />
        <select
          value={customerId}
          onChange={e => setCustomerId(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Selecionar cliente...</option>
          {filtered.slice(0, 50).map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {loadingBriefing && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-gray-500 text-sm">A preparar briefing...</span>
        </div>
      )}

      {briefing && !loadingBriefing && (
        <div className="space-y-4">
          {/* Sentiment header */}
          <div className={`${sentimentConfig[briefing.analysis.sentiment].bg} rounded-xl p-4 text-white`}>
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-3 h-3 rounded-full ${sentimentConfig[briefing.analysis.sentiment].dot} animate-pulse`} />
              <span className="font-semibold text-sm">{sentimentConfig[briefing.analysis.sentiment].label}</span>
            </div>
            <p className="text-sm text-white/90 leading-relaxed">{briefing.analysis.summary}</p>
          </div>

          {/* Alerts */}
          {briefing.analysis.alerts.length > 0 && (
            <div className="space-y-2">
              {briefing.analysis.alerts.map((alert, i) => (
                <div key={i} className={`flex items-start gap-3 border rounded-lg px-4 py-3 text-sm ${alertColors[alert.type]}`}>
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={alertIcons[alert.type]} />
                  </svg>
                  <span>{alert.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="kpi-card text-center">
              <p className="text-lg font-bold text-gray-900">€{briefing.salesThisYear.toFixed(0)}</p>
              <p className="text-xs text-gray-500 mt-0.5">Vendas este ano</p>
            </div>
            <div className="kpi-card text-center">
              <p className="text-lg font-bold text-gray-900">€{briefing.salesLast12m.toFixed(0)}</p>
              <p className="text-xs text-gray-500 mt-0.5">Últimos 12 meses</p>
            </div>
            <div className="kpi-card text-center">
              <p className={`text-lg font-bold ${briefing.trend > 0 ? 'text-green-600' : briefing.trend < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {briefing.trend > 0 ? '+' : ''}{briefing.trend.toFixed(0)}%
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Tendência</p>
            </div>
            <div className="kpi-card text-center">
              <p className="text-lg font-bold text-gray-900">{briefing.daysWithoutPurchase ?? '—'}</p>
              <p className="text-xs text-gray-500 mt-0.5">Dias sem compra</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Talking points */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Pontos de Conversa
              </h3>
              <ul className="space-y-2">
                {briefing.analysis.talking_points.map((pt, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-blue-400 mt-0.5 flex-shrink-0">•</span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Objectives */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                Objetivos da Visita
              </h3>
              <ul className="space-y-2">
                {briefing.analysis.objectives.map((obj, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="w-5 h-5 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                    <span>{obj}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Last visit */}
          {briefing.lastVisit && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Última Visita
              </h3>
              <div className="text-sm text-gray-600 space-y-1">
                <p><span className="font-medium text-gray-700">Data:</span> {formatDate(briefing.lastVisit.date)}</p>
                {briefing.lastVisit.commercial && <p><span className="font-medium text-gray-700">Comercial:</span> {briefing.lastVisit.commercial.name}</p>}
                {briefing.lastVisit.result && <p><span className="font-medium text-gray-700">Resultado:</span> {briefing.lastVisit.result}</p>}
                {briefing.lastVisit.nextAction && (
                  <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <p className="text-amber-800 text-xs font-medium">Ação pendente da visita anterior:</p>
                    <p className="text-amber-700 text-sm mt-0.5">{briefing.lastVisit.nextAction}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pending tasks */}
          {briefing.pendingTasks.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Tarefas Pendentes ({briefing.pendingTasks.length})
              </h3>
              <div className="space-y-2">
                {briefing.pendingTasks.map((task: any) => (
                  <div key={task.id} className="flex items-start gap-3 text-sm">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${task.priority === 'HIGH' || task.priority === 'URGENT' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                      {task.priority}
                    </span>
                    <span className="text-gray-700">{task.title}</span>
                    {task.dueDate && <span className="text-gray-400 ml-auto flex-shrink-0">{formatDate(task.dueDate)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent sales */}
          {briefing.recentSales.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 7H4l1-7z" />
                </svg>
                Últimas Encomendas
              </h3>
              <div className="space-y-2">
                {briefing.recentSales.map((sale: any) => (
                  <div key={sale.id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="text-gray-700 font-medium">{sale.brand?.name || 'Sem marca'}</span>
                      <span className="text-gray-400 ml-2">{formatDate(sale.date)}</span>
                    </div>
                    <span className="font-semibold text-gray-900">€{sale.total?.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function RegisterVisitView({ onBack, onSaved, session }: { onBack: () => void; onSaved: () => void; session: any }) {
  const [form, setForm] = useState({
    customerId: '',
    date: new Date().toISOString().split('T')[0],
    type: 'VISIT',
    result: '',
    nextAction: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [done, setDone] = useState(false)

  useEffect(() => {
    fetch('/api/customers?limit=200').then(r => r.json()).then(d => setCustomers(d.customers || []))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        date: new Date(form.date),
        result: form.result || undefined,
        nextAction: form.nextAction || undefined,
        notes: form.notes || undefined,
        commercialId: (session?.user as any)?.id,
      }),
    })
    setDone(true)
    setTimeout(onSaved, 1200)
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
          <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-gray-700 font-medium">Visita registada com sucesso!</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-700 transition">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Registar Visita</h2>
          <p className="text-xs text-gray-500">Registe o contacto realizado</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Cliente *</label>
            <select
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.customerId}
              onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}
            >
              <option value="">Selecionar cliente...</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Data *</label>
              <input
                required
                type="date"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Tipo *</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              >
                <option value="VISIT">🏢 Visita Presencial</option>
                <option value="CALL">📞 Chamada Telefónica</option>
                <option value="EMAIL">📧 Email</option>
                <option value="WHATSAPP">💬 WhatsApp</option>
                <option value="OTHER">📋 Outro</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Resultado</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Como correu o contacto?"
              value={form.result}
              onChange={e => setForm(f => ({ ...f, result: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Próxima Ação</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="O que fazer a seguir?"
              value={form.nextAction}
              onChange={e => setForm(f => ({ ...f, nextAction: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notas</label>
            <textarea
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Observações adicionais..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-700 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-60"
            >
              {saving ? 'A guardar...' : 'Registar Visita'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
