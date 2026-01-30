import { format, eachDayOfInterval } from "date-fns"
import { Expense, PaymentMethodType } from "../../types/expense"
import type { DateRange } from "../../types/analytics"
import type {
  PaymentInstrument,
  PaymentInstrumentMethod,
} from "../../types/payment-instrument"
import { getLocalDayKey } from "../date"
import { CATEGORY_COLORS } from "../../constants/category-colors"
import { PAYMENT_METHOD_COLORS } from "../../constants/payment-method-colors"
import {
  PAYMENT_INSTRUMENT_METHODS,
  findInstrumentById,
  formatPaymentInstrumentLabel,
  isPaymentInstrumentMethod,
} from "../../services/payment-instruments"
import { getPaymentMethodI18nKey } from "../../constants/payment-methods"
import { getCurrencySymbol } from "../currency"
import {
  PaymentInstrumentSelectionKey,
  makePaymentInstrumentSelectionKey,
} from "./filters"

// Category color map type for dynamic categories
export type CategoryColorMap = Record<string, string>

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

// Line chart data item
export interface LineChartDataItem {
  value: number
  date: string
  label: string
  dataPointText?: string
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
  categoryColors: CategoryColorMap | undefined,
  t: (key: string) => string
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
        text: category === "Other" ? t("categories.other") : category,
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
  expenses: Expense[],
  t: (key: string) => string
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
        text: t(`paymentMethods.${getPaymentMethodI18nKey(paymentMethodType)}`),
        percentage: (amount / total) * 100,
        paymentMethodType,
      })
    }
  }

  // Sort by value descending
  return pieData.sort((a, b) => b.value - a.value)
}

/**
 * Aggregate expenses by payment instrument (Credit/Debit/UPI).
 * - If the instrumentId is missing, unknown, or deleted, the expense is grouped under "{method} • Others".
 * - Only instrument methods are included (Credit Card, Debit Card, UPI).
 */
export function aggregateByPaymentInstrument(
  expenses: Expense[],
  instruments: PaymentInstrument[],
  t: (key: string) => string
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

    let text = `${t(`paymentMethods.${getPaymentMethodI18nKey(entry.method)}`)} • ${t("instruments.dropdown.others").split(" / ")[0]}`
    if (!entry.isOther && entry.instrumentId) {
      const inst = findInstrumentById(instruments, entry.instrumentId)
      if (inst && !inst.deletedAt) {
        text = `${t(`paymentMethods.${getPaymentMethodI18nKey(entry.method)}`)} • ${formatPaymentInstrumentLabel(inst)}`
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

/**
 * Aggregate expenses by day for line chart
 * Returns one data point per day in the date range, with zero-fill for days without expenses
 */
export function aggregateByDay(
  expenses: Expense[],
  dateRange: DateRange,
  locale?: any,
  currencyCode: string = "INR"
): LineChartDataItem[] {
  // Get all days in the range
  const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end })
  const symbol = getCurrencySymbol(currencyCode)

  // Group expenses by day
  const dailyTotals = new Map<string, number>()

  for (const expense of expenses) {
    try {
      const dayKey = getLocalDayKey(expense.date)
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
      label: format(day, "MMM d", { locale }),
      dataPointText: value > 0 ? `${symbol}${value.toFixed(0)}` : undefined,
    }
  })
}
