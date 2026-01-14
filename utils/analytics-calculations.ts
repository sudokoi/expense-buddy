import { Expense, PaymentMethodType } from "../types/expense"
import type {
  PaymentInstrument,
  PaymentInstrumentMethod,
} from "../types/payment-instrument"
import {
  parseISO,
  subDays,
  startOfDay,
  endOfDay,
  format,
  eachDayOfInterval,
  isWithinInterval,
} from "date-fns"
import { CATEGORY_COLORS } from "../constants/category-colors"
import { PAYMENT_METHOD_COLORS } from "../constants/payment-method-colors"
import {
  PAYMENT_INSTRUMENT_METHODS,
  findInstrumentById,
  formatPaymentInstrumentLabel,
  isPaymentInstrumentMethod,
} from "../services/payment-instruments"

// Category color map type for dynamic categories
export type CategoryColorMap = Record<string, string>

// Time window type
export type TimeWindow = "7d" | "15d" | "1m" | "3m" | "6m" | "1y" | "all"

// Pie chart data item
export interface PieChartDataItem {
  value: number
  color: string
  text: string
  percentage: number
  category: string
}

// Payment method chart data item
export interface PaymentMethodChartDataItem {
  value: number
  color: string
  text: string
  percentage: number
  paymentMethodType: PaymentMethodType | "Other"
}

export type PaymentInstrumentSelectionKey = string

export type PaymentMethodSelectionKey = PaymentMethodType | "__none__"

const PAYMENT_METHOD_NONE_KEY: PaymentMethodSelectionKey = "__none__"

const INSTRUMENT_OTHERS_ID = "__others__"

export interface PaymentInstrumentChartDataItem {
  key: PaymentInstrumentSelectionKey
  value: number
  color: string
  text: string
  percentage: number
  method: PaymentInstrumentMethod
  instrumentId?: string
  isOther: boolean
}

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
 * Aggregate expenses by payment instrument (Credit/Debit/UPI).
 * - If the instrumentId is missing, unknown, or deleted, the expense is grouped under "{method} • Others".
 * - Only instrument methods are included (Credit Card, Debit Card, UPI).
 */
export function aggregateByPaymentInstrument(
  expenses: Expense[],
  instruments: PaymentInstrument[]
): PaymentInstrumentChartDataItem[] {
  const totals = new Map<
    PaymentInstrumentSelectionKey,
    {
      method: PaymentInstrumentMethod
      instrumentId?: string
      isOther: boolean
      value: number
    }
  >()

  for (const expense of expenses) {
    const resolved = resolveInstrumentKeyForExpense(expense, instruments)
    if (!resolved) continue

    const current = totals.get(resolved.key)
    const nextValue = (current?.value ?? 0) + Math.abs(expense.amount)
    totals.set(resolved.key, {
      method: resolved.method,
      instrumentId: resolved.instrumentId,
      isOther: resolved.isOther,
      value: nextValue,
    })
  }

  const total = Array.from(totals.values()).reduce((sum, v) => sum + v.value, 0)
  if (total === 0) return []

  const items: PaymentInstrumentChartDataItem[] = []
  for (const [key, entry] of totals) {
    if (entry.value <= 0) continue

    let text = `${entry.method} • Others`
    if (!entry.isOther && entry.instrumentId) {
      const inst = findInstrumentById(instruments, entry.instrumentId)
      if (inst && !inst.deletedAt) {
        text = `${entry.method} • ${formatPaymentInstrumentLabel(inst)}`
      }
    }

    items.push({
      key,
      value: entry.value,
      color: PAYMENT_METHOD_COLORS[entry.method],
      text,
      percentage: (entry.value / total) * 100,
      method: entry.method,
      instrumentId: entry.instrumentId,
      isOther: entry.isOther,
    })
  }

  const methodOrder = new Map<PaymentInstrumentMethod, number>(
    PAYMENT_INSTRUMENT_METHODS.map((m, idx) => [m, idx])
  )

  return items.sort((a, b) => {
    const aOrder = methodOrder.get(a.method) ?? 999
    const bOrder = methodOrder.get(b.method) ?? 999
    if (aOrder !== bOrder) return aOrder - bOrder
    return b.value - a.value
  })
}

// Line chart data item
export interface LineChartDataItem {
  value: number
  date: string
  label: string
  dataPointText?: string
}

// Analytics statistics
export interface AnalyticsStatistics {
  totalSpending: number
  averageDaily: number
  highestCategory: {
    category: string
    amount: number
  } | null
  highestDay: {
    date: string
    amount: number
  } | null
  daysInPeriod: number
}

// Date range interface
export interface DateRange {
  start: Date
  end: Date
}

/**
 * Get the number of days for a time window
 * Returns -1 for "all" to indicate no limit
 */
export function getTimeWindowDays(timeWindow: TimeWindow): number {
  switch (timeWindow) {
    case "7d":
      return 7
    case "15d":
      return 15
    case "1m":
      return 30
    case "3m":
      return 90
    case "6m":
      return 180
    case "1y":
      return 365
    case "all":
      return -1 // No limit
    default:
      return 7
  }
}

/**
 * Calculate date range for a time window
 * For "all", returns range from earliest expense date to today
 */
export function getDateRangeForTimeWindow(
  timeWindow: TimeWindow,
  expenses?: Expense[]
): DateRange {
  const end = endOfDay(new Date())

  if (timeWindow === "all" && expenses && expenses.length > 0) {
    // Find the earliest expense date
    let earliestDate = new Date()
    for (const expense of expenses) {
      try {
        const expenseDate = parseISO(expense.date)
        if (expenseDate < earliestDate) {
          earliestDate = expenseDate
        }
      } catch {
        // Skip invalid dates
      }
    }
    return { start: startOfDay(earliestDate), end }
  }

  const days = getTimeWindowDays(timeWindow)
  const start = startOfDay(subDays(end, days - 1))
  return { start, end }
}

/**
 * Filter expenses by time window
 * Returns only expenses whose date falls within the specified time window
 * For "all", returns all expenses without filtering
 */
export function filterExpensesByTimeWindow(
  expenses: Expense[],
  timeWindow: TimeWindow
): Expense[] {
  // For "all", return all expenses without filtering
  if (timeWindow === "all") {
    return expenses
  }

  const { start, end } = getDateRangeForTimeWindow(timeWindow)

  return expenses.filter((expense) => {
    try {
      const expenseDate = parseISO(expense.date)
      return isWithinInterval(expenseDate, { start, end })
    } catch {
      return false
    }
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
  return expenses.filter((expense) => selectedCategories.includes(expense.category))
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

/**
 * Get category color from a color map with fallback
 * Uses the provided color map (from dynamic categories) or falls back to static CATEGORY_COLORS
 * @param category - The category label
 * @param categoryColors - Optional color map from dynamic categories
 * @returns The hex color for the category
 */
export function getCategoryColor(
  category: string,
  categoryColors?: CategoryColorMap
): string {
  // First try the provided color map (dynamic categories)
  if (categoryColors && categoryColors[category]) {
    return categoryColors[category]
  }
  // Fall back to static CATEGORY_COLORS for backward compatibility
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.Other
}

/**
 * Aggregate expenses by category for pie chart
 * Returns pie chart data with category totals, colors, and percentages
 * Excludes categories with zero expenses
 * @param expenses - Array of expenses to aggregate
 * @param categoryColors - Optional color map from dynamic categories
 */
export function aggregateByCategory(
  expenses: Expense[],
  categoryColors?: CategoryColorMap
): PieChartDataItem[] {
  // Group and sum by category
  const categoryTotals = new Map<string, number>()

  for (const expense of expenses) {
    const current = categoryTotals.get(expense.category) ?? 0
    categoryTotals.set(expense.category, current + Math.abs(expense.amount))
  }

  // Calculate total for percentages
  const total = Array.from(categoryTotals.values()).reduce((sum, val) => sum + val, 0)

  if (total === 0) {
    return []
  }

  // Convert to pie chart data, excluding zero categories
  const pieData: PieChartDataItem[] = []

  for (const [category, amount] of categoryTotals) {
    if (amount > 0) {
      pieData.push({
        value: amount,
        color: getCategoryColor(category, categoryColors),
        text: category,
        percentage: (amount / total) * 100,
        category,
      })
    }
  }

  // Sort by value descending
  return pieData.sort((a, b) => b.value - a.value)
}

/**
 * Aggregate expenses by payment method for pie chart
 * Returns pie chart data with payment method totals, colors, and percentages
 * Expenses without paymentMethod are grouped under "Other"
 * Excludes payment method types with zero total amount
 */
export function aggregateByPaymentMethod(
  expenses: Expense[]
): PaymentMethodChartDataItem[] {
  // Group and sum by payment method type
  // Expenses without paymentMethod are grouped under "Other"
  const paymentMethodTotals = new Map<PaymentMethodType | "Other", number>()

  for (const expense of expenses) {
    const paymentMethodType: PaymentMethodType | "Other" =
      expense.paymentMethod?.type ?? "Other"
    const current = paymentMethodTotals.get(paymentMethodType) ?? 0
    paymentMethodTotals.set(paymentMethodType, current + Math.abs(expense.amount))
  }

  // Calculate total for percentages
  const total = Array.from(paymentMethodTotals.values()).reduce(
    (sum, val) => sum + val,
    0
  )

  if (total === 0) {
    return []
  }

  // Convert to pie chart data, excluding zero-amount types
  const pieData: PaymentMethodChartDataItem[] = []

  for (const [paymentMethodType, amount] of paymentMethodTotals) {
    if (amount > 0) {
      pieData.push({
        value: amount,
        color: PAYMENT_METHOD_COLORS[paymentMethodType],
        text: paymentMethodType,
        percentage: (amount / total) * 100,
        paymentMethodType,
      })
    }
  }

  // Sort by value descending
  return pieData.sort((a, b) => b.value - a.value)
}

/**
 * Aggregate expenses by day for line chart
 * Returns one data point per day in the date range, with zero-fill for days without expenses
 */
export function aggregateByDay(
  expenses: Expense[],
  dateRange: DateRange
): LineChartDataItem[] {
  // Get all days in the range
  const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end })

  // Group expenses by day
  const dailyTotals = new Map<string, number>()

  for (const expense of expenses) {
    try {
      const expenseDate = parseISO(expense.date)
      const dayKey = format(expenseDate, "yyyy-MM-dd")
      const current = dailyTotals.get(dayKey) ?? 0
      dailyTotals.set(dayKey, current + Math.abs(expense.amount))
    } catch {
      // Skip invalid dates
    }
  }

  // Create line chart data with zero-fill
  return days.map((day) => {
    const dayKey = format(day, "yyyy-MM-dd")
    const value = dailyTotals.get(dayKey) ?? 0

    return {
      value,
      date: dayKey,
      label: format(day, "MMM d"),
      dataPointText: value > 0 ? `₹${value.toFixed(0)}` : undefined,
    }
  })
}

/**
 * Calculate summary statistics for expenses
 */
export function calculateStatistics(
  expenses: Expense[],
  daysInPeriod: number
): AnalyticsStatistics {
  // Calculate total spending
  const totalSpending = expenses.reduce(
    (sum, expense) => sum + Math.abs(expense.amount),
    0
  )

  // Calculate average daily spending
  const averageDaily = daysInPeriod > 0 ? totalSpending / daysInPeriod : 0

  // Find highest spending category
  const categoryTotals = new Map<string, number>()
  for (const expense of expenses) {
    const current = categoryTotals.get(expense.category) ?? 0
    categoryTotals.set(expense.category, current + Math.abs(expense.amount))
  }

  let highestCategory: { category: string; amount: number } | null = null
  for (const [category, amount] of categoryTotals) {
    if (!highestCategory || amount > highestCategory.amount) {
      highestCategory = { category, amount }
    }
  }

  // Find highest spending day
  const dailyTotals = new Map<string, number>()
  for (const expense of expenses) {
    try {
      const dayKey = format(parseISO(expense.date), "yyyy-MM-dd")
      const current = dailyTotals.get(dayKey) ?? 0
      dailyTotals.set(dayKey, current + Math.abs(expense.amount))
    } catch {
      // Skip invalid dates
    }
  }

  let highestDay: { date: string; amount: number } | null = null
  for (const [date, amount] of dailyTotals) {
    if (!highestDay || amount > highestDay.amount) {
      highestDay = { date, amount }
    }
  }

  return {
    totalSpending,
    averageDaily,
    highestCategory,
    highestDay,
    daysInPeriod,
  }
}
