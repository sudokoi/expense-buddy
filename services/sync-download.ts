import { loadSyncConfig } from "./sync-config"
import { saveLastSyncTime } from "./sync-direction"
import {
  listFiles,
  downloadCSV,
  downloadSettingsFile,
  getLatestCommitTimestamp,
  GitHubApiError,
} from "./github-sync"
import { AppSettings, hydrateSettingsFromJson } from "./settings-manager"
import { getDayKeyFromFilename } from "./daily-file-manager"
import { importFromCSV } from "./csv-handler"
import { getUserFriendlyMessage } from "./error-utils"
import { format } from "date-fns"
import { pMap } from "./retry"
import i18next from "i18next"
import type { Expense } from "../types/expense"

export async function syncDown(
  daysToDownload: number = 7,
  syncSettingsEnabled?: boolean
): Promise<{
  success: boolean
  message: string
  expenses?: Expense[]
  settings?: AppSettings
  error?: string
  hasMore?: boolean
  settingsDownloaded?: boolean
  remoteFilesUpdated?: number
  authStatus?: 401 | 403
  shouldSignOut?: boolean
}> {
  try {
    const config = await loadSyncConfig()
    if (!config) {
      return {
        success: false,
        message: i18next.t("githubSync.manager.notConfigured"),
        error: i18next.t("githubSync.manager.notConfigured"),
      }
    }

    const files = await listFiles(config.token, config.repo, config.branch)

    const expenseFiles = files
      .filter((file) => getDayKeyFromFilename(file.name) !== null)
      .map((file) => ({
        ...file,
        dayKey: getDayKeyFromFilename(file.name)!,
      }))
      .sort((a, b) => b.dayKey.localeCompare(a.dayKey))

    if (expenseFiles.length === 0) {
      let downloadedSettings: AppSettings | undefined
      let settingsDownloaded = false

      if (syncSettingsEnabled) {
        try {
          const settingsResult = await downloadSettingsFile(
            config.token,
            config.repo,
            config.branch
          )
          if (settingsResult) {
            downloadedSettings = hydrateSettingsFromJson(
              JSON.parse(settingsResult.content)
            )
            settingsDownloaded = true
          }
        } catch (settingsError) {
          if (
            settingsError instanceof GitHubApiError &&
            (settingsError.status === 401 || settingsError.status === 403)
          ) {
            throw settingsError
          }
          console.warn("Failed to download settings:", settingsError)
        }
      }

      return {
        success: false,
        message: i18next.t("githubSync.manager.noExpenseFiles"),
        error: i18next.t("githubSync.manager.noFilesFound"),
        settings: downloadedSettings,
        settingsDownloaded,
        remoteFilesUpdated: 0,
      }
    }

    const filesToDownload = expenseFiles.slice(0, daysToDownload)
    const hasMore = expenseFiles.length > daysToDownload

    const downloadResults = await pMap(
      filesToDownload,
      async (file) => {
        const fileData = await downloadCSV(
          config.token,
          config.repo,
          config.branch,
          file.path
        )

        if (fileData) {
          const expenses = importFromCSV(fileData.content)
          return { expenses, downloaded: true as const }
        }
        return { expenses: [] as Expense[], downloaded: false as const }
      },
      5
    )

    const allExpenses = downloadResults.flatMap((r) => r.expenses)
    const downloadedFiles = downloadResults.filter((r) => r.downloaded).length

    let downloadedSettings: AppSettings | undefined
    let settingsDownloaded = false

    if (syncSettingsEnabled) {
      try {
        const settingsResult = await downloadSettingsFile(
          config.token,
          config.repo,
          config.branch
        )
        if (settingsResult) {
          downloadedSettings = hydrateSettingsFromJson(JSON.parse(settingsResult.content))
          settingsDownloaded = true
        }
      } catch (settingsError) {
        if (
          settingsError instanceof GitHubApiError &&
          (settingsError.status === 401 || settingsError.status === 403)
        ) {
          throw settingsError
        }
        console.warn("Failed to download settings:", settingsError)
      }
    }

    const messageParts = [
      i18next.t("githubSync.manager.downloadedExpenses", {
        count: allExpenses.length,
        files: downloadedFiles,
      }),
    ]
    if (settingsDownloaded) {
      messageParts.push("settings downloaded")
    }

    try {
      const timestampResult = await getLatestCommitTimestamp(
        config.token,
        config.repo,
        config.branch
      )
      if ("timestamp" in timestampResult) {
        await saveLastSyncTime(timestampResult.timestamp)
      }
    } catch (e) {
      console.warn("Failed to save last sync time after pull:", e)
    }

    return {
      success: true,
      message: messageParts.join(", "),
      expenses: allExpenses,
      settings: downloadedSettings,
      hasMore,
      settingsDownloaded,
      remoteFilesUpdated: downloadedFiles,
    }
  } catch (error) {
    console.warn("[SyncManager] syncDown failed:", error)

    if (
      error instanceof GitHubApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      return {
        success: false,
        message: "Download failed",
        error: error.message,
        authStatus: error.status,
        shouldSignOut: error.shouldSignOut,
      }
    }

    return {
      success: false,
      message: i18next.t("githubSync.manager.downloadFailed"),
      error: getUserFriendlyMessage(error),
    }
  }
}

export async function syncDownMore(
  currentExpenses: Expense[],
  additionalDays: number = 7
): Promise<{
  success: boolean
  message: string
  expenses?: Expense[]
  error?: string
  hasMore?: boolean
  remoteFilesUpdated?: number
  authStatus?: 401 | 403
  shouldSignOut?: boolean
}> {
  try {
    const config = await loadSyncConfig()
    if (!config) {
      return {
        success: false,
        message: i18next.t("githubSync.manager.notConfigured"),
        error: i18next.t("githubSync.manager.notConfigured"),
      }
    }

    const oldestDate = currentExpenses.reduce((oldest, expense) => {
      const expenseDate = new Date(expense.date)
      return expenseDate < oldest ? expenseDate : oldest
    }, new Date())

    const files = await listFiles(config.token, config.repo, config.branch)

    const expenseFiles = files
      .filter((file) => getDayKeyFromFilename(file.name) !== null)
      .map((file) => ({
        ...file,
        dayKey: getDayKeyFromFilename(file.name)!,
      }))
      .filter((file) => file.dayKey < format(oldestDate, "yyyy-MM-dd"))
      .sort((a, b) => b.dayKey.localeCompare(a.dayKey))

    if (expenseFiles.length === 0) {
      return {
        success: true,
        message: "No more expenses to load",
        expenses: currentExpenses,
        hasMore: false,
        remoteFilesUpdated: 0,
      }
    }

    const filesToDownload = expenseFiles.slice(0, additionalDays)
    const hasMore = expenseFiles.length > additionalDays

    const downloadResults = await pMap(
      filesToDownload,
      async (file) => {
        const fileData = await downloadCSV(
          config.token,
          config.repo,
          config.branch,
          file.path
        )

        if (fileData) {
          const expenses = importFromCSV(fileData.content)
          return { expenses, downloaded: true as const }
        }
        return { expenses: [] as Expense[], downloaded: false as const }
      },
      5
    )

    const newExpenses = downloadResults.flatMap((r) => r.expenses)
    const downloadedFiles = downloadResults.filter((r) => r.downloaded).length
    const allExpenses = [...currentExpenses, ...newExpenses]

    return {
      success: true,
      message: `Loaded ${newExpenses.length} more expenses from ${downloadedFiles} file(s)`,
      expenses: allExpenses,
      hasMore,
      remoteFilesUpdated: downloadedFiles,
    }
  } catch (error) {
    console.warn("[SyncManager] syncDownMore failed:", error)

    if (
      error instanceof GitHubApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      return {
        success: false,
        message: "Load more failed",
        error: error.message,
        authStatus: error.status,
        shouldSignOut: error.shouldSignOut,
      }
    }

    return {
      success: false,
      message: "Load more failed",
      error: getUserFriendlyMessage(error),
    }
  }
}
