import {
  parseISO,
  subDays,
  startOfDay,
  endOfDay,
  isWithinInterval,
  isValid,
  startOfMonth,
  endOfMonth,
  parse,
} from "date-fns"
import { Expense } from "../../types/expense"
import type { DateRange } from "../../types/analytics"
import { formatDate } from "../date"

// Time window type
export type TimeWindow = "7d" | "15d" | "1m" | "3m" | "6m" | "1y" | "all"

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

export function getMonthStartDate(monthKey: string): Date {
  const parsed = parse(monthKey, "yyyy-MM", new Date())
  if (!isValid(parsed)) {
    return startOfMonth(new Date())
  }
  return startOfMonth(parsed)
}

export function getDateRangeForMonth(monthKey: string): DateRange {
  const start = getMonthStartDate(monthKey)
  return { start, end: endOfMonth(start) }
}

export function formatMonthLabel(monthKey: string): string {
  return formatDate(getMonthStartDate(monthKey), "MMM yyyy")
}

export function getDateRangeForFilters(
  timeWindow: TimeWindow,
  selectedMonth: string | null,
  expenses?: Expense[]
): DateRange {
  if (selectedMonth) {
    return getDateRangeForMonth(selectedMonth)
  }

  return getDateRangeForTimeWindow(timeWindow, expenses)
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
 * Determines whether the current expenses fully cover the selected time window.
 */
export function isTimeWindowCovered(
  expenses: Expense[],
  timeWindow: TimeWindow
): boolean {
  if (timeWindow === "all") {
    return false
  }

  if (expenses.length === 0) {
    return false
  }

  let oldestDate: Date | null = null

  for (const expense of expenses) {
    const expenseDate = parseISO(expense.date)
    if (!isValid(expenseDate)) continue

    if (!oldestDate || expenseDate < oldestDate) {
      oldestDate = expenseDate
    }
  }

  if (!oldestDate) {
    return false
  }

  const { start } = getDateRangeForTimeWindow(timeWindow)
  return startOfDay(oldestDate) <= start
}
