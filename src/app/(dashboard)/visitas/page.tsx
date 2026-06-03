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

const typeConfig: Record<string, { label: string; emoji: string; badgeClass: string }> = {
  VISIT: { label: 'Visita Presencial', emoji: '🏢', badgeClass: 'badge-blue' },
  CALL: { label: 'Chamada Telefónica', emoji: '📞', badgeClass: 'badge-green' },
  EMAIL: { label: 'Email', emoji: '📧', badgeClass: 'badge-gray' },
  WHATSAPP: { label: 'WhatsApp', emoji: '💬', badgeClass: 'badge-green' },
  OTHER: { label: 'Outro', emoji: '📋', badgeClass: 'badge-gray' },
}

export default function VisitasPage() {
  const { data: session } = useSession()
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const fetchVisits = useCallback(() => {
    setLoading(true)
    fetch('/api/visits')
      .then(r => r.json())
      .then(d => { setVisits(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { fetchVisits() }, [fetchVisits])

  const visitCounts = Object.keys(typeConfig).reduce((acc, key) => {
    acc[key] = visits.filter(v => v.type === key).length
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="p-6">
      <PageHeader
        title="Visitas e Contactos"
        subtitle={`${visits.length} registos`}
        actions={
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Registar Contacto
          </button>
        }
      />

      {/* Type Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        {Object.entries(typeConfig).map(([key, cfg]) => (
          <div key={key} className="kpi-card text-center">
            <div className="text-2xl mb-1">{cfg.emoji}</div>
            <p className="text-xl font-bold text-gray-900">{visitCounts[key] || 0}</p>
            <p className="text-xs text-gray-500 mt-0.5">{cfg.label}</p>
          </div>
        ))}
      </div>

      {/* Visits List */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Cliente</th>
                <th>Zona</th>
                <th>Comercial</th>
                <th>Resultado</th>
                <th>Próxima Ação</th>
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
                        <td className="text-sm text-gray-600">{formatDate(visit.date)}</td>
                        <td>
                          <span className={`badge ${tc.badgeClass}`}>
                            {tc.emoji} {tc.label}
                          </span>
                        </td>
                        <td>
                          <Link href={`/clientes/${visit.customer.id}`} className="font-medium text-gray-900 hover:text-blue-700 text-sm">
                            {visit.customer.name}
                          </Link>
                        </td>
                        <td className="text-sm text-gray-500">{visit.customer.zone || '—'}</td>
                        <td className="text-sm text-gray-600">{visit.commercial?.name || '—'}</td>
                        <td className="text-sm text-gray-600 max-w-xs">
                          <p className="truncate">{visit.result || '—'}</p>
                        </td>
                        <td className="text-sm text-blue-700">
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

      {showModal && (
        <NewVisitModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchVisits() }}
        />
      )}
    </div>
  )
}

function NewVisitModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { data: session } = useSession()
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

  useEffect(() => {
    fetch('/api/customers?limit=100').then(r => r.json()).then(d => setCustomers(d.customers || []))
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
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Registar Contacto</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Cliente *</label>
              <select required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.customerId} onChange={e => setForm(f => ({...f, customerId: e.target.value}))}>
                <option value="">Selecionar cliente...</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Data *</label>
              <input required type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Tipo *</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))}>
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
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Como correu o contacto?" value={form.result} onChange={e => setForm(f => ({...f, result: e.target.value}))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Próxima Ação</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="O que fazer a seguir?" value={form.nextAction} onChange={e => setForm(f => ({...f, nextAction: e.target.value}))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notas</label>
            <textarea rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Observações adicionais..." value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 bg-blue-700 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-60">
              {saving ? 'A guardar...' : 'Registar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
