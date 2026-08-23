import { File, Paths } from "expo-file-system"
import * as Sharing from "expo-sharing"

import { exportToCSV } from "./csv-handler"
import { Expense } from "../types/expense"

const EXPORT_MIME_TYPE = "text/csv"

/**
 * Builds the export filename for a given day (ADR-011).
 * `todayIso` is an ISO timestamp; injectable for deterministic tests.
 */
export function buildExpenseExportFilename(
  todayIso: string = new Date().toISOString()
): string {
  const dayKey = todayIso.slice(0, 10)
  return `expense-buddy-export-${dayKey}.csv`
}

/**
 * Writes the whole-ledger CSV snapshot (including soft-deleted tombstones)
 * to the app cache directory and returns the file handle.
 *
 * Reuses the sync CSV codec verbatim so a future import can round-trip
 * losslessly through `importFromCSV` (see ADR-011).
 */
export async function writeExpenseExportFile(
  expenses: Expense[],
  filename: string = buildExpenseExportFilename()
): Promise<File> {
  const csv = exportToCSV(expenses)
  const file = new File(Paths.cache, filename)
  await file.write(csv)
  return file
}

/**
 * Shares an exported file via the OS share sheet.
 * Returns false when no share target is available on the platform.
 */
export async function shareExpenseExport(file: File): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) {
    return false
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: EXPORT_MIME_TYPE,
    dialogTitle: file.name,
  })
  return true
}

export interface ExpenseExportResult {
  shared: boolean
  file: File | null
}

/**
 * Full local export flow: serialize the ledger, write to cache,
 * hand off to the share sheet (ADR-011).
 */
export async function exportExpensesToCsv(
  expenses: Expense[],
  filename?: string
): Promise<ExpenseExportResult> {
  try {
    const file = await writeExpenseExportFile(expenses, filename)
    const shared = await shareExpenseExport(file)
    return { shared, file }
  } catch (error) {
    console.warn("CSV export failed:", error)
    return { shared: false, file: null }
  }
}
