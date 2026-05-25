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
  dateRange: DateRange
): AnalyticsStatisticsResult {
  const statistics = useMemo(() => {
    // For "all", calculate actual days from data range
    let daysInPeriod = getTimeWindowDays(timeWindow)
    if (timeWindow === "all" && filteredExpenses.length > 0) {
      const diffTime = Math.abs(dateRange.end.getTime() - dateRange.start.getTime())
      daysInPeriod = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
    }
    return calculateStatistics(filteredExpenses, daysInPeriod)
  }, [filteredExpenses, timeWindow, dateRange])

  return { statistics }
}
