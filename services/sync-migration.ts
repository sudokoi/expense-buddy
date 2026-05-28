import { loadSyncConfig } from "./sync-config"
import { downloadCSV } from "./github-sync"
import { importFromCSV } from "./csv-handler"
import { syncUp } from "./sync-upload"
import i18next from "i18next"

export async function migrateToDailyFiles(): Promise<{
  migrated: boolean
  message: string
}> {
  try {
    const config = await loadSyncConfig()
    if (!config) {
      return { migrated: false, message: i18next.t("githubSync.manager.noConfigFound") }
    }

    const oldFile = await downloadCSV(
      config.token,
      config.repo,
      config.branch,
      "expenses.csv"
    )

    if (!oldFile) {
      return {
        migrated: false,
        message: i18next.t("githubSync.manager.noOldFileToMigrate"),
      }
    }

    const expenses = importFromCSV(oldFile.content)

    if (expenses.length === 0) {
      return { migrated: false, message: i18next.t("githubSync.manager.oldFileEmpty") }
    }

    const result = await syncUp(expenses)

    if (result.success) {
      return {
        migrated: true,
        message: i18next.t("githubSync.manager.migrated", { count: expenses.length }),
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
      message: i18next.t("githubSync.manager.migrationError", { error: String(error) }),
    }
  }
}
