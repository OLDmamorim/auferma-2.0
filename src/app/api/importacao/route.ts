import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const maxDuration = 26

const DEFAULT_PASSWORD_HASH = bcrypt.hashSync('auferma123', 10)

function normaliseVendedor(raw: string): string {
  if (!raw) return ''
  return raw.replace(/^(Administração|Admin|Directas)\s*\/\s*/gi, '').trim()
}

// Derive email: first letter of first name + last surname @auferma.pt
function vendedorEmail(norm: string): string {
  const stripped = norm.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const parts = stripped.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return stripped + '@auferma.pt'
  const first = parts[0][0] // first initial
  const last = parts[parts.length - 1] // last surname
  return `${first}${last}@auferma.pt`
}

const MONTH_MAP: Record<string, number> = {
  'janeiro': 1, 'fevereiro': 2, 'marco': 3, 'abril': 4,
  'maio': 5, 'junho': 6, 'julho': 7, 'agosto': 8,
  'setembro': 9, 'outubro': 10, 'novembro': 11, 'dezembro': 12,
}

function monthNumber(raw: string | null): number | null {
  if (!raw) return null
  const key = String(raw).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  return MONTH_MAP[key] || null
}

const SKIP_BRANDS = new Set(['Descontos', 'Transportes', 'Rendas', 'Imobilizado', 'Diversos'])

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

  // ── Pre-load all existing data in 3 parallel queries ─────────────────────
  const [existingUsers, existingBrands, existingCustomers] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true } }),
    prisma.brand.findMany({ select: { id: true, name: true } }),
    prisma.customer.findMany({ select: { id: true, nif: true, commercialId: true } }),
  ])

  const userMap = new Map<string, string>()
  for (const u of existingUsers) userMap.set(u.name.toLowerCase().trim(), u.id)

  const brandCache = new Map<string, string>()
  for (const b of existingBrands) brandCache.set(b.name.toLowerCase(), b.id)

  const customerCache = new Map<string, { id: string; commercialId: string | null }>()
  for (const c of existingCustomers) {
    if (c.nif) customerCache.set(c.nif, { id: c.id, commercialId: c.commercialId })
  }

  // ── First pass: collect all unique new brands/vendedores/customers ────────
  const newBrandNames = new Set<string>()
  const newVendedorNorms = new Set<string>()
  const newCustomers = new Map<string, { name: string; address: string | null; zone: string | null; vendedorNorm: string | null }>()

  const skipReasons: Record<string, number> = {}
  const skip = (reason: string) => { skipReasons[reason] = (skipReasons[reason] || 0) + 1 }

  // Pre-validated rows to avoid double-parsing in second pass
  type ValidRow = {
    lookupNif: string
    commercialNorm: string | null
    brandName: string | null
    date: Date
    total: number
    customerName: string
    address: string | null
    zone: string | null
  }
  const validRows: ValidRow[] = []

  for (const row of rows) {
    if (row.tipo === 'Desconto') { skip('desconto'); continue }
    const valorLiq = Number(row.valorLiquido) || 0
    if (valorLiq <= 0) { skip('valor_zero'); continue }

    const nif = row.nif ? String(row.nif).trim() : null
    const numCliente = row.numCliente ? String(row.numCliente).trim() : null
    if (!nif && !numCliente) { skip('sem_cliente'); continue }
    if (!row.mes || !row.ano) { skip('sem_data'); continue }

    const mesNum = monthNumber(row.mes)
    if (!mesNum) { skip('mes_invalido'); continue }

    const lookupNif = nif || `NUM_${numCliente}`
    const saleDate = new Date(Number(row.ano), mesNum - 1, 15)

    const class1 = row.class1 ? String(row.class1).trim() : null
    const brandName = class1 && !SKIP_BRANDS.has(class1) ? class1 : null
    if (brandName && !brandCache.has(brandName.toLowerCase())) newBrandNames.add(brandName)

    const vendedorRaw = row.vendedor ? String(row.vendedor) : null
    const vendedorNorm = vendedorRaw ? normaliseVendedor(vendedorRaw) : null
    const commercialNorm = vendedorNorm && vendedorNorm.toLowerCase() !== 'inactivo' ? vendedorNorm : null
    if (commercialNorm && createCommercials && !userMap.has(commercialNorm.toLowerCase())) {
      newVendedorNorms.add(commercialNorm)
    }

    if (!customerCache.has(lookupNif)) {
      const localidade = row.localidade ? String(row.localidade).trim() : null
      const zone = localidade ? localidade.replace(/^\d{4}-\d{3}\s*/, '').trim() || null : null
      if (!newCustomers.has(lookupNif)) {
        newCustomers.set(lookupNif, {
          name: row.cliente ? String(row.cliente).trim() : `Cliente ${numCliente}`,
          address: localidade,
          zone,
          vendedorNorm: commercialNorm,
        })
      }
    }

    validRows.push({ lookupNif, commercialNorm, brandName, date: saleDate, total: valorLiq, customerName: row.cliente ? String(row.cliente).trim() : `Cliente ${numCliente}`, address: row.localidade ? String(row.localidade).trim() : null, zone: null })
  }

  const skipped = Object.values(skipReasons).reduce((a, b) => a + b, 0)

  // ── Bulk create new brands ────────────────────────────────────────────────
  if (newBrandNames.size > 0) {
    const brandArr = Array.from(newBrandNames)
    await prisma.brand.createMany({
      data: brandArr.map(name => ({ name, active: true })),
      skipDuplicates: true,
    })
    const created = await prisma.brand.findMany({
      where: { name: { in: brandArr } },
      select: { id: true, name: true },
    })
    for (const b of created) brandCache.set(b.name.toLowerCase(), b.id)
  }

  // ── Bulk create new commercials ───────────────────────────────────────────
  if (createCommercials && newVendedorNorms.size > 0) {
    const vendArr = Array.from(newVendedorNorms).filter(v => !userMap.has(v.toLowerCase()))
    if (vendArr.length > 0) {
      await prisma.user.createMany({
        data: vendArr.map(norm => ({
          name: norm,
          email: vendedorEmail(norm),
          password: DEFAULT_PASSWORD_HASH,
          role: 'COMMERCIAL' as const,
          active: true,
        })),
        skipDuplicates: true,
      })
      const created = await prisma.user.findMany({
        where: { name: { in: vendArr } },
        select: { id: true, name: true },
      })
      for (const u of created) userMap.set(u.name.toLowerCase().trim(), u.id)
    }
  }

  // ── Bulk create new customers ─────────────────────────────────────────────
  if (newCustomers.size > 0) {
    const custArr = Array.from(newCustomers.entries()).map(([nif, c]) => ({
      nif,
      name: c.name,
      address: c.address,
      zone: c.zone,
      commercialId: c.vendedorNorm ? (userMap.get(c.vendedorNorm.toLowerCase()) || null) : null,
      status: 'ACTIVE' as const,
    }))
    await prisma.customer.createMany({ data: custArr, skipDuplicates: true })
    const created = await prisma.customer.findMany({
      where: { nif: { in: custArr.map(c => c.nif) } },
      select: { id: true, nif: true, commercialId: true },
    })
    for (const c of created) {
      if (c.nif) customerCache.set(c.nif, { id: c.id, commercialId: c.commercialId })
    }
  }

  // ── Build sales array ─────────────────────────────────────────────────────
  const salesData: { customerId: string; commercialId: string | null; brandId: string | null; date: Date; total: number }[] = []
  let errors = 0
  const errorLog: string[] = []

  for (let i = 0; i < validRows.length; i++) {
    const r = validRows[i]
    const cached = customerCache.get(r.lookupNif)
    if (!cached) {
      errors++
      if (errorLog.length < 5) errorLog.push(`NIF não encontrado: ${r.lookupNif}`)
      continue
    }
    const commercialId = r.commercialNorm ? (userMap.get(r.commercialNorm.toLowerCase()) || null) : null
    const brandId = r.brandName ? (brandCache.get(r.brandName.toLowerCase()) || null) : null
    salesData.push({ customerId: cached.id, commercialId, brandId, date: r.date, total: r.total })
  }

  // ── Bulk insert sales ─────────────────────────────────────────────────────
  if (salesData.length > 0) {
    await prisma.sale.createMany({ data: salesData })
  }

  const imported = salesData.length

  // ── On last chunk: update lastPurchaseDate + log import ───────────────────
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

  return NextResponse.json({ imported, skipped, errors, errorLog, skipReasons })
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
