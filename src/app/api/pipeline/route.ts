import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id as string
  const role = (session.user as any).role as string

  const where = role === 'COMMERCIAL' ? { commercialId: userId } : {}

  const deals = await prisma.pipeline.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true, zone: true } },
      commercial: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const stages = ['PROSPECTING', 'PROPOSAL_SENT', 'NEGOTIATION', 'ACCEPTED', 'CLOSED_WON', 'CLOSED_LOST']
  const summary = stages.reduce((acc, stage) => {
    const stagDeals = deals.filter(d => d.stage === stage)
    acc[stage] = {
      count: stagDeals.length,
      value: stagDeals.reduce((s, d) => s + d.value, 0),
    }
    return acc
  }, {} as Record<string, { count: number; value: number }>)

  const pipelineValue = deals
    .filter(d => !['CLOSED_WON', 'CLOSED_LOST'].includes(d.stage))
    .reduce((s, d) => s + d.value * (d.probability / 100), 0)

  return NextResponse.json({ deals, summary, pipelineValue })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id as string
  const body = await req.json()

  const deal = await prisma.pipeline.create({
    data: {
      customerId: body.customerId,
      commercialId: userId,
      title: body.title,
      value: parseFloat(body.value),
      stage: body.stage || 'PROSPECTING',
      probability: parseInt(body.probability) || 50,
      expectedDate: body.expectedDate ? new Date(body.expectedDate) : null,
      notes: body.notes || null,
    },
    include: {
      customer: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(deal)
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, ...data } = body

  const deal = await prisma.pipeline.update({
    where: { id },
    data: {
      ...data,
      value: data.value ? parseFloat(data.value) : undefined,
      probability: data.probability ? parseInt(data.probability) : undefined,
      expectedDate: data.expectedDate ? new Date(data.expectedDate) : undefined,
      closedAt: ['CLOSED_WON', 'CLOSED_LOST'].includes(data.stage) ? new Date() : undefined,
    },
    include: {
      customer: { select: { id: true, name: true } },
      commercial: { select: { name: true } },
    },
  })

  return NextResponse.json(deal)
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await prisma.pipeline.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
