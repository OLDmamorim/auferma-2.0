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

  const [targets, teamTarget, commercials, salesThisMonth, salesLastYearMonth] = await Promise.all([
    prisma.commercialTarget.findMany({ where: { year, month } }),
    prisma.teamTarget.findUnique({ where: { year_month: { year, month } } }),
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
  const teamGrowthPct = teamTarget?.growthPct ?? 0

  const result = commercials.map(c => {
    const override = targetMap.get(c.id)
    const achieved = salesMap.get(c.id) || 0
    const lastYearSales = lastYearMap.get(c.id) || 0
    const hasOverride = !!override && (override.growthPct !== null || override.target !== null)

    let growthPct: number
    let computedTarget: number
    if (override?.target != null) {
      // Explicit € target wins over any growth %
      computedTarget = override.target
      growthPct = lastYearSales > 0 ? ((computedTarget - lastYearSales) / lastYearSales) * 100 : 0
    } else {
      growthPct = override?.growthPct ?? teamGrowthPct
      computedTarget = lastYearSales > 0 ? lastYearSales * (1 + growthPct / 100) : 0
    }

    const pct = computedTarget > 0 ? Math.round((achieved / computedTarget) * 100) : null
    const vsLastYear = lastYearSales > 0 ? Math.round(((achieved - lastYearSales) / lastYearSales) * 100) : null

    return {
      userId: c.id,
      name: c.name,
      growthPct,
      hasOverride,
      target: computedTarget,
      lastYearSales,
      achieved,
      pct,
      vsLastYear,
    }
  })

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

  // Team-wide default — applies to every commercial without an individual override
  if (applyToAll) {
    await prisma.teamTarget.upsert({
      where: { year_month: { year: y, month: m } },
      create: { year: y, month: m, growthPct },
      update: { growthPct },
    })
    return NextResponse.json({ ok: true })
  }

  // Single-commercial override for this month
  const result = await prisma.commercialTarget.upsert({
    where: { userId_year_month: { userId, year: y, month: m } },
    create: { userId, year: y, month: m, growthPct, target: null },
    update: { growthPct, target: null },
  })

  return NextResponse.json(result)
}
