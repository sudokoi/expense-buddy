import { Expense } from "../types/expense"
import { format, parseISO } from "date-fns"

/**
 * Group expenses by day based on their date field
 */
export function groupExpensesByDay(expenses: Expense[]): Map<string, Expense[]> {
  const grouped = new Map<string, Expense[]>()

  for (const expense of expenses) {
    const dayKey = format(parseISO(expense.date), "yyyy-MM-dd")
    const existing = grouped.get(dayKey)
    if (existing) {
      existing.push(expense)
    } else {
      grouped.set(dayKey, [expense])
    }
  }

  return grouped
}

/**
 * Generate filename for a given day
 */
export function getFilenameForDay(dayKey: string): string {
  return `expenses-${dayKey}.csv`
}

/**
 * Extract day key from filename
 * Returns null if filename doesn't match pattern
 */
export function getDayKeyFromFilename(filename: string): string | null {
  const match = filename.match(/^expenses-(\d{4}-\d{2}-\d{2})\.csv$/)
  return match ? match[1] : null
}

/**
 * Get all unique days from a list of expenses
 */
export function getUniqueDays(expenses: Expense[]): string[] {
  const days = new Set<string>()
  for (const expense of expenses) {
    days.add(format(parseISO(expense.date), "yyyy-MM-dd"))
  }
  return Array.from(days).sort()
}

/**
 * Determine which day files need to be synced based on changed expenses
 */
export function getAffectedDays(expenses: Expense[]): string[] {
  return getUniqueDays(expenses)
}
