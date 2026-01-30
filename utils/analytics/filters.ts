import { Expense, PaymentMethodType } from "../../types/expense"
import type {
  PaymentInstrument,
  PaymentInstrumentMethod,
} from "../../types/payment-instrument"
import {
  isPaymentInstrumentMethod,
  findInstrumentById,
} from "../../services/payment-instruments"

export type PaymentInstrumentSelectionKey = string

export type PaymentMethodSelectionKey = PaymentMethodType | "__none__"

const PAYMENT_METHOD_NONE_KEY: PaymentMethodSelectionKey = "__none__"

const INSTRUMENT_OTHERS_ID = "__others__"

export function makePaymentInstrumentSelectionKey(
  method: PaymentInstrumentMethod,
  instrumentId?: string
): PaymentInstrumentSelectionKey {
  return `${method}::${instrumentId ?? INSTRUMENT_OTHERS_ID}`
}

function resolveInstrumentKeyForExpense(
  expense: Expense,
  instruments: PaymentInstrument[]
): {
  method: PaymentInstrumentMethod
  key: PaymentInstrumentSelectionKey
  isOther: boolean
  instrumentId?: string
} | null {
  const method = expense.paymentMethod?.type
  if (!method || !isPaymentInstrumentMethod(method)) return null

  const instrumentId = expense.paymentMethod?.instrumentId
  const inst = findInstrumentById(instruments, instrumentId)
  if (!inst || inst.deletedAt) {
    return {
      method,
      key: makePaymentInstrumentSelectionKey(method, undefined),
      isOther: true,
      instrumentId: undefined,
    }
  }
  return {
    method,
    key: makePaymentInstrumentSelectionKey(method, inst.id),
    isOther: false,
    instrumentId: inst.id,
  }
}

/**
 * Filter expenses by selected payment instrument keys.
 * If selection is empty, returns all expenses.
 * When selection is non-empty, includes ONLY expenses whose payment method is an instrument method
 * and whose resolved instrument key matches.
 */
export function filterExpensesByPaymentInstruments(
  expenses: Expense[],
  selectedInstrumentKeys: PaymentInstrumentSelectionKey[],
  instruments: PaymentInstrument[]
): Expense[] {
  if (selectedInstrumentKeys.length === 0) return expenses

  const selection = new Set(selectedInstrumentKeys)
  return expenses.filter((expense) => {
    const resolved = resolveInstrumentKeyForExpense(expense, instruments)
    if (!resolved) return false
    return selection.has(resolved.key)
  })
}

/**
 * Filter expenses by selected categories
 */
export function filterExpensesByCategories(
  expenses: Expense[],
  selectedCategories: string[]
): Expense[] {
  if (selectedCategories.length === 0) {
    return expenses
  }

  const selection = new Set(selectedCategories)
  return expenses.filter((expense) => selection.has(expense.category))
}

/**
 * Filter expenses by selected payment methods.
 * Empty selection means "All".
 * Supports a "__none__" key to include expenses without a payment method.
 */
export function filterExpensesByPaymentMethods(
  expenses: Expense[],
  selected: PaymentMethodSelectionKey[]
): Expense[] {
  if (selected.length === 0) return expenses

  const selection = new Set(selected)

  return expenses.filter((expense) => {
    const method = expense.paymentMethod?.type
    // Note: analytics aggregates missing payment methods under "Other".
    // So selecting "Other" should include both explicit "Other" and missing-method expenses.
    if (!method) return selection.has(PAYMENT_METHOD_NONE_KEY) || selection.has("Other")
    return selection.has(method)
  })
}

// ============================================================================
// Optimized Single-Pass Filter Application
// ============================================================================

import { parseISO, isWithinInterval, startOfDay, endOfDay, subDays } from "date-fns"
import type { TimeWindow } from "./time"

export interface FilterState {
  timeWindow: TimeWindow
  selectedCategories: string[]
  selectedPaymentMethods: PaymentMethodSelectionKey[]
  selectedPaymentInstruments: PaymentInstrumentSelectionKey[]
  searchQuery: string
  minAmount: number | null
  maxAmount: number | null
}

/**
 * Build a cached instrument lookup Map for O(1) access
 */
function buildInstrumentMap(
  instruments: PaymentInstrument[]
): Map<string, PaymentInstrument> {
  return new Map(instruments.map((i) => [i.id, i]))
}

/**
 * Get instrument selection key using cached map (O(1) lookup)
 */
function getInstrumentKeyWithMap(
  expense: Expense,
  instrumentMap: Map<string, PaymentInstrument>
): string {
  const method = expense.paymentMethod?.type
  if (!method || !isPaymentInstrumentMethod(method)) return ""

  const instrumentId = expense.paymentMethod?.instrumentId
  if (!instrumentId) return `${method}::__others__`

  const instrument = instrumentMap.get(instrumentId)
  if (!instrument || instrument.deletedAt) return `${method}::__others__`

  return `${method}::${instrumentId}`
}

/**
 * Check if expense matches search query
 * Searches: note, category, payment method, instrument nickname
 */
function matchesSearch(
  expense: Expense,
  query: string,
  instrumentMap: Map<string, PaymentInstrument>
): boolean {
  const lowerQuery = query.toLowerCase()

  // Check note
  if (expense.note?.toLowerCase().includes(lowerQuery)) return true

  // Check category
  if (expense.category.toLowerCase().includes(lowerQuery)) return true

  // Check payment method
  const method = expense.paymentMethod?.type
  if (method?.toLowerCase().includes(lowerQuery)) return true

  // Check instrument nickname
  const instrumentId = expense.paymentMethod?.instrumentId
  if (instrumentId) {
    const instrument = instrumentMap.get(instrumentId)
    if (instrument?.nickname.toLowerCase().includes(lowerQuery)) return true
  }

  return false
}

/**
 * Check if expense date falls within time window
 */
function isExpenseInTimeWindow(expense: Expense, timeWindow: TimeWindow): boolean {
  if (timeWindow === "all") return true

  const expenseDate = parseISO(expense.date)
  const now = new Date()
  const end = endOfDay(now)

  const daysMap: Record<TimeWindow, number> = {
    "7d": 7,
    "15d": 15,
    "1m": 30,
    "3m": 90,
    "6m": 180,
    "1y": 365,
    all: -1,
  }

  const days = daysMap[timeWindow]
  const start = startOfDay(subDays(end, days - 1))

  return isWithinInterval(expenseDate, { start, end })
}

/**
 * Apply all filters in a single pass for optimal performance
 *
 * Performance optimizations:
 * - Single pass through expenses (O(n))
 * - Set lookups for O(1) category/method/instrument checks
 * - Cached instrument Map for O(1) lookups
 * - Search performed last (most expensive check)
 *
 * @param expenses - Array of expenses to filter
 * @param filters - Filter state
 * @param instruments - Available payment instruments
 * @returns Filtered expenses
 */
export function applyAllFilters(
  expenses: Expense[],
  filters: FilterState,
  instruments: PaymentInstrument[]
): Expense[] {
  // Early return if no filters active
  const hasActiveFilters =
    filters.timeWindow !== "all" ||
    filters.selectedCategories.length > 0 ||
    filters.selectedPaymentMethods.length > 0 ||
    filters.selectedPaymentInstruments.length > 0 ||
    filters.searchQuery.trim().length > 0 ||
    filters.minAmount !== null ||
    filters.maxAmount !== null

  if (!hasActiveFilters) return expenses

  // Build lookup Sets for O(1) performance
  const categorySet = new Set(filters.selectedCategories)
  const methodSet = new Set(filters.selectedPaymentMethods)
  const instrumentSet = new Set(filters.selectedPaymentInstruments)

  // Build instrument lookup Map (cached)
  const instrumentMap = buildInstrumentMap(instruments)

  const searchLower = filters.searchQuery.toLowerCase().trim()
  const hasSearch = searchLower.length > 0

  return expenses.filter((expense) => {
    // 1. Time window check (fast)
    if (filters.timeWindow !== "all") {
      if (!isExpenseInTimeWindow(expense, filters.timeWindow)) return false
    }

    // 2. Amount range check
    const amount = Math.abs(expense.amount)
    if (filters.minAmount !== null && amount < filters.minAmount) return false
    if (filters.maxAmount !== null && amount > filters.maxAmount) return false

    // 3. Category check (Set lookup - O(1))
    if (categorySet.size > 0 && !categorySet.has(expense.category)) return false

    // 4. Payment method check (Set lookup - O(1))
    if (methodSet.size > 0) {
      const method = expense.paymentMethod?.type || "__none__"
      if (!methodSet.has(method as PaymentMethodSelectionKey)) return false
    }

    // 5. Payment instrument check (Set lookup - O(1))
    if (instrumentSet.size > 0) {
      const key = getInstrumentKeyWithMap(expense, instrumentMap)
      if (!instrumentSet.has(key)) return false
    }

    // 6. Search check (most expensive, do last)
    if (hasSearch) {
      if (!matchesSearch(expense, searchLower, instrumentMap)) return false
    }

    return true
  })
}

/**
 * Filter expenses by search query only
 * Useful for quick search without other filters
 */
export function filterExpensesBySearchQuery(
  expenses: Expense[],
  query: string,
  instruments: PaymentInstrument[]
): Expense[] {
  if (!query.trim()) return expenses

  const instrumentMap = buildInstrumentMap(instruments)
  return expenses.filter((expense) =>
    matchesSearch(expense, query.toLowerCase().trim(), instrumentMap)
  )
}

/**
 * Filter expenses by amount range only
 */
export function filterExpensesByAmountRange(
  expenses: Expense[],
  minAmount: number | null,
  maxAmount: number | null
): Expense[] {
  return expenses.filter((expense) => {
    const amount = Math.abs(expense.amount)
    if (minAmount !== null && amount < minAmount) return false
    if (maxAmount !== null && amount > maxAmount) return false
    return true
  })
}
