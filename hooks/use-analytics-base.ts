import { useMemo } from "react"
import { useSettings, useDerivedExpenseData } from "../stores/hooks"
import { Expense } from "../types/expense"
import type { PaymentInstrument } from "../types/payment-instrument"
import type { DateRange } from "../types/analytics"
import type { TimeWindow } from "../utils/analytics/time"
import { getDateRangeForFilters } from "../utils/analytics/time"
import type {
  PaymentInstrumentSelectionKey,
  PaymentMethodSelectionKey,
} from "../utils/analytics/filters"
import { applyAllFilters } from "../utils/analytics/filters"

export interface AnalyticsBaseResult {
  filteredExpenses: Expense[]
  /** All expenses in the effective currency, ignoring every filter including the time window/month */
  fullPeriodExpenses: Expense[]
  availableCurrencies: string[]
  effectiveCurrency: string
  dateRange: DateRange
  isLoading: boolean
  paymentInstruments: PaymentInstrument[]
  /** The effective selectedMonth — null if stored month doesn't exist for current currency */
  effectiveSelectedMonth: string | null
}

/**
 * Base analytics hook that handles:
 * - Currency grouping and selection (via shared useDerivedExpenseData)
 * - Filtering pipeline (Time → Categories → Payment Methods → Payment Instruments)
 * - Date range calculation
 *
 * Currency and month resolution are handled internally via useDerivedExpenseData
 * which reads from the shared filter store. No need to pass them as parameters.
 */
export function useAnalyticsBase(
  timeWindow: TimeWindow,
  selectedCategories: string[],
  selectedPaymentMethods: PaymentMethodSelectionKey[],
  selectedPaymentInstruments: PaymentInstrumentSelectionKey[],
  searchQuery: string = "",
  minAmount: number | null = null,
  maxAmount: number | null = null
): AnalyticsBaseResult {
  const { settings } = useSettings()
  const {
    availableCurrencies,
    currencyExpenses,
    effectiveCurrency,
    effectiveSelectedMonth,
    isLoading,
  } = useDerivedExpenseData()

  const paymentInstruments = useMemo(() => {
    return (settings.paymentInstruments ?? []) as PaymentInstrument[]
  }, [settings.paymentInstruments])

  // Apply all filters in single pass for optimal performance.
  // Uses effectiveSelectedMonth (null when the stored month doesn't exist for
  // the current currency) ensuring filtering is always consistent.
  const filterState = useMemo(
    () => ({
      timeWindow,
      selectedMonth: effectiveSelectedMonth,
      selectedCategories,
      selectedPaymentMethods,
      selectedPaymentInstruments,
      searchQuery,
      minAmount,
      maxAmount,
    }),
    [
      timeWindow,
      effectiveSelectedMonth,
      selectedCategories,
      selectedPaymentMethods,
      selectedPaymentInstruments,
      searchQuery,
      minAmount,
      maxAmount,
    ]
  )

  const filteredExpenses = useMemo(() => {
    return applyAllFilters(currencyExpenses, filterState, paymentInstruments)
  }, [currencyExpenses, filterState, paymentInstruments])

  // All expenses in the effective currency, with every filter ignored —
  // including the time window/month. Used to compute the grand total shown as
  // subtext on the stats cards, so it stays constant regardless of filters.
  const fullPeriodExpenses = currencyExpenses

  // Compute date range
  const dateRange = useMemo(() => {
    return getDateRangeForFilters(timeWindow, effectiveSelectedMonth, filteredExpenses)
  }, [timeWindow, effectiveSelectedMonth, filteredExpenses])

  return {
    filteredExpenses,
    fullPeriodExpenses,
    availableCurrencies,
    effectiveCurrency,
    dateRange,
    isLoading,
    paymentInstruments,
    effectiveSelectedMonth,
  }
}
