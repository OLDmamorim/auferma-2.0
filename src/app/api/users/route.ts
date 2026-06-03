import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role === 'COMMERCIAL') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const userRole = searchParams.get('role')

  const users = await prisma.user.findMany({
    where: userRole ? { role: userRole as any } : undefined,
    select: {
      id: true, name: true, email: true, role: true, active: true,
      _count: { select: { customers: true, tasks: true, visits: true } },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(users)
}
