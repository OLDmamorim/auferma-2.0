export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('pt-PT')
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function getMonthName(month: number): string {
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
                  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return months[month - 1] || ''
}

export function daysAgo(date: Date | string | null): number {
  if (!date) return 999
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
}

export function getRiskLabel(score: number): { label: string; color: string } {
  if (score >= 70) return { label: 'Alto Risco', color: 'text-red-600' }
  if (score >= 40) return { label: 'Risco Médio', color: 'text-orange-500' }
  return { label: 'Baixo Risco', color: 'text-green-600' }
}

export function getPotentialLabel(score: number): { label: string; color: string } {
  if (score >= 70) return { label: 'Alto Potencial', color: 'text-green-600' }
  if (score >= 40) return { label: 'Potencial Médio', color: 'text-blue-500' }
  return { label: 'Baixo Potencial', color: 'text-gray-500' }
}
