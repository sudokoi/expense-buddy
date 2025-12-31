import { Expense, ExpenseCategory, PaymentMethodType } from "../types/expense"
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

// Time window type
export type TimeWindow = "7d" | "15d" | "1m"

// Pie chart data item
export interface PieChartDataItem {
  value: number
  color: string
  text: string
  percentage: number
  category: ExpenseCategory
}

// Payment method chart data item
export interface PaymentMethodChartDataItem {
  value: number
  color: string
  text: string
  percentage: number
  paymentMethodType: PaymentMethodType | "Other"
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
    category: ExpenseCategory
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
 */
export function getTimeWindowDays(timeWindow: TimeWindow): number {
  switch (timeWindow) {
    case "7d":
      return 7
    case "15d":
      return 15
    case "1m":
      return 30
    default:
      return 7
  }
}

/**
 * Calculate date range for a time window
 */
export function getDateRangeForTimeWindow(timeWindow: TimeWindow): DateRange {
  const end = endOfDay(new Date())
  const days = getTimeWindowDays(timeWindow)
  const start = startOfDay(subDays(end, days - 1))
  return { start, end }
}

/**
 * Filter expenses by time window
 * Returns only expenses whose date falls within the specified time window
 */
export function filterExpensesByTimeWindow(
  expenses: Expense[],
  timeWindow: TimeWindow
): Expense[] {
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
  selectedCategories: ExpenseCategory[]
): Expense[] {
  if (selectedCategories.length === 0) {
    return expenses
  }
  return expenses.filter((expense) => selectedCategories.includes(expense.category))
}

/**
 * Get category color
 */
function getCategoryColor(category: ExpenseCategory): string {
  return CATEGORY_COLORS[category] ?? "#6b7280"
}

/**
 * Aggregate expenses by category for pie chart
 * Returns pie chart data with category totals, colors, and percentages
 * Excludes categories with zero expenses
 */
export function aggregateByCategory(expenses: Expense[]): PieChartDataItem[] {
  // Group and sum by category
  const categoryTotals = new Map<ExpenseCategory, number>()

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
        color: getCategoryColor(category),
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
  const categoryTotals = new Map<ExpenseCategory, number>()
  for (const expense of expenses) {
    const current = categoryTotals.get(expense.category) ?? 0
    categoryTotals.set(expense.category, current + Math.abs(expense.amount))
  }

  let highestCategory: { category: ExpenseCategory; amount: number } | null = null
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
