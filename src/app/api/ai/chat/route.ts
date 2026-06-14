import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const maxDuration = 26

interface Message {
  role: 'user' | 'assistant'
  content: string
}

// ─── Rule-based engine (fallback + structured data) ────────────────────────────
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

  if (q.includes('venda') || q.includes('fatura') || q.includes('objetivo') || q.includes('meta') || q.includes('ponto') || q.includes('mês passado') || q.includes('mes passado') || q.includes('passado')) {
    const isLastMonth = q.includes('passado')
    const startOfMonth = isLastMonth
      ? new Date(now.getFullYear(), now.getMonth() - 1, 1)
      : new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = isLastMonth
      ? new Date(now.getFullYear(), now.getMonth(), 1)
      : now
    const targetMonth = isLastMonth ? (now.getMonth() === 0 ? 12 : now.getMonth()) : now.getMonth() + 1
    const targetYear = isLastMonth && now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()

    const [salesMonth, target] = await Promise.all([
      prisma.sale.aggregate({ where: { date: { gte: startOfMonth, lt: endOfMonth }, customer: filter }, _sum: { total: true } }),
      prisma.commercialTarget.findFirst({
        where: { ...(role === 'COMMERCIAL' ? { userId } : {}), month: targetMonth, year: targetYear },
      }),
    ])
    const total = salesMonth._sum.total || 0
    const tgt = target?.target || 0
    const pct = tgt > 0 ? Math.round((total / tgt) * 100) : null
    const label = isLastMonth ? 'mês passado' : 'este mês'
    return `**Vendas ${label}:**\n\n• Total: **€${total.toFixed(2)}**\n• Objetivo: **${tgt > 0 ? `€${tgt.toFixed(2)}` : 'não definido'}**${pct !== null ? `\n• Progresso: **${pct}%** do objetivo` : ''}\n\n${pct !== null ? (pct >= 100 ? '✅ Objetivo atingido!' : pct >= 75 ? '🟡 Bom ritmo.' : '🔴 Abaixo do esperado.') : ''}`
  }

  if (q.includes('plano') || q.includes('semana')) {
    const [pendingTasks, customersToVisit] = await Promise.all([
      prisma.task.count({ where: { ...(role === 'COMMERCIAL' ? { assignedToId: userId } : {}), status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
      prisma.customer.count({ where: { ...filter, OR: [{ lastVisitDate: { lt: thirtyDaysAgo } }, { lastVisitDate: null }], status: 'ACTIVE' } }),
    ])

    return `**Plano comercial sugerido para esta semana:**\n\n📋 **Tarefas:** ${pendingTasks} pendentes para resolver\n👥 **Visitas:** ${customersToVisit} clientes precisam de visita\n\n**Prioridades:**\n1. Resolver tarefas urgentes\n2. Visitar clientes de alto risco\n3. Contactar clientes inativos\n4. Prospetar novos clientes com potencial`
  }

  // Default response
  const [customers, sales] = await Promise.all([
    prisma.customer.count({ where: filter }),
    prisma.sale.aggregate({ where: { date: { gte: thirtyDaysAgo }, customer: filter }, _sum: { total: true } }),
  ])

  return `Olá! Sou o Assistente Comercial Auferma. Posso ajudá-lo com:\n\n• **"Que clientes devo visitar esta semana?"**\n• **"Que clientes estão em queda?"**\n• **"Clientes inativos"**\n• **"Tarefas pendentes"**\n• **"Dá-me um plano para esta semana"**\n\n_Dados rápidos: ${customers} clientes | €${((sales._sum.total || 0)/1000).toFixed(1)}k em vendas nos últimos 30 dias_`
}

// ─── Context snapshot for the LLM ──────────────────────────────────────────────
async function buildContext(userId: string, role: string): Promise<string> {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const filter = role === 'COMMERCIAL' ? { commercialId: userId } : {}
  const taskFilter = role === 'COMMERCIAL' ? { assignedToId: userId } : {}

  const [
    totalCustomers,
    salesThisMonth,
    atRisk,
    inactive,
    toVisit,
    pendingTasks,
    topRisk,
    upcomingTasks,
  ] = await Promise.all([
    prisma.customer.count({ where: filter }),
    prisma.sale.aggregate({ where: { date: { gte: startOfMonth }, customer: filter }, _sum: { total: true } }),
    prisma.customer.count({ where: { ...filter, OR: [{ status: 'AT_RISK' }, { riskScore: { gte: 50 } }] } }),
    prisma.customer.count({ where: { ...filter, OR: [{ lastPurchaseDate: { lt: sixtyDaysAgo } }, { lastPurchaseDate: null }] } }),
    prisma.customer.count({ where: { ...filter, OR: [{ lastVisitDate: { lt: thirtyDaysAgo } }, { lastVisitDate: null }], status: 'ACTIVE' } }),
    prisma.task.count({ where: { ...taskFilter, status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
    prisma.customer.findMany({
      where: { ...filter, OR: [{ status: 'AT_RISK' }, { riskScore: { gte: 50 } }] },
      orderBy: { riskScore: 'desc' },
      take: 10,
      select: { name: true, zone: true, riskScore: true, lastPurchaseDate: true, lastVisitDate: true },
    }),
    prisma.task.findMany({
      where: { ...taskFilter, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      take: 10,
      select: { title: true, priority: true, dueDate: true, customer: { select: { name: true } } },
    }),
  ])

  const fmtDate = (d: Date | null) => d ? new Date(d).toLocaleDateString('pt-PT') : 'sem registo'

  const riskLines = topRisk.map(c =>
    `- ${c.name} (${c.zone || 'sem zona'}): risco ${c.riskScore.toFixed(0)}/100, última compra ${fmtDate(c.lastPurchaseDate)}, última visita ${fmtDate(c.lastVisitDate)}`
  ).join('\n') || 'nenhum'

  const taskLines = upcomingTasks.map(t =>
    `- ${t.title} [${t.priority}] cliente ${t.customer?.name || 'N/A'}, prazo ${fmtDate(t.dueDate)}`
  ).join('\n') || 'nenhuma'

  const scope = role === 'COMMERCIAL' ? 'do comercial' : 'da equipa toda'

  return `DADOS ATUAIS (${scope}), data de hoje ${now.toLocaleDateString('pt-PT')}:
- Clientes na carteira: ${totalCustomers}
- Vendas este mês: €${(salesThisMonth._sum.total || 0).toFixed(2)}
- Clientes em risco/queda: ${atRisk}
- Clientes inativos (60+ dias sem comprar): ${inactive}
- Clientes a precisar de visita (30+ dias): ${toVisit}
- Tarefas pendentes: ${pendingTasks}

TOP CLIENTES EM RISCO:
${riskLines}

TAREFAS PENDENTES:
${taskLines}`
}

// ─── OpenAI call ───────────────────────────────────────────────────────────────
async function askOpenAI(
  apiKey: string,
  context: string,
  history: Message[],
  message: string,
  userName: string,
): Promise<string> {
  const system = `És o Assistente Comercial Auferma, da Auferma 2.0 — uma plataforma de inteligência comercial para uma empresa B2B de importação e distribuição. Falas com ${userName}.

Responde sempre em português de Portugal, de forma clara, direta e prática. Usa **negrito** para destacar e listas com marcadores quando útil. Baseia-te SEMPRE nos dados fornecidos abaixo — não inventes clientes, números nem datas. Se a pergunta não tiver resposta nos dados, diz que não tens essa informação e sugere o que o utilizador pode fazer. Sê conciso: vai direto ao que interessa.

${context}`

  const messages = [
    { role: 'system', content: system },
    ...history.slice(-6).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ]

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.4,
      max_tokens: 700,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI ${res.status}: ${err}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() || 'Não consegui gerar uma resposta.'
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message, history } = await req.json()
  const userId = (session.user as any).id
  const role = (session.user as any).role
  const userName = session.user?.name?.split(' ')[0] || 'utilizador'

  const apiKey = process.env.OPENAI_API_KEY

  // No API key → rule-based engine
  if (!apiKey) {
    const response = await processQuery(message, userId, role)
    return NextResponse.json({ response, engine: 'rules' })
  }

  // OpenAI engine with live data context
  try {
    const context = await buildContext(userId, role)
    const response = await askOpenAI(apiKey, context, Array.isArray(history) ? history : [], message, userName)
    return NextResponse.json({ response, engine: 'openai' })
  } catch (e: any) {
    // Fall back to rules if OpenAI fails
    const response = await processQuery(message, userId, role)
    return NextResponse.json({ response, engine: 'rules-fallback', error: String(e?.message || e) })
  }
}
