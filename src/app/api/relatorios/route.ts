import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role as string
  const userId = (session.user as any).id as string
  const now = new Date()

  // Last 7 days
  const weekAgo = new Date(now.getTime() - 7 * 86400000)
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const isDirector = role === 'ADMIN' || role === 'DIRECTOR'
  const userFilter = isDirector ? {} : { id: userId }

  const commercials = await prisma.user.findMany({
    where: { role: 'COMMERCIAL', active: true, ...userFilter },
    select: { id: true, name: true, email: true },
  })

  const reports = await Promise.all(commercials.map(async (commercial) => {
    const [
      salesThisWeek, salesLastWeek, salesThisMonth,
      visitsThisWeek, visitsLastWeek,
      tasksDone, tasksPending,
      atRiskCustomers, target,
    ] = await Promise.all([
      prisma.sale.aggregate({ where: { commercialId: commercial.id, date: { gte: weekAgo } }, _sum: { total: true }, _count: true }),
      prisma.sale.aggregate({ where: { commercialId: commercial.id, date: { gte: twoWeeksAgo, lt: weekAgo } }, _sum: { total: true } }),
      prisma.sale.aggregate({ where: { commercialId: commercial.id, date: { gte: startOfMonth } }, _sum: { total: true } }),
      prisma.visit.count({ where: { commercialId: commercial.id, date: { gte: weekAgo } } }),
      prisma.visit.count({ where: { commercialId: commercial.id, date: { gte: twoWeeksAgo, lt: weekAgo } } }),
      prisma.task.count({ where: { status: 'COMPLETED', completedAt: { gte: weekAgo }, customer: { commercialId: commercial.id } } }),
      prisma.task.count({ where: { status: { in: ['PENDING', 'IN_PROGRESS'] }, customer: { commercialId: commercial.id } } }),
      prisma.customer.count({ where: { commercialId: commercial.id, status: 'ACTIVE', OR: [{ lastPurchaseDate: { lt: new Date(now.getTime() - 30 * 86400000) } }, { riskScore: { gt: 60 } }] } }),
      prisma.commercialTarget.findUnique({ where: { userId_year_month: { userId: commercial.id, year: now.getFullYear(), month: now.getMonth() + 1 } } }),
    ])

    const salesWeekVal = salesThisWeek._sum.total || 0
    const salesLastWeekVal = salesLastWeek._sum.total || 0
    const salesMonthVal = salesThisMonth._sum.total || 0
    const salesWoW = salesLastWeekVal > 0 ? ((salesWeekVal - salesLastWeekVal) / salesLastWeekVal) * 100 : 0
    const visitsWoW = visitsLastWeek > 0 ? ((visitsThisWeek - visitsLastWeek) / visitsLastWeek) * 100 : 0
    const targetPct = target && target.target > 0 ? (salesMonthVal / target.target) * 100 : null

    // Performance signal
    let signal: 'green' | 'amber' | 'red' = 'green'
    if (visitsThisWeek === 0 || salesWeekVal === 0) signal = 'red'
    else if (salesWoW < -20 || visitsThisWeek < 2) signal = 'amber'

    return {
      commercial,
      salesThisWeek: salesWeekVal,
      salesLastWeek: salesLastWeekVal,
      salesThisMonth: salesMonthVal,
      salesWoW: Math.round(salesWoW),
      salesCount: salesThisWeek._count,
      visitsThisWeek,
      visitsLastWeek,
      visitsWoW: Math.round(visitsWoW),
      tasksDone,
      tasksPending,
      atRiskCustomers,
      target: target?.target || 0,
      targetPct: targetPct !== null ? Math.round(targetPct) : null,
      signal,
    }
  }))

  // Team totals
  const team = {
    salesThisWeek: reports.reduce((s, r) => s + r.salesThisWeek, 0),
    salesThisMonth: reports.reduce((s, r) => s + r.salesThisMonth, 0),
    visitsThisWeek: reports.reduce((s, r) => s + r.visitsThisWeek, 0),
    tasksDone: reports.reduce((s, r) => s + r.tasksDone, 0),
    atRiskCustomers: reports.reduce((s, r) => s + r.atRiskCustomers, 0),
    green: reports.filter(r => r.signal === 'green').length,
    amber: reports.filter(r => r.signal === 'amber').length,
    red: reports.filter(r => r.signal === 'red').length,
  }

  return NextResponse.json({ reports, team, generatedAt: now.toISOString() })
}
