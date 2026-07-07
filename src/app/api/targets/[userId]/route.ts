import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const MONTHS = 12

// Full 12-month (Jan-Dez) view for a single commercial: their homólogo sales,
// any explicit override for that month, and the effective target either way.
export async function GET(req: NextRequest, { params }: { params: { userId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
  const lastYear = year - 1
  const { userId } = params

  const [commercial, overrides, teamTargets, lastYearSales] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } }),
    prisma.commercialTarget.findMany({ where: { userId, year } }),
    prisma.teamTarget.findMany({ where: { year } }),
    prisma.$queryRaw<{ month: number; total: number }[]>`
      SELECT EXTRACT(MONTH FROM date)::int as month, SUM(total)::float as total
      FROM "Sale"
      WHERE "commercialId" = ${userId}
        AND date >= ${new Date(lastYear, 0, 1)} AND date < ${new Date(lastYear + 1, 0, 1)}
      GROUP BY month
    `,
  ])

  if (!commercial) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const lastYearByMonth = new Map(lastYearSales.map(r => [r.month, r.total]))

  const overrideMap = new Map(overrides.map(o => [o.month, o]))
  const teamMap = new Map(teamTargets.map(t => [t.month, t.growthPct]))

  const months = Array.from({ length: MONTHS }, (_, i) => {
    const month = i + 1
    const lastYearTotal = lastYearByMonth.get(month) || 0
    const override = overrideMap.get(month)
    const teamGrowthPct = teamMap.get(month) ?? 0

    let effectiveGrowthPct: number
    let effectiveTarget: number
    if (override?.target != null) {
      effectiveTarget = override.target
      effectiveGrowthPct = lastYearTotal > 0 ? ((effectiveTarget - lastYearTotal) / lastYearTotal) * 100 : 0
    } else {
      effectiveGrowthPct = override?.growthPct ?? teamGrowthPct
      effectiveTarget = lastYearTotal > 0 ? lastYearTotal * (1 + effectiveGrowthPct / 100) : 0
    }

    return {
      month,
      lastYearTotal,
      overrideGrowthPct: override?.growthPct ?? null,
      overrideTarget: override?.target ?? null,
      teamGrowthPct,
      effectiveGrowthPct,
      effectiveTarget,
    }
  })

  return NextResponse.json({ userId, name: commercial.name, year, months })
}

// Bulk-save overrides for all 12 months at once. Sending null/empty for both
// growthPct and target on a month clears its override (falls back to the team
// default again).
export async function PUT(req: NextRequest, { params }: { params: { userId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role as string
  if (!['ADMIN', 'DIRECTOR'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId } = params
  const { year, months } = await req.json() as {
    year: number
    months: { month: number; growthPct: number | null; target: number | null }[]
  }

  await Promise.all(months.map(m => {
    const hasOverride = m.growthPct != null || m.target != null
    if (!hasOverride) {
      return prisma.commercialTarget.deleteMany({ where: { userId, year, month: m.month } })
    }
    return prisma.commercialTarget.upsert({
      where: { userId_year_month: { userId, year, month: m.month } },
      create: { userId, year, month: m.month, growthPct: m.growthPct, target: m.target },
      update: { growthPct: m.growthPct, target: m.target },
    })
  }))

  return NextResponse.json({ ok: true })
}
