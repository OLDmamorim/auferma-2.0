'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import PageHeader from '@/components/layout/PageHeader'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

interface Deal {
  id: string
  title: string
  value: number
  stage: string
  probability: number
  expectedDate: string | null
  notes: string | null
  customer: { id: string; name: string; zone: string | null }
  commercial: { id: string; name: string } | null
  createdAt: string
}

interface Customer { id: string; name: string }

const STAGES: { key: string; label: string; color: string; bg: string; border: string }[] = [
  { key: 'PROSPECTING',   label: 'Prospeção',    color: 'text-gray-600',   bg: 'bg-gray-50',   border: 'border-gray-200' },
  { key: 'PROPOSAL_SENT', label: 'Proposta Env.', color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  { key: 'NEGOTIATION',   label: 'Negociação',   color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  { key: 'ACCEPTED',      label: 'Aceite',        color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  { key: 'CLOSED_WON',    label: 'Ganho',         color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200' },
  { key: 'CLOSED_LOST',   label: 'Perdido',       color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200' },
]

const PROB_DEFAULTS: Record<string, number> = {
  PROSPECTING: 20, PROPOSAL_SENT: 40, NEGOTIATION: 60, ACCEPTED: 80, CLOSED_WON: 100, CLOSED_LOST: 0,
}

export default function PipelinePage() {
  const { data: session } = useSession()
  const [data, setData] = useState<{ deals: Deal[]; summary: Record<string, { count: number; value: number }>; pipelineValue: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editDeal, setEditDeal] = useState<Deal | null>(null)
  const [view, setView] = useState<'kanban' | 'list'>('kanban')

  const fetchData = useCallback(() => {
    setLoading(true)
    fetch('/api/pipeline').then(r => r.json()).then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function updateStage(dealId: string, stage: string) {
    await fetch('/api/pipeline', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: dealId, stage, probability: PROB_DEFAULTS[stage] }),
    })
    fetchData()
  }

  async function deleteDeal(id: string) {
    if (!confirm('Eliminar esta oportunidade?')) return
    await fetch(`/api/pipeline?id=${id}`, { method: 'DELETE' })
    fetchData()
  }

  const activePipelineValue = data?.pipelineValue || 0

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Pipeline Comercial"
        subtitle={`Valor ponderado em pipeline: €${activePipelineValue.toFixed(0)}`}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              <button onClick={() => setView('kanban')} className={`px-3 py-1.5 text-xs font-medium transition ${view === 'kanban' ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>Kanban</button>
              <button onClick={() => setView('list')} className={`px-3 py-1.5 text-xs font-medium transition ${view === 'list' ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>Lista</button>
            </div>
            <button
              onClick={() => { setEditDeal(null); setShowModal(true) }}
              className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Nova Oportunidade
            </button>
          </div>
        }
      />

      {/* Stage summary */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-5">
        {STAGES.map(s => {
          const sum = data?.summary[s.key]
          return (
            <div key={s.key} className={`rounded-xl border p-3 ${s.bg} ${s.border}`}>
              <p className={`text-xs font-medium ${s.color} mb-1`}>{s.label}</p>
              <p className="text-lg font-bold text-gray-900">{sum?.count || 0}</p>
              <p className="text-xs text-gray-500">€{(sum?.value || 0).toFixed(0)}</p>
            </div>
          )
        })}
      </div>

      {view === 'kanban' ? (
        <KanbanView deals={data?.deals || []} loading={loading} onStageChange={updateStage} onEdit={d => { setEditDeal(d); setShowModal(true) }} onDelete={deleteDeal} />
      ) : (
        <ListView deals={data?.deals || []} loading={loading} onEdit={d => { setEditDeal(d); setShowModal(true) }} onDelete={deleteDeal} onStageChange={updateStage} />
      )}

      {showModal && (
        <DealModal
          deal={editDeal}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchData() }}
          session={session}
        />
      )}
    </div>
  )
}

function KanbanView({ deals, loading, onStageChange, onEdit, onDelete }: {
  deals: Deal[]; loading: boolean
  onStageChange: (id: string, stage: string) => void
  onEdit: (d: Deal) => void
  onDelete: (id: string) => void
}) {
  const activeStages = STAGES.filter(s => !['CLOSED_WON', 'CLOSED_LOST'].includes(s.key))

  if (loading) return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {activeStages.map(s => (
        <div key={s.key} className="w-64 flex-shrink-0">
          <div className={`rounded-xl border p-3 ${s.bg} ${s.border} mb-3`}>
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
          </div>
          {Array(2).fill(0).map((_, i) => <div key={i} className="h-24 bg-white rounded-xl border border-gray-100 mb-2 animate-pulse" />)}
        </div>
      ))}
    </div>
  )

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {activeStages.map(s => {
        const stagDeals = deals.filter(d => d.stage === s.key)
        return (
          <div key={s.key} className="w-64 flex-shrink-0">
            <div className={`rounded-xl border px-3 py-2 ${s.bg} ${s.border} mb-2 flex items-center justify-between`}>
              <span className={`text-xs font-semibold ${s.color}`}>{s.label}</span>
              <span className="text-xs text-gray-500">{stagDeals.length} · €{stagDeals.reduce((a, d) => a + d.value, 0).toFixed(0)}</span>
            </div>
            <div className="space-y-2">
              {stagDeals.map(deal => (
                <DealCard key={deal.id} deal={deal} onEdit={onEdit} onDelete={onDelete} onStageChange={onStageChange} />
              ))}
              {stagDeals.length === 0 && (
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center text-xs text-gray-400">
                  Sem oportunidades
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DealCard({ deal, onEdit, onDelete, onStageChange }: {
  deal: Deal
  onEdit: (d: Deal) => void
  onDelete: (id: string) => void
  onStageChange: (id: string, stage: string) => void
}) {
  const currentIdx = STAGES.findIndex(s => s.key === deal.stage)
  const nextStage = STAGES[currentIdx + 1]
  const prevStage = STAGES[currentIdx - 1]

  return (
    <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-3 group">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-gray-900 leading-tight">{deal.title}</p>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
          <button onClick={() => onEdit(deal)} className="text-gray-400 hover:text-blue-600 p-0.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          </button>
          <button onClick={() => onDelete(deal.id)} className="text-gray-400 hover:text-red-600 p-0.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      </div>
      <Link href={`/clientes/${deal.customer.id}`} className="text-xs text-blue-600 hover:underline">{deal.customer.name}</Link>
      <div className="flex items-center justify-between mt-2">
        <span className="text-sm font-bold text-gray-900">€{deal.value.toFixed(0)}</span>
        <span className="text-xs text-gray-400">{deal.probability}%</span>
      </div>
      {deal.expectedDate && (
        <p className="text-xs text-gray-400 mt-1">{formatDate(deal.expectedDate)}</p>
      )}
      <div className="flex gap-1 mt-2 pt-2 border-t border-gray-50">
        {prevStage && (
          <button onClick={() => onStageChange(deal.id, prevStage.key)} className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-0.5">
            ← {prevStage.label}
          </button>
        )}
        {nextStage && (
          <button onClick={() => onStageChange(deal.id, nextStage.key)} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-0.5 ml-auto">
            {nextStage.label} →
          </button>
        )}
      </div>
    </div>
  )
}

function ListView({ deals, loading, onEdit, onDelete, onStageChange }: {
  deals: Deal[]; loading: boolean
  onEdit: (d: Deal) => void
  onDelete: (id: string) => void
  onStageChange: (id: string, stage: string) => void
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Oportunidade</th>
              <th>Cliente</th>
              <th>Fase</th>
              <th>Valor</th>
              <th>Prob.</th>
              <th className="hidden md:table-cell">Fecho previsto</th>
              <th className="hidden md:table-cell">Comercial</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? Array(5).fill(0).map((_, i) => (
              <tr key={i}>{Array(8).fill(0).map((_, j) => <td key={j}><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}</tr>
            )) : deals.map(deal => {
              const s = STAGES.find(st => st.key === deal.stage)!
              return (
                <tr key={deal.id}>
                  <td className="font-medium text-gray-900 text-sm">{deal.title}</td>
                  <td><Link href={`/clientes/${deal.customer.id}`} className="text-sm text-blue-600 hover:underline">{deal.customer.name}</Link></td>
                  <td>
                    <span className={`badge text-xs px-2 py-0.5 ${s.bg} ${s.color} border ${s.border}`}>{s.label}</span>
                  </td>
                  <td className="text-sm font-semibold text-gray-900">€{deal.value.toFixed(0)}</td>
                  <td className="text-sm text-gray-600">{deal.probability}%</td>
                  <td className="hidden md:table-cell text-sm text-gray-500">{deal.expectedDate ? formatDate(deal.expectedDate) : '—'}</td>
                  <td className="hidden md:table-cell text-sm text-gray-500">{deal.commercial?.name || '—'}</td>
                  <td>
                    <div className="flex gap-2">
                      <button onClick={() => onEdit(deal)} className="text-gray-400 hover:text-blue-600">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      <button onClick={() => onDelete(deal.id)} className="text-gray-400 hover:text-red-600">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {!loading && deals.length === 0 && (
              <tr><td colSpan={8} className="text-center text-gray-400 py-12 text-sm">Nenhuma oportunidade criada ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DealModal({ deal, onClose, onSaved, session }: { deal: Deal | null; onClose: () => void; onSaved: () => void; session: any }) {
  const [form, setForm] = useState({
    customerId: deal?.customer.id || '',
    title: deal?.title || '',
    value: deal?.value?.toString() || '',
    stage: deal?.stage || 'PROSPECTING',
    probability: deal?.probability?.toString() || '20',
    expectedDate: deal?.expectedDate ? deal.expectedDate.split('T')[0] : '',
    notes: deal?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])

  useEffect(() => {
    fetch('/api/customers?limit=200').then(r => r.json()).then(d => setCustomers(d.customers || []))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    if (deal) {
      await fetch('/api/pipeline', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deal.id, ...form }),
      })
    } else {
      await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{deal ? 'Editar Oportunidade' : 'Nova Oportunidade'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Cliente *</label>
            <select required className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}>
              <option value="">Selecionar...</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Título / Descrição *</label>
            <input required className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: Proposta Beko linha branca" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Valor (€) *</label>
              <input required type="number" step="0.01" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.00" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Probabilidade (%)</label>
              <input type="number" min="0" max="100" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.probability} onChange={e => setForm(f => ({ ...f, probability: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Fase</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value, probability: String(PROB_DEFAULTS[e.target.value]) }))}>
                {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Data prevista de fecho</label>
              <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.expectedDate} onChange={e => setForm(f => ({ ...f, expectedDate: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notas</label>
            <textarea rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 bg-blue-700 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-60">
              {saving ? 'A guardar...' : deal ? 'Guardar' : 'Criar Oportunidade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
