import { PrismaClient, Role, CustomerStatus, CustomerType, TaskStatus, TaskPriority, ContactType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomBetween(min, max + 1))
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function dateMonthsAgo(months: number, dayVariance = 0): Date {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  d.setDate(d.getDate() - randomInt(0, dayVariance))
  return d
}

function dateDaysAgo(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d
}

async function main() {
  console.log('Seeding database...')

  // ── Brands ──────────────────────────────────────────────────────────────────
  const brands = await Promise.all([
    prisma.brand.upsert({
      where: { name: 'Beko' },
      update: {},
      create: { name: 'Beko', description: 'Electrodomésticos Beko - linha completa', active: true },
    }),
    prisma.brand.upsert({
      where: { name: 'TimeRoad' },
      update: {},
      create: { name: 'TimeRoad', description: 'Relógios e acessórios TimeRoad', active: true },
    }),
    prisma.brand.upsert({
      where: { name: 'Ariston' },
      update: {},
      create: { name: 'Ariston', description: 'Aquecimento e climatização Ariston', active: true },
    }),
    prisma.brand.upsert({
      where: { name: 'Samsung' },
      update: {},
      create: { name: 'Samsung', description: 'Electrónica e electrodomésticos Samsung', active: true },
    }),
  ])

  const [bekoBrand, timeRoadBrand, aristonBrand, samsungBrand] = brands
  console.log('Brands created:', brands.length)

  // ── Products ─────────────────────────────────────────────────────────────────
  const bekoProducts = [
    { name: 'Frigorífico Combinado 350L', sku: 'BK-FRIG-350', price: 599.99 },
    { name: 'Máquina de Lavar 8kg A+++', sku: 'BK-ML-8KG', price: 449.99 },
    { name: 'Máquina de Lavar Loiça 14 Talheres', sku: 'BK-MLL-14', price: 389.99 },
    { name: 'Forno Elétrico Multifunções 65L', sku: 'BK-FORN-65', price: 299.99 },
    { name: 'Micro-ondas 25L Inox', sku: 'BK-MO-25', price: 129.99 },
    { name: 'Exaustor de Parede 60cm', sku: 'BK-EX-60', price: 179.99 },
    { name: 'Placa Indução 4 Zonas', sku: 'BK-PI-4Z', price: 349.99 },
    { name: 'Arcas Congeladoras 200L', sku: 'BK-AC-200', price: 259.99 },
    { name: 'Frigorífico Side-by-Side 560L', sku: 'BK-SBS-560', price: 899.99 },
    { name: 'Secadora a Condensação 8kg', sku: 'BK-SC-8KG', price: 399.99 },
  ]

  const timeRoadProducts = [
    { name: 'Relógio Automático Aço Inox', sku: 'TR-AUTO-SS', price: 249.99 },
    { name: 'Relógio Cronógrafo Desportivo', sku: 'TR-CRON-SP', price: 189.99 },
    { name: 'Relógio Senhora Dourado', sku: 'TR-SRA-AU', price: 159.99 },
    { name: 'Relógio Mergulhador 200m', sku: 'TR-MERG-200', price: 299.99 },
    { name: 'Correia em Pele Genuína 20mm', sku: 'TR-COR-20', price: 39.99 },
    { name: 'Bracelete Metal Milanesa', sku: 'TR-BRC-MIL', price: 49.99 },
    { name: 'Relógio Smartwatch GPS', sku: 'TR-SW-GPS', price: 179.99 },
    { name: 'Caixa Exposição 12 Relógios', sku: 'TR-CX-12', price: 59.99 },
    { name: 'Relógio Bolso Clássico', sku: 'TR-BOL-CL', price: 89.99 },
    { name: 'Relógio Infantil Colorido', sku: 'TR-INF-COL', price: 29.99 },
  ]

  const aristonProducts = [
    { name: 'Esquentador 11L GPL', sku: 'AR-ESQ-11G', price: 199.99 },
    { name: 'Esquentador 14L Gás Natural', sku: 'AR-ESQ-14N', price: 229.99 },
    { name: 'Termoacumulador 100L', sku: 'AR-TA-100', price: 349.99 },
    { name: 'Termoacumulador 150L', sku: 'AR-TA-150', price: 449.99 },
    { name: 'Caldeira Mural 24kW', sku: 'AR-CAL-24', price: 799.99 },
    { name: 'Bomba de Calor Ar-Água 8kW', sku: 'AR-BC-8', price: 2499.99 },
    { name: 'Painel Solar Térmico 2m²', sku: 'AR-SOL-2', price: 599.99 },
    { name: 'Kit Termostato Programável', sku: 'AR-TERM-P', price: 89.99 },
    { name: 'Radiador Alumínio 10 Elementos', sku: 'AR-RAD-10', price: 119.99 },
    { name: 'Válvula Termostática Radiador', sku: 'AR-VAL-TR', price: 24.99 },
  ]

  const samsungProducts = [
    { name: 'Televisor QLED 65" 4K', sku: 'SS-TV-65Q', price: 1299.99 },
    { name: 'Televisor UHD 55" 4K', sku: 'SS-TV-55U', price: 799.99 },
    { name: 'Televisor OLED 77" 4K', sku: 'SS-TV-77O', price: 2199.99 },
    { name: 'Frigorífico American 600L', sku: 'SS-FR-600', price: 1199.99 },
    { name: 'Máquina Lavar Ecobubble 10kg', sku: 'SS-ML-10E', price: 599.99 },
    { name: 'Ar Condicionado Split 12000 BTU', sku: 'SS-AC-12', price: 699.99 },
    { name: 'Micro-ondas com Grill 32L', sku: 'SS-MO-32G', price: 199.99 },
    { name: 'Barra de Som 2.1 Ch 320W', sku: 'SS-BS-320', price: 299.99 },
    { name: 'Monitor 27" FHD IPS', sku: 'SS-MON-27', price: 249.99 },
    { name: 'Tablet Galaxy 10.5" 128GB', sku: 'SS-TAB-105', price: 399.99 },
  ]

  const createProducts = async (productDefs: typeof bekoProducts, brand: typeof bekoBrand) => {
    return Promise.all(
      productDefs.map(p =>
        prisma.product.upsert({
          where: { sku: p.sku },
          update: {},
          create: { ...p, brandId: brand.id, active: true },
        })
      )
    )
  }

  const [bekoProds, timeRoadProds, aristonProds, samsungProds] = await Promise.all([
    createProducts(bekoProducts, bekoBrand),
    createProducts(timeRoadProducts, timeRoadBrand),
    createProducts(aristonProducts, aristonBrand),
    createProducts(samsungProducts, samsungBrand),
  ])

  const allProducts = [...bekoProds, ...timeRoadProds, ...aristonProds, ...samsungProds]
  console.log('Products created:', allProducts.length)

  // ── Users ────────────────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('admin123', 10)
  const directorHash = await bcrypt.hash('diretor123', 10)
  const commercialHash = await bcrypt.hash('comercial123', 10)

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@auferma.pt' },
    update: {},
    create: {
      name: 'Administrador Sistema',
      email: 'admin@auferma.pt',
      password: adminHash,
      role: Role.ADMIN,
      active: true,
    },
  })

  const directorUser = await prisma.user.upsert({
    where: { email: 'diretor@auferma.pt' },
    update: {},
    create: {
      name: 'António Ferreira',
      email: 'diretor@auferma.pt',
      password: directorHash,
      role: Role.DIRECTOR,
      active: true,
    },
  })

  const commercialData = [
    { name: 'João Silva', email: 'comercial1@auferma.pt' },
    { name: 'Maria Santos', email: 'comercial2@auferma.pt' },
    { name: 'Pedro Costa', email: 'comercial3@auferma.pt' },
    { name: 'Ana Rodrigues', email: 'comercial4@auferma.pt' },
    { name: 'Rui Oliveira', email: 'comercial5@auferma.pt' },
  ]

  const commercials = await Promise.all(
    commercialData.map(c =>
      prisma.user.upsert({
        where: { email: c.email },
        update: {},
        create: {
          ...c,
          password: commercialHash,
          role: Role.COMMERCIAL,
          active: true,
        },
      })
    )
  )

  console.log('Users created:', 2 + commercials.length)

  // ── Customers ─────────────────────────────────────────────────────────────────
  const zones = ['Norte', 'Sul', 'Lisboa', 'Centro', 'Algarve', 'Alentejo', 'Ilhas']
  const customerNames = [
    'Electrodomésticos Martins Lda',
    'Casa da Electrónica Torres',
    'Armazéns Sousa & Filhos',
    'Loja do Lar Ferreira',
    'Electro Carvalho SA',
    'Distribuições Lopes Lda',
    'Casa Pinto Electrodomésticos',
    'Comércio Gomes e Associados',
    'Eletro Ribeiro Centro',
    'Loja Tecnológica Nunes',
    'Armazéns Alves Norte',
    'Electrolar Ramos',
    'Casa Fonseca Eletrodomésticos',
    'Distribuições Cardoso',
    'Eletro Melo & Filhos',
    'Casa do Eletrodoméstico Cunha',
    'Equipamentos Moreira Lda',
    'Loja Pais e Pais Lda',
    'Electrónica Borges Centro',
    'Armazéns Correia Lda',
    'Electromar Teixeira',
    'Loja Sequeira Eletro',
    'Casa Bento e Sobrinho',
    'Eletro Machado Sul',
    'Loja Monteiro Equipamentos',
    'Distribuições Pereira & Co',
    'Electro Simões Lda',
    'Casa Marques do Norte',
    'Armazéns Azevedo',
    'Loja Eletro Braga',
    'Equipamentos Coelho Lda',
    'Electro Fernandes Porto',
    'Casa da Tecnologia Henriques',
    'Distribuições Esteves Lda',
    'Loja Eletro Serrano',
    'Armazéns Freitas & Irmãos',
    'Casa Nogueira Eletro',
    'Electrónica Barros Lisboa',
    'Loja Eletro Vasques',
    'Distribuições Nascimento Lda',
    'Electro Pimentel Centro',
    'Casa Amaral Equipamentos',
    'Armazéns Tavares Lda',
    'Loja Teles Eletrodomésticos',
    'Distribuições Lourenço',
    'Casa Eletro Coutinho Lda',
    'Equipamentos Antunes Norte',
    'Eletro Faria & Filhos',
    'Casa Veiga Eletro Sul',
    'Distribuições Pinto Algarve',
  ]

  const customerStatuses: CustomerStatus[] = [
    CustomerStatus.ACTIVE, CustomerStatus.ACTIVE, CustomerStatus.ACTIVE,
    CustomerStatus.AT_RISK, CustomerStatus.INACTIVE, CustomerStatus.PROSPECT,
  ]
  const customerTypes: CustomerType[] = [
    CustomerType.KEY_ACCOUNT, CustomerType.STANDARD, CustomerType.STANDARD,
    CustomerType.STANDARD, CustomerType.SMALL, CustomerType.PROSPECT,
  ]

  const customers = await Promise.all(
    customerNames.map((name, i) => {
      const commercial = commercials[i % commercials.length]
      const status = randomElement(customerStatuses)
      const type = i < 5 ? CustomerType.KEY_ACCOUNT : randomElement(customerTypes)
      const riskScore = status === CustomerStatus.AT_RISK
        ? randomBetween(60, 90)
        : status === CustomerStatus.INACTIVE
        ? randomBetween(70, 95)
        : randomBetween(5, 45)
      const potentialScore = type === CustomerType.KEY_ACCOUNT
        ? randomBetween(70, 95)
        : randomBetween(20, 80)
      const nif = `PT${500000000 + i * 1234567 % 100000000}`
      const lastPurchaseDaysAgo = status === CustomerStatus.INACTIVE ? randomInt(90, 365) : randomInt(1, 60)
      const lastVisitDaysAgo = randomInt(1, 90)
      const zone = zones[i % zones.length]

      return prisma.customer.create({
        data: {
          name,
          nif,
          zone,
          address: `Rua ${['das Flores', 'do Comércio', 'Principal', 'Nova', 'da Industria'][i % 5]}, ${randomInt(1, 200)}, ${zone}`,
          phone: `+351 ${randomInt(200, 299)} ${randomInt(100, 999)} ${randomInt(100, 999)}`,
          email: `geral@${name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 12)}.pt`,
          commercialId: commercial.id,
          type,
          status,
          riskScore: Math.round(riskScore * 10) / 10,
          potentialScore: Math.round(potentialScore * 10) / 10,
          lastPurchaseDate: dateDaysAgo(lastPurchaseDaysAgo),
          lastVisitDate: dateDaysAgo(lastVisitDaysAgo),
          notes: i % 7 === 0 ? 'Cliente com histórico sólido. Negociar condições especiais.' : null,
        },
      })
    })
  )

  console.log('Customers created:', customers.length)

  // ── Sales ─────────────────────────────────────────────────────────────────────
  // 200 sales spread over last 12 months
  const brandsList = [bekoBrand, timeRoadBrand, aristonBrand, samsungBrand]
  const productsByBrand: Record<string, typeof allProducts> = {
    [bekoBrand.id]: bekoProds,
    [timeRoadBrand.id]: timeRoadProds,
    [aristonBrand.id]: aristonProds,
    [samsungBrand.id]: samsungProds,
  }

  for (let i = 0; i < 200; i++) {
    const customer = customers[i % customers.length]
    const brand = randomElement(brandsList)
    const commercial = customer.commercialId
    const monthsAgo = randomInt(0, 11)
    const saleDate = dateMonthsAgo(monthsAgo, 28)
    const itemCount = randomInt(1, 4)
    const brandProds = productsByBrand[brand.id]
    const saleItems: { productId: string; quantity: number; unitPrice: number; total: number }[] = []
    let saleTotal = 0

    for (let j = 0; j < itemCount; j++) {
      const product = randomElement(brandProds)
      const quantity = randomInt(1, 5)
      const unitPrice = product.price! * randomBetween(0.85, 1.05)
      const rounded = Math.round(unitPrice * 100) / 100
      const itemTotal = Math.round(rounded * quantity * 100) / 100
      saleTotal += itemTotal
      saleItems.push({ productId: product.id, quantity, unitPrice: rounded, total: itemTotal })
    }

    const margin = Math.round(saleTotal * randomBetween(0.12, 0.28) * 100) / 100

    await prisma.sale.create({
      data: {
        customerId: customer.id,
        brandId: brand.id,
        commercialId: commercial,
        date: saleDate,
        total: Math.round(saleTotal * 100) / 100,
        margin,
        items: {
          create: saleItems,
        },
      },
    })
  }

  console.log('Sales created: 200')

  // ── Tasks ─────────────────────────────────────────────────────────────────────
  const taskTitles = [
    'Visita comercial agendada',
    'Proposta de preços a enviar',
    'Follow-up pós-visita',
    'Reunião de apresentação de novo produto',
    'Recuperação de cliente inativo',
    'Negociação de contrato anual',
    'Entrega de amostras',
    'Verificar stock do cliente',
    'Análise de satisfação do cliente',
    'Apresentar nova linha Beko',
    'Demonstração Samsung QLED',
    'Proposta aquecimento Ariston',
    'Follow-up relógios TimeRoad',
    'Resolver reclamação pendente',
    'Cobrar fatura em atraso',
    'Visita de cortesia',
    'Preparar orçamento especial',
    'Confirmar encomenda em curso',
    'Renovação de contrato',
    'Prospeção novo cliente',
    'Reunião de balanço semestral',
    'Enviar catálogo atualizado',
    'Verificar qualidade da instalação',
    'Formação sobre novo produto',
    'Análise de concorrência local',
    'Atualizar dados do cliente',
    'Planear campanha promocional',
    'Revisão de metas mensais',
    'Reportar visita ao diretor',
    'Fechar negociação pendente',
  ]

  const taskStatuses: TaskStatus[] = [
    TaskStatus.PENDING, TaskStatus.PENDING, TaskStatus.IN_PROGRESS,
    TaskStatus.COMPLETED, TaskStatus.CANCELLED,
  ]
  const taskPriorities: TaskPriority[] = [
    TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.MEDIUM,
    TaskPriority.HIGH, TaskPriority.URGENT,
  ]

  for (let i = 0; i < 30; i++) {
    const commercial = commercials[i % commercials.length]
    const customer = customers[randomInt(0, customers.length - 1)]
    const status = randomElement(taskStatuses)
    const daysOffset = randomInt(-10, 30)
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + daysOffset)

    await prisma.task.create({
      data: {
        title: taskTitles[i],
        description: `Descrição detalhada: ${taskTitles[i]} para o cliente ${customer.name}.`,
        customerId: customer.id,
        assignedToId: commercial.id,
        createdById: i % 5 === 0 ? directorUser.id : commercial.id,
        status,
        priority: randomElement(taskPriorities),
        dueDate,
        completedAt: status === TaskStatus.COMPLETED ? dateDaysAgo(randomInt(1, 15)) : null,
        notes: i % 4 === 0 ? 'Prioridade máxima. Confirmar com o diretor.' : null,
      },
    })
  }

  console.log('Tasks created: 30')

  // ── Visits ────────────────────────────────────────────────────────────────────
  const visitResults = [
    'Pedido de orçamento recebido',
    'Cliente interessado em nova linha',
    'Reunião produtiva, aguarda aprovação interna',
    'Cliente sem interesse atual',
    'Demonstração realizada com sucesso',
    'Encomenda confirmada no local',
    'Cliente solicita follow-up em 2 semanas',
    'Reclamação registada e encaminhada',
    'Visita de cortesia, bom relacionamento',
    'Negociação em curso',
  ]

  const contactTypes: ContactType[] = [
    ContactType.VISIT, ContactType.VISIT, ContactType.CALL,
    ContactType.EMAIL, ContactType.WHATSAPP,
  ]

  for (let i = 0; i < 20; i++) {
    const commercial = commercials[i % commercials.length]
    const customer = customers[randomInt(0, customers.length - 1)]
    const daysAgoVal = randomInt(1, 60)

    await prisma.visit.create({
      data: {
        customerId: customer.id,
        commercialId: commercial.id,
        date: dateDaysAgo(daysAgoVal),
        type: randomElement(contactTypes),
        result: randomElement(visitResults),
        nextAction: i % 3 === 0 ? 'Enviar proposta detalhada na semana seguinte.' : null,
        notes: i % 5 === 0 ? 'Cliente com potencial elevado para crescimento.' : null,
      },
    })
  }

  console.log('Visits created: 20')

  // ── Commercial Targets ────────────────────────────────────────────────────────
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  for (const commercial of commercials) {
    for (let m = 0; m < 6; m++) {
      let month = currentMonth - m
      let year = currentYear
      if (month <= 0) {
        month += 12
        year -= 1
      }
      const target = randomBetween(15000, 35000)
      const isPast = m > 0
      const achieved = isPast
        ? target * randomBetween(0.7, 1.3)
        : target * randomBetween(0.2, 0.8)

      await prisma.commercialTarget.upsert({
        where: { userId_year_month: { userId: commercial.id, year, month } },
        update: {},
        create: {
          userId: commercial.id,
          year,
          month,
          target: Math.round(target * 100) / 100,
          achieved: Math.round(achieved * 100) / 100,
        },
      })
    }
  }

  console.log('Commercial targets created')

  // ── Customer Scores ───────────────────────────────────────────────────────────
  for (const customer of customers) {
    await prisma.customerScore.create({
      data: {
        customerId: customer.id,
        riskScore: customer.riskScore,
        potentialScore: customer.potentialScore,
        calculatedAt: new Date(),
      },
    })
  }

  console.log('Customer scores created')

  // ── AI Recommendations ────────────────────────────────────────────────────────
  const recommendationTemplates = [
    {
      type: 'upsell',
      title: 'Oportunidade de Upsell Identificada',
      description: 'Este cliente comprou regularmente linha básica. Considere apresentar linha premium com margem superior.',
      priority: 2,
    },
    {
      type: 'risk',
      title: 'Risco de Churn Elevado',
      description: 'O cliente não realiza compras há mais de 60 dias. Agende visita urgente para recuperação.',
      priority: 1,
    },
    {
      type: 'cross_sell',
      title: 'Cross-sell: Nova Linha Ariston',
      description: 'Cliente compra electrodomésticos Beko. Introduzir solução de aquecimento Ariston pode aumentar ticket médio.',
      priority: 3,
    },
    {
      type: 'renewal',
      title: 'Renovação de Contrato Próxima',
      description: 'O contrato anual expira em 30 dias. Preparar proposta de renovação com condições melhoradas.',
      priority: 1,
    },
    {
      type: 'visit',
      title: 'Visita de Cortesia Recomendada',
      description: 'Cliente com potencial alto sem visita nos últimos 45 dias. Fortalecer relacionamento.',
      priority: 2,
    },
    {
      type: 'promotion',
      title: 'Campanha Promocional Compatível',
      description: 'Cliente elegível para campanha de verão Samsung. Contactar para apresentar condições especiais.',
      priority: 3,
    },
  ]

  // Add recommendations for ~20 customers
  const customersForRec = customers.slice(0, 20)
  for (let i = 0; i < customersForRec.length; i++) {
    const customer = customersForRec[i]
    const rec = recommendationTemplates[i % recommendationTemplates.length]
    await prisma.aiRecommendation.create({
      data: {
        customerId: customer.id,
        type: rec.type,
        title: rec.title,
        description: rec.description,
        priority: rec.priority,
        dismissed: false,
      },
    })
    // Some customers get a second recommendation
    if (i % 3 === 0 && i + 1 < recommendationTemplates.length) {
      const rec2 = recommendationTemplates[(i + 2) % recommendationTemplates.length]
      await prisma.aiRecommendation.create({
        data: {
          customerId: customer.id,
          type: rec2.type,
          title: rec2.title,
          description: rec2.description,
          priority: rec2.priority,
          dismissed: false,
        },
      })
    }
  }

  console.log('AI recommendations created')
  console.log('\nSeed completed successfully!')
  console.log('\nLogin credentials:')
  console.log('  Admin:     admin@auferma.pt     / admin123')
  console.log('  Director:  diretor@auferma.pt   / diretor123')
  console.log('  Commercial: comercial1@auferma.pt through comercial5@auferma.pt / comercial123')
}

main()
  .catch(e => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
