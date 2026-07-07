import { prisma } from './prisma'

// Effective monthly € target per commercial: an explicit CommercialTarget
// override wins; otherwise the team-wide TeamTarget growth % is applied to
// their own homólogo (same month, previous year) sales.
export async function getEffectiveTargets(year: number, month: number, userIds?: string[]): Promise<Map<string, number>> {
  const startOfLastYearMonth = new Date(year - 1, month - 1, 1)
  const endOfLastYearMonth = new Date(year - 1, month, 0, 23, 59, 59, 999)
  const commercialFilter = userIds ? { in: userIds } : { not: null }

  const [overrides, teamTarget, lastYearSales] = await Promise.all([
    prisma.commercialTarget.findMany({ where: { year, month, ...(userIds ? { userId: { in: userIds } } : {}) } }),
    prisma.teamTarget.findUnique({ where: { year_month: { year, month } } }),
    prisma.sale.groupBy({
      by: ['commercialId'],
      where: { date: { gte: startOfLastYearMonth, lte: endOfLastYearMonth }, commercialId: commercialFilter },
      _sum: { total: true },
    }),
  ])

  const overrideMap = new Map(overrides.map(o => [o.userId, o]))
  const lastYearMap = new Map(lastYearSales.map(s => [s.commercialId!, s._sum.total || 0]))
  const teamGrowthPct = teamTarget?.growthPct ?? 0

  const result = new Map<string, number>()
  const idSet: Record<string, true> = {}
  overrideMap.forEach((_, id) => { idSet[id] = true })
  lastYearMap.forEach((_, id) => { idSet[id] = true })
  ;(userIds || []).forEach(id => { idSet[id] = true })
  for (const id of Object.keys(idSet)) {
    const override = overrideMap.get(id)
    const lastYearTotal = lastYearMap.get(id) || 0
    if (override?.target != null) {
      result.set(id, override.target)
    } else {
      const growthPct = override?.growthPct ?? teamGrowthPct
      result.set(id, lastYearTotal > 0 ? lastYearTotal * (1 + growthPct / 100) : 0)
    }
  }
  return result
}
