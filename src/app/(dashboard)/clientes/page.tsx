'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import PageHeader from '@/components/layout/PageHeader'
import { formatCurrency, formatDate, daysAgo } from '@/lib/utils'

interface Customer {
  id: string
  name: string
  nif: string | null
  zone: string | null
  status: string
  type: string
  riskScore: number
  potentialScore: number
  lastPurchaseDate: string | null
  lastVisitDate: string | null
  commercial: { id: string; name: string } | null
  _count: { sales: number; tasks: number; visits: number }
}

const statusLabels: Record<string, { label: string; class: string }> = {
  ACTIVE: { label: 'Ativo', class: 'badge-green' },
  INACTIVE: { label: 'Inativo', class: 'badge-gray' },
  AT_RISK: { label: 'Em Risco', class: 'badge-red' },
  PROSPECT: { label: 'Prospeção', class: 'badge-blue' },
}

const typeLabels: Record<string, string> = {
  KEY_ACCOUNT: 'Key Account',
  STANDARD: 'Standard',
  SMALL: 'Pequeno',
  PROSPECT: 'Prospeção',
}

export default function ClientesPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)

  const fetchCustomers = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (search) params.set('search', search)
    if (status) params.set('status', status)
    fetch(`/api/customers?${params}`)
      .then(r => r.json())
      .then(d => {
        setCustomers(d.customers || [])
        setTotal(d.total || 0)
        setPages(d.pages || 1)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [page, search, status])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])

  // Debounced search
  const [searchInput, setSearchInput] = useState('')
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  return (
    <div className="p-6">
      <PageHeader
        title="Clientes"
        subtitle={`${total} clientes no total`}
        actions={
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Novo Cliente
          </button>
        }
      />

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text"
            placeholder="Pesquisar clientes..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1) }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos os estados</option>
          <option value="ACTIVE">Ativos</option>
          <option value="AT_RISK">Em Risco</option>
          <option value="INACTIVE">Inativos</option>
          <option value="PROSPECT">Prospeção</option>
        </select>
        <span className="text-xs text-gray-500">{total} resultados</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>NIF</th>
                <th>Zona</th>
                <th>Comercial</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Última Compra</th>
                <th>Última Visita</th>
                <th>Risco</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array(8).fill(0).map((_, i) => (
                    <tr key={i}>
                      {Array(9).fill(0).map((_, j) => (
                        <td key={j}><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                : customers.map(c => {
                    const daysSincePurchase = daysAgo(c.lastPurchaseDate)
                    const daysSinceVisit = daysAgo(c.lastVisitDate)
                    const st = statusLabels[c.status] || { label: c.status, class: 'badge-gray' }
                    return (
                      <tr key={c.id}>
                        <td>
                          <Link href={`/clientes/${c.id}`} className="font-medium text-gray-900 hover:text-blue-700">
                            {c.name}
                          </Link>
                          <div className="text-xs text-gray-400">{c._count.sales} compras</div>
                        </td>
                        <td className="text-gray-500 font-mono text-xs">{c.nif || '—'}</td>
                        <td className="text-gray-600">{c.zone || '—'}</td>
                        <td className="text-gray-600">{c.commercial?.name || '—'}</td>
                        <td><span className="text-xs text-gray-500">{typeLabels[c.type] || c.type}</span></td>
                        <td><span className={`badge ${st.class}`}>{st.label}</span></td>
                        <td>
                          <span className={`text-sm ${daysSincePurchase > 60 ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                            {c.lastPurchaseDate ? formatDate(c.lastPurchaseDate) : '—'}
                          </span>
                          {daysSincePurchase <= 999 && <div className="text-xs text-gray-400">{daysSincePurchase}d atrás</div>}
                        </td>
                        <td>
                          <span className={`text-sm ${daysSinceVisit > 30 ? 'text-orange-500 font-medium' : 'text-gray-600'}`}>
                            {c.lastVisitDate ? formatDate(c.lastVisitDate) : '—'}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-100 rounded-full h-1.5 w-16">
                              <div
                                className={`h-1.5 rounded-full ${c.riskScore > 50 ? 'bg-red-500' : c.riskScore > 25 ? 'bg-orange-400' : 'bg-green-500'}`}
                                style={{ width: `${c.riskScore}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">{c.riskScore.toFixed(0)}</span>
                          </div>
                        </td>
                        <td>
                          <Link href={`/clientes/${c.id}`} className="text-blue-600 hover:text-blue-800 text-xs font-medium">
                            Ver 360°
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Página {page} de {pages}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >
                ← Anterior
              </button>
              <button
                onClick={() => setPage(p => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >
                Próxima →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Customer Modal */}
      {showModal && <NewCustomerModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); fetchCustomers() }} />}
    </div>
  )
}

function NewCustomerModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', nif: '', zone: '', phone: '', email: '', type: 'STANDARD' })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, status: 'ACTIVE' }),
    })
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Novo Cliente</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Nome *</label>
              <input required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">NIF</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.nif} onChange={e => setForm(f => ({...f, nif: e.target.value}))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Zona</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.zone} onChange={e => setForm(f => ({...f, zone: e.target.value}))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Telefone</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input type="email" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Tipo</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))}>
                <option value="STANDARD">Standard</option>
                <option value="KEY_ACCOUNT">Key Account</option>
                <option value="SMALL">Pequeno</option>
                <option value="PROSPECT">Prospeção</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 bg-blue-700 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-800 transition disabled:opacity-60">
              {saving ? 'A guardar...' : 'Criar Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
