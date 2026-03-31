import Papa from "papaparse"
import { Expense, ExpenseCategory, PaymentMethodType } from "../types/expense"
import { getFallbackCurrency } from "../utils/currency"

export interface CSVRow {
  id: string
  amount: string
  currency?: string
  category: string
  date: string
  note: string
  paymentMethodType: string
  paymentMethodId: string
  paymentInstrumentId: string
  source: string
  importMetadata: string
  createdAt: string
  updatedAt: string
  deletedAt: string
}

/**
 * Export expenses to CSV format (v2.0)
 * Includes source and importMetadata fields for SMS import support
 */
export function exportToCSV(expenses: Expense[]): string {
  const rows: CSVRow[] = expenses.map((expense) => ({
    id: expense.id,
    amount: expense.amount.toString(),
    currency: expense.currency || getFallbackCurrency(),
    category: expense.category,
    date: expense.date,
    note: expense.note || "",
    paymentMethodType: expense.paymentMethod?.type || "",
    paymentMethodId: expense.paymentMethod?.identifier || "",
    paymentInstrumentId: expense.paymentMethod?.instrumentId || "",
    source: expense.source || "",
    importMetadata: expense.importMetadata ? JSON.stringify(expense.importMetadata) : "",
    createdAt: expense.createdAt,
    updatedAt: expense.updatedAt,
    deletedAt: expense.deletedAt || "",
  }))

  const csv = Papa.unparse(rows, {
    header: true,
    columns: [
      "id",
      "amount",
      "currency",
      "category",
      "date",
      "note",
      "paymentMethodType",
      "paymentMethodId",
      "paymentInstrumentId",
      "source",
      "importMetadata",
      "createdAt",
      "updatedAt",
      "deletedAt",
    ],
  })

  // Add version header comment
  return `#version: 2.0\n${csv}`
}

/**
 * Import expenses from CSV format (v2.0)
 * Handles backward compatibility for CSVs without payment method columns, deletedAt, or SMS import fields
 */
export function importFromCSV(csvString: string): {
  expenses: Expense[]
  version: number
} {
  // Parse version from header comment
  const versionMatch = csvString.match(/^#version:\s*(\d+\.?\d*)/m)
  const csvVersion = versionMatch ? parseFloat(versionMatch[1]) : 1.0

  // Remove comment lines before parsing
  const cleanCsv = csvString.replace(/^#.*$/gm, "").trim()

  const result = Papa.parse<CSVRow>(cleanCsv, {
    header: true,
    skipEmptyLines: true,
  })

  if (result.errors.length > 0) {
    throw new Error(`CSV parsing failed: ${result.errors[0].message}`)
  }

  const now = new Date().toISOString()

  const expenses = result.data.map((row) => {
    // Build payment method only if type is present
    const paymentMethod =
      row.paymentMethodType && row.paymentMethodType.trim()
        ? {
            type: row.paymentMethodType as PaymentMethodType,
            identifier: row.paymentMethodId?.trim() || undefined,
            instrumentId: row.paymentInstrumentId?.trim() || undefined,
          }
        : undefined

    const expense: Expense = {
      id: row.id,
      amount: parseFloat(row.amount),
      currency: row.currency?.trim() || getFallbackCurrency(),
      category: row.category as ExpenseCategory,
      date: row.date,
      note: row.note || "",
      paymentMethod,
      // Use timestamps from CSV if available, otherwise default to now
      createdAt: row.createdAt || now,
      updatedAt: row.updatedAt || now,
      // Handle deletedAt - empty string or missing means not deleted (undefined)
      deletedAt: row.deletedAt?.trim() || undefined,
    }

    // Handle v2.0+ fields
    if (csvVersion >= 2) {
      if (row.source?.trim()) {
        expense.source = row.source as "manual" | "auto-imported"
      }
      if (row.importMetadata?.trim()) {
        try {
          const parsedMetadata = JSON.parse(
            row.importMetadata
          ) as Expense["importMetadata"] & {
            rawMessage?: string
          }
          if (parsedMetadata) {
            const { rawMessage: _rawMessage, ...safeMetadata } = parsedMetadata
            expense.importMetadata = safeMetadata
          }
        } catch {
          // Ignore malformed metadata
        }
      }
    }

    return expense
  })

  return { expenses, version: csvVersion }
}
