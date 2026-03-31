/**
 * Pure utility functions for ImportHistoryView filtering and display logic.
 * Extracted for testability without React Native dependencies.
 */

import { Expense } from "../../../types/expense"

export type ImportFilter = "all" | "confirmed" | "edited"

export const IMPORT_FILTERS: ImportFilter[] = ["all", "confirmed", "edited"]

export function formatImportDate(expense: Expense): string {
  const dateStr = expense.importMetadata?.parsedAt ?? expense.createdAt
  try {
    return new Date(dateStr).toLocaleDateString()
  } catch {
    return dateStr
  }
}

export function getImportStatus(expense: Expense): "confirmed" | "edited" {
  if (expense.importMetadata?.userCorrected) return "edited"
  return "confirmed"
}

export function matchesFilter(expense: Expense, filter: ImportFilter): boolean {
  if (filter === "all") return true
  return getImportStatus(expense) === filter
}
