const NON_OPPORTUNITY_STATUSES = ['draft', 'rejected']

export function calculateMonthCloseRate(proposals, { monthStart, monthEnd, sellerId } = {}) {
  if (!Array.isArray(proposals)) return null
  if (!monthStart || !monthEnd) return null

  const startMs = new Date(monthStart).getTime()
  const endMs = new Date(monthEnd).getTime()

  const scope = sellerId
    ? proposals.filter(p => p.created_by === sellerId)
    : proposals

  const opportunities = scope.filter(p => {
    if (NON_OPPORTUNITY_STATUSES.includes(p.status)) return false
    const createdMs = new Date(p.created_at).getTime()
    return createdMs >= startMs && createdMs <= endMs
  })

  const won = scope.filter(p => {
    if (p.status !== 'accepted') return false
    const closedMs = new Date(p.accepted_at ?? p.created_at).getTime()
    return closedMs >= startMs && closedMs <= endMs
  }).length

  const total = opportunities.length
  if (total === 0) return null
  return { won, total, rate: (won / total) * 100 }
}

export function calculateHistoricalCloseRate(proposals, { asOfDate = new Date(), sellerId } = {}) {
  if (!Array.isArray(proposals)) return null

  const cutoffMs = new Date(asOfDate).getTime()

  const scope = sellerId
    ? proposals.filter(p => p.created_by === sellerId)
    : proposals

  const opportunities = scope.filter(p => {
    if (NON_OPPORTUNITY_STATUSES.includes(p.status)) return false
    const createdMs = new Date(p.created_at).getTime()
    return createdMs <= cutoffMs
  })

  const won = opportunities.filter(p => {
    if (p.status !== 'accepted') return false
    const closedMs = new Date(p.accepted_at ?? p.created_at).getTime()
    return closedMs <= cutoffMs
  }).length

  const total = opportunities.length
  if (total === 0) return null
  return { won, total, rate: (won / total) * 100 }
}

export function calculateMonthDelta(proposals, { sellerId } = {}) {
  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)

  const thisMonth = calculateMonthCloseRate(proposals, {
    monthStart: thisMonthStart, monthEnd: thisMonthEnd, sellerId,
  })
  const lastMonth = calculateMonthCloseRate(proposals, {
    monthStart: lastMonthStart, monthEnd: lastMonthEnd, sellerId,
  })

  if (!thisMonth || !lastMonth) return null
  return thisMonth.rate - lastMonth.rate
}
