import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || ''
  const zone = searchParams.get('zone') || ''
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const role = (session.user as any).role
  const userId = (session.user as any).id

  const where: any = {}
  if (role === 'COMMERCIAL') where.commercialId = userId
  if (search) where.name = { contains: search, mode: 'insensitive' }
  if (status) where.status = status
  if (zone) where.zone = { contains: zone, mode: 'insensitive' }

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: {
        commercial: { select: { id: true, name: true } },
        sales: {
          orderBy: { date: 'desc' },
          take: 1,
          select: { date: true, total: true },
        },
        _count: { select: { sales: true, tasks: true, visits: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { name: 'asc' },
    }),
    prisma.customer.count({ where }),
  ])

  return NextResponse.json({ customers, total, page, pages: Math.ceil(total / limit) })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const customer = await prisma.customer.create({ data: body })
  return NextResponse.json(customer, { status: 201 })
}
