'use client'
import { useEffect, useState, useCallback } from 'react'
import PageHeader from '@/components/layout/PageHeader'
import { useSession } from 'next-auth/react'

interface TargetRow {
  userId: string
  name: string
  growthPct: number
  target: number
  lastYearSales: number
  achieved: number
  pct: number | null
  vsLastYear: number | null
}

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function fmt(n: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

export default function TargetsPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [targets, setTargets] = useState<TargetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [teamGrowthPct, setTeamGrowthPct] = useState<number | null>(null)
  const [globalPctInput, setGlobalPctInput] = useState('')
  const [individualPcts, setIndividualPcts] = useState<Record<string, string>>({})
  const [applyingAll, setApplyingAll] = useState(false)

  const canEdit = role === 'ADMIN' || role === 'DIRECTOR'

  const fetchTargets = useCallback(() => {
    setLoading(true)
    fetch(`/api/targets?year=${year}&month=${month}`)
      .then(r => r.json())
      .then(d => {
        const rows: TargetRow[] = d.targets || []
        setTargets(rows)
        setTeamGrowthPct(d.teamGrowthPct)
        if (d.teamGrowthPct !== null) setGlobalPctInput(String(d.teamGrowthPct))
        const indiv: Record<string, string> = {}
        rows.forEach(t => { indiv[t.userId] = String(t.growthPct) })
        setIndividualPcts(indiv)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [year, month])

  useEffect(() => { fetchTargets() }, [fetchTargets])

  async function applyGlobalPct() {
    const pct = parseFloat(globalPctInput)
    if (isNaN(pct)) return
    setApplyingAll(true)
    await fetch('/api/targets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ growthPct: pct, year, month, applyToAll: true }),
    })
    setApplyingAll(false)
    fetchTargets()
  }

  async function saveIndividual(userId: string) {
    const pct = parseFloat(individualPcts[userId] || '0')
    if (isNaN(pct)) return
    setSaving(userId)
    await fetch('/api/targets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, growthPct: pct, year, month }),
    })
    setSaving(null)
    fetchTargets()
  }

  const totalTarget = targets.reduce((s, t) => s + t.target, 0)
  const totalAchieved = targets.reduce((s, t) => s + t.achieved, 0)
  const totalLastYear = targets.reduce((s, t) => s + t.lastYearSales, 0)
  const totalPct = totalTarget > 0 ? Math.round((totalAchieved / totalTarget) * 100) : null
  const totalVsLastYear = totalLastYear > 0 ? Math.round(((totalAchieved - totalLastYear) / totalLastYear) * 100) : null

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <PageHeader
        title="Metas & Performance"
        subtitle="Crescimento definido relativamente ao período homólogo do ano anterior"
      />

      {/* Month/Year selector */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Global growth % setter — director only */}
      {canEdit && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
          <p className="text-sm font-semibold text-blue-800 mb-1">Crescimento global da equipa</p>
          <p className="text-xs text-blue-600 mb-3">
            Define uma percentagem de crescimento face a {MONTHS[month - 1]} {year - 1} e aplica a todos os comerciais automaticamente.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-white border border-blue-200 rounded-lg px-3 py-2">
              <input
                type="number"
                step="0.5"
                min="-100"
                max="200"
                className="w-20 text-sm font-bold text-blue-700 focus:outline-none"
                value={globalPctInput}
                onChange={e => setGlobalPctInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && applyGlobalPct()}
                placeholder="0"
              />
              <span className="text-blue-500 font-bold">%</span>
            </div>
            <button
              onClick={applyGlobalPct}
              disabled={applyingAll}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50"
            >
              {applyingAll ? 'A aplicar...' : 'Aplicar a todos'}
            </button>
            {teamGrowthPct !== null && (
              <span className="text-xs text-blue-500">
                Meta atual: +{teamGrowthPct}% face a {year - 1}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Team summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Período homólogo {year - 1}</p>
          <p className="text-lg font-bold text-gray-700">{fmt(totalLastYear)}</p>
        </div>
        <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Meta {year}</p>
          <p className="text-lg font-bold text-blue-600">{fmt(totalTarget)}</p>
        </div>
        <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Realizado</p>
          <p className="text-lg font-bold text-gray-900">{fmt(totalAchieved)}</p>
        </div>
        <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Evolução vs meta</p>
          <p className={`text-lg font-bold ${totalPct === null ? 'text-gray-400' : totalPct >= 100 ? 'text-green-600' : totalPct >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
            {totalPct !== null ? `${totalPct}%` : '—'}
          </p>
        </div>
      </div>

      {/* Per-commercial rows */}
      <div className="space-y-3">
        {loading ? Array(3).fill(0).map((_, i) => (
          <div key={i} className="h-28 bg-white rounded-xl border border-gray-100 animate-pulse" />
        )) : targets.map(t => {
          const pct = t.pct
          const barPct = pct !== null ? Math.min(100, pct) : 0
          const barColor = pct === null ? 'bg-gray-200' : pct >= 100 ? 'bg-green-500' : pct >= 70 ? 'bg-amber-500' : 'bg-red-500'

          return (
            <div key={t.userId} className="bg-white border border-gray-100 shadow-sm rounded-xl p-4">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {t.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Name + growth badge */}
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                    <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {t.vsLastYear !== null && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${t.vsLastYear >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                          {t.vsLastYear >= 0 ? '↑' : '↓'} {Math.abs(t.vsLastYear)}% vs {year - 1}
                        </span>
                      )}
                      {pct !== null && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pct >= 100 ? 'bg-green-100 text-green-700' : pct >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                          {pct}% da meta
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 3-column data */}
                  <div className="grid grid-cols-3 gap-3 mb-3 text-xs">
                    <div>
                      <p className="text-gray-400 mb-0.5">{MONTHS[month - 1]} {year - 1}</p>
                      <p className="font-semibold text-gray-600">{t.lastYearSales > 0 ? fmt(t.lastYearSales) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 mb-0.5">Meta {year}</p>
                      <p className="font-semibold text-blue-600">{t.target > 0 ? fmt(t.target) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 mb-0.5">Realizado</p>
                      <p className="font-semibold text-gray-900">{fmt(t.achieved)}</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                    <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${barPct}%` }} />
                  </div>

                  {/* Individual % override */}
                  {canEdit && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-400">Crescimento individual:</span>
                      <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1">
                        <input
                          type="number"
                          step="0.5"
                          min="-100"
                          className="w-14 text-xs text-gray-700 bg-transparent focus:outline-none"
                          value={individualPcts[t.userId] ?? ''}
                          onChange={e => setIndividualPcts(v => ({ ...v, [t.userId]: e.target.value }))}
                          onBlur={() => saveIndividual(t.userId)}
                          onKeyDown={e => e.key === 'Enter' && saveIndividual(t.userId)}
                        />
                        <span className="text-xs text-gray-500">%</span>
                      </div>
                      {saving === t.userId && <span className="text-xs text-blue-500">A guardar...</span>}
                      {t.lastYearSales > 0 && parseFloat(individualPcts[t.userId] || '0') !== 0 && (
                        <span className="text-xs text-gray-400">
                          → Meta: {fmt(t.lastYearSales * (1 + parseFloat(individualPcts[t.userId] || '0') / 100))}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {!loading && targets.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">Nenhum comercial ativo.</div>
        )}
      </div>

      {totalVsLastYear !== null && totalLastYear > 0 && (
        <div className="mt-4 p-3 bg-gray-50 rounded-xl text-center">
          <p className="text-xs text-gray-500">
            Equipa realiza <strong className={totalVsLastYear >= 0 ? 'text-green-600' : 'text-red-600'}>{totalVsLastYear >= 0 ? '+' : ''}{totalVsLastYear}%</strong> face a {MONTHS[month - 1]} {year - 1} ({fmt(totalLastYear)})
          </p>
        </div>
      )}
    </div>
  )
}
