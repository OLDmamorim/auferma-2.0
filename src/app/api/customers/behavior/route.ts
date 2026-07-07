import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export type BehaviorStatus = 'positive' | 'risk' | 'negative'
export type CustomerCategory = 'A' | 'B' | 'C'

export interface CustomerBehavior {
  id: string
  name: string
  zone: string | null
  commercialName: string | null
  category: CustomerCategory
  behavior: BehaviorStatus
  score: number
  totalLast12m: number
  totalPrev12m: number
  growthRate: number
  avgOrderValue: number
  orderCount12m: number
  daysWithoutPurchase: number | null
  lastPurchaseDate: string | null
  trend3m: number
  alerts: string[]
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id
  const role = (session.user as any).role
  const customerFilter = role === 'COMMERCIAL' ? { commercialId: userId } : {}

  const now = new Date()
  const months12ago = new Date(now.getTime() - 365 * 86400000)
  const months24ago = new Date(now.getTime() - 730 * 86400000)
  const months3ago = new Date(now.getTime() - 90 * 86400000)
  const months6ago = new Date(now.getTime() - 180 * 86400000)

  const [customers, salesAgg] = await Promise.all([
    prisma.customer.findMany({
      where: { status: 'ACTIVE', ...customerFilter },
      select: {
        id: true,
        name: true,
        zone: true,
        lastPurchaseDate: true,
        riskScore: true,
        potentialScore: true,
        commercial: { select: { name: true } },
      },
    }),
    prisma.$queryRaw<{
      customerId: string
      period: string
      total: number
      cnt: number
    }[]>`
      SELECT
        "customerId",
        CASE
          WHEN date >= ${months12ago} THEN 'last12'
          WHEN date >= ${months24ago} THEN 'prev12'
          ELSE 'older'
        END as period,
        SUM(total)::float as total,
        COUNT(*)::int as cnt
      FROM "Sale"
      WHERE date >= ${months24ago}
      GROUP BY "customerId", period
    `,
  ])

  // Also get last 3m vs 3m-6m for trend
  const trend3mRaw = await prisma.$queryRaw<{
    customerId: string
    period: string
    total: number
  }[]>`
    SELECT
      "customerId",
      CASE WHEN date >= ${months3ago} THEN 'last3' ELSE 'prev3' END as period,
      SUM(total)::float as total
    FROM "Sale"
    WHERE date >= ${months6ago}
    GROUP BY "customerId", period
  `

  // Build maps
  const salesMap = new Map<string, { last12: number; prev12: number; cnt12: number }>()
  for (const row of salesAgg) {
    if (row.period === 'older') continue
    const cur = salesMap.get(row.customerId) || { last12: 0, prev12: 0, cnt12: 0 }
    if (row.period === 'last12') { cur.last12 = row.total; cur.cnt12 = row.cnt }
    if (row.period === 'prev12') cur.prev12 = row.total
    salesMap.set(row.customerId, cur)
  }

  const trend3mMap = new Map<string, { last3: number; prev3: number }>()
  for (const row of trend3mRaw) {
    const cur = trend3mMap.get(row.customerId) || { last3: 0, prev3: 0 }
    if (row.period === 'last3') cur.last3 = row.total
    if (row.period === 'prev3') cur.prev3 = row.total
    trend3mMap.set(row.customerId, cur)
  }

  // Compute per customer
  const results: CustomerBehavior[] = []
  const allLast12 = customers.map(c => salesMap.get(c.id)?.last12 || 0).sort((a, b) => b - a)
  const top20pct = allLast12[Math.floor(allLast12.length * 0.2)] || 1
  const top50pct = allLast12[Math.floor(allLast12.length * 0.5)] || 1

  for (const c of customers) {
    const sales = salesMap.get(c.id) || { last12: 0, prev12: 0, cnt12: 0 }
    const trend3 = trend3mMap.get(c.id) || { last3: 0, prev3: 0 }

    const growthRate = sales.prev12 > 0
      ? ((sales.last12 - sales.prev12) / sales.prev12) * 100
      : sales.last12 > 0 ? 100 : 0

    const trend3m = trend3.prev3 > 0
      ? ((trend3.last3 - trend3.prev3) / trend3.prev3) * 100
      : trend3.last3 > 0 ? 50 : 0

    const avgOrderValue = sales.cnt12 > 0 ? sales.last12 / sales.cnt12 : 0

    const daysWithoutPurchase = c.lastPurchaseDate
      ? Math.floor((now.getTime() - new Date(c.lastPurchaseDate).getTime()) / 86400000)
      : null

    // Category: A = top 20%, B = 20-50%, C = rest
    let category: CustomerCategory = 'C'
    if (sales.last12 >= top20pct) category = 'A'
    else if (sales.last12 >= top50pct) category = 'B'

    // Score 0-100: mix of activity, growth, recency
    let score = 50
    score += Math.min(25, Math.max(-25, growthRate * 0.3))
    score += Math.min(15, Math.max(-15, trend3m * 0.2))
    if (daysWithoutPurchase !== null) {
      if (daysWithoutPurchase < 30) score += 15
      else if (daysWithoutPurchase < 60) score += 5
      else if (daysWithoutPurchase < 90) score -= 10
      else score -= 20
    } else {
      score -= 15
    }
    if (sales.last12 === 0) score = 10
    score = Math.max(0, Math.min(100, score))

    // Behavior status
    const alerts: string[] = []
    let behavior: BehaviorStatus = 'positive'

    if (sales.last12 === 0) {
      behavior = 'negative'
      alerts.push('Sem compras nos últimos 12 meses')
    } else if (daysWithoutPurchase !== null && daysWithoutPurchase > 90) {
      behavior = 'negative'
      alerts.push(`Inativo há ${daysWithoutPurchase} dias`)
    } else if (growthRate < -30 || (daysWithoutPurchase !== null && daysWithoutPurchase > 60)) {
      behavior = 'risk'
      if (growthRate < -30) alerts.push(`Queda de ${Math.abs(growthRate).toFixed(0)}% vs ano anterior`)
      if (daysWithoutPurchase && daysWithoutPurchase > 60) alerts.push(`${daysWithoutPurchase} dias sem comprar`)
    } else if (trend3m < -25) {
      behavior = 'risk'
      alerts.push(`Tendência negativa nos últimos 3 meses (${trend3m.toFixed(0)}%)`)
    } else if (growthRate > 15 && trend3m >= 0) {
      behavior = 'positive'
    } else if (growthRate >= -10 && (daysWithoutPurchase === null || daysWithoutPurchase < 45)) {
      behavior = 'positive'
    } else {
      behavior = 'risk'
    }

    if (c.riskScore > 60) alerts.push(`Score de risco elevado (${c.riskScore.toFixed(0)}/100)`)

    results.push({
      id: c.id,
      name: c.name,
      zone: c.zone,
      commercialName: c.commercial?.name || null,
      category,
      behavior,
      score: Math.round(score),
      totalLast12m: sales.last12,
      totalPrev12m: sales.prev12,
      growthRate: Math.round(growthRate * 10) / 10,
      avgOrderValue: Math.round(avgOrderValue),
      orderCount12m: sales.cnt12,
      daysWithoutPurchase,
      lastPurchaseDate: c.lastPurchaseDate ? c.lastPurchaseDate.toISOString() : null,
      trend3m: Math.round(trend3m * 10) / 10,
      alerts,
    })
  }

  // Sort: negative first, then risk, then positive; within each by category A>B>C
  const behaviorOrder = { negative: 0, risk: 1, positive: 2 }
  const catOrder = { A: 0, B: 1, C: 2 }
  results.sort((a, b) => {
    const bo = behaviorOrder[a.behavior] - behaviorOrder[b.behavior]
    if (bo !== 0) return bo
    return catOrder[a.category] - catOrder[b.category]
  })

  // Summary
  const summary = {
    total: results.length,
    positive: results.filter(r => r.behavior === 'positive').length,
    risk: results.filter(r => r.behavior === 'risk').length,
    negative: results.filter(r => r.behavior === 'negative').length,
    catA: results.filter(r => r.category === 'A').length,
    catB: results.filter(r => r.category === 'B').length,
    catC: results.filter(r => r.category === 'C').length,
  }

  // Priority visit suggestions: risk + negative customers, sorted by category then urgency
  const priorityVisits = results
    .filter(r => r.behavior !== 'positive')
    .slice(0, 15)

  return NextResponse.json({ customers: results, summary, priorityVisits })
}
