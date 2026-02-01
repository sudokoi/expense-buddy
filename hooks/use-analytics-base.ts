import { useMemo, useCallback } from "react"
import { useExpenses, useSettings } from "../stores/hooks"
import { Expense } from "../types/expense"
import { isWithinInterval, parseISO } from "date-fns"
import type { PaymentInstrument } from "../types/payment-instrument"
import type { DateRange } from "../types/analytics"
import {
  TimeWindow,
  PaymentInstrumentSelectionKey,
  PaymentMethodSelectionKey,
  filterExpensesByCategories,
  filterExpensesByPaymentMethods,
  filterExpensesByPaymentInstruments,
  groupExpensesByCurrency,
  getDateRangeForFilters,
} from "../utils/analytics-calculations"
import {
  filterExpensesByTimeWindow,
  getDateRangeForMonth,
  getAvailableMonths,
} from "../utils/analytics/time"
import { applyAllFilters } from "../utils/analytics/filters"
import { getFallbackCurrency, computeEffectiveCurrency } from "../utils/currency"

export interface AnalyticsBaseResult {
  filteredExpenses: Expense[]
  availableCurrencies: string[]
  effectiveCurrency: string
  dateRange: DateRange
  isLoading: boolean
  paymentInstruments: PaymentInstrument[]
  availableMonths: string[]
  filterByTimeWindow: (expenses: Expense[]) => Expense[]
  filterByCategories: (expenses: Expense[]) => Expense[]
  filterByPaymentMethods: (expenses: Expense[]) => Expense[]
  filterByPaymentInstruments: (expenses: Expense[]) => Expense[]
}

/**
 * Base analytics hook that handles:
 * - Currency grouping and selection
 * - Filtering pipeline (Time → Categories → Payment Methods → Payment Instruments)
 * - Date range calculation
 */
export function useAnalyticsBase(
  timeWindow: TimeWindow,
  selectedMonth: string | null,
  selectedCategories: string[],
  selectedPaymentMethods: PaymentMethodSelectionKey[],
  selectedPaymentInstruments: PaymentInstrumentSelectionKey[],
  selectedCurrency: string | null = null
): AnalyticsBaseResult {
  const { state } = useExpenses()
  const { settings } = useSettings()
  const { activeExpenses, isLoading } = state

  const paymentInstruments = useMemo(() => {
    return (settings.paymentInstruments ?? []) as PaymentInstrument[]
  }, [settings.paymentInstruments])

  // 1. Group ALL active expenses by currency to determine available currencies
  const { availableCurrencies, expensesByCurrency } = useMemo(() => {
    const grouped = groupExpensesByCurrency(activeExpenses, getFallbackCurrency())
    const available = Array.from(grouped.keys()).sort()
    return { availableCurrencies: available, expensesByCurrency: grouped }
  }, [activeExpenses])

  // 2. Determine effective currency
  const effectiveCurrency = useMemo(() => {
    return computeEffectiveCurrency(
      selectedCurrency,
      availableCurrencies,
      expensesByCurrency,
      settings.defaultCurrency
    )
  }, [
    selectedCurrency,
    availableCurrencies,
    expensesByCurrency,
    settings.defaultCurrency,
  ])

  // 3. Get expenses for the effective currency (ALL TIME)
  const currencyExpenses = useMemo(() => {
    return expensesByCurrency.get(effectiveCurrency) || []
  }, [expensesByCurrency, effectiveCurrency])

  // Memoized filter callbacks
  const filterByTimeWindow = useCallback(
    (expenses: Expense[]): Expense[] => {
      if (selectedMonth) {
        const { start, end } = getDateRangeForMonth(selectedMonth)
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
    [selectedMonth, timeWindow]
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

  // 4. Apply all filters in single pass for optimal performance
  const filterState = useMemo(
    () => ({
      timeWindow,
      selectedMonth,
      selectedCategories,
      selectedPaymentMethods,
      selectedPaymentInstruments,
      searchQuery: "", // Search is not used in analytics base hook
      minAmount: null,
      maxAmount: null,
    }),
    [
      timeWindow,
      selectedMonth,
      selectedCategories,
      selectedPaymentMethods,
      selectedPaymentInstruments,
    ]
  )

  const filteredExpenses = useMemo(() => {
    return applyAllFilters(currencyExpenses, filterState, paymentInstruments)
  }, [currencyExpenses, filterState, paymentInstruments])

  const availableMonths = useMemo(() => {
    return getAvailableMonths(currencyExpenses)
  }, [currencyExpenses])

  // Compute date range
  const dateRange = useMemo(() => {
    return getDateRangeForFilters(timeWindow, selectedMonth, filteredExpenses)
  }, [timeWindow, selectedMonth, filteredExpenses])

  return {
    filteredExpenses,
    availableCurrencies,
    effectiveCurrency,
    dateRange,
    isLoading,
    paymentInstruments,
    availableMonths,
    filterByTimeWindow,
    filterByCategories,
    filterByPaymentMethods,
    filterByPaymentInstruments,
  }
}
