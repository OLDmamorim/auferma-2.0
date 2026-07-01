import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role === 'COMMERCIAL') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const now = new Date()
  const qYear = parseInt(new URL(req.url).searchParams.get('year') || '')
  const year = Number.isFinite(qYear) ? qYear : now.getFullYear()
  const startOfYear = new Date(year, 0, 1)
  const endOfYear = new Date(year + 1, 0, 1)

  const [users, targets, salesByCommercial] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'COMMERCIAL' },
      select: { id: true, name: true, email: true, role: true, active: true },
      orderBy: { name: 'asc' },
    }),
    // Annual budget = sum of monthly targets for the current year
    prisma.commercialTarget.groupBy({
      by: ['userId'],
      where: { year },
      _sum: { target: true },
    }),
    // Sales for the current year per commercial
    prisma.sale.groupBy({
      by: ['commercialId'],
      where: { date: { gte: startOfYear, lt: endOfYear } },
      _sum: { total: true },
    }),
  ])

  const targetMap = new Map<string, number>()
  for (const t of targets) targetMap.set(t.userId, t._sum.target || 0)

  const salesMap = new Map<string, number>()
  for (const s of salesByCommercial) {
    if (s.commercialId) salesMap.set(s.commercialId, s._sum.total || 0)
  }

  const result = users.map(u => {
    const orcamento = targetMap.get(u.id) || 0
    const vendasAno = salesMap.get(u.id) || 0
    const desvio = orcamento > 0 ? ((vendasAno - orcamento) / orcamento) * 100 : null
    return { ...u, orcamento, vendasAno, desvio }
  })

  return NextResponse.json(result)
}
