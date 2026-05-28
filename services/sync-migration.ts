import { loadSyncConfig } from "./sync-config"
import { downloadCSV } from "./github-sync"
import { importFromCSV } from "./csv-handler"
import { syncUp } from "./sync-upload"

export async function migrateToDailyFiles(): Promise<{
  migrated: boolean
  message: string
}> {
  try {
    const config = await loadSyncConfig()
    if (!config) {
      return { migrated: false, message: "No sync configuration" }
    }

    const oldFile = await downloadCSV(
      config.token,
      config.repo,
      config.branch,
      "expenses.csv"
    )

    if (!oldFile) {
      return { migrated: false, message: "No old file to migrate" }
    }

    const expenses = importFromCSV(oldFile.content)

    if (expenses.length === 0) {
      return { migrated: false, message: "Old file is empty" }
    }

    const result = await syncUp(expenses)

    if (result.success) {
      return {
        migrated: true,
        message: `Migrated ${expenses.length} expenses to daily files`,
      }
    } else {
      return {
        migrated: false,
        message: `Migration failed: ${result.error}`,
      }
    }
  } catch (error) {
    return {
      migrated: false,
      message: `Migration error: ${String(error)}`,
    }
  }
}
