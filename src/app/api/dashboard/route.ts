import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Insight = { type: 'positive' | 'warning' | 'danger'; title: string; body: string }

function generateDashboardInsights(d: {
  monthChange: number
  yoyChange: number | null
  targetPct: number | null
  atRiskPct: number
  inactivePct: number
  topFamily: { name: string; pct: number } | null
  worstCustomer: { name: string; desvio: number | null } | null
}): Insight[] {
  const insights: Insight[] = []

  if (d.yoyChange !== null) {
    if (d.yoyChange > 10) insights.push({ type: 'positive', title: 'Crescimento face ao ano anterior', body: `Vendas acumuladas ${d.yoyChange.toFixed(0)}% acima do mesmo período do ano passado.` })
    else if (d.yoyChange < -10) insights.push({ type: 'danger', title: 'Quebra face ao ano anterior', body: `Vendas acumuladas ${Math.abs(d.yoyChange).toFixed(0)}% abaixo do homólogo. Requer atenção imediata.` })
    else if (d.yoyChange < 0) insights.push({ type: 'warning', title: 'Ligeira quebra homóloga', body: `Vendas ${Math.abs(d.yoyChange).toFixed(0)}% abaixo do ano anterior. Monitorizar evolução.` })
  }

  if (d.monthChange > 15) insights.push({ type: 'positive', title: 'Mês em aceleração', body: `Vendas do mês ${d.monthChange.toFixed(0)}% acima do mês anterior.` })
  else if (d.monthChange < -15) insights.push({ type: 'warning', title: 'Mês em desaceleração', body: `Vendas do mês ${Math.abs(d.monthChange).toFixed(0)}% abaixo do mês anterior.` })

  if (d.targetPct !== null) {
    if (d.targetPct >= 100) insights.push({ type: 'positive', title: 'Orçamento do mês atingido', body: `Equipa já cumpriu ${d.targetPct.toFixed(0)}% do orçamento mensal.` })
    else if (d.targetPct < 70) insights.push({ type: 'warning', title: 'Orçamento do mês em risco', body: `Apenas ${d.targetPct.toFixed(0)}% do orçamento mensal atingido até agora.` })
  }

  if (d.atRiskPct > 25) insights.push({ type: 'danger', title: 'Muitos clientes sem visita', body: `${d.atRiskPct.toFixed(0)}% da carteira está há mais de 60 dias sem visita. Priorizar contactos de retenção.` })
  else if (d.atRiskPct > 12) insights.push({ type: 'warning', title: 'Clientes a monitorizar', body: `${d.atRiskPct.toFixed(0)}% dos clientes sem visita recente. Agendar visitas preventivas.` })

  if (d.inactivePct > 30) insights.push({ type: 'danger', title: 'Carteira inativa elevada', body: `${d.inactivePct.toFixed(0)}% dos clientes sem comprar há mais de 90 dias.` })

  if (d.topFamily && d.topFamily.pct > 50) insights.push({ type: 'warning', title: 'Concentração de família', body: `A família "${d.topFamily.name}" representa ${d.topFamily.pct.toFixed(0)}% das vendas recentes. Diversificar reduz risco.` })

  if (d.worstCustomer && d.worstCustomer.desvio !== null && d.worstCustomer.desvio < -25) {
    insights.push({ type: 'warning', title: 'Cliente em forte queda', body: `${d.worstCustomer.name} está ${Math.abs(d.worstCustomer.desvio).toFixed(0)}% abaixo do ano anterior. Agendar visita.` })
  }

  if (insights.length === 0) insights.push({ type: 'positive', title: 'Indicadores estáveis', body: 'A atividade da equipa está dentro dos parâmetros normais. Manter o ritmo e foco nos clientes de maior potencial.' })

  return insights.slice(0, 6)
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()

  // Months that actually have sales — powers the month selector + default
  const monthsWithData = await prisma.$queryRaw<{ y: number; m: number }[]>`
    SELECT DISTINCT EXTRACT(YEAR FROM date)::int AS y, EXTRACT(MONTH FROM date)::int AS m
    FROM "Sale"
    ORDER BY y DESC, m DESC
  `
  const latest = monthsWithData[0]

  const sp = new URL(req.url).searchParams
  const qMonth = parseInt(sp.get('month') || '')
  const qYear = parseInt(sp.get('year') || '')
  const selYear = Number.isFinite(qYear) ? qYear : (latest ? latest.y : now.getFullYear())
  const selMonth = Number.isFinite(qMonth) ? qMonth : (latest ? latest.m : now.getMonth() + 1) // 1-based

  const currentYear = selYear
  const startOfMonth = new Date(selYear, selMonth - 1, 1)
  const startOfNextMonth = new Date(selYear, selMonth, 1)
  const startOfLastMonth = new Date(selYear, selMonth - 2, 1)
  const endOfLastMonth = new Date(selYear, selMonth - 1, 0, 23, 59, 59, 999)
  const startOfLastYear = new Date(currentYear - 1, 0, 1)
  const startOfThisYear = new Date(currentYear, 0, 1)
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
    salesByBrandFallback,
    salesByCommercial,
    monthlySales,
    monthlyTargets,
    pendingTasks,
    recentVisits,
    lastSaleAgg,
    topCustomers,
  ] = await Promise.all([
    // Total sales this month
    prisma.sale.aggregate({
      where: { date: { gte: startOfMonth, lt: startOfNextMonth }, customer: customerFilter },
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
    // Sales by family (current year)
    prisma.sale.groupBy({
      by: ['family'],
      where: { date: { gte: startOfThisYear }, customer: customerFilter, family: { not: null } },
      _sum: { total: true, quantity: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 6,
    }),
    // Fallback: sales by brand (current year) — used when no family data exists
    prisma.sale.groupBy({
      by: ['brandId'],
      where: { date: { gte: startOfThisYear }, customer: customerFilter, brandId: { not: null } },
      _sum: { total: true, quantity: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 6,
    }),
    // Sales by commercial (current month) - only for director/admin
    role !== 'COMMERCIAL' ? prisma.sale.groupBy({
      by: ['commercialId'],
      where: { date: { gte: startOfMonth, lt: startOfNextMonth } },
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
    // Most recent sale date (last analysed day)
    prisma.sale.aggregate({
      where: { customer: customerFilter },
      _max: { date: true },
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

  // Sales by family — fall back to brand names when no family data is stored yet
  let salesByCategory: { name: string; total: number; units: number }[] = salesByBrand.map(s => ({
    name: (s as any).family || 'Sem família',
    total: s._sum.total || 0,
    units: s._sum.quantity || 0,
  }))
  if (salesByCategory.length === 0 && salesByBrandFallback.length > 0) {
    const bIds = salesByBrandFallback.map(s => s.brandId).filter(Boolean) as string[]
    const bRows = await prisma.brand.findMany({ where: { id: { in: bIds } }, select: { id: true, name: true } })
    const bMap = Object.fromEntries(bRows.map(b => [b.id, b.name]))
    salesByCategory = salesByBrandFallback.map(s => ({
      name: bMap[s.brandId!] || 'Sem marca',
      total: s._sum.total || 0,
      units: s._sum.quantity || 0,
    }))
  }

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

  // ── Team AI analysis ───────────────────────────────────────────────────────
  const currentMonthIdx = selMonth - 1 // 0-based selected month
  let yoyThis = 0
  let yoyLast = 0
  for (let i = 0; i <= currentMonthIdx; i++) {
    yoyThis += monthlySeries[i].total
    yoyLast += monthlySeries[i].homologo
  }
  const yoyChange = yoyLast > 0 ? ((yoyThis - yoyLast) / yoyLast) * 100 : null

  const thisMonthBudget = targetMap.get(currentMonthIdx + 1) || 0
  const targetPct = thisMonthBudget > 0 ? (thisMonthTotal / thisMonthBudget) * 100 : null

  const atRiskPct = totalCustomers > 0 ? (atRiskCustomers / totalCustomers) * 100 : 0
  const inactivePct = totalCustomers > 0 ? (inactiveCustomers / totalCustomers) * 100 : 0

  const familyTotal = salesByCategory.reduce((s, b) => s + b.total, 0)
  const topFamily = salesByCategory[0] && familyTotal > 0
    ? { name: salesByCategory[0].name, pct: (salesByCategory[0].total / familyTotal) * 100 }
    : null

  const worstCustomer = topCustomersSorted.length > 0
    ? { name: topCustomersSorted[0].name, desvio: topCustomersSorted[0].desvio }
    : null

  const aiInsights = generateDashboardInsights({
    monthChange, yoyChange, targetPct, atRiskPct, inactivePct, topFamily, worstCustomer,
  })

  return NextResponse.json({
    aiInsights,
    lastSaleDate: lastSaleAgg._max.date,
    availableMonths: monthsWithData.map(x => ({ year: x.y, month: x.m })),
    selectedMonth: selMonth,
    selectedYear: selYear,
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
    salesByBrand: salesByCategory,
    salesByCommercial: (salesByCommercial as any[]).map(s => ({
      name: commercialMap[s.commercialId!] || 'N/A',
      total: s._sum.total || 0,
    })),
    monthlySales: monthlySeries,
    topCustomers: topCustomersSorted,
  }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } })
}
