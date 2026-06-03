import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
  const startOf12MonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
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
    prisma.customer.count({ where: { ...customerFilter, status: 'AT_RISK' } }),
    prisma.customer.count({ where: { ...customerFilter, status: 'INACTIVE' } }),
    // Sales by brand (last 30 days)
    prisma.sale.groupBy({
      by: ['brandId'],
      where: { date: { gte: thirtyDaysAgo }, customer: customerFilter },
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
    // Monthly sales (last 12 months)
    prisma.$queryRaw`
      SELECT
        EXTRACT(YEAR FROM date)::int as year,
        EXTRACT(MONTH FROM date)::int as month,
        SUM(total)::float as total
      FROM "Sale"
      WHERE date >= ${startOf12MonthsAgo}
      GROUP BY year, month
      ORDER BY year, month
    `,
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
    // Top customers by sales
    prisma.customer.findMany({
      where: customerFilter,
      include: {
        sales: {
          where: { date: { gte: startOf12MonthsAgo } },
          select: { total: true },
        },
      },
      take: 10,
    }),
  ])

  // Enrich brand sales with names
  const brandIds = salesByBrand.map(s => s.brandId).filter(Boolean) as string[]
  const brands = await prisma.brand.findMany({ where: { id: { in: brandIds } } })
  const brandMap = Object.fromEntries(brands.map(b => [b.id, b.name]))

  // Enrich commercial sales with names
  const commercialIds = (salesByCommercial as any[]).map(s => s.commercialId).filter(Boolean) as string[]
  const commercials = await prisma.user.findMany({ where: { id: { in: commercialIds } } })
  const commercialMap = Object.fromEntries(commercials.map(c => [c.id, c.name]))

  const thisMonthTotal = totalSalesThisMonth._sum.total || 0
  const lastMonthTotal = totalSalesLastMonth._sum.total || 0
  const monthChange = lastMonthTotal > 0 ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 : 0

  // Process top customers
  const topCustomersSorted = topCustomers
    .map(c => ({
      id: c.id,
      name: c.name,
      zone: c.zone,
      total: c.sales.reduce((sum, s) => sum + s.total, 0),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

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
      name: brandMap[s.brandId!] || 'Sem marca',
      total: s._sum.total || 0,
    })),
    salesByCommercial: (salesByCommercial as any[]).map(s => ({
      name: commercialMap[s.commercialId!] || 'N/A',
      total: s._sum.total || 0,
    })),
    monthlySales: (monthlySales as any[]).map(r => ({
      month: `${r.month}/${r.year}`,
      total: r.total,
    })),
    topCustomers: topCustomersSorted,
  })
}
