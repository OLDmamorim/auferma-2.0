import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

// Normalise vendedor name → try to match a User in the DB
function normaliseVendedor(raw: string): string {
  if (!raw) return ''
  // Strip department prefixes like "Administração / Directas / "
  const clean = raw.replace(/^(Administração|Admin|Directas)\s*\/\s*/gi, '').trim()
  return clean
}

const MONTH_MAP: Record<string, number> = {
  'Janeiro': 1, 'Fevereiro': 2, 'Março': 3, 'Abril': 4,
  'Maio': 5, 'Junho': 6, 'Julho': 7, 'Agosto': 8,
  'Setembro': 9, 'Outubro': 10, 'Novembro': 11, 'Dezembro': 12,
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role as string
  if (!['ADMIN', 'DIRECTOR'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File
  const mode = (formData.get('mode') as string) || 'upsert' // upsert | replace

  if (!file) return NextResponse.json({ error: 'Ficheiro em falta' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const ws = workbook.Sheets[workbook.SheetNames[0]]
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: null })

  let imported = 0
  let skipped = 0
  let errors = 0
  const errorLog: string[] = []

  // ── Pre-load lookup tables ────────────────────────────────────────────────
  const existingUsers = await prisma.user.findMany({
    where: { role: { in: ['COMMERCIAL', 'ADMIN', 'DIRECTOR'] } },
    select: { id: true, name: true },
  })

  // Build user name→id map (normalised)
  const userMap = new Map<string, string>()
  for (const u of existingUsers) {
    userMap.set(u.name.toLowerCase().trim(), u.id)
    // Also map first+last name variants
    const parts = u.name.split(' ')
    if (parts.length >= 2) {
      userMap.set(`${parts[0]} ${parts[parts.length - 1]}`.toLowerCase(), u.id)
    }
  }

  // Brand cache: classification → Brand id
  const brandCache = new Map<string, string>()
  const existingBrands = await prisma.brand.findMany({ select: { id: true, name: true } })
  for (const b of existingBrands) brandCache.set(b.name.toLowerCase(), b.id)

  // Customer cache: nif → { id, commercialId }
  const customerCache = new Map<string, { id: string; commercialId: string | null }>()
  const existingCustomers = await prisma.customer.findMany({ select: { id: true, nif: true, commercialId: true } })
  for (const c of existingCustomers) {
    if (c.nif) customerCache.set(c.nif, { id: c.id, commercialId: c.commercialId })
  }

  // ── Process rows in batches of 500 ───────────────────────────────────────
  const BATCH = 500
  const salesBatch: {
    customerId: string
    commercialId: string | null
    brandId: string | null
    date: Date
    total: number
    sku: string | null
    productName: string | null
    qty: number
    unitPrice: number
  }[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    try {
      // Skip discount lines
      if (row['Tipo'] === 'Desconto') { skipped++; continue }
      // Skip zero or negative total (pure discount products)
      const valorLiq = parseFloat(row['Valor Líquido'] ?? row['Valor Liquido'] ?? 0)
      if (valorLiq <= 0) { skipped++; continue }

      const nif = row['NIF'] ? String(row['NIF']).trim() : null
      const numCliente = row['Numero Cliente'] ? String(row['Numero Cliente']).trim() : null
      const nomeCliente = row['Cliente'] ? String(row['Cliente']).trim() : null
      const localidade = row['Localidade'] ? String(row['Localidade']).trim() : null
      const vendedorRaw = row['Vendedor'] ? String(row['Vendedor']).trim() : ''
      const class1 = row['Classificação 1'] ? String(row['Classificação 1']).trim() : null
      const sku = row['Código'] ? String(row['Código']).trim() : null
      const productName = row['Produto'] ? String(row['Produto']).trim() : null
      const mesNome = row['Mês'] ? String(row['Mês']).trim() : null
      const ano = row['Ficheiro'] ? parseInt(String(row['Ficheiro'])) : null
      const qty = parseFloat(row['Quantidade'] ?? 0) || 0
      const valorProd = parseFloat(row['Valor Produto'] ?? 0) || 0

      if (!nif && !numCliente) { skipped++; continue }
      if (!mesNome || !ano) { skipped++; continue }

      const mesNum = MONTH_MAP[mesNome]
      if (!mesNum) { skipped++; continue }
      const saleDate = new Date(ano, mesNum - 1, 15)

      // ── Resolve / create Brand ──────────────────────────────────────────
      let brandId: string | null = null
      if (class1 && !['Descontos', 'Transportes', 'Rendas', 'Imobilizado', 'Diversos'].includes(class1)) {
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

      // ── Resolve commercial ──────────────────────────────────────────────
      let commercialId: string | null = null
      const vendedorNorm = normaliseVendedor(vendedorRaw).toLowerCase()
      if (vendedorNorm) {
        commercialId = userMap.get(vendedorNorm) || null
        // Fuzzy: try partial match on first word
        if (!commercialId) {
          const firstName = vendedorNorm.split(' ')[0]
          for (const [key, id] of userMap.entries()) {
            if (key.startsWith(firstName) && firstName.length > 3) {
              commercialId = id
              break
            }
          }
        }
      }

      // ── Resolve / create Customer ───────────────────────────────────────
      let customerId: string
      const lookupKey = nif || numCliente!
      if (nif && customerCache.has(nif)) {
        customerId = customerCache.get(nif)!.id
        // Update commercialId if not set
        if (!customerCache.get(nif)!.commercialId && commercialId) {
          await prisma.customer.update({ where: { id: customerId }, data: { commercialId } })
          customerCache.set(nif, { id: customerId, commercialId })
        }
      } else {
        // Parse zone from localidade (e.g. "4435-321 RIO TINTO" → "RIO TINTO")
        const zone = localidade ? localidade.replace(/^\d{4}-\d{3}\s*/, '').trim() || null : null

        const customer = await prisma.customer.upsert({
          where: { nif: nif || `NUM_${numCliente}` },
          create: {
            name: nomeCliente || `Cliente ${numCliente}`,
            nif: nif || `NUM_${numCliente}`,
            address: localidade,
            zone,
            commercialId,
            status: 'ACTIVE',
          },
          update: {
            name: nomeCliente || undefined,
            address: localidade || undefined,
            zone: zone || undefined,
            commercialId: commercialId || undefined,
          },
        })
        customerId = customer.id
        customerCache.set(nif || `NUM_${numCliente}`, { id: customerId, commercialId })
      }

      salesBatch.push({ customerId, commercialId, brandId, date: saleDate, total: valorLiq, sku, productName, qty, unitPrice: valorProd })

      // Flush batch
      if (salesBatch.length >= BATCH) {
        await flushSales(salesBatch)
        imported += salesBatch.length
        salesBatch.length = 0
      }
    } catch (err: any) {
      errors++
      if (errorLog.length < 10) errorLog.push(`Linha ${i + 2}: ${err.message}`)
    }
  }

  // Final flush
  if (salesBatch.length > 0) {
    await flushSales(salesBatch)
    imported += salesBatch.length
    salesBatch.length = 0
  }

  // Update lastPurchaseDate on customers
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

  // Log import
  await prisma.import.create({
    data: {
      type: 'auferma_matrix',
      filename: file.name,
      status: errors > 0 ? 'partial' : 'done',
      records: imported,
      errors,
    },
  })

  return NextResponse.json({
    imported,
    skipped,
    errors,
    errorLog,
    message: `Importados ${imported} registos. ${skipped} ignorados. ${errors} erros.`,
  })
}

async function flushSales(batch: {
  customerId: string; commercialId: string | null; brandId: string | null
  date: Date; total: number; sku: string | null; productName: string | null
  qty: number; unitPrice: number
}[]) {
  await prisma.sale.createMany({
    data: batch.map(s => ({
      customerId: s.customerId,
      commercialId: s.commercialId,
      brandId: s.brandId,
      date: s.date,
      total: s.total,
    })),
    skipDuplicates: false,
  })
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Return stats about current DB
  const [customers, sales, brands, users] = await Promise.all([
    prisma.customer.count(),
    prisma.sale.count(),
    prisma.brand.count(),
    prisma.user.count({ where: { role: 'COMMERCIAL' } }),
  ])

  return NextResponse.json({ customers, sales, brands, commercials: users })
}
