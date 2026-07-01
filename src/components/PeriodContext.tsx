'use client'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'

export interface Period { year: number; month: number } // month is 1-based

interface PeriodContextValue {
  period: Period | null
  setPeriod: (p: Period) => void
  months: Period[]
  ready: boolean
}

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
export function monthLabel(p: Period | null): string {
  return p ? `${MONTH_NAMES[p.month - 1]} ${p.year}` : '—'
}

const PeriodCtx = createContext<PeriodContextValue>({ period: null, setPeriod: () => {}, months: [], ready: false })

export function usePeriod() {
  return useContext(PeriodCtx)
}

const STORAGE_KEY = 'auferma.period'

export function PeriodProvider({ children }: { children: React.ReactNode }) {
  const [months, setMonths] = useState<Period[]>([])
  const [period, setPeriodState] = useState<Period | null>(null)
  const [ready, setReady] = useState(false)

  const setPeriod = useCallback((p: Period) => {
    setPeriodState(p)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)) } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetch('/api/periods')
      .then(r => r.json())
      .then((d: { months: Period[] }) => {
        const list = d.months || []
        setMonths(list)
        // Prefer the stored period if it still exists in the data, else latest
        let initial: Period | null = null
        try {
          const raw = localStorage.getItem(STORAGE_KEY)
          if (raw) {
            const saved = JSON.parse(raw) as Period
            if (list.some(m => m.year === saved.year && m.month === saved.month)) initial = saved
          }
        } catch { /* ignore */ }
        if (!initial) initial = list[0] || null
        setPeriodState(initial)
        setReady(true)
      })
      .catch(() => setReady(true))
  }, [])

  return (
    <PeriodCtx.Provider value={{ period, setPeriod, months, ready }}>
      {children}
    </PeriodCtx.Provider>
  )
}

export function PeriodSelector({ className }: { className?: string }) {
  const { period, setPeriod, months } = usePeriod()
  if (months.length === 0) return null
  return (
    <select
      value={period ? `${period.year}-${period.month}` : ''}
      onChange={e => {
        const [y, m] = e.target.value.split('-').map(Number)
        setPeriod({ year: y, month: m })
      }}
      className={className || 'bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500'}
    >
      {months.map(m => (
        <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
          {MONTH_NAMES[m.month - 1]} {m.year}
        </option>
      ))}
    </select>
  )
}
