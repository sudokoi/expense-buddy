import { useMemo } from "react"
import { useCategories } from "../stores/hooks"
import { Expense } from "../types/expense"
import type { PaymentInstrument } from "../types/payment-instrument"
import {
  PieChartDataItem,
  PaymentMethodChartDataItem,
  PaymentInstrumentChartDataItem,
  LineChartDataItem,
  CategoryColorMap,
  aggregateByCategory,
  aggregateByPaymentMethod,
  aggregateByPaymentInstrument,
  aggregateByDay,
} from "../utils/analytics-calculations"
import { getLocale } from "../utils/date"
import { TFunction } from "i18next"

export interface DateRange {
  start: Date
  end: Date
}

export interface AnalyticsChartsResult {
  pieChartData: PieChartDataItem[]
  paymentMethodChartData: PaymentMethodChartDataItem[]
  paymentInstrumentChartData: PaymentInstrumentChartDataItem[]
  lineChartData: LineChartDataItem[]
}

/**
 * Hook for generating analytics chart data.
 * Requires filtered expenses from useAnalyticsBase.
 */
export function useAnalyticsCharts(
  filteredExpenses: Expense[],
  dateRange: DateRange,
  paymentInstruments: PaymentInstrument[],
  t: TFunction
): AnalyticsChartsResult {
  const { categories } = useCategories()
  const locale = getLocale()

  // Build category color map
  const categoryColorMap = useMemo((): CategoryColorMap => {
    const colorMap: CategoryColorMap = {}
    for (const category of categories) {
      colorMap[category.label] = category.color
    }
    return colorMap
  }, [categories])

  // Pie chart data by category
  const pieChartData = useMemo(() => {
    return aggregateByCategory(filteredExpenses, categoryColorMap, t)
  }, [filteredExpenses, categoryColorMap, t])

  // Payment method chart data
  const paymentMethodChartData = useMemo(() => {
    return aggregateByPaymentMethod(filteredExpenses, t)
  }, [filteredExpenses, t])

  // Payment instrument chart data
  const paymentInstrumentChartData = useMemo(() => {
    return aggregateByPaymentInstrument(filteredExpenses, paymentInstruments, t)
  }, [filteredExpenses, paymentInstruments, t])

  // Line chart data by day
  const lineChartData = useMemo(() => {
    return aggregateByDay(filteredExpenses, dateRange, locale)
  }, [filteredExpenses, dateRange, locale])

  return {
    pieChartData,
    paymentMethodChartData,
    paymentInstrumentChartData,
    lineChartData,
  }
}
