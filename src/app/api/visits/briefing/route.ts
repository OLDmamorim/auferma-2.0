import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const customerId = searchParams.get('customerId')
  if (!customerId) return NextResponse.json({ error: 'customerId required' }, { status: 400 })

  const now = new Date()
  const startOfYear = new Date(now.getFullYear(), 0, 1)
  const startOf12m = new Date(now.getTime() - 365 * 86400000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000)

  const [customer, lastVisit, salesThisYear, salesLast12m, monthlySales, pendingTasks] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        commercial: { select: { name: true } },
        recommendations: { where: { dismissed: false }, orderBy: { priority: 'desc' }, take: 3 },
      },
    }),
    prisma.visit.findFirst({
      where: { customerId },
      orderBy: { date: 'desc' },
      include: { commercial: { select: { name: true } } },
    }),
    prisma.sale.aggregate({
      where: { customerId, date: { gte: startOfYear } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.sale.aggregate({
      where: { customerId, date: { gte: startOf12m } },
      _sum: { total: true },
    }),
    prisma.$queryRaw`
      SELECT
        EXTRACT(MONTH FROM date)::int as month,
        EXTRACT(YEAR FROM date)::int as year,
        SUM(total)::float as total
      FROM "Sale"
      WHERE "customerId" = ${customerId}
        AND date >= ${startOf12m}
      GROUP BY year, month
      ORDER BY year, month
    `,
    prisma.task.findMany({
      where: { customerId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      take: 3,
    }),
  ])

  if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

  // Last 3 sales
  const recentSales = await prisma.sale.findMany({
    where: { customerId },
    include: { brand: { select: { name: true } } },
    orderBy: { date: 'desc' },
    take: 3,
  })

  // Calculate trend
  const months = monthlySales as any[]
  const lastMonthTotal = months[months.length - 1]?.total || 0
  const prevMonthTotal = months[months.length - 2]?.total || 0
  const trend = prevMonthTotal > 0
    ? ((lastMonthTotal - prevMonthTotal) / prevMonthTotal) * 100
    : 0

  const daysWithoutPurchase = customer.lastPurchaseDate
    ? Math.floor((now.getTime() - new Date(customer.lastPurchaseDate).getTime()) / 86400000)
    : null

  const daysWithoutVisit = customer.lastVisitDate
    ? Math.floor((now.getTime() - new Date(customer.lastVisitDate).getTime()) / 86400000)
    : null

  // AI Analysis (rule-based engine)
  const analysis = generateAnalysis({
    customer,
    trend,
    daysWithoutPurchase,
    daysWithoutVisit,
    salesThisYear: salesThisYear._sum.total || 0,
    salesLast12m: salesLast12m._sum.total || 0,
    salesCount: salesThisYear._count,
    lastVisit,
    pendingTasks,
    recentSales,
  })

  return NextResponse.json({
    customer,
    lastVisit,
    salesThisYear: salesThisYear._sum.total || 0,
    salesLast12m: salesLast12m._sum.total || 0,
    salesCount: salesThisYear._count,
    monthlySales: months,
    recentSales,
    pendingTasks,
    trend,
    daysWithoutPurchase,
    daysWithoutVisit,
    analysis,
  })
}

function generateAnalysis({ customer, trend, daysWithoutPurchase, daysWithoutVisit, salesThisYear, salesLast12m, salesCount, lastVisit, pendingTasks, recentSales }: any) {
  const alerts: { type: 'danger' | 'warning' | 'success' | 'info'; text: string }[] = []
  const talking_points: string[] = []
  const objectives: string[] = []
  let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral'
  let summary = ''

  // Trend analysis
  if (trend > 20) {
    alerts.push({ type: 'success', text: `Vendas em crescimento de ${trend.toFixed(0)}% face ao mês anterior` })
    sentiment = 'positive'
  } else if (trend < -20) {
    alerts.push({ type: 'danger', text: `Queda de ${Math.abs(trend).toFixed(0)}% nas vendas face ao mês anterior` })
    sentiment = 'negative'
  }

  // Inactivity
  if (daysWithoutPurchase && daysWithoutPurchase > 60) {
    alerts.push({ type: 'danger', text: `Sem compras há ${daysWithoutPurchase} dias — cliente em risco` })
    sentiment = 'negative'
    objectives.push('Perceber razão da inatividade e reativar conta')
  } else if (daysWithoutPurchase && daysWithoutPurchase > 30) {
    alerts.push({ type: 'warning', text: `Última compra há ${daysWithoutPurchase} dias — acompanhar de perto` })
  }

  // No visit
  if (daysWithoutVisit && daysWithoutVisit > 45) {
    alerts.push({ type: 'warning', text: `Visita em atraso — último contacto há ${daysWithoutVisit} dias` })
  }

  // Risk score
  if (customer.riskScore > 60) {
    alerts.push({ type: 'danger', text: `Score de risco elevado (${customer.riskScore.toFixed(0)}/100)` })
  }

  // Potential
  if (customer.potentialScore > 65) {
    alerts.push({ type: 'success', text: `Alto potencial identificado (${customer.potentialScore.toFixed(0)}/100) — explorar crescimento` })
    objectives.push('Apresentar proposta de expansão de encomendas')
  }

  // Last visit result
  if (lastVisit?.result) {
    talking_points.push(`Dar seguimento à última visita: "${lastVisit.result}"`)
  }

  // Pending tasks
  if (pendingTasks.length > 0) {
    talking_points.push(`Resolver ${pendingTasks.length} tarefa(s) pendente(s) com este cliente`)
    pendingTasks.forEach((t: any) => objectives.push(t.title))
  }

  // Recommendations from DB
  customer.recommendations?.forEach((r: any) => {
    talking_points.push(r.description)
  })

  // Sales talking points
  if (salesThisYear > 0) {
    talking_points.push(`Volume de compras este ano: €${salesThisYear.toFixed(0)} em ${salesCount} encomendas`)
  }

  // Brands
  const brands = Array.from(new Set(recentSales.map((s: any) => s.brand?.name).filter(Boolean)))
  if (brands.length > 0) {
    talking_points.push(`Marcas habituais: ${brands.join(', ')}`)
  }

  // Objectives
  if (objectives.length === 0) {
    if (sentiment === 'positive') {
      objectives.push('Consolidar relação e propor aumento de volume')
      objectives.push('Apresentar novidades de produto')
    } else if (sentiment === 'negative') {
      objectives.push('Perceber obstáculos à compra')
      objectives.push('Propor condições especiais de reativação')
    } else {
      objectives.push('Apresentar catálogo atualizado')
      objectives.push('Avaliar satisfação e necessidades')
    }
  }

  // Summary
  if (sentiment === 'positive') {
    summary = `${customer.name} é um cliente com tendência positiva. As vendas estão a crescer e o potencial é elevado. Aproveite esta visita para consolidar a relação e explorar novas oportunidades.`
  } else if (sentiment === 'negative') {
    summary = `${customer.name} apresenta sinais de alerta. ${daysWithoutPurchase && daysWithoutPurchase > 30 ? `Sem compras há ${daysWithoutPurchase} dias.` : ''} É fundamental perceber o que está a impedir as compras e apresentar uma proposta de valor clara.`
  } else {
    summary = `${customer.name} é um cliente estável${salesThisYear > 0 ? ` com €${salesThisYear.toFixed(0)} em compras este ano` : ''}. Use esta visita para reforçar a relação e identificar novas necessidades.`
  }

  return { summary, sentiment, alerts, talking_points, objectives }
}
