import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

// Rule-based AI service (future: replace with OpenAI)
async function processQuery(query: string, userId: string, role: string): Promise<string> {
  const q = query.toLowerCase()
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const filter = role === 'COMMERCIAL' ? { commercialId: userId } : {}

  if (q.includes('clientes') && (q.includes('visitar') || q.includes('visita'))) {
    const customers = await prisma.customer.findMany({
      where: {
        ...filter,
        OR: [
          { lastVisitDate: { lt: thirtyDaysAgo } },
          { lastVisitDate: null },
        ],
        status: { in: ['ACTIVE', 'AT_RISK'] },
      },
      orderBy: { riskScore: 'desc' },
      take: 5,
    })

    if (customers.length === 0) return 'Todos os seus clientes foram visitados recentemente. Ótimo trabalho!'

    return `**Clientes prioritários para visitar esta semana:**\n\n${customers.map((c, i) =>
      `${i+1}. **${c.name}** (${c.zone || 'Zona não definida'})\n   • Última visita: ${c.lastVisitDate ? new Date(c.lastVisitDate).toLocaleDateString('pt-PT') : 'Nunca registada'}\n   • Risco: ${c.riskScore > 50 ? '🔴 Alto' : c.riskScore > 25 ? '🟡 Médio' : '🟢 Baixo'}`
    ).join('\n\n')}`
  }

  if (q.includes('queda') || q.includes('risco')) {
    const customers = await prisma.customer.findMany({
      where: { ...filter, OR: [{ status: 'AT_RISK' }, { riskScore: { gte: 50 } }] },
      orderBy: { riskScore: 'desc' },
      take: 5,
    })

    if (customers.length === 0) return 'Não foram detetados clientes em risco de queda no momento.'

    return `**Clientes em queda ou risco:**\n\n${customers.map((c, i) =>
      `${i+1}. **${c.name}**\n   • Score de risco: ${c.riskScore.toFixed(0)}/100\n   • Última compra: ${c.lastPurchaseDate ? new Date(c.lastPurchaseDate).toLocaleDateString('pt-PT') : 'Sem dados'}`
    ).join('\n\n')}`
  }

  if (q.includes('inativos') || q.includes('sem compras')) {
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
    const customers = await prisma.customer.findMany({
      where: { ...filter, OR: [{ lastPurchaseDate: { lt: sixtyDaysAgo } }, { lastPurchaseDate: null }] },
      take: 5,
    })
    return `**Clientes inativos (sem compras há 60+ dias):**\n\n${customers.map((c, i) =>
      `${i+1}. **${c.name}** — última compra: ${c.lastPurchaseDate ? new Date(c.lastPurchaseDate).toLocaleDateString('pt-PT') : 'nunca registada'}`
    ).join('\n')}`
  }

  if (q.includes('tarefas') || q.includes('pendentes')) {
    const tasks = await prisma.task.findMany({
      where: {
        ...(role === 'COMMERCIAL' ? { assignedToId: userId } : {}),
        status: { in: ['PENDING', 'IN_PROGRESS'] }
      },
      include: { customer: { select: { name: true } } },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      take: 5,
    })
    if (tasks.length === 0) return 'Não tem tarefas pendentes. Continue assim!'
    return `**Tarefas pendentes:**\n\n${tasks.map((t, i) =>
      `${i+1}. **${t.title}**\n   • Cliente: ${t.customer?.name || 'N/A'}\n   • Prioridade: ${t.priority}\n   • Data limite: ${t.dueDate ? new Date(t.dueDate).toLocaleDateString('pt-PT') : 'Sem data'}`
    ).join('\n\n')}`
  }

  if (q.includes('plano') || q.includes('semana')) {
    const [pendingTasks, customersToVisit] = await Promise.all([
      prisma.task.count({ where: { ...(role === 'COMMERCIAL' ? { assignedToId: userId } : {}), status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
      prisma.customer.count({ where: { ...filter, OR: [{ lastVisitDate: { lt: thirtyDaysAgo } }, { lastVisitDate: null }], status: 'ACTIVE' } }),
    ])

    return `**Plano comercial sugerido para esta semana:**\n\n📋 **Tarefas:** ${pendingTasks} pendentes para resolver\n👥 **Visitas:** ${customersToVisit} clientes precisam de visita\n\n**Prioridades:**\n1. Resolver tarefas urgentes\n2. Visitar clientes de alto risco\n3. Contactar clientes inativos\n4. Prospetar novos clientes com potencial\n\n_Nota: Para análise mais detalhada com IA generativa, configure a chave OpenAI nas definições._`
  }

  // Default response
  const [customers, sales] = await Promise.all([
    prisma.customer.count({ where: filter }),
    prisma.sale.aggregate({ where: { date: { gte: thirtyDaysAgo }, customer: filter }, _sum: { total: true } }),
  ])

  return `Olá! Sou o Assistente Comercial Auferma. Posso ajudá-lo com:\n\n• **"Que clientes devo visitar esta semana?"**\n• **"Que clientes estão em queda?"**\n• **"Clientes inativos"**\n• **"Tarefas pendentes"**\n• **"Dá-me um plano para esta semana"**\n\n_Dados rápidos: ${customers} clientes | €${((sales._sum.total || 0)/1000).toFixed(1)}k em vendas nos últimos 30 dias_`
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message } = await req.json()
  const userId = (session.user as any).id
  const role = (session.user as any).role

  const response = await processQuery(message, userId, role)
  return NextResponse.json({ response })
}
