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

  const startOfMonth = new Date(year, month - 1, 1)
  const endOfMonth = new Date(year, month, 0, 23, 59, 59)

  const [targets, commercials] = await Promise.all([
    prisma.commercialTarget.findMany({
      where: { year, month },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.user.findMany({
      where: { role: 'COMMERCIAL', active: true },
      select: { id: true, name: true },
    }),
  ])

  // Get actual sales for this month per commercial
  const salesAgg = await prisma.sale.groupBy({
    by: ['commercialId'],
    where: { date: { gte: startOfMonth, lte: endOfMonth }, commercialId: { not: null } },
    _sum: { total: true },
  })

  const salesMap = new Map(salesAgg.map(s => [s.commercialId!, s._sum.total || 0]))

  const result = commercials.map(c => {
    const target = targets.find(t => t.userId === c.id)
    const achieved = salesMap.get(c.id) || 0
    return {
      userId: c.id,
      name: c.name,
      targetId: target?.id || null,
      target: target?.target || 0,
      achieved,
      pct: target?.target ? Math.round((achieved / target.target) * 100) : null,
    }
  })

  return NextResponse.json({ targets: result, year, month })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role as string
  if (!['ADMIN', 'DIRECTOR'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId, target, year, month } = await req.json()
  const now = new Date()

  const result = await prisma.commercialTarget.upsert({
    where: { userId_year_month: { userId, year: year || now.getFullYear(), month: month || now.getMonth() + 1 } },
    create: { userId, year: year || now.getFullYear(), month: month || now.getMonth() + 1, target },
    update: { target },
  })

  return NextResponse.json(result)
}
