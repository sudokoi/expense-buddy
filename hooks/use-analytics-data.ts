import { useMemo, useCallback } from "react"
import { useExpenses, useCategories, useSettings } from "../stores/hooks"
import { Expense } from "../types/expense"
import type { PaymentInstrument } from "../types/payment-instrument"
import {
  TimeWindow,
  PieChartDataItem,
  PaymentMethodChartDataItem,
  PaymentInstrumentChartDataItem,
  PaymentInstrumentSelectionKey,
  PaymentMethodSelectionKey,
  LineChartDataItem,
  AnalyticsStatistics,
  CategoryColorMap,
  filterExpensesByTimeWindow,
  filterExpensesByCategories,
  filterExpensesByPaymentMethods,
  filterExpensesByPaymentInstruments,
  aggregateByCategory,
  aggregateByPaymentMethod,
  aggregateByPaymentInstrument,
  aggregateByDay,
  calculateStatistics,
  getDateRangeForTimeWindow,
  getTimeWindowDays,
} from "../utils/analytics-calculations"
import { getLocale } from "../utils/date"
import { useTranslation } from "react-i18next"

/**
 * Analytics data returned by the hook
 */
export interface AnalyticsData {
  filteredExpenses: ReturnType<typeof filterExpensesByTimeWindow>
  pieChartData: PieChartDataItem[]
  paymentMethodChartData: PaymentMethodChartDataItem[]
  paymentInstrumentChartData: PaymentInstrumentChartDataItem[]
  lineChartData: LineChartDataItem[]
  statistics: AnalyticsStatistics
  paymentInstruments: PaymentInstrument[]
  isLoading: boolean
  // Memoized filter functions for consumers that need to apply additional filtering
  filterByTimeWindow: (expenses: Expense[]) => Expense[]
  filterByCategories: (expenses: Expense[]) => Expense[]
  filterByPaymentMethods: (expenses: Expense[]) => Expense[]
  filterByPaymentInstruments: (expenses: Expense[]) => Expense[]
}

/**
 * Hook for computing analytics data from expenses
 *
 * @param timeWindow - The time window to filter expenses (7d, 15d, 1m, 3m, 6m, 1y, all)
 * @param selectedCategories - Categories to filter by (empty array = all categories)
 * @returns Analytics data including filtered expenses, chart data, and statistics
 */
export function useAnalyticsData(
  timeWindow: TimeWindow,
  selectedCategories: string[],
  selectedPaymentMethods: PaymentMethodSelectionKey[],
  selectedPaymentInstruments: PaymentInstrumentSelectionKey[]
): AnalyticsData {
  const { state } = useExpenses()
  const { categories } = useCategories()
  const { settings } = useSettings()
  const { t } = useTranslation()
  // Use activeExpenses (excludes soft-deleted) for analytics
  const { activeExpenses, isLoading } = state

  const paymentInstruments = useMemo(() => {
    return (settings.paymentInstruments ?? []) as PaymentInstrument[]
  }, [settings.paymentInstruments])

  // Memoized: Build category color map from dynamic categories
  const categoryColorMap = useMemo((): CategoryColorMap => {
    const colorMap: CategoryColorMap = {}
    for (const category of categories) {
      colorMap[category.label] = category.color
    }
    return colorMap
  }, [categories])

  const locale = getLocale()

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

  const filterByPaymentMethods = useCallback(
    (expenses: Expense[]): Expense[] => {
      return filterExpensesByPaymentMethods(expenses, selectedPaymentMethods)
    },
    [selectedPaymentMethods]
  )

  const filterByPaymentInstruments = useCallback(
    (expenses: Expense[]): Expense[] => {
      return filterExpensesByPaymentInstruments(
        expenses,
        selectedPaymentInstruments,
        paymentInstruments
      )
    },
    [selectedPaymentInstruments, paymentInstruments]
  )

  // Memoized: Filter expenses by time window
  const timeFilteredExpenses = useMemo(() => {
    return filterByTimeWindow(activeExpenses)
  }, [activeExpenses, filterByTimeWindow])

  // Memoized: Filter expenses by selected categories
  const categoryFilteredExpenses = useMemo(() => {
    return filterByCategories(timeFilteredExpenses)
  }, [timeFilteredExpenses, filterByCategories])

  const paymentMethodFilteredExpenses = useMemo(() => {
    return filterByPaymentMethods(categoryFilteredExpenses)
  }, [categoryFilteredExpenses, filterByPaymentMethods])

  const filteredExpenses = useMemo(() => {
    return filterByPaymentInstruments(paymentMethodFilteredExpenses)
  }, [paymentMethodFilteredExpenses, filterByPaymentInstruments])

  // Compute date range once; for "all" this scans the data for the earliest date.
  const dateRange = useMemo(() => {
    return getDateRangeForTimeWindow(timeWindow, filteredExpenses)
  }, [timeWindow, filteredExpenses])

  // Memoized: Pie chart data aggregated by category with dynamic colors
  const pieChartData = useMemo(() => {
    return aggregateByCategory(filteredExpenses, categoryColorMap, t)
  }, [filteredExpenses, categoryColorMap, t])

  // Memoized: Payment method chart data aggregated by payment method
  const paymentMethodChartData = useMemo(() => {
    return aggregateByPaymentMethod(filteredExpenses, t)
  }, [filteredExpenses, t])

  const paymentInstrumentChartData = useMemo(() => {
    return aggregateByPaymentInstrument(filteredExpenses, paymentInstruments, t)
  }, [filteredExpenses, paymentInstruments, t])

  // Memoized: Line chart data aggregated by day
  const lineChartData = useMemo(() => {
    return aggregateByDay(filteredExpenses, dateRange, locale)
  }, [filteredExpenses, dateRange, locale])

  // Memoized: Summary statistics
  const statistics = useMemo(() => {
    // For "all", calculate actual days from data range
    let daysInPeriod = getTimeWindowDays(timeWindow)
    if (timeWindow === "all" && filteredExpenses.length > 0) {
      const diffTime = Math.abs(dateRange.end.getTime() - dateRange.start.getTime())
      daysInPeriod = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
    }
    return calculateStatistics(filteredExpenses, daysInPeriod)
  }, [filteredExpenses, timeWindow, dateRange])

  // Memoized: Return object to ensure stable reference
  return useMemo(
    () => ({
      filteredExpenses,
      pieChartData,
      paymentMethodChartData,
      paymentInstrumentChartData,
      lineChartData,
      statistics,
      paymentInstruments,
      isLoading,
      filterByTimeWindow,
      filterByCategories,
      filterByPaymentMethods,
      filterByPaymentInstruments,
    }),
    [
      filteredExpenses,
      pieChartData,
      paymentMethodChartData,
      paymentInstrumentChartData,
      lineChartData,
      statistics,
      paymentInstruments,
      isLoading,
      filterByTimeWindow,
      filterByCategories,
      filterByPaymentMethods,
      filterByPaymentInstruments,
    ]
  )
}
