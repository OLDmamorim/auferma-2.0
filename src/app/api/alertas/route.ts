import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEffectiveTargets } from '@/lib/targets'

export interface Alert {
  id: string
  type: 'danger' | 'warning' | 'info'
  category: 'commercial' | 'customer' | 'target' | 'visit'
  title: string
  message: string
  commercialId?: string
  commercialName?: string
  customerId?: string
  customerName?: string
  createdAt: string
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id as string
  const role = (session.user as any).role as string
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dayOfMonth = now.getDate()

  const isDirector = role === 'ADMIN' || role === 'DIRECTOR'

  // For COMMERCIAL role, only show their own alerts
  const commercialFilter = isDirector ? {} : { id: userId }

  const [commercials, effectiveTargets, salesThisMonthByCommercial, atRiskACustomers] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'COMMERCIAL', active: true, ...commercialFilter },
      select: {
        id: true, name: true,
        visits: { orderBy: { date: 'desc' }, take: 1, select: { date: true } },
        customers: {
          where: { status: 'ACTIVE' },
          select: { id: true, name: true, lastVisitDate: true, lastPurchaseDate: true, riskScore: true, potentialScore: true },
        },
      },
    }),
    getEffectiveTargets(now.getFullYear(), now.getMonth() + 1),
    prisma.sale.groupBy({
      by: ['commercialId'],
      where: { date: { gte: new Date(now.getFullYear(), now.getMonth(), 1), lt: new Date(now.getFullYear(), now.getMonth() + 1, 1) }, commercialId: { not: null } },
      _sum: { total: true },
    }),
    // Customers with high value (potential or recent sales) without recent visit
    prisma.customer.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { potentialScore: { gt: 65 } },
          { riskScore: { lt: 25 } },
        ],
        AND: [
          {
            OR: [
              { lastVisitDate: { lt: new Date(now.getTime() - 30 * 86400000) } },
              { lastVisitDate: null },
            ],
          },
        ],
        ...(isDirector ? {} : { commercialId: userId }),
      },
      select: { id: true, name: true, lastVisitDate: true, commercialId: true, commercial: { select: { name: true } } },
      take: 10,
    }),
  ])

  const alerts: Alert[] = []
  let idCounter = 0

  // Check each commercial's visit activity
  for (const commercial of commercials) {
    const lastVisit = commercial.visits[0]
    const daysSinceVisit = lastVisit
      ? Math.floor((now.getTime() - new Date(lastVisit.date).getTime()) / 86400000)
      : null

    if (daysSinceVisit === null || daysSinceVisit > 10) {
      alerts.push({
        id: `visit-danger-${idCounter++}`,
        type: 'danger',
        category: 'visit',
        title: 'Comercial sem visitas',
        message: daysSinceVisit === null
          ? `${commercial.name} ainda não registou nenhuma visita`
          : `${commercial.name} sem visitas há ${daysSinceVisit} dias`,
        commercialId: commercial.id,
        commercialName: commercial.name,
        createdAt: now.toISOString(),
      })
    } else if (daysSinceVisit > 5) {
      alerts.push({
        id: `visit-warn-${idCounter++}`,
        type: 'warning',
        category: 'visit',
        title: 'Visitas em atraso',
        message: `${commercial.name} sem visitas há ${daysSinceVisit} dias`,
        commercialId: commercial.id,
        commercialName: commercial.name,
        createdAt: now.toISOString(),
      })
    }

    // Check customers at risk in their portfolio
    const highRiskCount = commercial.customers.filter(c =>
      c.riskScore > 70 || (c.lastPurchaseDate && new Date(c.lastPurchaseDate) < new Date(now.getTime() - 60 * 86400000))
    ).length

    if (highRiskCount >= 3) {
      alerts.push({
        id: `risk-${idCounter++}`,
        type: 'danger',
        category: 'customer',
        title: 'Múltiplos clientes em risco',
        message: `${commercial.name} tem ${highRiskCount} clientes em situação de risco na sua carteira`,
        commercialId: commercial.id,
        commercialName: commercial.name,
        createdAt: now.toISOString(),
      })
    }
  }

  // Target alerts
  if (isDirector && dayOfMonth >= 15) {
    const achievedMap = new Map(salesThisMonthByCommercial.map(s => [s.commercialId!, s._sum.total || 0]))
    for (const commercial of commercials) {
      const target = effectiveTargets.get(commercial.id) || 0
      if (target <= 0) continue
      const achieved = achievedMap.get(commercial.id) || 0
      const pct = (achieved / target) * 100
      if (dayOfMonth >= 20 && pct < 25) {
        alerts.push({
          id: `target-danger-${idCounter++}`,
          type: 'danger',
          category: 'target',
          title: 'Meta muito abaixo do esperado',
          message: `${commercial.name} atingiu apenas ${pct.toFixed(0)}% da meta a ${dayOfMonth} dias do mês`,
          commercialId: commercial.id,
          commercialName: commercial.name,
          createdAt: now.toISOString(),
        })
      } else if (pct < 50) {
        alerts.push({
          id: `target-warn-${idCounter++}`,
          type: 'warning',
          category: 'target',
          title: 'Meta abaixo do ritmo',
          message: `${commercial.name} está a ${pct.toFixed(0)}% da meta mensal (dia ${dayOfMonth})`,
          commercialId: commercial.id,
          commercialName: commercial.name,
          createdAt: now.toISOString(),
        })
      }
    }
  }

  // High-value customers without recent visit
  for (const customer of atRiskACustomers) {
    const daysSince = customer.lastVisitDate
      ? Math.floor((now.getTime() - new Date(customer.lastVisitDate).getTime()) / 86400000)
      : null
    alerts.push({
      id: `customer-visit-${idCounter++}`,
      type: 'warning',
      category: 'customer',
      title: 'Cliente prioritário sem visita',
      message: daysSince !== null
        ? `${customer.name} (cliente de alto potencial) sem visita há ${daysSince} dias`
        : `${customer.name} (cliente de alto potencial) nunca recebeu visita`,
      customerId: customer.id,
      customerName: customer.name,
      commercialId: customer.commercialId || undefined,
      commercialName: customer.commercial?.name || undefined,
      createdAt: now.toISOString(),
    })
  }

  // Sort: danger first, then warning
  alerts.sort((a, b) => {
    if (a.type === 'danger' && b.type !== 'danger') return -1
    if (b.type === 'danger' && a.type !== 'danger') return 1
    return 0
  })

  return NextResponse.json({
    alerts: alerts.slice(0, 25),
    counts: {
      danger: alerts.filter(a => a.type === 'danger').length,
      warning: alerts.filter(a => a.type === 'warning').length,
      total: alerts.length,
    },
  })
}
