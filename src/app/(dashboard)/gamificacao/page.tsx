'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import PageHeader from '@/components/layout/PageHeader'
import { formatCurrency } from '@/lib/utils'

interface RankEntry {
  id: string
  name: string
  rank: number
  medal: string
  salesTotal: number
  tasksCompleted: number
  visitsCount: number
  progress: number
}

interface GamificationData {
  rankings: RankEntry[]
  weekHighlight: string
}

const medalColors: Record<number, string> = {
  1: 'bg-yellow-50 border-yellow-200',
  2: 'bg-gray-50 border-gray-200',
  3: 'bg-orange-50 border-orange-200',
}

export default function GamificacaoPage() {
  const { data: session } = useSession()
  const [data, setData] = useState<GamificationData | null>(null)
  const [loading, setLoading] = useState(true)
  const userId = (session?.user as any)?.id

  useEffect(() => {
    fetch('/api/gamification')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const currentUserRank = data?.rankings.find(r => r.id === userId)

  return (
    <div className="p-6">
      <PageHeader
        title="Gamificação"
        subtitle={`Ranking do mês de ${new Date().toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}`}
      />

      {/* Highlight */}
      {!loading && data?.weekHighlight && (
        <div className="bg-gradient-to-r from-yellow-400 to-orange-400 rounded-2xl p-6 mb-6 text-white shadow-lg">
          <div className="flex items-center gap-4">
            <div className="text-4xl">🏆</div>
            <div>
              <p className="text-sm font-medium opacity-90">Destaque do Mês</p>
              <p className="text-2xl font-bold">{data.weekHighlight}</p>
              <p className="text-sm opacity-80 mt-0.5">Melhor vendedor do mês</p>
            </div>
          </div>
        </div>
      )}

      {/* Current user card */}
      {currentUserRank && (
        <div className="bg-blue-700 text-white rounded-xl p-5 mb-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-sm">A tua posição</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-4xl">{currentUserRank.medal}</span>
                <div>
                  <p className="text-2xl font-bold">{currentUserRank.name}</p>
                  <p className="text-blue-200 text-sm">{formatCurrency(currentUserRank.salesTotal)} em vendas</p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-blue-200 text-sm">Progresso</p>
              <p className="text-3xl font-bold">{currentUserRank.progress}%</p>
              <div className="w-32 bg-blue-600 rounded-full h-2 mt-1">
                <div className="bg-white rounded-full h-2" style={{ width: `${currentUserRank.progress}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ranking */}
      <div className="grid grid-cols-1 gap-3">
        {loading
          ? Array(5).fill(0).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-100 rounded w-1/3 mb-2" />
                    <div className="h-2 bg-gray-100 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))
          : (data?.rankings || []).map(entry => (
              <div
                key={entry.id}
                className={`rounded-xl border-2 shadow-sm p-5 transition ${
                  entry.id === userId ? 'border-blue-300 bg-blue-50' :
                  medalColors[entry.rank] || 'bg-white border-gray-100'
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Rank */}
                  <div className="text-3xl w-12 text-center">{entry.medal}</div>

                  {/* Avatar */}
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0 ${
                    entry.rank === 1 ? 'bg-yellow-500' : entry.rank === 2 ? 'bg-gray-500' : entry.rank === 3 ? 'bg-orange-500' : 'bg-blue-600'
                  }`}>
                    {entry.name.charAt(0)}
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{entry.name}</p>
                      {entry.id === userId && <span className="badge badge-blue text-xs">Tu</span>}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5 max-w-48">
                        <div
                          className={`h-1.5 rounded-full ${entry.rank === 1 ? 'bg-yellow-500' : 'bg-blue-600'}`}
                          style={{ width: `${entry.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{entry.progress}%</span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="hidden md:grid grid-cols-3 gap-6 text-center">
                    <div>
                      <p className="text-lg font-bold text-gray-900">{formatCurrency(entry.salesTotal)}</p>
                      <p className="text-xs text-gray-500">Vendas</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-900">{entry.visitsCount}</p>
                      <p className="text-xs text-gray-500">Visitas</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-900">{entry.tasksCompleted}</p>
                      <p className="text-xs text-gray-500">Tarefas</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
      </div>

      {/* Info */}
      <div className="mt-6 bg-gray-50 border border-gray-100 rounded-xl p-4 text-xs text-gray-500">
        <p>📊 Ranking calculado com base nas vendas, visitas e tarefas concluídas no mês atual. Atualizado em tempo real.</p>
      </div>
    </div>
  )
}
