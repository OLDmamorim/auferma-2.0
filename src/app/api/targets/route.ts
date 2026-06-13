import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))
  const lastYear = year - 1

  const startOfMonth = new Date(year, month - 1, 1)
  const endOfMonth = new Date(year, month, 0, 23, 59, 59)
  const startOfLastYearMonth = new Date(lastYear, month - 1, 1)
  const endOfLastYearMonth = new Date(lastYear, month, 0, 23, 59, 59)

  const [targets, commercials, salesThisMonth, salesLastYearMonth] = await Promise.all([
    prisma.commercialTarget.findMany({ where: { year, month } }),
    prisma.user.findMany({ where: { role: 'COMMERCIAL', active: true }, select: { id: true, name: true } }),
    prisma.sale.groupBy({
      by: ['commercialId'],
      where: { date: { gte: startOfMonth, lte: endOfMonth }, commercialId: { not: null } },
      _sum: { total: true },
    }),
    prisma.sale.groupBy({
      by: ['commercialId'],
      where: { date: { gte: startOfLastYearMonth, lte: endOfLastYearMonth }, commercialId: { not: null } },
      _sum: { total: true },
    }),
  ])

  const salesMap = new Map(salesThisMonth.map(s => [s.commercialId!, s._sum.total || 0]))
  const lastYearMap = new Map(salesLastYearMonth.map(s => [s.commercialId!, s._sum.total || 0]))
  const targetMap = new Map(targets.map(t => [t.userId, t]))

  const result = commercials.map(c => {
    const t = targetMap.get(c.id)
    const achieved = salesMap.get(c.id) || 0
    const lastYearSales = lastYearMap.get(c.id) || 0
    const growthPct = t?.growthPct ?? 0
    // target = last year's value + growth%, or stored target if no last year data
    const computedTarget = lastYearSales > 0 ? lastYearSales * (1 + growthPct / 100) : (t?.target || 0)
    const pct = computedTarget > 0 ? Math.round((achieved / computedTarget) * 100) : null
    const vsLastYear = lastYearSales > 0 ? Math.round(((achieved - lastYearSales) / lastYearSales) * 100) : null

    return {
      userId: c.id,
      name: c.name,
      growthPct,
      target: computedTarget,
      lastYearSales,
      achieved,
      pct,
      vsLastYear,
    }
  })

  // Derive a single "team growth %" if all commercials share same growthPct
  const growthPcts = Array.from(new Set(result.map(r => r.growthPct)))
  const teamGrowthPct = growthPcts.length === 1 ? growthPcts[0] : null

  return NextResponse.json({ targets: result, year, month, teamGrowthPct })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role as string
  if (!['ADMIN', 'DIRECTOR'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId, growthPct, year, month, applyToAll } = await req.json()
  const now = new Date()
  const y = year || now.getFullYear()
  const m = month || now.getMonth() + 1
  const lastYear = y - 1

  // If applyToAll, get all commercials and apply same growthPct
  if (applyToAll) {
    const commercials = await prisma.user.findMany({
      where: { role: 'COMMERCIAL', active: true },
      select: { id: true },
    })
    const lastYearSales = await prisma.sale.groupBy({
      by: ['commercialId'],
      where: {
        date: { gte: new Date(lastYear, m - 1, 1), lte: new Date(lastYear, m, 0, 23, 59, 59) },
        commercialId: { not: null },
      },
      _sum: { total: true },
    })
    const lastYearMap = new Map(lastYearSales.map(s => [s.commercialId!, s._sum.total || 0]))

    await Promise.all(commercials.map(c => {
      const lastYr = lastYearMap.get(c.id) || 0
      const computedTarget = lastYr > 0 ? lastYr * (1 + growthPct / 100) : 0
      return prisma.commercialTarget.upsert({
        where: { userId_year_month: { userId: c.id, year: y, month: m } },
        create: { userId: c.id, year: y, month: m, growthPct, target: computedTarget },
        update: { growthPct, target: computedTarget },
      })
    }))

    return NextResponse.json({ ok: true, applied: commercials.length })
  }

  // Single user update
  const lastYrSales = await prisma.sale.aggregate({
    where: {
      commercialId: userId,
      date: { gte: new Date(lastYear, m - 1, 1), lte: new Date(lastYear, m, 0, 23, 59, 59) },
    },
    _sum: { total: true },
  })
  const lastYr = lastYrSales._sum.total || 0
  const computedTarget = lastYr > 0 ? lastYr * (1 + growthPct / 100) : 0

  const result = await prisma.commercialTarget.upsert({
    where: { userId_year_month: { userId, year: y, month: m } },
    create: { userId, year: y, month: m, growthPct, target: computedTarget },
    update: { growthPct, target: computedTarget },
  })

  return NextResponse.json(result)
}
