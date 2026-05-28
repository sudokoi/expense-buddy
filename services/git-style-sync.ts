import { loadSyncConfig } from "./sync-config"
import { saveLastSyncTime } from "./sync-direction"
import { fetchAllRemoteExpenses } from "./remote-fetch"
import { exportToCSV } from "./csv-handler"
import {
  listFiles,
  batchCommit,
  generateCommitMessage,
  downloadSettingsFile,
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
  hydrateSettingsFromJson,
} from "./settings-manager"
import { groupExpensesByDay, getFilenameForDay, getDayKeyFromFilename } from "./daily-file-manager"
import { computeContentHash, loadFileHashes, saveFileHashes, FileHashMap } from "./hash-storage"
import { loadDirtyDays } from "./expense-dirty-days"
import { loadRemoteSHACache, saveRemoteSHACache } from "./remote-sha-cache"
import { mergeExpenses, applyConflictResolutions, MergeResult, TrueConflict } from "./merge-engine"
import { mergeCategories } from "./category-merger"
import { mergePaymentInstruments } from "./payment-instrument-merger"
import { getUserFriendlyMessage } from "./error-utils"
import i18next from "i18next"
import type { Expense } from "../types/expense"
import type { Category } from "../types/category"

export interface ConflictResolution {
  expenseId: string
  choice: "local" | "remote"
}

export interface GitStyleSyncResult {
  success: boolean
  message: string
  mergeResult?: MergeResult
  filesUploaded: number
  filesSkipped: number
  filesDeleted?: number
  localFilesUpdated?: number
  remoteFilesUpdated?: number
  error?: string
  authStatus?: 401 | 403
  shouldSignOut?: boolean
  commitTimestamp?: string
  settingsSynced?: boolean
  settingsSkipped?: boolean
  settingsError?: string
  mergedCategories?: Category[]
  mergedSettings?: AppSettings
}

export type OnConflictCallback = (
  conflicts: TrueConflict[]
) => Promise<ConflictResolution[] | undefined>

function buildSyncMessage(
  mergeResult: MergeResult,
  filesUploaded: number,
  filesSkipped: number,
  filesDeleted: number,
  settingsSynced?: boolean
): string {
  const parts: string[] = []

  if (mergeResult.addedFromRemote.length > 0) {
    parts.push(`${mergeResult.addedFromRemote.length} added from remote`)
  }

  if (mergeResult.updatedFromRemote.length > 0) {
    parts.push(`${mergeResult.updatedFromRemote.length} updated from remote`)
  }

  const localChangesPushed =
    mergeResult.addedFromLocal.length + mergeResult.updatedFromLocal.length
  if (localChangesPushed > 0) {
    parts.push(`${localChangesPushed} local changes pushed`)
  }

  if (mergeResult.autoResolved.length > 0) {
    parts.push(`${mergeResult.autoResolved.length} auto-resolved`)
  }

  if (filesUploaded > 0) {
    parts.push(`${filesUploaded} file(s) uploaded`)
  }
  if (filesSkipped > 0) {
    parts.push(`${filesSkipped} file(s) unchanged`)
  }
  if (filesDeleted > 0) {
    parts.push(`${filesDeleted} file(s) deleted`)
  }

  if (settingsSynced) {
    parts.push("settings synced")
  }

  if (parts.length === 0) {
    return "Already in sync"
  }

  return `Sync complete: ${parts.join(", ")}`
}

export async function gitStyleSync(
  localExpenses: Expense[],
  onConflict?: OnConflictCallback,
  settings?: AppSettings,
  syncSettingsEnabled?: boolean
): Promise<GitStyleSyncResult> {
  try {
    const config = await loadSyncConfig()
    if (!config) {
      return {
        success: false,
        message: "Sync not configured",
        error: "No sync configuration found",
        filesUploaded: 0,
        filesSkipped: 0,
      }
    }

    const fetchResult = await fetchAllRemoteExpenses(localExpenses)

    if (!fetchResult.success) {
      return {
        success: false,
        message: "Failed to fetch remote expenses",
        error: fetchResult.error,
        authStatus: fetchResult.authStatus,
        shouldSignOut: fetchResult.shouldSignOut,
        filesUploaded: 0,
        filesSkipped: 0,
      }
    }

    const remoteExpenses = fetchResult.expenses || []
    const treeEntries = fetchResult.treeEntries

    const dirtyDaysResult = await loadDirtyDays()
    const useDirtyDays = dirtyDaysResult.isTrusted
    const dirtyDaySet = new Set(dirtyDaysResult.state.dirtyDays)
    const deletedDaySet = new Set(dirtyDaysResult.state.deletedDays)

    let mergeResult = mergeExpenses(localExpenses, remoteExpenses)

    if (mergeResult.trueConflicts.length > 0) {
      if (!onConflict) {
        return {
          success: false,
          message: `Sync has ${mergeResult.trueConflicts.length} conflict(s) that require resolution`,
          error: "Conflicts detected but no conflict handler provided",
          mergeResult,
          filesUploaded: 0,
          filesSkipped: 0,
        }
      }

      const resolutions = await onConflict(mergeResult.trueConflicts)

      if (!resolutions) {
        return {
          success: false,
          message: "Sync cancelled by user",
          error: "User cancelled conflict resolution",
          mergeResult,
          filesUploaded: 0,
          filesSkipped: 0,
        }
      }

      const resolutionMap = new Map(resolutions.map((r) => [r.expenseId, r.choice]))
      mergeResult = applyConflictResolutions(mergeResult, resolutionMap)

      if (mergeResult.trueConflicts.length > 0) {
        return {
          success: false,
          message: `${mergeResult.trueConflicts.length} conflict(s) were not resolved`,
          error: "Not all conflicts were resolved",
          mergeResult,
          filesUploaded: 0,
          filesSkipped: 0,
        }
      }
    }

    const mergedExpenses = mergeResult.merged

    const storedHashes = await loadFileHashes()

    let existingExpenseFiles: { path: string; name: string; dayKey: string }[]
    if (treeEntries) {
      existingExpenseFiles = treeEntries
        .filter((entry) => getDayKeyFromFilename(entry.path) !== null)
        .map((entry) => ({
          path: entry.path,
          name: entry.path,
          dayKey: getDayKeyFromFilename(entry.path)!,
        }))
    } else {
      const existingFiles = await listFiles(config.token, config.repo, config.branch)
      existingExpenseFiles = existingFiles
        .filter((file) => getDayKeyFromFilename(file.name) !== null)
        .map((file) => ({
          ...file,
          dayKey: getDayKeyFromFilename(file.name)!,
        }))
    }

    const groupedByDay = groupExpensesByDay(mergedExpenses)
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
    let newSettingsHash: string | undefined
    let mergedCategories: Category[] | undefined
    let settingsToSync: AppSettings | undefined
    let mergedSettings: AppSettings | undefined

    if (syncSettingsEnabled && settings) {
      let remoteSettings: AppSettings | undefined
      try {
        const remoteSettingsResult = await downloadSettingsFile(
          config.token,
          config.repo,
          config.branch
        )
        if (remoteSettingsResult) {
          remoteSettings = hydrateSettingsFromJson(
            JSON.parse(remoteSettingsResult.content)
          )
        }
      } catch (e) {
        if (e instanceof GitHubApiError && (e.status === 401 || e.status === 403)) {
          return {
            success: false,
            message: "Failed to download settings",
            error: e.message,
            authStatus: e.status,
            shouldSignOut: e.shouldSignOut,
            mergeResult,
            filesUploaded: 0,
            filesSkipped: 0,
          }
        }
        console.warn("Failed to download remote settings for merge:", e)
      }

      const remoteCategories = remoteSettings?.categories
      const localCategories = settings.categories
      if (remoteCategories && localCategories) {
        mergedCategories = mergeCategories(localCategories, remoteCategories).merged
      }

      const instrumentMerge = mergePaymentInstruments(
        settings.paymentInstruments,
        remoteSettings?.paymentInstruments
      )

      mergedSettings = {
        ...settings,
        syncSettings: true,
        categories: mergedCategories ?? settings.categories,
        paymentInstruments: instrumentMerge.merged,
        paymentInstrumentsMigrationVersion: Math.max(
          settings.paymentInstrumentsMigrationVersion ?? 0,
          remoteSettings?.paymentInstrumentsMigrationVersion ?? 0
        ),
        categoriesVersion: Math.max(
          settings.categoriesVersion ?? 0,
          remoteSettings?.categoriesVersion ?? 0
        ),
        version: Math.max(settings.version ?? 0, remoteSettings?.version ?? 0),
        updatedAt: new Date().toISOString(),
      }

      settingsToSync = mergedSettings

      newSettingsHash = computeSettingsHash(settingsToSync)
      const storedSettingsHash = await getSettingsHash()

      if (remoteSettings) {
        const remoteHash = computeSettingsHash(remoteSettings)
        if (remoteHash === newSettingsHash) {
          await saveSettingsHash(newSettingsHash)
          await clearSettingsChanged()
        }
      }

      if (storedSettingsHash !== newSettingsHash) {
        shouldSyncSettings = true
        const settingsContent = JSON.stringify(settingsToSync, null, 2)
        filesToUpload.push({
          path: "settings.json",
          content: settingsContent,
        })
      }
    }

    if (filesToUpload.length === 0 && filesToDelete.length === 0) {
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
        console.warn("Failed to update sync time:", e)
      }

      if (treeEntries) {
        const shaCache: { [filename: string]: string } = {}
        for (const entry of treeEntries) {
          if (getDayKeyFromFilename(entry.path) !== null) {
            shaCache[entry.path] = entry.sha
          }
        }
        await saveRemoteSHACache(shaCache)
      }

      return {
        success: true,
        message: buildSyncMessage(mergeResult, 0, skippedFiles, 0),
        mergeResult,
        filesUploaded: 0,
        filesSkipped: skippedFiles,
        filesDeleted: 0,
        localFilesUpdated: 0,
        remoteFilesUpdated:
          mergeResult.addedFromRemote.length + mergeResult.updatedFromRemote.length,
        settingsSynced: false,
        settingsSkipped: syncSettingsEnabled && settings ? true : undefined,
        mergedCategories,
        mergedSettings,
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

    if (!batchResult.success) {
      if (batchResult.errorCode === "AUTH" || batchResult.errorCode === "PERMISSION") {
        return {
          success: false,
          message: "Failed to push merged expenses",
          error:
            batchResult.errorCode === "AUTH"
              ? "Your GitHub session is no longer valid. Please sign in again."
              : "GitHub denied access (403). Please ensure you own the repo and have write access, then sign in again.",
          authStatus: batchResult.errorCode === "AUTH" ? 401 : 403,
          shouldSignOut: true,
          mergeResult,
          filesUploaded: 0,
          filesSkipped: skippedFiles,
        }
      }

      return {
        success: false,
        message: "Failed to push merged expenses",
        error: batchResult.error,
        mergeResult,
        filesUploaded: 0,
        filesSkipped: skippedFiles,
      }
    }

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

    if (treeEntries) {
      const deletedPaths = new Set(filesToDelete.map((f) => f.path))
      const shaCache: { [filename: string]: string } = {}
      for (const entry of treeEntries) {
        if (getDayKeyFromFilename(entry.path) !== null && !deletedPaths.has(entry.path)) {
          shaCache[entry.path] = entry.sha
        }
      }
      if (batchResult.blobShas) {
        for (const [path, sha] of Object.entries(batchResult.blobShas)) {
          if (getDayKeyFromFilename(path) !== null) {
            shaCache[path] = sha
          }
        }
      }
      await saveRemoteSHACache(shaCache)
    }

    if (shouldSyncSettings && newSettingsHash) {
      await saveSettingsHash(newSettingsHash)
      await clearSettingsChanged()
    }

    let commitTimestamp: string | undefined
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

    const expenseFilesUploaded = filesToUpload.filter(
      (f) => f.path !== "settings.json"
    ).length
    const localFilesUpdated = expenseFilesUploaded + filesToDelete.length

    return {
      success: true,
      message: buildSyncMessage(
        mergeResult,
        expenseFilesUploaded,
        skippedFiles,
        filesToDelete.length,
        shouldSyncSettings
      ),
      mergeResult,
      filesUploaded: expenseFilesUploaded,
      filesSkipped: skippedFiles,
      filesDeleted: filesToDelete.length,
      localFilesUpdated,
      remoteFilesUpdated:
        mergeResult.addedFromRemote.length + mergeResult.updatedFromRemote.length,
      commitTimestamp,
      settingsSynced: shouldSyncSettings,
      settingsSkipped: syncSettingsEnabled && settings && !shouldSyncSettings,
      mergedCategories,
      mergedSettings,
    }
  } catch (error) {
    console.warn("[SyncManager] gitStyleSync failed:", error)

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
        filesUploaded: 0,
        filesSkipped: 0,
        settingsSynced: false,
      }
    }

    return {
      success: false,
      message: "Sync failed",
      error: getUserFriendlyMessage(error),
      filesUploaded: 0,
      filesSkipped: 0,
      settingsSynced: false,
    }
  }
}
