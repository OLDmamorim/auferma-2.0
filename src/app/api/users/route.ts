import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

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
      id: true, name: true, email: true, role: true, active: true, createdAt: true,
      _count: { select: { customers: true, tasks: true, visits: true } },
    },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  })

  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, email, password, role } = await req.json()
  if (!name || !email || !password || !role) {
    return NextResponse.json({ error: 'Campos obrigatórios em falta' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return NextResponse.json({ error: 'Email já existe' }, { status: 409 })

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: bcrypt.hashSync(password, 10),
      role,
      active: true,
    },
    select: { id: true, name: true, email: true, role: true, active: true },
  })

  return NextResponse.json(user, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, name, email, role, active, password } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

  const data: any = {}
  if (name !== undefined) data.name = name
  if (email !== undefined) data.email = email
  if (role !== undefined) data.role = role
  if (active !== undefined) data.active = active
  if (password) data.password = bcrypt.hashSync(password, 10)

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, active: true },
  })

  return NextResponse.json(user)
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

  // Prevent deleting self
  if (id === (session.user as any).id) {
    return NextResponse.json({ error: 'Não pode eliminar a sua própria conta' }, { status: 400 })
  }

  // Unlink related data instead of cascade delete
  await prisma.customer.updateMany({ where: { commercialId: id }, data: { commercialId: null } })
  await prisma.visit.updateMany({ where: { commercialId: id }, data: { commercialId: null } })
  await prisma.commercialTarget.deleteMany({ where: { userId: id } })
  await prisma.task.deleteMany({ where: { assignedToId: id } })
  await prisma.proposal.deleteMany({ where: { commercialId: id } })
  await prisma.user.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
