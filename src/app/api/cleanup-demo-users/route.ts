import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// DELETE commercial users that have zero sales — safely removes seed/demo commercials
// after a real data import has been done.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role as string
  if (role !== 'ADMIN') {
    return NextResponse.json({ error: 'Apenas administradores' }, { status: 403 })
  }

  // Find all COMMERCIAL users
  const commercials = await prisma.user.findMany({
    where: { role: 'COMMERCIAL' },
    select: { id: true, name: true, email: true },
  })

  // Check which ones have sales
  const salesAgg = await prisma.sale.groupBy({
    by: ['commercialId'],
    where: { commercialId: { not: null } },
    _count: true,
  })
  const withSales = new Set(salesAgg.map(s => s.commercialId!))

  const toDelete = commercials.filter(c => !withSales.has(c.id))

  if (toDelete.length === 0) {
    return NextResponse.json({ deleted: 0, message: 'Nenhum utilizador demo encontrado.' })
  }

  // Delete related data first (tasks assigned, visits, targets, proposals)
  const ids = toDelete.map(c => c.id)
  await prisma.commercialTarget.deleteMany({ where: { userId: { in: ids } } })
  await prisma.visit.deleteMany({ where: { commercialId: { in: ids } } })
  await prisma.task.deleteMany({ where: { assignedToId: { in: ids } } })
  await prisma.proposal.deleteMany({ where: { commercialId: { in: ids } } })
  // Unlink customers
  await prisma.customer.updateMany({ where: { commercialId: { in: ids } }, data: { commercialId: null } })
  // Delete users
  await prisma.user.deleteMany({ where: { id: { in: ids } } })

  return NextResponse.json({
    deleted: toDelete.length,
    removedUsers: toDelete.map(c => c.name),
    message: `${toDelete.length} utilizador(es) demo removidos com sucesso.`,
  })
}
