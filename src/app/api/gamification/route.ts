import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const currentUserId = (session.user as any).id

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const commercials = await prisma.user.findMany({
    where: { role: 'COMMERCIAL', active: true },
    select: { id: true, name: true },
  })

  const [salesByCommercial, tasksByCommercial, visitsByCommercial, targets] = await Promise.all([
    prisma.sale.groupBy({
      by: ['commercialId'],
      where: { date: { gte: startOfMonth, lt: startOfNextMonth }, commercialId: { not: null } },
      _sum: { total: true },
    }),
    prisma.task.groupBy({
      by: ['assignedToId'],
      where: { status: 'COMPLETED', completedAt: { gte: startOfMonth, lt: startOfNextMonth }, assignedToId: { not: null } },
      _count: { id: true },
    }),
    prisma.visit.groupBy({
      by: ['commercialId'],
      where: { date: { gte: startOfMonth, lt: startOfNextMonth }, commercialId: { not: null } },
      _count: { id: true },
    }),
    prisma.commercialTarget.findMany({
      where: { year: now.getFullYear(), month: now.getMonth() + 1 },
      select: { userId: true, target: true },
    }),
  ])

  const salesMap = Object.fromEntries(salesByCommercial.map(s => [s.commercialId!, s._sum.total || 0]))
  const tasksMap = Object.fromEntries(tasksByCommercial.map(t => [t.assignedToId!, t._count.id]))
  const visitsMap = Object.fromEntries(visitsByCommercial.map(v => [v.commercialId!, v._count.id]))
  const targetMap = Object.fromEntries(targets.map(t => [t.userId, t.target]))

  // Rank by budget attainment %, not raw revenue — keeps sales figures private between colleagues
  const ranked = commercials.map(c => {
    const salesTotal = salesMap[c.id] || 0
    const target = targetMap[c.id] || 0
    const attainmentPct = target > 0 ? (salesTotal / target) * 100 : 0
    return {
      id: c.id,
      name: c.name,
      hasTarget: target > 0,
      attainmentPct: Math.round(attainmentPct),
      tasksCompleted: tasksMap[c.id] || 0,
      visitsCount: visitsMap[c.id] || 0,
      // Only the caller's own revenue figure travels over the wire
      salesTotal: c.id === currentUserId ? salesTotal : null,
      target: c.id === currentUserId ? target : null,
    }
  }).sort((a, b) => b.attainmentPct - a.attainmentPct)

  return NextResponse.json({
    rankings: ranked.map((c, i) => ({
      ...c,
      rank: i + 1,
      medal: i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`,
      progress: Math.min(100, c.attainmentPct),
    })),
    weekHighlight: ranked[0]?.name || 'N/A',
  })
}
