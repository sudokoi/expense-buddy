import { useTranslation } from "react-i18next"
import { useAnalyticsBase, AnalyticsBaseResult } from "./use-analytics-base"
import { useAnalyticsCharts, AnalyticsChartsResult } from "./use-analytics-charts"
import {
  useAnalyticsStatistics,
  AnalyticsStatisticsResult,
} from "./use-analytics-statistics"
import {
  TimeWindow,
  PaymentInstrumentSelectionKey,
  PaymentMethodSelectionKey,
} from "../utils/analytics-calculations"

/**
 * Combined analytics data interface (for backward compatibility)
 * @deprecated Consider using individual hooks: useAnalyticsBase, useAnalyticsCharts, useAnalyticsStatistics
 */
export interface AnalyticsData
  extends AnalyticsBaseResult, AnalyticsChartsResult, AnalyticsStatisticsResult {}

/**
 * Hook for computing analytics data from expenses.
 * This is a composite hook that combines useAnalyticsBase, useAnalyticsCharts, and useAnalyticsStatistics.
 *
 * @deprecated Consider using individual hooks for better tree-shaking and targeted updates
 * @param timeWindow - The time window to filter expenses (7d, 15d, 1m, 3m, 6m, 1y, all)
 * @param selectedCategories - Categories to filter by (empty array = all categories)
 * @param selectedPaymentMethods - Payment methods to filter by
 * @param selectedPaymentInstruments - Payment instruments to filter by
 * @param selectedCurrency - Selected currency code (null = auto)
 * @returns Analytics data including filtered expenses, chart data, and statistics
 */
export function useAnalyticsData(
  timeWindow: TimeWindow,
  selectedCategories: string[],
  selectedPaymentMethods: PaymentMethodSelectionKey[],
  selectedPaymentInstruments: PaymentInstrumentSelectionKey[],
  selectedCurrency: string | null = null
): AnalyticsData {
  const { t } = useTranslation()

  const base = useAnalyticsBase(
    timeWindow,
    null,
    selectedCategories,
    selectedPaymentMethods,
    selectedPaymentInstruments,
    selectedCurrency
  )

  const charts = useAnalyticsCharts(
    base.filteredExpenses,
    base.dateRange,
    base.paymentInstruments,
    t
  )

  const stats = useAnalyticsStatistics(base.filteredExpenses, timeWindow, base.dateRange)

  return {
    ...base,
    ...charts,
    ...stats,
  }
}

// Re-export individual hooks for direct usage
export { useAnalyticsBase, useAnalyticsCharts, useAnalyticsStatistics }
export type { AnalyticsBaseResult, AnalyticsChartsResult, AnalyticsStatisticsResult }
