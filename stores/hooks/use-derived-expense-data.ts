import { useMemo } from "react"
import { parseISO, isValid } from "date-fns"
import { useExpenses, useSettings } from "../hooks"
import { useFilters } from "../filter-store"
import { getFallbackCurrency, computeEffectiveCurrency } from "../../utils/currency"
import type { Expense } from "../../types/expense"

/**
 * Pre-computed derived data from activeExpenses.
 *
 * This hook performs expensive derivations (currency grouping, available months,
 * effective currency resolution) once and shares the results across consumers.
 * Previously each screen (Dashboard, History, Filters) re-computed these independently
 * on mount, iterating all expenses multiple times.
 *
 * Key design decisions:
 * - `availableMonths` is scoped to the effective currency (not all expenses)
 * - Month validation is exposed as a pure derived value (`effectiveSelectedMonth`)
 *   rather than an imperative store correction. The store keeps the user's intent;
 *   consumers use the derived value for display and filtering.
 */
export function useDerivedExpenseData() {
  const { state } = useExpenses()
  const { settings } = useSettings()
  const {
    filters: { selectedCurrency, selectedMonth },
  } = useFilters()

  // Single-pass derivation: group by currency
  const { expensesByCurrency, availableCurrencies } = useMemo(() => {
    const groups = new Map<string, Expense[]>()
    const fallback = getFallbackCurrency()

    for (const expense of state.activeExpenses) {
      const currency = expense.currency || fallback
      let bucket = groups.get(currency)
      if (!bucket) {
        bucket = []
        groups.set(currency, bucket)
      }
      bucket.push(expense)
    }

    const sortedCurrencies = Array.from(groups.keys()).sort()

    return {
      expensesByCurrency: groups,
      availableCurrencies: sortedCurrencies,
    }
  }, [state.activeExpenses])

  // Effective currency based on user selection, available data, and settings default
  const effectiveCurrency = useMemo(
    () =>
      computeEffectiveCurrency(
        selectedCurrency,
        availableCurrencies,
        expensesByCurrency,
        settings.defaultCurrency
      ),
    [selectedCurrency, availableCurrencies, expensesByCurrency, settings.defaultCurrency]
  )

  // Expenses scoped to the effective currency
  const currencyExpenses = useMemo(
    () => expensesByCurrency.get(effectiveCurrency) ?? [],
    [expensesByCurrency, effectiveCurrency]
  )

  // Available months scoped to the effective currency (not all expenses).
  // This ensures month options only show months that have data for the selected currency.
  const availableMonths = useMemo(() => {
    const months = new Set<string>()
    for (const expense of currencyExpenses) {
      const date = parseISO(expense.date)
      if (isValid(date)) {
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
        months.add(monthKey)
      }
    }
    return Array.from(months).sort((a, b) => b.localeCompare(a))
  }, [currencyExpenses])

  // Effective selectedMonth: resolves the store's selectedMonth against the
  // current currency's available months. Returns null if the stored month
  // has no data for the effective currency.
  //
  // This is a pure derived value — it does NOT write back to the store.
  // The store retains the user's intent (their last explicit month selection).
  // Consumers should use this for display and filtering logic.
  const effectiveSelectedMonth = useMemo(() => {
    if (!selectedMonth) return null
    return availableMonths.includes(selectedMonth) ? selectedMonth : null
  }, [selectedMonth, availableMonths])

  // Default currency (what resolves when no explicit selection is made) — used by Filters screen
  const defaultCurrency = useMemo(
    () =>
      computeEffectiveCurrency(
        null,
        availableCurrencies,
        expensesByCurrency,
        settings.defaultCurrency
      ),
    [availableCurrencies, expensesByCurrency, settings.defaultCurrency]
  )

  return {
    /** Expenses grouped by currency code */
    expensesByCurrency,
    /** Sorted list of currency codes present in the data */
    availableCurrencies,
    /** Sorted list of month keys (YYYY-MM) present for the effective currency, newest first */
    availableMonths,
    /** The resolved currency taking into account user selection and defaults */
    effectiveCurrency,
    /** Expenses filtered to the effective currency */
    currencyExpenses,
    /** The currency that would be selected with no explicit user choice */
    defaultCurrency,
    /**
     * The effective selectedMonth — null if the stored month doesn't exist for
     * the current currency. Use this for display (chips) and filtering logic.
     */
    effectiveSelectedMonth,
    /** Whether the expense store is still loading */
    isLoading: state.isLoading,
  }
}
