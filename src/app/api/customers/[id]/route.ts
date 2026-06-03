import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    include: {
      commercial: { select: { id: true, name: true, email: true } },
      sales: {
        include: { brand: true, items: { include: { product: true } } },
        orderBy: { date: 'desc' },
        take: 20,
      },
      tasks: {
        include: { assignedTo: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      visits: {
        include: { commercial: { select: { name: true } } },
        orderBy: { date: 'desc' },
        take: 10,
      },
      recommendations: {
        where: { dismissed: false },
        orderBy: { priority: 'desc' },
        take: 5,
      },
    },
  })

  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Calculate monthly sales for the last 12 months
  const monthlySales = await prisma.$queryRaw`
    SELECT
      EXTRACT(YEAR FROM date)::int as year,
      EXTRACT(MONTH FROM date)::int as month,
      SUM(total)::float as total
    FROM "Sale"
    WHERE "customerId" = ${params.id}
      AND date >= NOW() - INTERVAL '12 months'
    GROUP BY year, month
    ORDER BY year, month
  `

  return NextResponse.json({ ...customer, monthlySales })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const customer = await prisma.customer.update({
    where: { id: params.id },
    data: body,
  })
  return NextResponse.json(customer)
}
