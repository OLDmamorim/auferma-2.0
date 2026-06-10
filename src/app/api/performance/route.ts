import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function getPeriodRange(period: string, year: number, month: number) {
  if (period === 'month') {
    return {
      from: new Date(year, month - 1, 1),
      to: new Date(year, month, 0, 23, 59, 59),
    }
  }
  if (period === 'quarter') {
    const q = Math.floor((month - 1) / 3)
    return {
      from: new Date(year, q * 3, 1),
      to: new Date(year, q * 3 + 3, 0, 23, 59, 59),
    }
  }
  // year
  return {
    from: new Date(year, 0, 1),
    to: new Date(year, 11, 31, 23, 59, 59),
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const now = new Date()
  const year = parseInt(searchParams.get('year') || String(now.getFullYear()))
  const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1))
  const period = (searchParams.get('period') || 'month') as 'month' | 'quarter' | 'year'

  const { from, to } = getPeriodRange(period, year, month)

  const commercials = await prisma.user.findMany({
    where: { role: 'COMMERCIAL', active: true },
    select: { id: true, name: true },
  })

  // Sales aggregated by commercial
  const salesAgg = await prisma.sale.groupBy({
    by: ['commercialId'],
    where: {
      date: { gte: from, lte: to },
      commercialId: { not: null },
    },
    _sum: { total: true },
    _count: { id: true },
  })

  // Visits aggregated by commercial
  const visitsAgg = await prisma.visit.groupBy({
    by: ['commercialId'],
    where: {
      date: { gte: from, lte: to },
      commercialId: { not: null },
    },
    _count: { id: true },
  })

  // Tasks done aggregated by commercial
  const tasksAgg = await prisma.task.groupBy({
    by: ['assignedToId'],
    where: {
      status: 'COMPLETED',
      completedAt: { gte: from, lte: to },
      assignedToId: { not: null },
    },
    _count: { id: true },
  })

  // New customers per commercial
  const newCustomersAgg = await prisma.customer.groupBy({
    by: ['commercialId'],
    where: {
      createdAt: { gte: from, lte: to },
      commercialId: { not: null },
    },
    _count: { id: true },
  })

  // Targets (only relevant for month period)
  let targetsMap = new Map<string, number>()
  if (period === 'month') {
    const targets = await prisma.commercialTarget.findMany({
      where: { year, month },
    })
    targetsMap = new Map(targets.map(t => [t.userId, t.target]))
  }

  const salesMap = new Map(salesAgg.map(s => [s.commercialId!, { total: s._sum.total || 0, count: s._count.id }]))
  const visitsMap = new Map(visitsAgg.map(v => [v.commercialId!, v._count.id]))
  const tasksMap = new Map(tasksAgg.map(t => [t.assignedToId!, t._count.id]))
  const newCustomersMap = new Map(newCustomersAgg.map(c => [c.commercialId!, c._count.id]))

  const data = commercials.map(c => {
    const s = salesMap.get(c.id)
    const sales = s?.total || 0
    const salesCount = s?.count || 0
    const visits = visitsMap.get(c.id) || 0
    const tasksDone = tasksMap.get(c.id) || 0
    const newCustomers = newCustomersMap.get(c.id) || 0
    const avgOrderValue = salesCount > 0 ? sales / salesCount : 0
    const target = targetsMap.get(c.id)
    const targetPct = period === 'month' && target ? Math.round((sales / target) * 100) : null

    return {
      userId: c.id,
      name: c.name,
      sales,
      salesCount,
      visits,
      tasksDone,
      newCustomers,
      avgOrderValue,
      targetPct,
    }
  })

  // Rankings
  const bySales = [...data].sort((a, b) => b.sales - a.sales)
  const byVisits = [...data].sort((a, b) => b.visits - a.visits)
  const byTasksDone = [...data].sort((a, b) => b.tasksDone - a.tasksDone)

  // Monthly evolution (last 6 months) via raw query
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

  type EvolutionRow = { commercialId: string; month: number; year: number; total: number }
  const evolutionRows = await prisma.$queryRaw<EvolutionRow[]>`
    SELECT
      "commercialId",
      EXTRACT(MONTH FROM date)::int AS month,
      EXTRACT(YEAR FROM date)::int AS year,
      SUM(total)::float AS total
    FROM "Sale"
    WHERE
      date >= ${sixMonthsAgo}
      AND "commercialId" IS NOT NULL
    GROUP BY "commercialId", EXTRACT(MONTH FROM date), EXTRACT(YEAR FROM date)
    ORDER BY year ASC, month ASC
  `

  const monthlyEvolution = commercials.map(c => {
    const rows = evolutionRows.filter(r => r.commercialId === c.id)
    return {
      userId: c.id,
      name: c.name,
      months: rows.map(r => ({ month: r.month, year: r.year, total: r.total })),
    }
  })

  return NextResponse.json({
    bySales,
    byVisits,
    byTasksDone,
    monthlyEvolution,
    period,
    year,
    month,
  })
}
