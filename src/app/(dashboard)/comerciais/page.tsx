'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import { usePeriod } from '@/components/PeriodContext'

interface Commercial {
  id: string
  name: string
  email: string
  role: string
  active: boolean
  orcamento: number
  vendasAno: number
  desvio: number | null
}

export default function ComerciaisPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const [users, setUsers] = useState<Commercial[]>([])
  const [loading, setLoading] = useState(true)

  const { period, ready } = usePeriod()

  useEffect(() => {
    if (role && !['ADMIN', 'DIRECTOR'].includes(role)) return
    if (!ready) return
    setLoading(true)
    const base = period ? `?year=${period.year}&` : '?'
    fetch(`/api/comerciais${base}_t=${Date.now()}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setUsers(Array.isArray(d) ? d : []); setLoading(false) })
  }, [role, period, ready])

  if (role === 'COMMERCIAL') {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl p-4 text-sm">
          Não tem permissão para aceder a esta página.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <PageHeader title="Equipa Comercial" subtitle="Gestão e performance da equipa de comerciais" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading
          ? Array(5).fill(0).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-100 rounded mb-2 w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))
          : users.map(user => (
              <div key={user.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white text-lg font-bold">
                    {user.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{user.name}</h3>
                    <p className="text-xs text-gray-500">{user.email}</p>
                    <span className={`badge mt-1 ${user.active ? 'badge-green' : 'badge-gray'}`}>
                      {user.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-50">
                  <div className="text-center">
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(user.orcamento)}</p>
                    <p className="text-xs text-gray-500">Orçamento</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(user.vendasAno)}</p>
                    <p className="text-xs text-gray-500">Vendas do ano</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-sm font-bold ${
                      user.desvio === null ? 'text-gray-400'
                        : user.desvio >= 0 ? 'text-green-600' : 'text-red-500'
                    }`}>
                      {user.desvio === null ? '—' : `${user.desvio >= 0 ? '+' : ''}${user.desvio.toFixed(1)}%`}
                    </p>
                    <p className="text-xs text-gray-500">Desvio</p>
                  </div>
                </div>
              </div>
            ))}
      </div>
    </div>
  )
}
