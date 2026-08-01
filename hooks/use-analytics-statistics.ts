import { useMemo } from "react"
import { Expense } from "../types/expense"
import type { DateRange } from "../types/analytics"
import type { TimeWindow } from "../utils/analytics/time"
import { getTimeWindowDays } from "../utils/analytics/time"
import type { AnalyticsStatistics } from "../utils/analytics/statistics"
import { calculateStatistics } from "../utils/analytics/statistics"

export interface AnalyticsStatisticsResult {
  statistics: AnalyticsStatistics
}

/**
 * Hook for calculating analytics statistics.
 * Requires filtered expenses from useAnalyticsBase.
 */
export function useAnalyticsStatistics(
  filteredExpenses: Expense[],
  timeWindow: TimeWindow,
  dateRange: DateRange,
  fullPeriodExpenses?: Expense[]
): AnalyticsStatisticsResult {
  const statistics = useMemo(() => {
    // For "all", calculate actual days from data range
    let daysInPeriod = getTimeWindowDays(timeWindow)
    if (timeWindow === "all" && filteredExpenses.length > 0) {
      const diffTime = Math.abs(dateRange.end.getTime() - dateRange.start.getTime())
      daysInPeriod = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
    }

    // fullPeriodTotalSpending is derived from all expenses in the effective
    // currency (ignoring every filter including the time window) so the stats
    // cards can show the grand total as subtext regardless of active filters.
    return calculateStatistics(filteredExpenses, daysInPeriod, fullPeriodExpenses)
  }, [filteredExpenses, timeWindow, dateRange, fullPeriodExpenses])

  return { statistics }
}
