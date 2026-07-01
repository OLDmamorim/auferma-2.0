import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Distinct year-months that have sales — powers the global period selector.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await prisma.$queryRaw<{ y: number; m: number }[]>`
    SELECT DISTINCT EXTRACT(YEAR FROM date)::int AS y, EXTRACT(MONTH FROM date)::int AS m
    FROM "Sale"
    ORDER BY y DESC, m DESC
  `
  return NextResponse.json({ months: rows.map(r => ({ year: r.y, month: r.m })) }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } })
}
