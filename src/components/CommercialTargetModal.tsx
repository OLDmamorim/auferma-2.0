'use client'
import { useEffect, useState } from 'react'

interface MonthRow {
  month: number
  lastYearTotal: number
  overrideGrowthPct: number | null
  overrideTarget: number | null
  teamGrowthPct: number
  effectiveGrowthPct: number
  effectiveTarget: number
}

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function fmt(n: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

export default function CommercialTargetModal({
  userId, name, year, onClose, onSaved,
}: {
  userId: string
  name: string
  year: number
  onClose: () => void
  onSaved: () => void
}) {
  const [rows, setRows] = useState<MonthRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [growthInputs, setGrowthInputs] = useState<Record<number, string>>({})
  const [targetInputs, setTargetInputs] = useState<Record<number, string>>({})

  useEffect(() => {
    setLoading(true)
    fetch(`/api/targets/${userId}?year=${year}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        const months: MonthRow[] = d.months || []
        setRows(months)
        const g: Record<number, string> = {}
        const t: Record<number, string> = {}
        months.forEach(m => {
          g[m.month] = m.overrideGrowthPct != null ? String(m.overrideGrowthPct) : ''
          t[m.month] = m.overrideTarget != null ? String(Math.round(m.overrideTarget)) : ''
        })
        setGrowthInputs(g)
        setTargetInputs(t)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [userId, year])

  async function handleSave() {
    setSaving(true)
    const months = rows.map(r => {
      const targetStr = targetInputs[r.month]?.trim()
      const growthStr = growthInputs[r.month]?.trim()
      // An explicit € target wins over a growth % for that month
      const target = targetStr ? parseFloat(targetStr) : null
      const growthPct = !target && growthStr ? parseFloat(growthStr) : null
      return { month: r.month, growthPct: isNaN(growthPct as any) ? null : growthPct, target: isNaN(target as any) ? null : target }
    })
    await fetch(`/api/targets/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, months }),
    })
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-900">{name}</p>
            <p className="text-xs text-gray-500">Metas mensais {year} — deixa em branco para herdar a meta global da equipa</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          {loading ? (
            <div className="space-y-2">
              {Array(12).fill(0).map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-400 px-2">
                <div className="col-span-3">Mês</div>
                <div className="col-span-2">Ano anterior</div>
                <div className="col-span-2">Crescimento %</div>
                <div className="col-span-2">Valor (€)</div>
                <div className="col-span-3">Meta efetiva</div>
              </div>
              {rows.map(r => (
                <div key={r.month} className="grid grid-cols-12 gap-2 items-center px-2 py-1.5 rounded-lg hover:bg-gray-50">
                  <div className="col-span-3 text-sm text-gray-700">{MONTHS[r.month - 1]}</div>
                  <div className="col-span-2 text-xs text-gray-500">{r.lastYearTotal > 0 ? fmt(r.lastYearTotal) : '—'}</div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      step="0.5"
                      placeholder={`${r.teamGrowthPct}% (global)`}
                      className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={growthInputs[r.month] ?? ''}
                      onChange={e => setGrowthInputs(v => ({ ...v, [r.month]: e.target.value }))}
                      disabled={!!targetInputs[r.month]?.trim()}
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      step="100"
                      placeholder="ex: 5000"
                      className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={targetInputs[r.month] ?? ''}
                      onChange={e => setTargetInputs(v => ({ ...v, [r.month]: e.target.value }))}
                    />
                  </div>
                  <div className="col-span-3 text-xs font-semibold text-blue-600">{fmt(r.effectiveTarget)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
          >
            {saving ? 'A guardar...' : 'Guardar metas'}
          </button>
        </div>
      </div>
    </div>
  )
}
