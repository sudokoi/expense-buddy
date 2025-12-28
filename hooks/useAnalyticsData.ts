import { useMemo } from "react"
import { useExpenses } from "../context/ExpenseContext"
import { ExpenseCategory } from "../types/expense"
import {
  TimeWindow,
  PieChartDataItem,
  LineChartDataItem,
  AnalyticsStatistics,
  filterExpensesByTimeWindow,
  filterExpensesByCategories,
  aggregateByCategory,
  aggregateByDay,
  calculateStatistics,
  getDateRangeForTimeWindow,
  getTimeWindowDays,
} from "../utils/analytics-calculations"

/**
 * Analytics data returned by the hook
 */
export interface AnalyticsData {
  filteredExpenses: ReturnType<typeof filterExpensesByTimeWindow>
  pieChartData: PieChartDataItem[]
  lineChartData: LineChartDataItem[]
  statistics: AnalyticsStatistics
  isLoading: boolean
}

/**
 * Hook for computing analytics data from expenses
 *
 * @param timeWindow - The time window to filter expenses (7d, 15d, 1m)
 * @param selectedCategories - Categories to filter by (empty array = all categories)
 * @returns Analytics data including filtered expenses, chart data, and statistics
 */
export function useAnalyticsData(
  timeWindow: TimeWindow,
  selectedCategories: ExpenseCategory[]
): AnalyticsData {
  const { state } = useExpenses()
  const { expenses, isLoading } = state

  // Memoized: Filter expenses by time window
  const timeFilteredExpenses = useMemo(() => {
    return filterExpensesByTimeWindow(expenses, timeWindow)
  }, [expenses, timeWindow])

  // Memoized: Filter expenses by selected categories
  const filteredExpenses = useMemo(() => {
    return filterExpensesByCategories(timeFilteredExpenses, selectedCategories)
  }, [timeFilteredExpenses, selectedCategories])

  // Memoized: Pie chart data aggregated by category
  const pieChartData = useMemo(() => {
    return aggregateByCategory(filteredExpenses)
  }, [filteredExpenses])

  // Memoized: Line chart data aggregated by day
  const lineChartData = useMemo(() => {
    const dateRange = getDateRangeForTimeWindow(timeWindow)
    return aggregateByDay(filteredExpenses, dateRange)
  }, [filteredExpenses, timeWindow])

  // Memoized: Summary statistics
  const statistics = useMemo(() => {
    const daysInPeriod = getTimeWindowDays(timeWindow)
    return calculateStatistics(filteredExpenses, daysInPeriod)
  }, [filteredExpenses, timeWindow])

  return {
    filteredExpenses,
    pieChartData,
    lineChartData,
    statistics,
    isLoading,
  }
}
