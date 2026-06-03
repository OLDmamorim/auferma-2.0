'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency, formatDate, daysAgo, getRiskLabel, getPotentialLabel } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'

interface CustomerDetail {
  id: string
  name: string
  nif: string | null
  zone: string | null
  phone: string | null
  email: string | null
  address: string | null
  status: string
  type: string
  riskScore: number
  potentialScore: number
  lastPurchaseDate: string | null
  lastVisitDate: string | null
  notes: string | null
  commercial: { id: string; name: string; email: string } | null
  sales: {
    id: string; date: string; total: number; margin: number | null
    brand: { name: string } | null
    items: { id: string; quantity: number; unitPrice: number; product: { name: string } | null }[]
  }[]
  tasks: {
    id: string; title: string; status: string; priority: string; dueDate: string | null
    assignedTo: { name: string } | null
  }[]
  visits: {
    id: string; date: string; type: string; result: string | null; notes: string | null
    commercial: { name: string } | null
  }[]
  recommendations: { id: string; type: string; title: string; description: string; priority: number }[]
  monthlySales: { year: number; month: number; total: number }[]
}

const statusMap: Record<string, { label: string; class: string }> = {
  ACTIVE: { label: 'Ativo', class: 'badge-green' },
  INACTIVE: { label: 'Inativo', class: 'badge-gray' },
  AT_RISK: { label: 'Em Risco', class: 'badge-red' },
  PROSPECT: { label: 'Prospeção', class: 'badge-blue' },
}

const contactTypeMap: Record<string, string> = {
  VISIT: '🏢 Visita', CALL: '📞 Chamada', EMAIL: '📧 Email', WHATSAPP: '💬 WhatsApp', OTHER: '📋 Outro'
}

const taskStatusMap: Record<string, { label: string; class: string }> = {
  PENDING: { label: 'Pendente', class: 'badge-orange' },
  IN_PROGRESS: { label: 'Em Curso', class: 'badge-blue' },
  COMPLETED: { label: 'Concluída', class: 'badge-green' },
  CANCELLED: { label: 'Cancelada', class: 'badge-gray' },
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-8 text-right">{value.toFixed(0)}</span>
    </div>
  )
}

export default function ClientePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [activeTab, setActiveTab] = useState<'vendas' | 'visitas' | 'tarefas'>('vendas')

  useEffect(() => {
    fetch(`/api/customers/${id}`)
      .then(r => r.json())
      .then(d => {
        setCustomer(d)
        setNotes(d.notes || '')
        setLoading(false)
      })
  }, [id])

  async function saveNotes() {
    setSavingNotes(true)
    await fetch(`/api/customers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    })
    setSavingNotes(false)
  }

  const monthlyData = (customer?.monthlySales || []).map(m => ({
    month: `${m.month}/${m.year}`,
    total: m.total,
  }))

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-100 rounded w-64" />
          <div className="grid grid-cols-3 gap-4">
            {Array(3).fill(0).map((_, i) => <div key={i} className="h-48 bg-gray-100 rounded-xl" />)}
          </div>
        </div>
      </div>
    )
  }

  if (!customer) return <div className="p-6 text-gray-500">Cliente não encontrado.</div>

  const st = statusMap[customer.status] || { label: customer.status, class: 'badge-gray' }
  const riskLabel = getRiskLabel(customer.riskScore)
  const potLabel = getPotentialLabel(customer.potentialScore)
  const totalSales12m = customer.sales.reduce((s, sale) => s + sale.total, 0)

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">{customer.name}</h1>
            <span className={`badge ${st.class}`}>{st.label}</span>
          </div>
          <p className="text-sm text-gray-500">
            {customer.zone && `${customer.zone} · `}
            {customer.nif && `NIF: ${customer.nif} · `}
            Cliente 360°
          </p>
        </div>
        <Link
          href={`/visitas?customerId=${customer.id}`}
          className="flex items-center gap-2 bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800 transition"
        >
          Registar Visita
        </Link>
        <Link
          href={`/tarefas?customerId=${customer.id}`}
          className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 transition"
        >
          Nova Tarefa
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column */}
        <div className="space-y-4">
          {/* Info Card */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Informação</h3>
            <div className="space-y-3 text-sm">
              {customer.phone && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Telefone</span>
                  <span className="font-medium text-gray-900">{customer.phone}</span>
                </div>
              )}
              {customer.email && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Email</span>
                  <span className="font-medium text-gray-900 truncate max-w-32">{customer.email}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Comercial</span>
                <span className="font-medium text-gray-900">{customer.commercial?.name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tipo</span>
                <span className="font-medium text-gray-900">{customer.type}</span>
              </div>
              <div className="border-t border-gray-50 pt-3">
                <div className="flex justify-between mb-1">
                  <span className="text-gray-500">Última compra</span>
                  <span className={`font-medium ${daysAgo(customer.lastPurchaseDate) > 60 ? 'text-red-600' : 'text-gray-900'}`}>
                    {customer.lastPurchaseDate ? formatDate(customer.lastPurchaseDate) : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Última visita</span>
                  <span className={`font-medium ${daysAgo(customer.lastVisitDate) > 30 ? 'text-orange-500' : 'text-gray-900'}`}>
                    {customer.lastVisitDate ? formatDate(customer.lastVisitDate) : '—'}
                  </span>
                </div>
              </div>
              <div className="border-t border-gray-50 pt-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Vendas (12m)</span>
                  <span className="font-bold text-gray-900">{formatCurrency(totalSales12m)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Scores */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Scores</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs text-gray-500">Score de Risco</span>
                  <span className={`text-xs font-semibold ${riskLabel.color}`}>{riskLabel.label}</span>
                </div>
                <ScoreBar value={customer.riskScore} color={customer.riskScore > 50 ? 'bg-red-500' : customer.riskScore > 25 ? 'bg-orange-400' : 'bg-green-500'} />
              </div>
              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs text-gray-500">Score de Potencial</span>
                  <span className={`text-xs font-semibold ${potLabel.color}`}>{potLabel.label}</span>
                </div>
                <ScoreBar value={customer.potentialScore} color={customer.potentialScore > 60 ? 'bg-green-500' : customer.potentialScore > 35 ? 'bg-blue-500' : 'bg-gray-400'} />
              </div>
            </div>
          </div>

          {/* Recommendations */}
          {customer.recommendations.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Recomendações IA</h3>
              <div className="space-y-3">
                {customer.recommendations.map(r => (
                  <div key={r.id} className="bg-blue-50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-blue-800">{r.title}</p>
                    <p className="text-xs text-blue-700 mt-0.5">{r.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Notas Comerciais</h3>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Adicione notas sobre este cliente..."
            />
            <button
              onClick={saveNotes}
              disabled={savingNotes}
              className="mt-2 w-full bg-gray-900 text-white py-2 rounded-lg text-xs font-medium hover:bg-gray-800 transition disabled:opacity-60"
            >
              {savingNotes ? 'A guardar...' : 'Guardar Notas'}
            </button>
          </div>
        </div>

        {/* Right Column (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Monthly Sales Chart */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Evolução de Compras (12 meses)</h3>
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-40 flex items-center justify-center text-gray-400 text-sm">Sem dados de vendas</div>
            )}
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex border-b border-gray-100">
              {(['vendas', 'visitas', 'tarefas'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-3 text-sm font-medium capitalize transition ${
                    activeTab === tab
                      ? 'text-blue-700 border-b-2 border-blue-700 bg-blue-50/50'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'vendas' ? `Vendas (${customer.sales.length})` :
                   tab === 'visitas' ? `Visitas (${customer.visits.length})` :
                   `Tarefas (${customer.tasks.length})`}
                </button>
              ))}
            </div>

            <div className="p-4">
              {activeTab === 'vendas' && (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Marca</th>
                      <th>Produtos</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customer.sales.slice(0, 15).map(sale => (
                      <tr key={sale.id}>
                        <td className="text-sm">{formatDate(sale.date)}</td>
                        <td><span className="badge badge-blue">{sale.brand?.name || '—'}</span></td>
                        <td className="text-xs text-gray-500">{sale.items.length} itens</td>
                        <td className="text-right font-semibold text-gray-900">{formatCurrency(sale.total)}</td>
                      </tr>
                    ))}
                    {customer.sales.length === 0 && (
                      <tr><td colSpan={4} className="text-center text-gray-400 py-8">Sem vendas registadas</td></tr>
                    )}
                  </tbody>
                </table>
              )}

              {activeTab === 'visitas' && (
                <div className="space-y-3">
                  {customer.visits.map(v => (
                    <div key={v.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="text-xl">{contactTypeMap[v.type]?.split(' ')[0] || '📋'}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900">{contactTypeMap[v.type] || v.type}</span>
                          <span className="text-xs text-gray-400">{formatDate(v.date)}</span>
                        </div>
                        {v.result && <p className="text-xs text-gray-600 mt-0.5">{v.result}</p>}
                        {v.notes && <p className="text-xs text-gray-400 mt-0.5">{v.notes}</p>}
                        <p className="text-xs text-gray-400 mt-1">Por: {v.commercial?.name || '—'}</p>
                      </div>
                    </div>
                  ))}
                  {customer.visits.length === 0 && (
                    <div className="text-center text-gray-400 py-8 text-sm">Sem visitas registadas</div>
                  )}
                </div>
              )}

              {activeTab === 'tarefas' && (
                <div className="space-y-3">
                  {customer.tasks.map(t => {
                    const ts = taskStatusMap[t.status] || { label: t.status, class: 'badge-gray' }
                    return (
                      <div key={t.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-gray-900">{t.title}</span>
                            <span className={`badge ${ts.class}`}>{ts.label}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            {t.dueDate && <span className="text-xs text-gray-400">Prazo: {formatDate(t.dueDate)}</span>}
                            {t.assignedTo && <span className="text-xs text-gray-400">→ {t.assignedTo.name}</span>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {customer.tasks.length === 0 && (
                    <div className="text-center text-gray-400 py-8 text-sm">Sem tarefas registadas</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
