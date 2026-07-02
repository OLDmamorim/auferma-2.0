import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// Recreates the admin + director accounts if they don't exist.
// Safe to call multiple times — uses upsert.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret')
  if (secret !== (process.env.SEED_SECRET || 'auferma2024seed')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const hash = (pw: string) => bcrypt.hashSync(pw, 10)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@auferma.pt' },
    create: { name: 'Administrador', email: 'admin@auferma.pt', password: hash('admin123'), role: 'ADMIN', active: true },
    update: { password: hash('admin123'), role: 'ADMIN', active: true },
  })

  const director = await prisma.user.upsert({
    where: { email: 'diretor@auferma.pt' },
    create: { name: 'Ricardo Mendes', email: 'diretor@auferma.pt', password: hash('diretor123'), role: 'DIRECTOR', active: true },
    update: { password: hash('diretor123'), role: 'DIRECTOR', active: true },
  })

  return NextResponse.json({
    ok: true,
    message: 'Contas de acesso repostas.',
    admin: admin.email,
    director: director.email,
    credentials: {
      admin: 'admin@auferma.pt / admin123',
      director: 'diretor@auferma.pt / diretor123',
    },
  })
}
