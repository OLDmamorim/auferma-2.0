import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const currentYear = now.getFullYear()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
  const startOfLastYear = new Date(currentYear - 1, 0, 1)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

  const userId = (session.user as any).id
  const role = (session.user as any).role

  // For commercial role, filter by their customers only
  const customerFilter = role === 'COMMERCIAL' ? { commercialId: userId } : {}

  const [
    totalSalesThisMonth,
    totalSalesLastMonth,
    totalCustomers,
    activeCustomers,
    atRiskCustomers,
    inactiveCustomers,
    salesByBrand,
    salesByCommercial,
    monthlySales,
    monthlyTargets,
    pendingTasks,
    recentVisits,
    topCustomers,
  ] = await Promise.all([
    // Total sales this month
    prisma.sale.aggregate({
      where: { date: { gte: startOfMonth }, customer: customerFilter },
      _sum: { total: true },
    }),
    // Total sales last month
    prisma.sale.aggregate({
      where: { date: { gte: startOfLastMonth, lte: endOfLastMonth }, customer: customerFilter },
      _sum: { total: true },
    }),
    // Customers count
    prisma.customer.count({ where: customerFilter }),
    prisma.customer.count({ where: { ...customerFilter, status: 'ACTIVE' } }),
    prisma.customer.count({ where: { ...customerFilter, lastVisitDate: { lt: sixtyDaysAgo } } }),
    prisma.customer.count({ where: { ...customerFilter, lastPurchaseDate: { lt: ninetyDaysAgo } } }),
    // Sales by family (last 30 days)
    prisma.sale.groupBy({
      by: ['family'],
      where: { date: { gte: thirtyDaysAgo }, customer: customerFilter, family: { not: null } },
      _sum: { total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 6,
    }),
    // Sales by commercial (current month) - only for director/admin
    role !== 'COMMERCIAL' ? prisma.sale.groupBy({
      by: ['commercialId'],
      where: { date: { gte: startOfMonth } },
      _sum: { total: true },
      orderBy: { _sum: { total: 'desc' } },
    }) : Promise.resolve([]),
    // Monthly sales: current year + homologous (last year), by calendar month
    prisma.$queryRaw`
      SELECT
        EXTRACT(YEAR FROM date)::int as year,
        EXTRACT(MONTH FROM date)::int as month,
        SUM(total)::float as total
      FROM "Sale"
      WHERE date >= ${startOfLastYear}
      GROUP BY year, month
      ORDER BY year, month
    `,
    // Monthly budget (target) for the current year, summed across commercials
    prisma.commercialTarget.groupBy({
      by: ['month'],
      where: { year: currentYear },
      _sum: { target: true },
    }),
    // Pending tasks
    prisma.task.count({
      where: {
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        ...(role === 'COMMERCIAL' ? { assignedToId: userId } : {})
      }
    }),
    // Recent visits count
    prisma.visit.count({
      where: {
        date: { gte: thirtyDaysAgo },
        ...(role === 'COMMERCIAL' ? { commercialId: userId } : {})
      }
    }),
    // Top customers — sales of current + last year for deviation %
    prisma.customer.findMany({
      where: customerFilter,
      select: {
        id: true,
        name: true,
        zone: true,
        commercial: { select: { name: true } },
        sales: {
          where: { date: { gte: startOfLastYear } },
          select: { total: true, date: true },
        },
      },
    }),
  ])

  // family is stored as a plain string — no enrichment needed

  // Enrich commercial sales with names
  const commercialIds = (salesByCommercial as any[]).map(s => s.commercialId).filter(Boolean) as string[]
  const commercials = await prisma.user.findMany({ where: { id: { in: commercialIds } } })
  const commercialMap = Object.fromEntries(commercials.map(c => [c.id, c.name]))

  const thisMonthTotal = totalSalesThisMonth._sum.total || 0
  const lastMonthTotal = totalSalesLastMonth._sum.total || 0
  const monthChange = lastMonthTotal > 0 ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 : 0

  // Process top customers — deviation of this year vs homologous (last year)
  const topCustomersSorted = topCustomers
    .map(c => {
      let thisYear = 0
      let lastYear = 0
      for (const s of c.sales) {
        const y = new Date(s.date).getFullYear()
        if (y === currentYear) thisYear += s.total
        else if (y === currentYear - 1) lastYear += s.total
      }
      const desvio = lastYear > 0 ? ((thisYear - lastYear) / lastYear) * 100 : null
      return {
        id: c.id,
        name: c.name,
        zone: c.zone,
        commercial: c.commercial?.name || null,
        total: thisYear,
        lastYear,
        desvio,
      }
    })
    // only customers with activity in either year
    .filter(c => c.total > 0 || c.lastYear > 0)
    // worst deviation first (biggest drops at top)
    .sort((a, b) => {
      if (a.desvio === null) return 1
      if (b.desvio === null) return -1
      return a.desvio - b.desvio
    })
    .slice(0, 10)

  // Build 12-month series for the current year with homologous + budget
  const salesMap = new Map<string, number>()
  for (const r of monthlySales as any[]) salesMap.set(`${r.year}-${r.month}`, r.total)
  const targetMap = new Map<number, number>()
  for (const t of monthlyTargets as any[]) targetMap.set(t.month, t._sum.target || 0)
  const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const monthlySeries = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    return {
      month: MONTH_NAMES[i],
      total: salesMap.get(`${currentYear}-${m}`) || 0,
      homologo: salesMap.get(`${currentYear - 1}-${m}`) || 0,
      orcamento: targetMap.get(m) || 0,
    }
  })

  return NextResponse.json({
    kpis: {
      totalSalesMonth: thisMonthTotal,
      totalSalesLastMonth: lastMonthTotal,
      monthChange,
      totalCustomers,
      activeCustomers,
      atRiskCustomers,
      inactiveCustomers,
      pendingTasks,
      recentVisits,
    },
    salesByBrand: salesByBrand.map(s => ({
      name: (s as any).family || 'Sem família',
      total: s._sum.total || 0,
    })),
    salesByCommercial: (salesByCommercial as any[]).map(s => ({
      name: commercialMap[s.commercialId!] || 'N/A',
      total: s._sum.total || 0,
    })),
    monthlySales: monthlySeries,
    topCustomers: topCustomersSorted,
  })
}
