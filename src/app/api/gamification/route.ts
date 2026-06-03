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
    select: { id: true, name: true },
  })

  const [salesByCommercial, tasksByCommercial, visitsByCommercial] = await Promise.all([
    prisma.sale.groupBy({
      by: ['commercialId'],
      where: { date: { gte: startOfMonth }, commercialId: { not: null } },
      _sum: { total: true },
    }),
    prisma.task.groupBy({
      by: ['assignedToId'],
      where: { status: 'COMPLETED', completedAt: { gte: startOfMonth }, assignedToId: { not: null } },
      _count: { id: true },
    }),
    prisma.visit.groupBy({
      by: ['commercialId'],
      where: { date: { gte: startOfMonth }, commercialId: { not: null } },
      _count: { id: true },
    }),
  ])

  const salesMap = Object.fromEntries(salesByCommercial.map(s => [s.commercialId!, s._sum.total || 0]))
  const tasksMap = Object.fromEntries(tasksByCommercial.map(t => [t.assignedToId!, t._count.id]))
  const visitsMap = Object.fromEntries(visitsByCommercial.map(v => [v.commercialId!, v._count.id]))

  const ranked = commercials.map(c => ({
    id: c.id,
    name: c.name,
    salesTotal: salesMap[c.id] || 0,
    tasksCompleted: tasksMap[c.id] || 0,
    visitsCount: visitsMap[c.id] || 0,
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
