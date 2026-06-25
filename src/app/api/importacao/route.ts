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

function vendedorEmail(norm: string): string {
  const stripped = norm.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const parts = stripped.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return stripped + '@auferma.pt'
  const first = parts[0][0]
  const last = parts[parts.length - 1]
  return `${first}${last}@auferma.pt`
}

// Excel serial date → JS Date (base: 30 Dec 1899)
function excelSerialToDate(serial: number): Date {
  const msPerDay = 86400000
  // Excel incorrectly treats 1900 as a leap year; serial 60 = 28 Feb 1900, skip it
  const adjusted = serial > 59 ? serial - 1 : serial
  return new Date(Date.UTC(1900, 0, 0) + adjusted * msPerDay)
}

const SKIP_BRANDS = new Set([
  'descontos', 'transportes', 'rendas', 'imobilizado', 'diversos',
  'outros', 'servicos', 'serviços',
])

const SKIP_FAMILIAS = new Set([
  'transportes', 'rendas', 'imobilizado', 'outros', 'serviços', 'servicos',
])

interface ImportRow {
  // New format columns
  data: number | null        // Excel serial date
  colabNome: string | null   // salesperson
  cliId: string | null       // client ID
  cliNome: string | null     // client name
  cliContr: string | null    // NIF
  cliCodPostal: string | null
  marca: string | null
  familia: string | null
  docId: string | null       // NCDsc = credit note/discount, CliFa = invoice
  vendas: number             // sale value
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

  // ── Pre-load all existing data ─────────────────────────────────────────────
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

  // ── First pass: validate and collect new entities ──────────────────────────
  const newBrandNames = new Set<string>()
  const newVendedorNorms = new Set<string>()
  const newCustomers = new Map<string, { name: string; address: string | null; zone: string | null; vendedorNorm: string | null }>()

  const skipReasons: Record<string, number> = {}
  const skip = (reason: string) => { skipReasons[reason] = (skipReasons[reason] || 0) + 1 }

  type ValidRow = {
    lookupNif: string
    commercialNorm: string | null
    brandName: string | null
    family: string | null
    date: Date
    total: number
    customerName: string
    address: string | null
    zone: string | null
  }
  const validRows: ValidRow[] = []

  for (const row of rows) {
    // Skip credit notes / discounts
    if (row.docId === 'NCDsc') { skip('desconto'); continue }

    const total = Number(row.vendas) || 0
    if (total <= 0) { skip('valor_zero'); continue }

    // Skip unwanted brands/families
    const marcaLower = row.marca ? row.marca.toLowerCase().trim() : ''
    const familiaLower = row.familia ? row.familia.toLowerCase().trim() : ''
    if (SKIP_BRANDS.has(marcaLower) || SKIP_FAMILIAS.has(familiaLower)) { skip('marca_ignorada'); continue }

    const nif = row.cliContr ? String(row.cliContr).trim() : null
    const cliId = row.cliId ? String(row.cliId).trim() : null
    if (!nif && !cliId) { skip('sem_cliente'); continue }

    if (!row.data) { skip('sem_data'); continue }
    const date = excelSerialToDate(Number(row.data))
    if (isNaN(date.getTime())) { skip('data_invalida'); continue }

    const lookupNif = nif || `ID_${cliId}`

    const brandName = row.marca && !SKIP_BRANDS.has(row.marca.toLowerCase()) ? row.marca.trim() : null
    if (brandName && !brandCache.has(brandName.toLowerCase())) newBrandNames.add(brandName)

    const vendedorRaw = row.colabNome ? String(row.colabNome) : null
    const vendedorNorm = vendedorRaw ? normaliseVendedor(vendedorRaw) : null
    const commercialNorm = vendedorNorm && vendedorNorm.toLowerCase() !== 'inactivo' ? vendedorNorm : null
    if (commercialNorm && createCommercials && !userMap.has(commercialNorm.toLowerCase())) {
      newVendedorNorms.add(commercialNorm)
    }

    const codPostal = row.cliCodPostal ? String(row.cliCodPostal).trim() : null
    const zone = codPostal ? codPostal.replace(/^\d{4}-\d{3}\s*/, '').trim() || null : null

    if (!customerCache.has(lookupNif) && !newCustomers.has(lookupNif)) {
      newCustomers.set(lookupNif, {
        name: row.cliNome ? String(row.cliNome).trim() : `Cliente ${cliId}`,
        address: codPostal,
        zone,
        vendedorNorm: commercialNorm,
      })
    }

    const family = row.familia && !SKIP_FAMILIAS.has(familiaLower) ? row.familia.trim() : null

    validRows.push({
      lookupNif,
      commercialNorm,
      brandName,
      family,
      date,
      total,
      customerName: row.cliNome ? String(row.cliNome).trim() : `Cliente ${cliId}`,
      address: codPostal,
      zone,
    })
  }

  // ── Bulk create new brands ─────────────────────────────────────────────────
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

  // ── Bulk create new commercials ────────────────────────────────────────────
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

  // ── Bulk create new customers ──────────────────────────────────────────────
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

  // ── Build and insert sales ─────────────────────────────────────────────────
  const salesData: { customerId: string; commercialId: string | null; brandId: string | null; family: string | null; date: Date; total: number }[] = []
  let errors = 0
  const errorLog: string[] = []

  for (const r of validRows) {
    const cached = customerCache.get(r.lookupNif)
    if (!cached) {
      errors++
      if (errorLog.length < 5) errorLog.push(`Cliente não encontrado: ${r.lookupNif} (${r.customerName})`)
      continue
    }
    const commercialId = r.commercialNorm ? (userMap.get(r.commercialNorm.toLowerCase()) || null) : null
    const brandId = r.brandName ? (brandCache.get(r.brandName.toLowerCase()) || null) : null
    salesData.push({ customerId: cached.id, commercialId, brandId, family: r.family, date: r.date, total: r.total })
  }

  if (salesData.length > 0) {
    await prisma.sale.createMany({ data: salesData })
  }

  const imported = salesData.length

  // ── Last chunk: update lastPurchaseDate + log ──────────────────────────────
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

  return NextResponse.json({ imported, skipped: Object.values(skipReasons).reduce((a, b) => a + b, 0), errors, errorLog, skipReasons })
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
