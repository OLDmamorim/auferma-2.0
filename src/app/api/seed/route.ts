import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// Protected by SEED_SECRET env var - call with ?secret=YOUR_SECRET
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret')

  if (!secret || secret !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if already seeded
  const existing = await prisma.user.count()
  if (existing > 0) {
    return NextResponse.json({ message: 'Already seeded', users: existing })
  }

  const hash = (pw: string) => bcrypt.hashSync(pw, 10)

  // Users
  const admin = await prisma.user.create({
    data: { name: 'Administrador', email: 'admin@auferma.pt', password: hash('admin123'), role: 'ADMIN' },
  })
  const director = await prisma.user.create({
    data: { name: 'Ricardo Mendes', email: 'diretor@auferma.pt', password: hash('diretor123'), role: 'DIRECTOR' },
  })
  const commercials = await Promise.all([
    prisma.user.create({ data: { name: 'João Silva', email: 'comercial1@auferma.pt', password: hash('comercial123'), role: 'COMMERCIAL' } }),
    prisma.user.create({ data: { name: 'Ana Costa', email: 'comercial2@auferma.pt', password: hash('comercial123'), role: 'COMMERCIAL' } }),
    prisma.user.create({ data: { name: 'Pedro Ferreira', email: 'comercial3@auferma.pt', password: hash('comercial123'), role: 'COMMERCIAL' } }),
    prisma.user.create({ data: { name: 'Mariana Santos', email: 'comercial4@auferma.pt', password: hash('comercial123'), role: 'COMMERCIAL' } }),
    prisma.user.create({ data: { name: 'Rui Oliveira', email: 'comercial5@auferma.pt', password: hash('comercial123'), role: 'COMMERCIAL' } }),
  ])

  // Brands
  const brands = await Promise.all([
    prisma.brand.create({ data: { name: 'Beko', description: 'Eletrodomésticos Beko' } }),
    prisma.brand.create({ data: { name: 'TimeRoad', description: 'Equipamentos TimeRoad' } }),
    prisma.brand.create({ data: { name: 'Ariston', description: 'Eletrodomésticos Ariston' } }),
    prisma.brand.create({ data: { name: 'Samsung', description: 'Tecnologia Samsung' } }),
  ])

  // Products (10 per brand)
  const productNames: Record<string, string[]> = {
    Beko: ['Frigorífico BK100', 'Máquina Lavar BK200', 'Forno BK300', 'Lava-loiça BK400', 'Micro-ondas BK500', 'Arca Congeladora BK600', 'Secadora BK700', 'Placa Indução BK800', 'Aspirador BK900', 'Ar Condicionado BK1000'],
    TimeRoad: ['Router TR100', 'Switch TR200', 'Access Point TR300', 'Firewall TR400', 'NAS TR500', 'UPS TR600', 'KVM TR700', 'Rack TR800', 'Patch Panel TR900', 'Cabo Cat6 TR1000'],
    Ariston: ['Esquentador AR100', 'Caldeira AR200', 'Termoacumulador AR300', 'Bomba Calor AR400', 'Solar AR500', 'Esquentador Turbo AR600', 'Kit Solar AR700', 'Painel Solar AR800', 'Depósito AR900', 'Circulador AR1000'],
    Samsung: ['TV 55" SM100', 'TV 65" SM200', 'Smartphone SM300', 'Tablet SM400', 'Monitor SM500', 'Soundbar SM600', 'Frigorífico SM700', 'Máquina Lavar SM800', 'Ar Condicionado SM900', 'Microondas SM1000'],
  }

  const products: any[] = []
  for (const brand of brands) {
    const names = productNames[brand.name] || []
    for (let i = 0; i < names.length; i++) {
      const p = await prisma.product.create({
        data: { name: names[i], sku: `${brand.name.toUpperCase()}-${(i + 1).toString().padStart(3, '0')}`, brandId: brand.id, price: Math.round(100 + Math.random() * 900) },
      })
      products.push({ ...p, brandId: brand.id })
    }
  }

  // Customers
  const zones = ['Norte', 'Sul', 'Centro', 'Lisboa', 'Porto', 'Algarve', 'Alentejo']
  const customerTypes = ['STANDARD', 'KEY_ACCOUNT', 'SMALL', 'STANDARD', 'STANDARD']
  const customerStatuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'AT_RISK', 'INACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'PROSPECT']
  const customerNames = [
    'Electro Lisboa Lda', 'Casa Máquinas Porto', 'Eletrodomésticos Santos', 'Techno Center Lda', 'Mundo Eletro Lda',
    'Super Eletro Norte', 'Lar Moderno Lda', 'Mega Eletro Sul', 'Casa do Lar Lda', 'Equipamentos Ferreira',
    'Eletro Braga Lda', 'Tech Solutions Porto', 'Armazém Eletro Lda', 'Distribuidora Centro', 'Loja Eletro Faro',
    'Casa Moderna Lda', 'Eletro Évora Lda', 'Tech Store Lisboa', 'Eletrodomésticos Costa', 'Casa Eletro Coimbra',
    'Mega Store Norte', 'Eletro Funchal Lda', 'Distribuidora Sul Lda', 'Casa Eletro Leiria', 'Tech World Lda',
    'Eletro Aveiro Lda', 'Loja Moderna Lda', 'Eletro Setúbal Lda', 'Casa Tech Lda', 'Eletro Viseu Lda',
    'Super Tech Norte', 'Eletro Portimão Lda', 'Casa Equipamentos Lda', 'Mega Eletro Centro', 'Tech Plus Lda',
    'Eletro Guimarães Lda', 'Loja Eletro Sul', 'Casa Moderna Porto', 'Eletro Almada Lda', 'Distribuidora Norte',
    'Eletro Sintra Lda', 'Tech Center Sul', 'Casa Eletro Faro', 'Mega Tech Lda', 'Eletro Cascais Lda',
    'Loja Tech Centro', 'Casa Eletro Braga', 'Eletro Oeiras Lda', 'Super Eletro Sul', 'Tech Home Lda',
  ]

  const customers: any[] = []
  for (let i = 0; i < 50; i++) {
    const commercial = commercials[i % commercials.length]
    const lastPurchaseDaysAgo = Math.floor(Math.random() * 120)
    const lastVisitDaysAgo = Math.floor(Math.random() * 60)
    const status = customerStatuses[i % customerStatuses.length]
    const riskScore = status === 'AT_RISK' ? 60 + Math.random() * 35 : status === 'INACTIVE' ? 70 + Math.random() * 25 : Math.random() * 45

    const c = await prisma.customer.create({
      data: {
        name: customerNames[i],
        nif: `PT${(500000000 + i * 12345).toString()}`,
        zone: zones[i % zones.length],
        phone: `+351 ${Math.floor(200000000 + Math.random() * 99999999)}`,
        email: `geral@${customerNames[i].toLowerCase().replace(/\s+/g, '').replace(/lda|pt/g, '').slice(0, 10)}.pt`,
        commercialId: commercial.id,
        type: customerTypes[i % customerTypes.length] as any,
        status: status as any,
        riskScore: Math.round(riskScore * 10) / 10,
        potentialScore: Math.round((Math.random() * 80 + 10) * 10) / 10,
        lastPurchaseDate: new Date(Date.now() - lastPurchaseDaysAgo * 86400000),
        lastVisitDate: new Date(Date.now() - lastVisitDaysAgo * 86400000),
      },
    })
    customers.push(c)
  }

  // Sales (200 across last 12 months)
  const now = new Date()
  let salesCount = 0
  for (let i = 0; i < 200; i++) {
    const customer = customers[i % customers.length]
    const brand = brands[i % brands.length]
    const daysAgo = Math.floor(Math.random() * 365)
    const saleDate = new Date(now.getTime() - daysAgo * 86400000)
    const total = Math.round((500 + Math.random() * 4500) * 100) / 100

    await prisma.sale.create({
      data: {
        customerId: customer.id,
        brandId: brand.id,
        commercialId: customer.commercialId,
        date: saleDate,
        total,
        margin: Math.round(total * (0.15 + Math.random() * 0.2) * 100) / 100,
      },
    })
    salesCount++
  }

  // Tasks (30)
  const taskTitles = [
    'Apresentar nova linha Beko', 'Follow-up proposta enviada', 'Renovar contrato anual',
    'Visita de prospeção', 'Resolver reclamação', 'Enviar catálogo atualizado',
    'Negociar condições pagamento', 'Fazer demonstração produto', 'Contactar após inatividade',
    'Preparar proposta comercial',
  ]
  for (let i = 0; i < 30; i++) {
    const commercial = commercials[i % commercials.length]
    const customer = customers[i % customers.length]
    const statuses = ['PENDING', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'PENDING']
    const priorities = ['HIGH', 'MEDIUM', 'URGENT', 'LOW', 'HIGH']
    await prisma.task.create({
      data: {
        title: taskTitles[i % taskTitles.length],
        assignedToId: commercial.id,
        createdById: director.id,
        customerId: customer.id,
        status: statuses[i % statuses.length] as any,
        priority: priorities[i % priorities.length] as any,
        dueDate: new Date(Date.now() + (i % 14 - 7) * 86400000),
      },
    })
  }

  // Visits (20)
  const types = ['VISIT', 'CALL', 'EMAIL', 'WHATSAPP', 'VISIT']
  const results = ['Reunião positiva, cliente interessado', 'Cliente solicitou proposta', 'Sem resposta', 'Encomenda confirmada', 'Próxima visita agendada']
  for (let i = 0; i < 20; i++) {
    const commercial = commercials[i % commercials.length]
    const customer = customers[i % customers.length]
    await prisma.visit.create({
      data: {
        customerId: customer.id,
        commercialId: commercial.id,
        date: new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000),
        type: types[i % types.length] as any,
        result: results[i % results.length],
        nextAction: 'Agendar próxima visita',
      },
    })
  }

  // Targets (last 6 months for each commercial)
  for (const commercial of commercials) {
    for (let m = 0; m < 6; m++) {
      const month = ((now.getMonth() - m + 12) % 12) + 1
      const year = now.getMonth() - m < 0 ? now.getFullYear() - 1 : now.getFullYear()
      await prisma.commercialTarget.create({
        data: {
          userId: commercial.id,
          year,
          month,
          target: 15000 + Math.random() * 10000,
          achieved: 10000 + Math.random() * 12000,
        },
      })
    }
  }

  // AI Recommendations
  const recTypes = [
    { type: 'CROSS_SELL', title: 'Oportunidade Cross-sell', description: 'Cliente compra Beko mas nunca adquiriu Ariston. Potencial de €3.000+.' },
    { type: 'REACTIVATION', title: 'Cliente em risco de abandono', description: 'Sem compras há mais de 60 dias. Contactar urgentemente.' },
    { type: 'UPSELL', title: 'Potencial de upgrade', description: 'Histórico de compras sugere interesse em linha premium.' },
  ]
  for (let i = 0; i < 15; i++) {
    const rec = recTypes[i % recTypes.length]
    await prisma.aiRecommendation.create({
      data: {
        customerId: customers[i].id,
        type: rec.type,
        title: rec.title,
        description: rec.description,
        priority: 3 - (i % 3),
      },
    })
  }

  return NextResponse.json({
    ok: true,
    message: '✅ Base de dados populada com sucesso!',
    data: {
      users: 7,
      brands: 4,
      products: 40,
      customers: 50,
      sales: salesCount,
      tasks: 30,
      visits: 20,
    },
  })
}
