import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  const userId = (session.user as any).id
  const { searchParams } = new URL(req.url)
  const customerId = searchParams.get('customerId')

  const where: any = {}
  if (role === 'COMMERCIAL') where.commercialId = userId
  if (customerId) where.customerId = customerId

  const visits = await prisma.visit.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true, zone: true } },
      commercial: { select: { id: true, name: true } },
    },
    orderBy: { date: 'desc' },
    take: 50,
  })

  return NextResponse.json(visits)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const userId = (session.user as any).id

  const visit = await prisma.visit.create({
    data: { ...body, commercialId: body.commercialId || userId },
    include: {
      customer: { select: { id: true, name: true } },
      commercial: { select: { id: true, name: true } },
    },
  })

  // Update customer's lastVisitDate
  await prisma.customer.update({
    where: { id: body.customerId },
    data: { lastVisitDate: new Date(body.date) },
  })

  return NextResponse.json(visit, { status: 201 })
}
