import { loadSyncConfig } from "./sync-config"
import { saveLastSyncTime } from "./sync-direction"
import { exportToCSV } from "./csv-handler"
import {
  listFiles,
  batchCommit,
  generateCommitMessage,
  getLatestCommitTimestamp,
  GitHubApiError,
  BatchFileUpload,
  BatchFileDelete,
} from "./github-sync"
import {
  AppSettings,
  computeSettingsHash,
  getSettingsHash,
  saveSettingsHash,
  clearSettingsChanged,
} from "./settings-manager"
import { groupExpensesByDay, getFilenameForDay, getDayKeyFromFilename } from "./daily-file-manager"
import { computeContentHash, loadFileHashes, saveFileHashes, FileHashMap } from "./hash-storage"
import { loadDirtyDays } from "./expense-dirty-days"
import { getUserFriendlyMessage } from "./error-utils"
import i18next from "i18next"
import type { Expense } from "../types/expense"
import type { SyncResult } from "../types/sync"

export async function syncUp(
  expenses: Expense[],
  settings?: AppSettings,
  syncSettingsEnabled?: boolean
): Promise<SyncResult> {
  try {
    const config = await loadSyncConfig()
    if (!config) {
      return {
        success: false,
        message: i18next.t("githubSync.manager.notConfigured"),
        error: i18next.t("githubSync.manager.notConfigured"),
      }
    }

    const storedHashes = await loadFileHashes()

    const dirtyDaysResult = await loadDirtyDays()
    const useDirtyDays = dirtyDaysResult.isTrusted
    const dirtyDaySet = new Set(dirtyDaysResult.state.dirtyDays)
    const deletedDaySet = new Set(dirtyDaysResult.state.deletedDays)

    let existingFiles: { name: string; path: string; sha: string }[]
    try {
      existingFiles = await listFiles(config.token, config.repo, config.branch)
    } catch (error) {
      if (
        error instanceof GitHubApiError &&
        (error.status === 401 || error.status === 403)
      ) {
        return {
          success: false,
          message: "Failed to list remote files",
          error: error.message,
          authStatus: error.status,
          shouldSignOut: error.shouldSignOut,
          filesUploaded: 0,
          filesSkipped: 0,
        }
      }

      return {
        success: false,
        message: i18next.t("githubSync.manager.failedToListRemote"),
        error: getUserFriendlyMessage(error),
        filesUploaded: 0,
        filesSkipped: 0,
      }
    }
    const existingExpenseFiles = existingFiles
      .filter((file) => getDayKeyFromFilename(file.name) !== null)
      .map((file) => ({
        ...file,
        dayKey: getDayKeyFromFilename(file.name)!,
      }))

    const groupedByDay = groupExpensesByDay(expenses)
    const localDayKeys = new Set(groupedByDay.keys())
    const dayKeysToProcess = useDirtyDays
      ? new Set([...dirtyDaySet].filter((dayKey) => localDayKeys.has(dayKey)))
      : localDayKeys

    let oldestLocalDate: string | null = null
    let newestLocalDate: string | null = null

    for (const dayKey of localDayKeys) {
      if (!oldestLocalDate || dayKey < oldestLocalDate) {
        oldestLocalDate = dayKey
      }
      if (!newestLocalDate || dayKey > newestLocalDate) {
        newestLocalDate = dayKey
      }
    }

    const filesToUpload: BatchFileUpload[] = []
    const uploadedFileHashes: Map<string, string> = new Map()
    let skippedFiles = 0

    for (const dayKey of dayKeysToProcess) {
      const dayExpenses = groupedByDay.get(dayKey)
      if (!dayExpenses) continue
      const filename = getFilenameForDay(dayKey)
      const csvContent = exportToCSV(dayExpenses)
      const contentHash = computeContentHash(csvContent)

      if (storedHashes[filename] === contentHash) {
        skippedFiles++
        continue
      }

      filesToUpload.push({
        path: filename,
        content: csvContent,
      })
      uploadedFileHashes.set(filename, contentHash)
    }

    const filesToDelete: BatchFileDelete[] = []
    for (const file of existingExpenseFiles) {
      if (useDirtyDays && !deletedDaySet.has(file.dayKey)) {
        continue
      }

      const isWithinLocalRange =
        oldestLocalDate &&
        newestLocalDate &&
        file.dayKey >= oldestLocalDate &&
        file.dayKey <= newestLocalDate

      if (!localDayKeys.has(file.dayKey) && isWithinLocalRange) {
        filesToDelete.push({
          path: file.path,
        })
      }
    }

    let shouldSyncSettings = false
    let settingsContent: string | undefined
    let newSettingsHash: string | undefined

    if (syncSettingsEnabled && settings) {
      newSettingsHash = computeSettingsHash(settings)
      const storedSettingsHash = await getSettingsHash()

      if (storedSettingsHash !== newSettingsHash) {
        shouldSyncSettings = true
        settingsContent = JSON.stringify(settings, null, 2)
        filesToUpload.push({
          path: "settings.json",
          content: settingsContent,
        })
      }
    }

    if (filesToUpload.length === 0 && filesToDelete.length === 0) {
      return {
        success: true,
        message: i18next.t("githubSync.manager.noChanges", { skipped: skippedFiles }),
        filesUploaded: 0,
        filesSkipped: skippedFiles,
        filesDeleted: 0,
        localFilesUpdated: 0,
        remoteFilesUpdated: 0,
        settingsSynced: false,
        settingsSkipped: syncSettingsEnabled && settings ? true : undefined,
      }
    }

    const commitMessage = generateCommitMessage(
      filesToUpload.length,
      filesToDelete.length
    )

    const batchResult = await batchCommit(config.token, config.repo, config.branch, {
      uploads: filesToUpload,
      deletions: filesToDelete,
      message: commitMessage,
    })

    if (batchResult.success) {
      const updatedHashes: FileHashMap = useDirtyDays ? { ...storedHashes } : {}

      if (useDirtyDays) {
        for (const [filename, hash] of uploadedFileHashes.entries()) {
          updatedHashes[filename] = hash
        }

        for (const file of filesToDelete) {
          delete updatedHashes[file.path]
        }
      } else {
        for (const [dayKey] of groupedByDay.entries()) {
          const filename = getFilenameForDay(dayKey)
          if (storedHashes[filename] && !uploadedFileHashes.has(filename)) {
            updatedHashes[filename] = storedHashes[filename]
          }
        }

        for (const [filename, hash] of uploadedFileHashes.entries()) {
          updatedHashes[filename] = hash
        }
      }

      await saveFileHashes(updatedHashes)

      if (shouldSyncSettings && newSettingsHash) {
        await saveSettingsHash(newSettingsHash)
        await clearSettingsChanged()
      }

      let commitTimestamp: string | undefined
      if (batchResult.commitSha) {
        try {
          const timestampResult = await getLatestCommitTimestamp(
            config.token,
            config.repo,
            config.branch
          )
          if ("timestamp" in timestampResult) {
            commitTimestamp = timestampResult.timestamp
            await saveLastSyncTime(commitTimestamp)
          }
        } catch (e) {
          console.warn("Failed to fetch commit timestamp after sync:", e)
        }
      }

      const message: string[] = []
      const expenseFilesUploaded = filesToUpload.filter(
        (f) => f.path !== "settings.json"
      ).length
      const localFilesUpdated = expenseFilesUploaded + filesToDelete.length
      if (expenseFilesUploaded > 0)
        message.push(`${expenseFilesUploaded} file(s) uploaded`)
      if (skippedFiles > 0) message.push(`${skippedFiles} file(s) unchanged`)
      if (filesToDelete.length > 0)
        message.push(`${filesToDelete.length} file(s) deleted`)
      if (shouldSyncSettings) message.push("settings synced")

      return {
        success: true,
        message: i18next.t("githubSync.manager.syncedExpenses", {
          count: expenses.length,
          details: message.join(", "),
        }),
        filesUploaded: expenseFilesUploaded,
        filesSkipped: skippedFiles,
        filesDeleted: filesToDelete.length,
        localFilesUpdated,
        remoteFilesUpdated: 0,
        settingsSynced: shouldSyncSettings,
        settingsSkipped: syncSettingsEnabled && settings && !shouldSyncSettings,
        commitTimestamp,
      }
    } else {
      return {
        success: false,
        message: i18next.t("githubSync.manager.batchCommitFailed"),
        error: batchResult.error,
        filesUploaded: 0,
        filesSkipped: skippedFiles,
        filesDeleted: 0,
        settingsSynced: false,
      }
    }
  } catch (error) {
    console.warn("[SyncManager] syncUp failed:", error)

    if (
      error instanceof GitHubApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      return {
        success: false,
        message: "Sync failed",
        error: error.message,
        authStatus: error.status,
        shouldSignOut: error.shouldSignOut,
      }
    }

    return {
      success: false,
      message: i18next.t("githubSync.manager.syncFailed"),
      error: getUserFriendlyMessage(error),
    }
  }
}
