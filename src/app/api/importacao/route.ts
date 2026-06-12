import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const maxDuration = 26

const DEFAULT_PASSWORD_HASH = bcrypt.hashSync('auferma123', 10)

// Normalise vendedor name → try to match a User in the DB
function normaliseVendedor(raw: string): string {
  if (!raw) return ''
  const clean = raw.replace(/^(Administração|Admin|Directas)\s*\/\s*/gi, '').trim()
  return clean
}

const MONTH_MAP: Record<string, number> = {
  'Janeiro': 1, 'Fevereiro': 2, 'Março': 3, 'Abril': 4,
  'Maio': 5, 'Junho': 6, 'Julho': 7, 'Agosto': 8,
  'Setembro': 9, 'Outubro': 10, 'Novembro': 11, 'Dezembro': 12,
}

const SKIP_BRANDS = ['Descontos', 'Transportes', 'Rendas', 'Imobilizado', 'Diversos']

interface ImportRow {
  mes: string | null
  ano: number | null
  numCliente: string | null
  nif: string | null
  vendedor: string | null
  cliente: string | null
  localidade: string | null
  class1: string | null
  valorLiquido: number
  tipo: string | null
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role as string
  if (!['ADMIN', 'DIRECTOR'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const rows: ImportRow[] = body.rows || []
  const filename: string = body.filename || 'import.xlsx'
  const isLastChunk: boolean = body.isLastChunk === true
  const createCommercials: boolean = body.createCommercials === true

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Sem linhas para importar' }, { status: 400 })
  }

  let imported = 0
  let skipped = 0
  let errors = 0
  const errorLog: string[] = []

  // ── Pre-load lookup tables ────────────────────────────────────────────────
  const existingUsers = await prisma.user.findMany({
    select: { id: true, name: true },
  })
  const userMap = new Map<string, string>()
  for (const u of existingUsers) {
    userMap.set(u.name.toLowerCase().trim(), u.id)
  }

  const brandCache = new Map<string, string>()
  const existingBrands = await prisma.brand.findMany({ select: { id: true, name: true } })
  for (const b of existingBrands) brandCache.set(b.name.toLowerCase(), b.id)

  const customerCache = new Map<string, { id: string; commercialId: string | null }>()
  const existingCustomers = await prisma.customer.findMany({ select: { id: true, nif: true, commercialId: true } })
  for (const c of existingCustomers) {
    if (c.nif) customerCache.set(c.nif, { id: c.id, commercialId: c.commercialId })
  }

  // ── Resolve vendedor → user (optionally create) ──────────────────────────
  async function resolveCommercial(vendedorRaw: string): Promise<string | null> {
    const norm = normaliseVendedor(vendedorRaw)
    if (!norm || norm.toLowerCase() === 'inactivo') return null
    const key = norm.toLowerCase()
    if (userMap.has(key)) return userMap.get(key)!

    if (createCommercials) {
      // Create commercial user with default password (bcrypt hash of 'auferma123')
      const email = key.replace(/\s+/g, '.').normalize('NFD').replace(/[̀-ͯ]/g, '') + '@auferma.pt'
      try {
        const user = await prisma.user.create({
          data: {
            name: norm,
            email,
            password: DEFAULT_PASSWORD_HASH,
            role: 'COMMERCIAL',
            active: true,
          },
        })
        userMap.set(key, user.id)
        return user.id
      } catch {
        return null
      }
    }
    return null
  }

  // ── Process rows ──────────────────────────────────────────────────────────
  const salesData: { customerId: string; commercialId: string | null; brandId: string | null; date: Date; total: number }[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    try {
      if (row.tipo === 'Desconto') { skipped++; continue }
      const valorLiq = Number(row.valorLiquido) || 0
      if (valorLiq <= 0) { skipped++; continue }

      const nif = row.nif ? String(row.nif).trim() : null
      const numCliente = row.numCliente ? String(row.numCliente).trim() : null
      if (!nif && !numCliente) { skipped++; continue }
      if (!row.mes || !row.ano) { skipped++; continue }

      const mesNum = MONTH_MAP[row.mes]
      if (!mesNum) { skipped++; continue }
      const saleDate = new Date(row.ano, mesNum - 1, 15)

      // Brand
      let brandId: string | null = null
      const class1 = row.class1 ? String(row.class1).trim() : null
      if (class1 && !SKIP_BRANDS.includes(class1)) {
        const brandKey = class1.toLowerCase()
        if (brandCache.has(brandKey)) {
          brandId = brandCache.get(brandKey)!
        } else {
          const brand = await prisma.brand.upsert({
            where: { name: class1 },
            create: { name: class1, active: true },
            update: {},
          })
          brandCache.set(brandKey, brand.id)
          brandId = brand.id
        }
      }

      // Commercial
      const commercialId = row.vendedor ? await resolveCommercial(String(row.vendedor)) : null

      // Customer
      const lookupNif = nif || `NUM_${numCliente}`
      let customerId: string
      if (customerCache.has(lookupNif)) {
        customerId = customerCache.get(lookupNif)!.id
        if (!customerCache.get(lookupNif)!.commercialId && commercialId) {
          await prisma.customer.update({ where: { id: customerId }, data: { commercialId } })
          customerCache.set(lookupNif, { id: customerId, commercialId })
        }
      } else {
        const localidade = row.localidade ? String(row.localidade).trim() : null
        const zone = localidade ? localidade.replace(/^\d{4}-\d{3}\s*/, '').trim() || null : null
        const customer = await prisma.customer.upsert({
          where: { nif: lookupNif },
          create: {
            name: row.cliente ? String(row.cliente).trim() : `Cliente ${numCliente}`,
            nif: lookupNif,
            address: localidade,
            zone,
            commercialId,
            status: 'ACTIVE',
          },
          update: {},
        })
        customerId = customer.id
        customerCache.set(lookupNif, { id: customerId, commercialId })
      }

      salesData.push({ customerId, commercialId, brandId, date: saleDate, total: valorLiq })
    } catch (err: any) {
      errors++
      if (errorLog.length < 5) errorLog.push(`Linha ${i + 1}: ${err.message}`)
    }
  }

  // Bulk insert sales
  if (salesData.length > 0) {
    await prisma.sale.createMany({ data: salesData })
    imported = salesData.length
  }

  // On last chunk: update lastPurchaseDate + log import
  if (isLastChunk) {
    await prisma.$executeRaw`
      UPDATE "Customer" c
      SET "lastPurchaseDate" = sub.max_date
      FROM (
        SELECT "customerId", MAX(date) as max_date
        FROM "Sale"
        GROUP BY "customerId"
      ) sub
      WHERE c.id = sub."customerId"
    `
    await prisma.import.create({
      data: { type: 'auferma_matrix', filename, status: 'done', records: imported, errors },
    })
  }

  return NextResponse.json({ imported, skipped, errors, errorLog })
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [customers, sales, brands, users] = await Promise.all([
    prisma.customer.count(),
    prisma.sale.count(),
    prisma.brand.count(),
    prisma.user.count({ where: { role: 'COMMERCIAL' } }),
  ])

  return NextResponse.json({ customers, sales, brands, commercials: users })
}
