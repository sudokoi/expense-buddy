import { useMemo, useCallback } from "react"
import { useSettings, useDerivedExpenseData } from "../stores/hooks"
import { Expense } from "../types/expense"
import { isWithinInterval, parseISO } from "date-fns"
import type { PaymentInstrument } from "../types/payment-instrument"
import type { DateRange } from "../types/analytics"
import type { TimeWindow } from "../utils/analytics/time"
import { getDateRangeForFilters } from "../utils/analytics/time"
import type {
  PaymentInstrumentSelectionKey,
  PaymentMethodSelectionKey,
} from "../utils/analytics/filters"
import {
  filterExpensesByCategories,
  filterExpensesByPaymentMethods,
  filterExpensesByPaymentInstruments,
} from "../utils/analytics/filters"
import { filterExpensesByTimeWindow, getDateRangeForMonth } from "../utils/analytics/time"
import { applyAllFilters } from "../utils/analytics/filters"

export interface AnalyticsBaseResult {
  filteredExpenses: Expense[]
  availableCurrencies: string[]
  effectiveCurrency: string
  dateRange: DateRange
  isLoading: boolean
  paymentInstruments: PaymentInstrument[]
  availableMonths: string[]
  /** The effective selectedMonth — null if stored month doesn't exist for current currency */
  effectiveSelectedMonth: string | null
  filterByTimeWindow: (expenses: Expense[]) => Expense[]
  filterByCategories: (expenses: Expense[]) => Expense[]
  filterByPaymentMethods: (expenses: Expense[]) => Expense[]
  filterByPaymentInstruments: (expenses: Expense[]) => Expense[]
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
    availableMonths,
    currencyExpenses,
    effectiveCurrency,
    effectiveSelectedMonth,
    isLoading,
  } = useDerivedExpenseData()

  const paymentInstruments = useMemo(() => {
    return (settings.paymentInstruments ?? []) as PaymentInstrument[]
  }, [settings.paymentInstruments])

  // Memoized filter callbacks
  const filterByTimeWindow = useCallback(
    (expenses: Expense[]): Expense[] => {
      if (effectiveSelectedMonth) {
        const { start, end } = getDateRangeForMonth(effectiveSelectedMonth)
        return expenses.filter((expense) => {
          try {
            const expenseDate = parseISO(expense.date)
            return isWithinInterval(expenseDate, { start, end })
          } catch {
            return false
          }
        })
      }

      return filterExpensesByTimeWindow(expenses, timeWindow)
    },
    [effectiveSelectedMonth, timeWindow]
  )

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

  // Compute date range
  const dateRange = useMemo(() => {
    return getDateRangeForFilters(timeWindow, effectiveSelectedMonth, filteredExpenses)
  }, [timeWindow, effectiveSelectedMonth, filteredExpenses])

  return {
    filteredExpenses,
    availableCurrencies,
    effectiveCurrency,
    dateRange,
    isLoading,
    paymentInstruments,
    availableMonths,
    effectiveSelectedMonth,
    filterByTimeWindow,
    filterByCategories,
    filterByPaymentMethods,
    filterByPaymentInstruments,
  }
}
