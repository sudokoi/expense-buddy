import { Expense } from "../../types/expense"
import { getLocalDayKey } from "../date"

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
      const dayKey = getLocalDayKey(expense.date)
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
