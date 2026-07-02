import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role as string
  if (role !== 'ADMIN') {
    return NextResponse.json({ error: 'Apenas administradores podem fazer reset' }, { status: 403 })
  }

  const { confirm } = await req.json()
  if (confirm !== 'RESET_CONFIRMED') {
    return NextResponse.json({ error: 'Confirmação inválida' }, { status: 400 })
  }

  // Delete in dependency order
  await prisma.saleItem.deleteMany()
  await prisma.sale.deleteMany()
  await prisma.aiRecommendation.deleteMany()
  await prisma.customerScore.deleteMany()
  await prisma.task.deleteMany()
  await prisma.visit.deleteMany()
  await prisma.proposal.deleteMany()
  await prisma.commercialTarget.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.product.deleteMany()
  await prisma.brand.deleteMany()
  await prisma.import.deleteMany()

  return NextResponse.json({ ok: true, message: 'Base de dados limpa. Utilizadores mantidos.' })
}
