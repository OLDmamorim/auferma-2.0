import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id as string
  const role = (session.user as any).role as string
  const isDirector = role === 'ADMIN' || role === 'DIRECTOR'

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() // 0-indexed
  const startOfMonth = new Date(year, month, 1)
  const startOfLastMonth = new Date(year, month - 1, 1)
  const endOfLastMonth = new Date(year, month, 0, 23, 59, 59, 999)
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
  const dayOfWeek = now.getDay()
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - daysSinceMonday)
  startOfWeek.setHours(0, 0, 0, 0)
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)
  endOfWeek.setHours(23, 59, 59, 999)

  // ── DIRECTOR / ADMIN: team totals ────────────────────────────────────────
  if (isDirector) {
    const [
      salesThisMonthAgg,
      salesLastMonthAgg,
      allTargets,
      totalCustomers,
      atRiskCustomers,
      visitsThisWeekCount,
      pendingTasksCount,
      recentSales,
      commercialsCount,
    ] = await Promise.all([
      prisma.sale.aggregate({ where: { date: { gte: startOfMonth } }, _sum: { total: true } }),
      prisma.sale.aggregate({ where: { date: { gte: startOfLastMonth, lte: endOfLastMonth } }, _sum: { total: true } }),
      prisma.commercialTarget.findMany({ where: { year, month: month + 1 }, select: { target: true } }),
      prisma.customer.count({ where: { status: 'ACTIVE' } }),
      prisma.customer.findMany({
        where: { lastVisitDate: { lt: sixtyDaysAgo } },
        select: { id: true, name: true, lastVisitDate: true, commercial: { select: { name: true } } },
        orderBy: { lastVisitDate: 'asc' },
        take: 5,
      }),
      prisma.visit.count({ where: { date: { gte: startOfWeek, lte: endOfWeek } } }),
      prisma.task.count({ where: { status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
      prisma.sale.findMany({
        where: { date: { gte: startOfMonth } },
        select: {
          id: true, date: true, total: true,
          customer: { select: { name: true } },
          brand: { select: { name: true } },
        },
        orderBy: { date: 'desc' },
        take: 5,
      }),
      prisma.user.count({ where: { role: 'COMMERCIAL', active: true } }),
    ])

    const teamTarget = allTargets.reduce((s, t) => s + (t.target || 0), 0)
    const salesThisMonth = salesThisMonthAgg._sum.total ?? 0
    const targetPct = teamTarget > 0 ? (salesThisMonth / teamTarget) * 100 : null

    return NextResponse.json({
      isTeam: true,
      salesThisMonth,
      salesLastMonth: salesLastMonthAgg._sum.total ?? 0,
      monthTarget: teamTarget > 0 ? { target: teamTarget, achieved: salesThisMonth, pct: targetPct } : null,
      myCustomers: totalCustomers,
      atRiskCustomers,
      pendingTasks: [],
      pendingTasksCount,
      visitsThisWeek: { count: visitsThisWeekCount, items: [] },
      recentSales,
      commercialsCount,
    })
  }

  // ── COMMERCIAL: personal data ─────────────────────────────────────────────
  const commercialId = userId

  const [
    salesThisMonthAgg,
    salesLastMonthAgg,
    monthTarget,
    myCustomersCount,
    atRiskCustomers,
    pendingTasks,
    visitsThisWeekRaw,
    recentSales,
  ] = await Promise.all([
    prisma.sale.aggregate({ where: { commercialId, date: { gte: startOfMonth } }, _sum: { total: true } }),
    prisma.sale.aggregate({ where: { commercialId, date: { gte: startOfLastMonth, lte: endOfLastMonth } }, _sum: { total: true } }),
    prisma.commercialTarget.findUnique({
      where: { userId_year_month: { userId: commercialId, year, month: month + 1 } },
      select: { target: true },
    }),
    prisma.customer.count({ where: { commercialId } }),
    prisma.customer.findMany({
      where: { commercialId, lastVisitDate: { lt: sixtyDaysAgo } },
      select: { id: true, name: true, lastVisitDate: true },
      take: 5,
      orderBy: { lastVisitDate: 'asc' },
    }),
    prisma.task.findMany({
      where: { assignedToId: commercialId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      select: {
        id: true, title: true, priority: true, dueDate: true, status: true,
        customer: { select: { id: true, name: true } },
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      take: 5,
    }),
    prisma.visit.findMany({
      where: { commercialId, date: { gte: startOfWeek, lte: endOfWeek } },
      select: { id: true, date: true, type: true, customer: { select: { id: true, name: true } } },
      orderBy: { date: 'asc' },
    }),
    prisma.sale.findMany({
      where: { commercialId },
      select: {
        id: true, date: true, total: true,
        customer: { select: { name: true } },
        brand: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
      take: 5,
    }),
  ])

  const salesThisMonth = salesThisMonthAgg._sum.total ?? 0
  const target = monthTarget?.target ?? 0
  const targetPct = target > 0 ? (salesThisMonth / target) * 100 : null

  return NextResponse.json({
    isTeam: false,
    salesThisMonth,
    salesLastMonth: salesLastMonthAgg._sum.total ?? 0,
    monthTarget: target > 0 ? { target, achieved: salesThisMonth, pct: targetPct } : null,
    myCustomers: myCustomersCount,
    atRiskCustomers,
    pendingTasks,
    visitsThisWeek: { count: visitsThisWeekRaw.length, items: visitsThisWeekRaw },
    recentSales,
  })
}
