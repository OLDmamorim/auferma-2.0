import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (!['ADMIN', 'DIRECTOR'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { type, data } = body

  let records = 0
  let errors = 0

  try {
    if (type === 'customers') {
      for (const row of data) {
        try {
          await prisma.customer.upsert({
            where: { nif: row.nif || `tmp-${Date.now()}-${Math.random()}` },
            update: {
              name: row.name || row.nome,
              zone: row.zone || row.zona,
              phone: row.phone || row.telefone,
              email: row.email,
            },
            create: {
              name: row.name || row.nome || 'Sem nome',
              nif: row.nif,
              zone: row.zone || row.zona,
              phone: row.phone || row.telefone,
              email: row.email,
              type: 'STANDARD',
              status: 'ACTIVE',
            },
          })
          records++
        } catch (e) {
          errors++
        }
      }
    } else if (type === 'sales') {
      for (const row of data) {
        try {
          const customer = await prisma.customer.findFirst({
            where: { name: { contains: row.customer || row.cliente, mode: 'insensitive' } },
          })
          if (!customer) { errors++; continue }

          await prisma.sale.create({
            data: {
              customerId: customer.id,
              date: new Date(row.date || row.data || Date.now()),
              total: parseFloat(row.total || row.valor || 0),
              margin: row.margin ? parseFloat(row.margin) : undefined,
            },
          })
          records++
        } catch (e) {
          errors++
        }
      }
    }

    await prisma.import.create({
      data: {
        type,
        filename: body.filename || 'import.csv',
        status: 'completed',
        records,
        errors,
      },
    })

    return NextResponse.json({ ok: true, records, errors })
  } catch (error) {
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const imports = await prisma.import.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  return NextResponse.json(imports)
}
