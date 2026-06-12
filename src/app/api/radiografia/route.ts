import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const maxDuration = 26

function generateAIInsights(data: {
  salesGrowthYoY: number
  visitFreqPerMonth: number
  taskCompletionRate: number
  atRiskPct: number
  targetAvgPct: number
  topBrandConcentration: number
  inactiveDays: number
  avgOrderValue: number
}): { type: 'positive' | 'warning' | 'danger'; title: string; body: string }[] {
  const insights: { type: 'positive' | 'warning' | 'danger'; title: string; body: string }[] = []

  if (data.salesGrowthYoY > 15) {
    insights.push({ type: 'positive', title: 'Crescimento sólido', body: `Vendas cresceram ${data.salesGrowthYoY.toFixed(0)}% face ao ano anterior. Ritmo acima da média da equipa.` })
  } else if (data.salesGrowthYoY < -10) {
    insights.push({ type: 'danger', title: 'Quebra de vendas', body: `Queda de ${Math.abs(data.salesGrowthYoY).toFixed(0)}% face ao ano anterior. Requer atenção imediata e revisão de carteira.` })
  } else if (data.salesGrowthYoY < 0) {
    insights.push({ type: 'warning', title: 'Tendência negativa', body: `Ligeira quebra de ${Math.abs(data.salesGrowthYoY).toFixed(0)}% vs ano anterior. Monitorizar evolução nas próximas semanas.` })
  }

  if (data.visitFreqPerMonth >= 15) {
    insights.push({ type: 'positive', title: 'Alta frequência de visitas', body: `Média de ${data.visitFreqPerMonth.toFixed(0)} visitas/mês. Presença forte junto dos clientes.` })
  } else if (data.visitFreqPerMonth < 5) {
    insights.push({ type: 'warning', title: 'Visitas insuficientes', body: `Apenas ${data.visitFreqPerMonth.toFixed(0)} visitas/mês em média. Aumentar presença no terreno pode melhorar resultados.` })
  }

  if (data.taskCompletionRate >= 80) {
    insights.push({ type: 'positive', title: 'Execução exemplar', body: `Taxa de conclusão de tarefas de ${data.taskCompletionRate.toFixed(0)}%. Organização e follow-up acima da média.` })
  } else if (data.taskCompletionRate < 50) {
    insights.push({ type: 'warning', title: 'Tarefas em atraso', body: `Apenas ${data.taskCompletionRate.toFixed(0)}% das tarefas concluídas. Rever prioridades e planeamento semanal.` })
  }

  if (data.atRiskPct > 30) {
    insights.push({ type: 'danger', title: 'Carteira em risco', body: `${data.atRiskPct.toFixed(0)}% dos clientes ativos em risco de churn. Priorizar visitas de retenção urgentes.` })
  } else if (data.atRiskPct > 15) {
    insights.push({ type: 'warning', title: 'Clientes a monitorizar', body: `${data.atRiskPct.toFixed(0)}% da carteira com sinais de risco. Agendar contactos preventivos.` })
  } else if (data.atRiskPct < 8) {
    insights.push({ type: 'positive', title: 'Carteira saudável', body: `Apenas ${data.atRiskPct.toFixed(0)}% dos clientes em risco. Excelente trabalho de retenção.` })
  }

  if (data.targetAvgPct >= 100) {
    insights.push({ type: 'positive', title: 'Metas superadas', body: `Média de ${data.targetAvgPct.toFixed(0)}% das metas atingidas. Performance consistente ao longo do ano.` })
  } else if (data.targetAvgPct < 70) {
    insights.push({ type: 'warning', title: 'Metas abaixo do esperado', body: `Apenas ${data.targetAvgPct.toFixed(0)}% das metas cumpridas em média. Rever estratégia de prospeção.` })
  }

  if (data.topBrandConcentration > 60) {
    insights.push({ type: 'warning', title: 'Concentração de marca', body: `Top marca representa ${data.topBrandConcentration.toFixed(0)}% das vendas. Diversificar portfolio reduz risco.` })
  }

  if (data.avgOrderValue > 0) {
    if (data.avgOrderValue > 500) {
      insights.push({ type: 'positive', title: 'Ticket médio elevado', body: `Valor médio de encomenda de €${data.avgOrderValue.toFixed(0)}. Indica clientes de maior dimensão e boas negociações.` })
    } else if (data.avgOrderValue < 100) {
      insights.push({ type: 'warning', title: 'Ticket médio baixo', body: `Valor médio de €${data.avgOrderValue.toFixed(0)} por venda. Oportunidade de upselling e cross-selling nos clientes existentes.` })
    }
  }

  if (insights.length === 0) {
    insights.push({ type: 'positive', title: 'Performance estável', body: 'Indicadores dentro dos parâmetros normais. Manter ritmo e foco nos clientes de maior potencial.' })
  }

  return insights.slice(0, 5)
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role as string
  const sessionUserId = (session.user as any).id as string

  const userId = req.nextUrl.searchParams.get('userId') || sessionUserId

  // Only ADMIN/DIRECTOR can view other commercials
  if (userId !== sessionUserId && !['ADMIN', 'DIRECTOR'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const now = new Date()
  const currentYear = now.getFullYear()
  const lastYear = currentYear - 1
  const startOfYear = new Date(currentYear, 0, 1)
  const startOfLastYear = new Date(lastYear, 0, 1)
  const endOfLastYear = new Date(lastYear, 11, 31)
  const startOfMonth = new Date(currentYear, now.getMonth(), 1)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000)

  const [
    commercial,
    salesThisYear,
    salesLastYear,
    salesByMonth,
    salesByBrand,
    customers,
    visitsThisYear,
    visitsByMonth,
    tasksAll,
    targets,
    proposals,
    recentVisits,
    pendingTasks,
  ] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, createdAt: true } }),
    prisma.sale.aggregate({ where: { commercialId: userId, date: { gte: startOfYear } }, _sum: { total: true }, _count: true }),
    prisma.sale.aggregate({ where: { commercialId: userId, date: { gte: startOfLastYear, lte: endOfLastYear } }, _sum: { total: true } }),
    prisma.sale.groupBy({ by: ['date'], where: { commercialId: userId, date: { gte: startOfYear } }, _sum: { total: true }, _count: true }),
    prisma.sale.groupBy({ by: ['brandId'], where: { commercialId: userId, date: { gte: startOfYear } }, _sum: { total: true } }),
    prisma.customer.findMany({
      where: { commercialId: userId },
      select: { id: true, name: true, status: true, lastPurchaseDate: true, riskScore: true, zone: true },
    }),
    prisma.visit.count({ where: { commercialId: userId, date: { gte: startOfYear } } }),
    prisma.visit.groupBy({ by: ['date'], where: { commercialId: userId, date: { gte: startOfYear } }, _count: true }),
    prisma.task.findMany({
      where: { customer: { commercialId: userId } },
      select: { id: true, status: true, priority: true, completedAt: true, dueDate: true, title: true },
    }),
    prisma.commercialTarget.findMany({
      where: { userId, year: currentYear },
      select: { month: true, target: true },
    }),
    prisma.proposal.findMany({
      where: { commercialId: userId },
      select: { id: true, stage: true, value: true, createdAt: true, title: true },
    }),
    prisma.visit.findMany({
      where: { commercialId: userId },
      orderBy: { date: 'desc' },
      take: 5,
      select: { id: true, date: true, notes: true, customer: { select: { name: true } } },
    }),
    prisma.task.findMany({
      where: { customer: { commercialId: userId }, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      take: 6,
      select: { id: true, title: true, priority: true, status: true, dueDate: true, customer: { select: { name: true } } },
    }),
  ])

  if (!commercial) return NextResponse.json({ error: 'Comercial não encontrado' }, { status: 404 })

  // Monthly sales aggregation
  const monthlySales: { month: number; total: number; count: number }[] = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total: 0, count: 0 }))
  for (const s of salesByMonth) {
    const m = new Date(s.date).getMonth()
    monthlySales[m].total += s._sum.total || 0
    monthlySales[m].count += s._count
  }

  const monthlyVisits: { month: number; count: number }[] = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, count: 0 }))
  for (const v of visitsByMonth) {
    const m = new Date(v.date).getMonth()
    monthlyVisits[m].count += v._count
  }

  // Brand breakdown — fetch brand names
  const brandIds = salesByBrand.filter(b => b.brandId).map(b => b.brandId!)
  const brands = brandIds.length > 0 ? await prisma.brand.findMany({ where: { id: { in: brandIds } }, select: { id: true, name: true } }) : []
  const brandNameMap = new Map(brands.map(b => [b.id, b.name]))
  const totalSalesYr = salesThisYear._sum.total || 0
  const brandBreakdown = salesByBrand
    .filter(b => b.brandId && brandNameMap.has(b.brandId))
    .map(b => ({ name: brandNameMap.get(b.brandId!)!, total: b._sum.total || 0, pct: totalSalesYr > 0 ? ((b._sum.total || 0) / totalSalesYr) * 100 : 0 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)

  // Customer stats
  const totalCustomers = customers.length
  const activeCustomers = customers.filter(c => c.status === 'ACTIVE').length
  const atRiskCustomers = customers.filter(c => c.status === 'ACTIVE' && (
    (c.lastPurchaseDate && c.lastPurchaseDate < thirtyDaysAgo) || (c.riskScore || 0) > 60
  )).length
  const atRiskPct = activeCustomers > 0 ? (atRiskCustomers / activeCustomers) * 100 : 0

  // Zone breakdown
  const zoneMap = new Map<string, number>()
  for (const c of customers) {
    if (c.zone) zoneMap.set(c.zone, (zoneMap.get(c.zone) || 0) + 1)
  }
  const zones = Array.from(zoneMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([zone, count]) => ({ zone, count }))

  // Task stats
  const totalTasks = tasksAll.length
  const completedTasks = tasksAll.filter(t => t.status === 'COMPLETED').length
  const taskCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

  // Target stats
  const targetMap = new Map(targets.map(t => [t.month, t.target]))
  const monthlyTargets = monthlySales.map(ms => {
    const target = targetMap.get(ms.month) || 0
    return { month: ms.month, target, achieved: ms.total, pct: target > 0 ? (ms.total / target) * 100 : null }
  })
  const avgTargetPct = monthlyTargets.filter(t => t.target > 0 && t.pct !== null)
  const targetAvgPct = avgTargetPct.length > 0 ? avgTargetPct.reduce((s, t) => s + (t.pct || 0), 0) / avgTargetPct.length : 0

  // Proposals
  const proposalStats = {
    sent: proposals.filter(p => p.stage === 'SENT').length,
    accepted: proposals.filter(p => p.stage === 'ACCEPTED').length,
    lost: proposals.filter(p => p.stage === 'LOST').length,
    totalValue: proposals.filter(p => p.stage === 'ACCEPTED').reduce((s, p) => s + (p.value || 0), 0),
    winRate: proposals.length > 0 ? (proposals.filter(p => p.stage === 'ACCEPTED').length / proposals.filter(p => p.stage !== 'SENT').length) * 100 : 0,
  }

  // YoY growth
  const lastYearTotal = salesLastYear._sum.total || 0
  const salesGrowthYoY = lastYearTotal > 0 ? ((totalSalesYr - lastYearTotal) / lastYearTotal) * 100 : 0

  // Visit frequency
  const monthsActive = now.getMonth() + 1
  const visitFreqPerMonth = monthsActive > 0 ? visitsThisYear / monthsActive : 0

  // Avg order value
  const avgOrderValue = (salesThisYear._count || 0) > 0 ? totalSalesYr / (salesThisYear._count || 1) : 0

  // Top brand concentration
  const topBrandConcentration = brandBreakdown.length > 0 ? brandBreakdown[0].pct : 0

  // Best month
  const bestMonth = monthlySales.reduce((best, m) => m.total > best.total ? m : best, monthlySales[0])

  // AI insights
  const aiInsights = generateAIInsights({
    salesGrowthYoY, visitFreqPerMonth, taskCompletionRate, atRiskPct,
    targetAvgPct, topBrandConcentration, inactiveDays: 0, avgOrderValue,
  })

  return NextResponse.json({
    commercial,
    summary: {
      salesThisYear: totalSalesYr,
      salesLastYear: lastYearTotal,
      salesGrowthYoY,
      salesCount: salesThisYear._count || 0,
      avgOrderValue,
      visitsThisYear,
      visitFreqPerMonth,
      totalCustomers,
      activeCustomers,
      atRiskCustomers,
      atRiskPct,
      taskCompletionRate,
      completedTasks,
      totalTasks,
      targetAvgPct,
      bestMonth: bestMonth.month,
      bestMonthTotal: bestMonth.total,
    },
    monthlySales,
    monthlyVisits,
    monthlyTargets,
    brandBreakdown,
    zones,
    proposalStats,
    recentVisits,
    pendingTasks,
    aiInsights,
  })
}
