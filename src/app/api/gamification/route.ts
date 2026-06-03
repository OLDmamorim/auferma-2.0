import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const commercials = await prisma.user.findMany({
    where: { role: 'COMMERCIAL', active: true },
    select: {
      id: true, name: true,
      sales: {
        where: { date: { gte: startOfMonth } },
        select: { total: true },
      },
      tasks: {
        where: { status: 'COMPLETED', completedAt: { gte: startOfMonth }, _: undefined } as any,
        select: { id: true },
      },
      visits: {
        where: { date: { gte: startOfMonth } },
        select: { id: true },
      },
    },
  })

  const ranked = commercials.map(c => ({
    id: c.id,
    name: c.name,
    salesTotal: c.sales.reduce((sum, s) => sum + s.total, 0),
    tasksCompleted: c.tasks.length,
    visitsCount: c.visits.length,
  })).sort((a, b) => b.salesTotal - a.salesTotal)

  const maxSales = ranked[0]?.salesTotal || 1

  return NextResponse.json({
    rankings: ranked.map((c, i) => ({
      ...c,
      rank: i + 1,
      medal: i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`,
      progress: Math.round((c.salesTotal / maxSales) * 100),
    })),
    weekHighlight: ranked[0]?.name || 'N/A',
  })
}
