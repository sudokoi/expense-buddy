/**
 * Pure utility functions for ImportHistoryView filtering and display logic.
 * Extracted for testability without React Native dependencies.
 */

import { Expense } from "../../../types/expense"

export type ImportFilter = "all" | "confirmed" | "edited" | "rejected"

export const IMPORT_FILTERS: ImportFilter[] = ["all", "confirmed", "edited", "rejected"]

export function formatImportDate(expense: Expense): string {
  const dateStr = expense.importMetadata?.parsedAt ?? expense.createdAt
  try {
    return new Date(dateStr).toLocaleDateString()
  } catch {
    return dateStr
  }
}

export function getImportStatus(expense: Expense): "confirmed" | "edited" | "rejected" {
  if (expense.importMetadata?.userCorrected) return "edited"
  return "confirmed"
}

export function matchesFilter(expense: Expense, filter: ImportFilter): boolean {
  if (filter === "all") return true
  // Rejected items are not in the expense store (they were never created),
  // so we only filter confirmed vs edited from persisted expenses
  if (filter === "rejected") return false
  return getImportStatus(expense) === filter
}
