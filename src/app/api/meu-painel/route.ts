import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id as string
  const role = (session.user as any).role as string

  // Determine which commercial to filter by
  let commercialId = userId
  if (role === 'ADMIN' || role === 'DIRECTOR') {
    const qp = req.nextUrl.searchParams.get('commercialId')
    if (qp) commercialId = qp
  }

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() // 0-indexed
  const startOfMonth = new Date(year, month, 1)
  const startOfLastMonth = new Date(year, month - 1, 1)
  const endOfLastMonth = new Date(year, month, 0, 23, 59, 59, 999)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  // Monday of current week
  const dayOfWeek = now.getDay() // 0=Sunday
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - daysSinceMonday)
  startOfWeek.setHours(0, 0, 0, 0)
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)
  endOfWeek.setHours(23, 59, 59, 999)

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
    // Sales this month
    prisma.sale.aggregate({
      where: { commercialId, date: { gte: startOfMonth } },
      _sum: { total: true },
    }),
    // Sales last month
    prisma.sale.aggregate({
      where: { commercialId, date: { gte: startOfLastMonth, lte: endOfLastMonth } },
      _sum: { total: true },
    }),
    // CommercialTarget for current month
    prisma.commercialTarget.findUnique({
      where: { userId_year_month: { userId: commercialId, year, month: month + 1 } },
      select: { target: true, achieved: true },
    }),
    // Count of customers
    prisma.customer.count({ where: { commercialId } }),
    // At-risk customers
    prisma.customer.findMany({
      where: {
        commercialId,
        OR: [
          { lastPurchaseDate: { lt: thirtyDaysAgo } },
          { riskScore: { gt: 60 } },
        ],
      },
      select: { id: true, name: true, lastPurchaseDate: true, riskScore: true },
      take: 5,
      orderBy: { riskScore: 'desc' },
    }),
    // Pending tasks
    prisma.task.findMany({
      where: {
        assignedToId: commercialId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
      select: {
        id: true,
        title: true,
        priority: true,
        dueDate: true,
        status: true,
        customer: { select: { id: true, name: true } },
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      take: 5,
    }),
    // Visits this week
    prisma.visit.findMany({
      where: {
        commercialId,
        date: { gte: startOfWeek, lte: endOfWeek },
      },
      select: {
        id: true,
        date: true,
        type: true,
        customer: { select: { id: true, name: true } },
      },
      orderBy: { date: 'asc' },
    }),
    // Recent sales
    prisma.sale.findMany({
      where: { commercialId },
      select: {
        id: true,
        date: true,
        total: true,
        customer: { select: { name: true } },
        brand: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
      take: 5,
    }),
  ])

  return NextResponse.json({
    salesThisMonth: salesThisMonthAgg._sum.total ?? 0,
    salesLastMonth: salesLastMonthAgg._sum.total ?? 0,
    monthTarget: monthTarget ?? null,
    myCustomers: myCustomersCount,
    atRiskCustomers,
    pendingTasks,
    visitsThisWeek: {
      count: visitsThisWeekRaw.length,
      items: visitsThisWeekRaw,
    },
    recentSales,
  })
}
