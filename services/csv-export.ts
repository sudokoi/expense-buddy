import { Directory, File, Paths } from "expo-file-system"
import * as Sharing from "expo-sharing"
import { Platform } from "react-native"

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

export interface SaveExportResult {
  uri: string | null
  success: boolean
  cancelled?: boolean
  error?: string
}

/**
 * Direct download to device storage (ADR-011 updated).
 *
 * Uses the modern `expo-file-system` File/Directory API where available
 * (scoped SAF grant via system folder picker, no WRITE_EXTERNAL_STORAGE).
 * Falls back to app-private file when picker is unavailable (tests, etc.).
 */
export async function saveExpenseExportToFile(
  expenses: Expense[],
  filename: string = buildExpenseExportFilename()
): Promise<SaveExportResult> {
  const csv = exportToCSV(expenses)

  try {
    if (Platform.OS === "android") {
      try {
        const dir = await Directory.pickDirectoryAsync()
        if (!dir) {
          return { uri: null, success: false, cancelled: true }
        }
        const file = dir.createFile(filename, EXPORT_MIME_TYPE)
        await file.write(csv)
        return { uri: file.uri, success: true }
      } catch (error) {
        // Only fall through for picker unavailable; surface write errors
        const message = String(error)
        if (message.includes("pickDirectory") || message.includes("SAF")) {
          // fall through to File fallback
        } else {
          throw error
        }
      }
    }

    // Fallback: save to app-private storage
    const baseDir = Paths.document ?? Paths.cache
    const file = new File(baseDir, filename)
    if (file.exists) {
      try {
        file.delete()
      } catch {
        // ignore
      }
    }
    await file.write(csv)
    return { uri: file.uri, success: true }
  } catch (error) {
    console.warn("Save export failed:", error)
    return { uri: null, success: false, error: String(error) }
  }
}

/**
 * Full local export flow: serialize the ledger, write to cache,
 * hand off to the share sheet (ADR-011).
 * Kept for share-specific call sites; prefer saveExpenseExportToFile for direct download.
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

/**
 * Preferred export entry: direct save to Downloads/Documents.
 * Falls back to share sheet if SAF is unavailable or user cancels.
 */
export async function downloadExpensesToCsv(
  expenses: Expense[],
  filename?: string
): Promise<SaveExportResult & { fallbackShared?: boolean }> {
  const result = await saveExpenseExportToFile(expenses, filename)
  if (result.success) return result
  // If user cancelled picker, don't fallback — surface cancellation
  if (result.cancelled) return result
  // Fallback: try share flow for environments where SAF fails
  try {
    const file = await writeExpenseExportFile(expenses, filename)
    const shared = await shareExpenseExport(file)
    if (shared) return { uri: file.uri, success: true, fallbackShared: true }
  } catch {
    // ignore fallback error
  }
  return result
}
