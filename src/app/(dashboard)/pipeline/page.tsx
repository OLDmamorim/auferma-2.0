'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import PageHeader from '@/components/layout/PageHeader'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

interface Proposal {
  id: string
  title: string
  value: number
  stage: 'SENT' | 'ACCEPTED' | 'LOST'
  expectedDate: string | null
  notes: string | null
  customer: { id: string; name: string; zone: string | null }
  commercial: { id: string; name: string } | null
  createdAt: string
}

interface Customer { id: string; name: string }

const STAGES = [
  { key: 'SENT',     label: 'Enviada',  color: 'text-blue-600',  bg: 'bg-blue-50',  border: 'border-blue-200',  icon: '📤' },
  { key: 'ACCEPTED', label: 'Aceite',   color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', icon: '✅' },
  { key: 'LOST',     label: 'Perdida',  color: 'text-red-600',   bg: 'bg-red-50',   border: 'border-red-200',   icon: '❌' },
]

export default function PropostasPage() {
  const { data: session } = useSession()
  const [data, setData] = useState<{ proposals: Proposal[]; summary: Record<string, { count: number; value: number }> } | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editProposal, setEditProposal] = useState<Proposal | null>(null)
  const [filter, setFilter] = useState<'ALL' | 'SENT' | 'ACCEPTED' | 'LOST'>('ALL')

  const fetchData = useCallback(() => {
    setLoading(true)
    fetch('/api/pipeline').then(r => r.json()).then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function updateStage(id: string, stage: string) {
    await fetch('/api/pipeline', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, stage }),
    })
    fetchData()
  }

  async function deleteProposal(id: string) {
    if (!confirm('Eliminar esta proposta?')) return
    await fetch(`/api/pipeline?id=${id}`, { method: 'DELETE' })
    fetchData()
  }

  const proposals = (data?.proposals || []).filter(p => filter === 'ALL' || p.stage === filter)
  const s = data?.summary || {}

  const totalSent = s.SENT?.value || 0
  const totalAccepted = s.ACCEPTED?.value || 0
  const winRate = (s.SENT?.count || 0) + (s.ACCEPTED?.count || 0) + (s.LOST?.count || 0) > 0
    ? Math.round(((s.ACCEPTED?.count || 0) / ((s.ACCEPTED?.count || 0) + (s.LOST?.count || 0) || 1)) * 100)
    : null

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Propostas"
        subtitle="Acompanhamento de propostas enviadas a clientes"
        actions={
          <button
            onClick={() => { setEditProposal(null); setShowModal(true) }}
            className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Nova Proposta
          </button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="kpi-card text-center">
          <p className="text-xl font-bold text-blue-700">{s.SENT?.count || 0}</p>
          <p className="text-xs text-gray-500 mt-0.5">Em aberto</p>
          <p className="text-xs text-gray-400">€{totalSent.toFixed(0)}</p>
        </div>
        <div className="kpi-card text-center">
          <p className="text-xl font-bold text-green-600">{s.ACCEPTED?.count || 0}</p>
          <p className="text-xs text-gray-500 mt-0.5">Aceites</p>
          <p className="text-xs text-gray-400">€{totalAccepted.toFixed(0)}</p>
        </div>
        <div className="kpi-card text-center">
          <p className="text-xl font-bold text-red-500">{s.LOST?.count || 0}</p>
          <p className="text-xs text-gray-500 mt-0.5">Perdidas</p>
          <p className="text-xs text-gray-400">€{(s.LOST?.value || 0).toFixed(0)}</p>
        </div>
        <div className="kpi-card text-center">
          <p className={`text-xl font-bold ${winRate === null ? 'text-gray-400' : winRate >= 60 ? 'text-green-600' : winRate >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
            {winRate !== null ? `${winRate}%` : '—'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Taxa de sucesso</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4">
        {([['ALL', 'Todas'], ['SENT', '📤 Enviadas'], ['ACCEPTED', '✅ Aceites'], ['LOST', '❌ Perdidas']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filter === key ? 'bg-blue-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Proposals list */}
      <div className="space-y-3">
        {loading ? Array(4).fill(0).map((_, i) => (
          <div key={i} className="h-20 bg-white rounded-xl border border-gray-100 animate-pulse" />
        )) : proposals.map(p => {
          const stage = STAGES.find(s => s.key === p.stage)!
          return (
            <div key={p.id} className="bg-white border border-gray-100 shadow-sm rounded-xl p-4">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${stage.bg} border ${stage.border}`}>
                  {stage.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{p.title}</p>
                      <Link href={`/clientes/${p.customer.id}`} className="text-xs text-blue-600 hover:underline">
                        {p.customer.name}
                        {p.customer.zone && <span className="text-gray-400"> · {p.customer.zone}</span>}
                      </Link>
                    </div>
                    <p className="text-lg font-bold text-gray-900">€{p.value.toFixed(0)}</p>
                  </div>

                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className={`badge text-xs px-2 py-0.5 ${stage.bg} ${stage.color} border ${stage.border}`}>
                      {stage.label}
                    </span>
                    {p.expectedDate && (
                      <span className="text-xs text-gray-400">📅 {formatDate(p.expectedDate)}</span>
                    )}
                    {p.commercial && (
                      <span className="text-xs text-gray-400">👤 {p.commercial.name}</span>
                    )}
                    {p.notes && (
                      <span className="text-xs text-gray-500 italic truncate max-w-xs">{p.notes}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1 flex-shrink-0">
                  {p.stage === 'SENT' && (
                    <>
                      <button
                        onClick={() => updateStage(p.id, 'ACCEPTED')}
                        className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded-lg hover:bg-green-100 transition whitespace-nowrap"
                      >
                        ✅ Aceite
                      </button>
                      <button
                        onClick={() => updateStage(p.id, 'LOST')}
                        className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-100 transition whitespace-nowrap"
                      >
                        ❌ Perdida
                      </button>
                    </>
                  )}
                  {p.stage !== 'SENT' && (
                    <button
                      onClick={() => updateStage(p.id, 'SENT')}
                      className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-lg hover:bg-blue-100 transition whitespace-nowrap"
                    >
                      ↩ Reabrir
                    </button>
                  )}
                  <button
                    onClick={() => { setEditProposal(p); setShowModal(true) }}
                    className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 transition text-center"
                  >
                    ✏️ Editar
                  </button>
                  <button
                    onClick={() => deleteProposal(p.id)}
                    className="text-xs text-gray-300 hover:text-red-500 px-2 py-1 transition text-center"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          )
        })}
        {!loading && proposals.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📄</p>
            <p className="text-sm">Nenhuma proposta {filter !== 'ALL' ? STAGES.find(s => s.key === filter)?.label.toLowerCase() : 'criada'} ainda.</p>
            {filter === 'ALL' && (
              <button onClick={() => setShowModal(true)} className="mt-4 text-sm text-blue-600 hover:underline">
                Criar primeira proposta →
              </button>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <ProposalModal
          proposal={editProposal}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchData() }}
        />
      )}
    </div>
  )
}

function ProposalModal({ proposal, onClose, onSaved }: { proposal: Proposal | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    customerId: proposal?.customer.id || '',
    title: proposal?.title || '',
    value: proposal?.value?.toString() || '',
    stage: proposal?.stage || 'SENT',
    expectedDate: proposal?.expectedDate ? proposal.expectedDate.split('T')[0] : '',
    notes: proposal?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])

  useEffect(() => {
    fetch('/api/customers?limit=200').then(r => r.json()).then(d => setCustomers(d.customers || []))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/pipeline', {
      method: proposal ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proposal ? { id: proposal.id, ...form } : form),
    })
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{proposal ? 'Editar Proposta' : 'Nova Proposta'}</h2>
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
            <label className="block text-xs font-medium text-gray-700 mb-1">Descrição da proposta *</label>
            <input required className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: Proposta Beko linha branca" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Valor (€) *</label>
              <input required type="number" step="0.01" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.00" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Estado</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}>
                <option value="SENT">📤 Enviada</option>
                <option value="ACCEPTED">✅ Aceite</option>
                <option value="LOST">❌ Perdida</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Data prevista de resposta</label>
            <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.expectedDate} onChange={e => setForm(f => ({ ...f, expectedDate: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notas</label>
            <textarea rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 bg-blue-700 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-60">
              {saving ? 'A guardar...' : proposal ? 'Guardar' : 'Criar Proposta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
