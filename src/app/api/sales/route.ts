import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '25')
  const customerId = searchParams.get('customerId')
  const brandId = searchParams.get('brandId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const role = (session.user as any).role
  const userId = (session.user as any).id

  const where: any = {}
  if (role === 'COMMERCIAL') where.customer = { commercialId: userId }
  if (customerId) where.customerId = customerId
  if (brandId) where.brandId = brandId
  if (from || to) {
    where.date = {}
    if (from) where.date.gte = new Date(from)
    if (to) where.date.lte = new Date(to)
  }

  const [sales, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, zone: true } },
        brand: { select: { id: true, name: true } },
        items: { include: { product: { select: { name: true } } } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { date: 'desc' },
    }),
    prisma.sale.count({ where }),
  ])

  return NextResponse.json({ sales, total, page, pages: Math.ceil(total / limit) })
}
