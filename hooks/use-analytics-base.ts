import { useMemo, useCallback } from "react"
import { useExpenses, useSettings } from "../stores/hooks"
import { Expense } from "../types/expense"
import type { PaymentInstrument } from "../types/payment-instrument"
import {
  TimeWindow,
  PaymentInstrumentSelectionKey,
  PaymentMethodSelectionKey,
  CategoryColorMap,
  filterExpensesByTimeWindow,
  filterExpensesByCategories,
  filterExpensesByPaymentMethods,
  filterExpensesByPaymentInstruments,
  groupExpensesByCurrency,
  getDateRangeForTimeWindow,
} from "../utils/analytics-calculations"
import { getFallbackCurrency, computeEffectiveCurrency } from "../utils/currency"

export interface DateRange {
  start: Date
  end: Date
}

export interface AnalyticsBaseResult {
  filteredExpenses: Expense[]
  availableCurrencies: string[]
  effectiveCurrency: string
  dateRange: DateRange
  isLoading: boolean
  paymentInstruments: PaymentInstrument[]
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
      return filterExpensesByTimeWindow(expenses, timeWindow)
    },
    [timeWindow]
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

  // 4. Filter by Time Window
  const timeFilteredExpenses = useMemo(() => {
    return filterByTimeWindow(currencyExpenses)
  }, [currencyExpenses, filterByTimeWindow])

  // 5. Filter by Categories
  const categoryFilteredExpenses = useMemo(() => {
    return filterByCategories(timeFilteredExpenses)
  }, [timeFilteredExpenses, filterByCategories])

  // 6. Filter by Payment Methods
  const paymentMethodFilteredExpenses = useMemo(() => {
    return filterByPaymentMethods(categoryFilteredExpenses)
  }, [categoryFilteredExpenses, filterByPaymentMethods])

  // 7. Filter by Payment Instruments (final filtered list)
  const filteredExpenses = useMemo(() => {
    return filterByPaymentInstruments(paymentMethodFilteredExpenses)
  }, [paymentMethodFilteredExpenses, filterByPaymentInstruments])

  // Compute date range
  const dateRange = useMemo(() => {
    return getDateRangeForTimeWindow(timeWindow, filteredExpenses)
  }, [timeWindow, filteredExpenses])

  return {
    filteredExpenses,
    availableCurrencies,
    effectiveCurrency,
    dateRange,
    isLoading,
    paymentInstruments,
    filterByTimeWindow,
    filterByCategories,
    filterByPaymentMethods,
    filterByPaymentInstruments,
  }
}
