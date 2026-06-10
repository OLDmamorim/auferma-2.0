'use client'
import { useEffect, useState, useCallback } from 'react'
import PageHeader from '@/components/layout/PageHeader'
import { useSession } from 'next-auth/react'

interface TargetRow {
  userId: string
  name: string
  targetId: string | null
  target: number
  achieved: number
  pct: number | null
}

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default function TargetsPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [targets, setTargets] = useState<TargetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>({})

  const fetchTargets = useCallback(() => {
    setLoading(true)
    fetch(`/api/targets?year=${year}&month=${month}`)
      .then(r => r.json())
      .then(d => {
        setTargets(d.targets || [])
        const vals: Record<string, string> = {}
        ;(d.targets || []).forEach((t: TargetRow) => { vals[t.userId] = t.target > 0 ? String(t.target) : '' })
        setEditValues(vals)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [year, month])

  useEffect(() => { fetchTargets() }, [fetchTargets])

  async function saveTarget(userId: string) {
    const val = parseFloat(editValues[userId] || '0')
    if (isNaN(val)) return
    setSaving(userId)
    await fetch('/api/targets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, target: val, year, month }),
    })
    setSaving(null)
    fetchTargets()
  }

  const canEdit = role === 'ADMIN' || role === 'DIRECTOR'
  const totalTarget = targets.reduce((s, t) => s + t.target, 0)
  const totalAchieved = targets.reduce((s, t) => s + t.achieved, 0)
  const totalPct = totalTarget > 0 ? Math.round((totalAchieved / totalTarget) * 100) : null

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Metas & Performance"
        subtitle="Definição e acompanhamento de metas mensais por comercial"
      />

      {/* Month/Year selector */}
      <div className="flex items-center gap-3 mb-5">
        <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Team summary */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="kpi-card text-center">
          <p className="text-xl font-bold text-gray-900">€{totalTarget.toFixed(0)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Meta Total Equipa</p>
        </div>
        <div className="kpi-card text-center">
          <p className="text-xl font-bold text-gray-900">€{totalAchieved.toFixed(0)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Realizado Total</p>
        </div>
        <div className="kpi-card text-center">
          <p className={`text-xl font-bold ${totalPct === null ? 'text-gray-400' : totalPct >= 100 ? 'text-green-600' : totalPct >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
            {totalPct !== null ? `${totalPct}%` : '—'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">% Equipa</p>
        </div>
      </div>

      {/* Targets table */}
      <div className="space-y-3">
        {loading ? Array(3).fill(0).map((_, i) => (
          <div key={i} className="h-20 bg-white rounded-xl border border-gray-100 animate-pulse" />
        )) : targets.map(t => {
          const pct = t.pct
          const barColor = pct === null ? 'bg-gray-200' : pct >= 100 ? 'bg-green-500' : pct >= 70 ? 'bg-amber-500' : 'bg-red-500'
          const barWidth = pct !== null ? Math.min(100, pct) : 0

          return (
            <div key={t.userId} className="bg-white border border-gray-100 shadow-sm rounded-xl p-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {t.name.charAt(0)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-gray-500">€{t.achieved.toFixed(0)} realizado</span>
                      {pct !== null && (
                        <span className={`font-bold ${pct >= 100 ? 'text-green-600' : pct >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                          {pct}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                    <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${barWidth}%` }} />
                  </div>
                  <div className="flex items-center justify-between">
                    {canEdit ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Meta:</span>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500">€</span>
                          <input
                            type="number"
                            step="100"
                            className="w-28 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={editValues[t.userId] || ''}
                            onChange={e => setEditValues(v => ({ ...v, [t.userId]: e.target.value }))}
                            onBlur={() => saveTarget(t.userId)}
                            onKeyDown={e => e.key === 'Enter' && saveTarget(t.userId)}
                            placeholder="Definir meta..."
                          />
                          {saving === t.userId && <span className="text-xs text-blue-500">A guardar...</span>}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500">
                        Meta: {t.target > 0 ? `€${t.target.toFixed(0)}` : 'Não definida'}
                      </span>
                    )}
                    {t.target > 0 && (
                      <span className="text-xs text-gray-400">
                        Falta: €{Math.max(0, t.target - t.achieved).toFixed(0)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        {!loading && targets.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">Nenhum comercial ativo.</div>
        )}
      </div>

      {canEdit && (
        <p className="text-xs text-gray-400 mt-4 text-center">
          Clique no campo da meta e pressione Enter ou clique fora para guardar automaticamente.
        </p>
      )}
    </div>
  )
}
