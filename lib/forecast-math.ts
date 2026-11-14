// Pure forecasting maths for partner reorder suggestions (no I/O, unit-testable).

export type ForecastSettings = {
  leadTimeDays: number  // days from order to delivery (default 14)
  coverDays: number     // how long each order should last after it arrives (default 14)
  safetyDays: number    // buffer against sales spikes / delays (default 7)
}

export const DEFAULT_FORECAST: ForecastSettings = { leadTimeDays: 14, coverDays: 14, safetyDays: 7 }

export type PlanInput = {
  onHand: number
  onOrder: number          // boxes in undelivered orders for this location
  caseSize: number
  recent14: number         // boxes sold in the last 14 days (incl. today)
  prior14: number          // boxes sold in the 14 days before that
  daysOfHistory: number    // days since first delivery at this location (capped at 28)
}

export type PlanResult = {
  avgDaily: number
  trendPct: number | null      // recent vs prior 14 days
  daysCover: number | null     // on hand ÷ forecast daily sales
  reorderPoint: number         // boxes: lead time + safety stock
  targetLevel: number          // boxes: lead time + cover + safety
  needsReorder: boolean
  suggestedCases: number
}

/**
 * Forecast daily sales, weighting the most recent two weeks twice as much as
 * the two weeks before, but never below the last two weeks' rate — so a rising
 * trend is followed at once while one slow week doesn't cut orders too hard. Then:
 *   reorder when   on hand + on order ≤ daily × (lead time + safety)
 *   order up to    daily × (lead time + cover + safety), rounded up to whole cases
 */
export function planLine(i: PlanInput, s: ForecastSettings): PlanResult {
  const days = Math.max(0, Math.min(28, Math.floor(i.daysOfHistory)))
  const recentRate = i.recent14 / 14
  let avgDaily: number
  if (days >= 28) avgDaily = (2 * recentRate + i.prior14 / 14) / 3
  else if (days > 14) avgDaily = (2 * recentRate + i.prior14 / (days - 14)) / 3
  else avgDaily = i.recent14 / Math.max(days, 7) // new location: avoid over-reacting to the first few days
  // Follow rising sales immediately (running out costs more than a little extra stock);
  // falling sales are smoothed by the weighted average above.
  if (days > 14) avgDaily = Math.max(avgDaily, recentRate)

  const trendPct = i.prior14 > 0 && days >= 28 ? ((i.recent14 - i.prior14) / i.prior14) * 100 : null
  const position = i.onHand + i.onOrder
  const reorderPoint = avgDaily * (s.leadTimeDays + s.safetyDays)
  const targetLevel = avgDaily * (s.leadTimeDays + s.coverDays + s.safetyDays)
  const needsReorder = avgDaily > 0 && position <= reorderPoint
  const caseSize = Math.max(1, i.caseSize)
  const suggestedCases = needsReorder ? Math.max(1, Math.ceil((targetLevel - position) / caseSize)) : 0

  return {
    avgDaily,
    trendPct,
    daysCover: avgDaily > 0 ? i.onHand / avgDaily : null,
    reorderPoint,
    targetLevel,
    needsReorder,
    suggestedCases,
  }
}
