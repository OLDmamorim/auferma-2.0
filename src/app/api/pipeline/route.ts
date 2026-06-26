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

  const rows = await prisma.proposal.findMany({
    where,
    select: {
      id: true, title: true, value: true, stage: true, expectedDate: true,
      notes: true, closedAt: true, createdAt: true, attachmentName: true,
      customer: { select: { id: true, name: true, zone: true } },
      commercial: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })
  // expose whether an attachment exists without sending the base64 payload
  const proposals = rows.map(p => ({ ...p, hasAttachment: !!p.attachmentName }))

  const stages = ['SENT', 'ACCEPTED', 'LOST'] as const
  const summary = stages.reduce((acc, stage) => {
    const group = proposals.filter(p => p.stage === stage)
    acc[stage] = { count: group.length, value: group.reduce((s, p) => s + p.value, 0) }
    return acc
  }, {} as Record<string, { count: number; value: number }>)

  return NextResponse.json({ proposals, summary })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as any).id as string
  const body = await req.json()

  const proposal = await prisma.proposal.create({
    data: {
      customerId: body.customerId,
      commercialId: userId,
      title: body.title,
      value: parseFloat(body.value),
      stage: body.stage || 'SENT',
      expectedDate: body.expectedDate ? new Date(body.expectedDate) : null,
      notes: body.notes || null,
      attachmentName: body.attachmentName || null,
      attachmentType: body.attachmentType || null,
      attachmentData: body.attachmentData || null,
    },
    select: { id: true, customer: { select: { id: true, name: true } } },
  })

  return NextResponse.json(proposal)
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...data } = await req.json()

  const proposal = await prisma.proposal.update({
    where: { id },
    data: {
      ...data,
      value: data.value !== undefined ? parseFloat(data.value) : undefined,
      expectedDate: data.expectedDate ? new Date(data.expectedDate) : undefined,
      closedAt: data.stage && data.stage !== 'SENT' ? new Date() : undefined,
    },
    include: {
      customer: { select: { id: true, name: true } },
      commercial: { select: { name: true } },
    },
  })

  return NextResponse.json(proposal)
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await prisma.proposal.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
