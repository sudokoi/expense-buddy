import { parseISO, isValid } from "date-fns"
import { getFallbackCurrency, computeEffectiveCurrency } from "../../utils/currency"
import type { Expense } from "../../types/expense"

export interface DerivedExpenseData {
  /** Expenses grouped by currency code */
  expensesByCurrency: Map<string, Expense[]>
  /** Sorted list of currency codes present in the data */
  availableCurrencies: string[]
  /** Sorted list of month keys (YYYY-MM) present for the effective currency, newest first */
  availableMonths: string[]
  /** The resolved currency taking into account user selection and defaults */
  effectiveCurrency: string
  /** Expenses filtered to the effective currency */
  currencyExpenses: Expense[]
  /** The currency that would be selected with no explicit user choice */
  defaultCurrency: string
  /**
   * The effective selectedMonth — null when the stored month has no expenses
   * in the effective currency, which keeps month-scoped views from showing an
   * empty state for a selection that is no longer valid.
   */
  effectiveSelectedMonth: string | null
  /** Whether the expense store is still loading */
  isLoading: boolean
}

/**
 * Derives the currency- and month-partitioned view of the active expenses.
 *
 * Expenses are grouped by currency (legacy entries with no currency fall back
 * to the default), the effective currency is resolved from the user's selection
 * and settings default, and the month list plus effective selected month are
 * derived from only the expenses in that currency.
 */
export function computeDerivedExpenseData(
  activeExpenses: Expense[],
  defaultCurrencySetting: string,
  selectedCurrency: string | null,
  selectedMonth: string | null,
  isLoading: boolean
): DerivedExpenseData {
  // Single-pass derivation: group by currency
  const groups = new Map<string, Expense[]>()
  const fallback = getFallbackCurrency()

  for (const expense of activeExpenses) {
    const currency = expense.currency || fallback
    let bucket = groups.get(currency)
    if (!bucket) {
      bucket = []
      groups.set(currency, bucket)
    }
    bucket.push(expense)
  }

  const availableCurrencies = Array.from(groups.keys()).sort()

  // Effective currency based on user selection, available data, and settings default
  const effectiveCurrency = computeEffectiveCurrency(
    selectedCurrency,
    availableCurrencies,
    groups,
    defaultCurrencySetting
  )

  // Expenses scoped to the effective currency
  const currencyExpenses = groups.get(effectiveCurrency) ?? []

  // Available months scoped to the effective currency (not all expenses).
  // This ensures month options only show months that have data for the selected currency.
  const months = new Set<string>()
  for (const expense of currencyExpenses) {
    const date = parseISO(expense.date)
    if (isValid(date)) {
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      months.add(monthKey)
    }
  }
  const availableMonths = Array.from(months).sort((a, b) => b.localeCompare(a))

  // Effective selectedMonth: resolves the store's selectedMonth against the
  // current currency's available months. Returns null if the stored month
  // has no data for the effective currency, so month-scoped views don't show
  // an empty state for a selection that is no longer valid.
  const effectiveSelectedMonth =
    selectedMonth && availableMonths.includes(selectedMonth) ? selectedMonth : null

  // Default currency resolves the same way as effectiveCurrency but with no
  // user selection, representing what the currency would be when the user has
  // never overridden it.
  const defaultCurrency = computeEffectiveCurrency(
    null,
    availableCurrencies,
    groups,
    defaultCurrencySetting
  )

  return {
    expensesByCurrency: groups,
    availableCurrencies,
    availableMonths,
    effectiveCurrency,
    currencyExpenses,
    defaultCurrency,
    effectiveSelectedMonth,
    isLoading,
  }
}
