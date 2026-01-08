import { useMemo, useCallback } from "react"
import { useExpenses, useCategories } from "../stores/hooks"
import { Expense } from "../types/expense"
import {
  TimeWindow,
  PieChartDataItem,
  PaymentMethodChartDataItem,
  LineChartDataItem,
  AnalyticsStatistics,
  CategoryColorMap,
  filterExpensesByTimeWindow,
  filterExpensesByCategories,
  aggregateByCategory,
  aggregateByPaymentMethod,
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
  paymentMethodChartData: PaymentMethodChartDataItem[]
  lineChartData: LineChartDataItem[]
  statistics: AnalyticsStatistics
  isLoading: boolean
  // Memoized filter functions for consumers that need to apply additional filtering
  filterByTimeWindow: (expenses: Expense[]) => Expense[]
  filterByCategories: (expenses: Expense[]) => Expense[]
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
  selectedCategories: string[]
): AnalyticsData {
  const { state } = useExpenses()
  const { categories } = useCategories()
  // Use activeExpenses (excludes soft-deleted) for analytics
  const { activeExpenses, isLoading } = state

  // Memoized: Build category color map from dynamic categories
  const categoryColorMap = useMemo((): CategoryColorMap => {
    const colorMap: CategoryColorMap = {}
    for (const category of categories) {
      colorMap[category.label] = category.color
    }
    return colorMap
  }, [categories])

  // Memoized filter callback: Filter expenses by time window
  const filterByTimeWindow = useCallback(
    (expenses: Expense[]): Expense[] => {
      return filterExpensesByTimeWindow(expenses, timeWindow)
    },
    [timeWindow]
  )

  // Memoized filter callback: Filter expenses by selected categories
  const filterByCategories = useCallback(
    (expenses: Expense[]): Expense[] => {
      return filterExpensesByCategories(expenses, selectedCategories)
    },
    [selectedCategories]
  )

  // Memoized: Filter expenses by time window
  const timeFilteredExpenses = useMemo(() => {
    return filterByTimeWindow(activeExpenses)
  }, [activeExpenses, filterByTimeWindow])

  // Memoized: Filter expenses by selected categories
  const filteredExpenses = useMemo(() => {
    return filterByCategories(timeFilteredExpenses)
  }, [timeFilteredExpenses, filterByCategories])

  // Memoized: Pie chart data aggregated by category with dynamic colors
  const pieChartData = useMemo(() => {
    return aggregateByCategory(filteredExpenses, categoryColorMap)
  }, [filteredExpenses, categoryColorMap])

  // Memoized: Payment method chart data aggregated by payment method
  const paymentMethodChartData = useMemo(() => {
    return aggregateByPaymentMethod(filteredExpenses)
  }, [filteredExpenses])

  // Memoized: Line chart data aggregated by day
  const lineChartData = useMemo(() => {
    const dateRange = getDateRangeForTimeWindow(timeWindow, filteredExpenses)
    return aggregateByDay(filteredExpenses, dateRange)
  }, [filteredExpenses, timeWindow])

  // Memoized: Summary statistics
  const statistics = useMemo(() => {
    // For "all", calculate actual days from data range
    let daysInPeriod = getTimeWindowDays(timeWindow)
    if (timeWindow === "all" && filteredExpenses.length > 0) {
      const dateRange = getDateRangeForTimeWindow(timeWindow, filteredExpenses)
      const diffTime = Math.abs(dateRange.end.getTime() - dateRange.start.getTime())
      daysInPeriod = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
    }
    return calculateStatistics(filteredExpenses, daysInPeriod)
  }, [filteredExpenses, timeWindow])

  // Memoized: Return object to ensure stable reference
  return useMemo(
    () => ({
      filteredExpenses,
      pieChartData,
      paymentMethodChartData,
      lineChartData,
      statistics,
      isLoading,
      filterByTimeWindow,
      filterByCategories,
    }),
    [
      filteredExpenses,
      pieChartData,
      paymentMethodChartData,
      lineChartData,
      statistics,
      isLoading,
      filterByTimeWindow,
      filterByCategories,
    ]
  )
}
