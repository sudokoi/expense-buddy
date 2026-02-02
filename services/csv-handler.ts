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
  createdAt: string
  updatedAt: string
  deletedAt: string
}

/**
 * Export expenses to CSV format
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
    createdAt: expense.createdAt,
    updatedAt: expense.updatedAt,
    deletedAt: expense.deletedAt || "",
  }))

  return Papa.unparse(rows, {
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
      "createdAt",
      "updatedAt",
      "deletedAt",
    ],
  })
}

/**
 * Import expenses from CSV format
 * Handles backward compatibility for CSVs without payment method columns or deletedAt column
 */
export function importFromCSV(csvString: string): Expense[] {
  const result = Papa.parse<CSVRow>(csvString, {
    header: true,
    skipEmptyLines: true,
  })

  if (result.errors.length > 0) {
    throw new Error(`CSV parsing failed: ${result.errors[0].message}`)
  }

  const now = new Date().toISOString()

  return result.data.map((row) => {
    // Build payment method only if type is present
    const paymentMethod =
      row.paymentMethodType && row.paymentMethodType.trim()
        ? {
            type: row.paymentMethodType as PaymentMethodType,
            identifier: row.paymentMethodId?.trim() || undefined,
            instrumentId: row.paymentInstrumentId?.trim() || undefined,
          }
        : undefined

    return {
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
  })
}
