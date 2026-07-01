import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role as string
  if (role !== 'ADMIN' && role !== 'DIRECTOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() // 0-indexed
  const dayOfMonth = now.getDate()

  // Selected period (global) — drives the monthly sales/target figures.
  // Activity status/week/today remain relative to now.
  const sp = new URL(req.url).searchParams
  const qYear = parseInt(sp.get('year') || '')
  const qMonth = parseInt(sp.get('month') || '') // 1-based
  const selYear = Number.isFinite(qYear) ? qYear : year
  const selMonth = Number.isFinite(qMonth) ? qMonth - 1 : month // 0-indexed
  const endOfSelMonth = new Date(selYear, selMonth + 1, 0, 23, 59, 59, 999)

  // Start of today
  const startOfToday = new Date(year, month, dayOfMonth, 0, 0, 0, 0)

  // Start of this week (Monday)
  const dayOfWeek = now.getDay()
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - daysSinceMonday)
  startOfWeek.setHours(0, 0, 0, 0)
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)
  endOfWeek.setHours(23, 59, 59, 999)

  // Start of the selected month
  const startOfMonth = new Date(selYear, selMonth, 1)

  // Time thresholds for status/alerts
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  // Get all active COMMERCIAL users
  const commercials = await prisma.user.findMany({
    where: { active: true, role: 'COMMERCIAL' },
    select: { id: true, name: true },
  })

  const commercialIds = commercials.map(c => c.id)

  // Parallel queries for all commercials at once
  const [
    salesTodayAgg,
    salesThisWeekAgg,
    salesThisMonthAgg,
    visitsThisWeekCounts,
    visitsTodayCounts,
    tasksDoneThisWeek,
    tasksPending,
    monthTargets,
    customersTotalCounts,
    customersAtRiskCounts,
    lastVisitDates,
    lastSaleDates,
    categoryAAtRisk,
  ] = await Promise.all([
    // Sales today per commercial
    prisma.sale.groupBy({
      by: ['commercialId'],
      where: {
        commercialId: { in: commercialIds },
        date: { gte: startOfToday },
      },
      _sum: { total: true },
    }),
    // Sales this week per commercial
    prisma.sale.groupBy({
      by: ['commercialId'],
      where: {
        commercialId: { in: commercialIds },
        date: { gte: startOfWeek, lte: endOfWeek },
      },
      _sum: { total: true },
    }),
    // Sales in the selected month per commercial
    prisma.sale.groupBy({
      by: ['commercialId'],
      where: {
        commercialId: { in: commercialIds },
        date: { gte: startOfMonth, lte: endOfSelMonth },
      },
      _sum: { total: true },
    }),
    // Visits this week per commercial
    prisma.visit.groupBy({
      by: ['commercialId'],
      where: {
        commercialId: { in: commercialIds },
        date: { gte: startOfWeek, lte: endOfWeek },
      },
      _count: { id: true },
    }),
    // Visits today per commercial
    prisma.visit.groupBy({
      by: ['commercialId'],
      where: {
        commercialId: { in: commercialIds },
        date: { gte: startOfToday },
      },
      _count: { id: true },
    }),
    // Tasks done this week per commercial (completedAt field)
    prisma.task.groupBy({
      by: ['assignedToId'],
      where: {
        assignedToId: { in: commercialIds },
        status: 'COMPLETED',
        completedAt: { gte: startOfWeek, lte: endOfWeek },
      },
      _count: { id: true },
    }),
    // Pending/in-progress tasks per commercial (via customer.commercialId)
    prisma.task.groupBy({
      by: ['assignedToId'],
      where: {
        assignedToId: { in: commercialIds },
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
      _count: { id: true },
    }),
    // CommercialTarget for the selected month
    prisma.commercialTarget.findMany({
      where: {
        userId: { in: commercialIds },
        year: selYear,
        month: selMonth + 1,
      },
      select: { userId: true, target: true, achieved: true },
    }),
    // Total active customers per commercial
    prisma.customer.groupBy({
      by: ['commercialId'],
      where: {
        commercialId: { in: commercialIds },
        status: 'ACTIVE',
      },
      _count: { id: true },
    }),
    // At-risk customers per commercial
    prisma.customer.groupBy({
      by: ['commercialId'],
      where: {
        commercialId: { in: commercialIds },
        OR: [
          { lastPurchaseDate: { lt: thirtyDaysAgo } },
          { riskScore: { gt: 60 } },
        ],
      },
      _count: { id: true },
    }),
    // Last visit date per commercial
    prisma.visit.groupBy({
      by: ['commercialId'],
      where: { commercialId: { in: commercialIds } },
      _max: { date: true },
    }),
    // Last sale date per commercial
    prisma.sale.groupBy({
      by: ['commercialId'],
      where: { commercialId: { in: commercialIds } },
      _max: { date: true },
    }),
    // Category A customers at risk: proxy = riskScore < 30 AND potentialScore > 60,
    // or lastPurchaseDate in last 60 days AND (lastVisitDate null or > 30 days ago)
    prisma.customer.findMany({
      where: {
        commercialId: { in: commercialIds },
        OR: [
          {
            riskScore: { lt: 30 },
            potentialScore: { gt: 60 },
            OR: [
              { lastVisitDate: null },
              { lastVisitDate: { lt: thirtyDaysAgo } },
            ],
          },
          {
            lastPurchaseDate: { gte: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) },
            OR: [
              { lastVisitDate: null },
              { lastVisitDate: { lt: thirtyDaysAgo } },
            ],
          },
        ],
      },
      select: { id: true, name: true, commercialId: true, lastVisitDate: true },
    }),
  ])

  // Build lookup maps
  const salesTodayMap = new Map(salesTodayAgg.map(r => [r.commercialId!, r._sum.total ?? 0]))
  const salesWeekMap = new Map(salesThisWeekAgg.map(r => [r.commercialId!, r._sum.total ?? 0]))
  const salesMonthMap = new Map(salesThisMonthAgg.map(r => [r.commercialId!, r._sum.total ?? 0]))
  const visitsWeekMap = new Map(visitsThisWeekCounts.map(r => [r.commercialId!, r._count.id]))
  const visitsTodayMap = new Map(visitsTodayCounts.map(r => [r.commercialId!, r._count.id]))
  const tasksDoneMap = new Map(tasksDoneThisWeek.map(r => [r.assignedToId!, r._count.id]))
  const tasksPendingMap = new Map(tasksPending.map(r => [r.assignedToId!, r._count.id]))
  const targetsMap = new Map(monthTargets.map(r => [r.userId, r]))
  const customersTotalMap = new Map(customersTotalCounts.map(r => [r.commercialId!, r._count.id]))
  const customersAtRiskMap = new Map(customersAtRiskCounts.map(r => [r.commercialId!, r._count.id]))
  const lastVisitMap = new Map(lastVisitDates.map(r => [r.commercialId!, r._max.date]))
  const lastSaleMap = new Map(lastSaleDates.map(r => [r.commercialId!, r._max.date]))

  // Category A at-risk customers grouped by commercialId
  const categoryAMap = new Map<string, typeof categoryAAtRisk>()
  for (const c of categoryAAtRisk) {
    if (!c.commercialId) continue
    const arr = categoryAMap.get(c.commercialId) || []
    arr.push(c)
    categoryAMap.set(c.commercialId, arr)
  }

  const alerts: { type: 'danger' | 'warning'; commercialName: string; message: string; commercialId: string }[] = []

  // Build per-commercial data
  const commercialsData = commercials.map(commercial => {
    const id = commercial.id
    const target = targetsMap.get(id) ?? null

    const lastVisitDate = lastVisitMap.get(id) ?? null
    const lastSaleDate = lastSaleMap.get(id) ?? null

    let lastActivityDate: Date | null = null
    if (lastVisitDate && lastSaleDate) {
      lastActivityDate = lastVisitDate > lastSaleDate ? lastVisitDate : lastSaleDate
    } else if (lastVisitDate) {
      lastActivityDate = lastVisitDate
    } else if (lastSaleDate) {
      lastActivityDate = lastSaleDate
    }

    let status: 'active' | 'warning' | 'inactive'
    if (!lastActivityDate) {
      status = 'inactive'
    } else if (lastActivityDate >= threeDaysAgo) {
      status = 'active'
    } else if (lastActivityDate >= sevenDaysAgo) {
      status = 'warning'
    } else {
      status = 'inactive'
    }

    const salesThisMonth = salesMonthMap.get(id) ?? 0
    const targetPct = target && target.target > 0 ? (salesThisMonth / target.target) * 100 : null

    // Alerts for this commercial
    if (lastVisitDate && lastVisitDate < tenDaysAgo) {
      alerts.push({
        type: 'danger',
        commercialName: commercial.name,
        commercialId: id,
        message: `Sem visitas há mais de 10 dias (última: ${lastVisitDate.toLocaleDateString('pt-PT')})`,
      })
    } else if (lastVisitDate && lastVisitDate < fiveDaysAgo) {
      alerts.push({
        type: 'warning',
        commercialName: commercial.name,
        commercialId: id,
        message: `Sem visitas há mais de 5 dias (última: ${lastVisitDate.toLocaleDateString('pt-PT')})`,
      })
    } else if (!lastVisitDate) {
      alerts.push({
        type: 'danger',
        commercialName: commercial.name,
        commercialId: id,
        message: 'Sem registos de visitas',
      })
    }

    // Category A customers without contact
    const catACustomers = categoryAMap.get(id) || []
    if (catACustomers.length > 0) {
      alerts.push({
        type: 'warning',
        commercialName: commercial.name,
        commercialId: id,
        message: `${catACustomers.length} cliente(s) categoria A sem contacto há 30+ dias`,
      })
    }

    // Target alerts (past day 15 or 20)
    if (targetPct !== null) {
      if (dayOfMonth > 20 && targetPct < 25) {
        alerts.push({
          type: 'danger',
          commercialName: commercial.name,
          commercialId: id,
          message: `Meta apenas ${targetPct.toFixed(0)}% após dia 20 do mês`,
        })
      } else if (dayOfMonth > 15 && targetPct < 50) {
        alerts.push({
          type: 'warning',
          commercialName: commercial.name,
          commercialId: id,
          message: `Meta abaixo de 50% (${targetPct.toFixed(0)}%) após dia 15 do mês`,
        })
      }
    }

    return {
      id,
      name: commercial.name,
      salesToday: salesTodayMap.get(id) ?? 0,
      salesThisWeek: salesWeekMap.get(id) ?? 0,
      salesThisMonth: salesMonthMap.get(id) ?? 0,
      visitsThisWeek: visitsWeekMap.get(id) ?? 0,
      visitsToday: visitsTodayMap.get(id) ?? 0,
      tasksDoneThisWeek: tasksDoneMap.get(id) ?? 0,
      tasksPending: tasksPendingMap.get(id) ?? 0,
      monthTarget: target ? { target: target.target, achieved: salesThisMonth } : null,
      targetPct,
      customersTotal: customersTotalMap.get(id) ?? 0,
      customersAtRisk: customersAtRiskMap.get(id) ?? 0,
      lastActivityDate: lastActivityDate ? lastActivityDate.toISOString() : null,
      status,
    }
  })

  // Team summary
  const totalSalesThisMonth = commercialsData.reduce((s, c) => s + c.salesThisMonth, 0)
  const totalSalesThisWeek = commercialsData.reduce((s, c) => s + c.salesThisWeek, 0)
  const totalVisitsThisWeek = commercialsData.reduce((s, c) => s + c.visitsThisWeek, 0)
  const totalTasksDone = commercialsData.reduce((s, c) => s + c.tasksDoneThisWeek, 0)
  const totalCustomersAtRisk = commercialsData.reduce((s, c) => s + c.customersAtRisk, 0)

  const targetsWithData = commercialsData.filter(c => c.monthTarget !== null)
  const sumTarget = targetsWithData.reduce((s, c) => s + (c.monthTarget?.target ?? 0), 0)
  const sumAchieved = targetsWithData.reduce((s, c) => s + (c.monthTarget?.achieved ?? 0), 0)
  const teamTargetPct = sumTarget > 0 ? (sumAchieved / sumTarget) * 100 : null

  const activeCount = commercialsData.filter(c => c.status === 'active').length
  const warningCount = commercialsData.filter(c => c.status === 'warning').length
  const inactiveCount = commercialsData.filter(c => c.status === 'inactive').length

  return NextResponse.json({
    commercials: commercialsData,
    team: {
      salesThisMonth: totalSalesThisMonth,
      salesThisWeek: totalSalesThisWeek,
      visitsThisWeek: totalVisitsThisWeek,
      tasksDone: totalTasksDone,
      customersAtRisk: totalCustomersAtRisk,
      teamTargetPct,
      active: activeCount,
      warning: warningCount,
      inactive: inactiveCount,
    },
    alerts: alerts.slice(0, 20),
  })
}
