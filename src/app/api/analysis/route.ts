import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  const userId = (session.user as any).id
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

  const customerFilter = role === 'COMMERCIAL' ? { commercialId: userId } : {}

  const customers = await prisma.customer.findMany({
    where: customerFilter,
    include: {
      sales: {
        where: { date: { gte: sixtyDaysAgo } },
        select: { total: true, date: true },
        orderBy: { date: 'desc' },
      },
      commercial: { select: { name: true } },
    },
  })

  // Customers without purchase in 60+ days
  const inactiveCustomers = customers.filter(c => {
    if (!c.lastPurchaseDate) return true
    return new Date(c.lastPurchaseDate) < sixtyDaysAgo
  }).slice(0, 10)

  // Customers without visit in 30+ days
  const noVisitCustomers = customers.filter(c => {
    if (!c.lastVisitDate) return true
    return new Date(c.lastVisitDate) < thirtyDaysAgo
  }).slice(0, 10)

  // At risk customers
  const atRiskCustomers = customers
    .filter(c => c.riskScore > 50 || c.status === 'AT_RISK')
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 10)

  // High potential customers
  const highPotentialCustomers = customers
    .filter(c => c.potentialScore > 60 && c.status !== 'INACTIVE')
    .sort((a, b) => b.potentialScore - a.potentialScore)
    .slice(0, 10)

  return NextResponse.json({
    inactiveCustomers: inactiveCustomers.map(c => ({
      id: c.id, name: c.name, zone: c.zone,
      lastPurchase: c.lastPurchaseDate,
      daysInactive: c.lastPurchaseDate
        ? Math.floor((now.getTime() - new Date(c.lastPurchaseDate).getTime()) / 86400000)
        : null,
      commercial: c.commercial?.name,
    })),
    noVisitCustomers: noVisitCustomers.map(c => ({
      id: c.id, name: c.name, zone: c.zone,
      lastVisit: c.lastVisitDate,
      daysWithoutVisit: c.lastVisitDate
        ? Math.floor((now.getTime() - new Date(c.lastVisitDate).getTime()) / 86400000)
        : null,
      commercial: c.commercial?.name,
    })),
    atRiskCustomers: atRiskCustomers.map(c => ({
      id: c.id, name: c.name, zone: c.zone, riskScore: c.riskScore, commercial: c.commercial?.name,
    })),
    highPotentialCustomers: highPotentialCustomers.map(c => ({
      id: c.id, name: c.name, zone: c.zone, potentialScore: c.potentialScore, commercial: c.commercial?.name,
    })),
  })
}
