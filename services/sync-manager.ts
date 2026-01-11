import { Expense } from "../types/expense"
import { secureStorage } from "./secure-storage"
import { exportToCSV, importFromCSV } from "./csv-handler"
import { getUserFriendlyMessage } from "./error-utils"
import {
  downloadCSV,
  validatePAT,
  listFiles,
  batchCommit,
  generateCommitMessage,
  BatchFileUpload,
  BatchFileDelete,
  downloadSettingsFile,
  getLatestCommitTimestamp,
} from "./github-sync"
import {
  AppSettings,
  computeSettingsHash,
  getSettingsHash,
  saveSettingsHash,
  clearSettingsChanged,
  hydrateSettingsFromJson,
} from "./settings-manager"
import {
  groupExpensesByDay,
  getFilenameForDay,
  getDayKeyFromFilename,
} from "./daily-file-manager"
import {
  computeContentHash,
  loadFileHashes,
  saveFileHashes,
  FileHashMap,
} from "./hash-storage"
import { format } from "date-fns"
import {
  mergeExpenses,
  applyConflictResolutions,
  MergeResult,
  TrueConflict,
} from "./merge-engine"
import { mergeCategories } from "./category-merger"
import { mergePaymentInstruments } from "./payment-instrument-merger"

// Import sync types from centralized location
import type {
  SyncConfig,
  SyncResult,
  SyncNotification,
  SyncDirection,
  SyncDirectionResult,
  FetchAllRemoteResult,
} from "../types/sync"

// Re-export types for backward compatibility
export type {
  SyncConfig,
  SyncResult,
  SyncNotification,
  SyncDirection,
  SyncDirectionResult,
  FetchAllRemoteResult,
}

const GITHUB_TOKEN_KEY = "github_pat"
const GITHUB_REPO_KEY = "github_repo"
const GITHUB_BRANCH_KEY = "github_branch"

/**
 * Save GitHub sync configuration securely
 */
export async function saveSyncConfig(config: SyncConfig): Promise<void> {
  await secureStorage.setItem(GITHUB_TOKEN_KEY, config.token)
  await secureStorage.setItem(GITHUB_REPO_KEY, config.repo)
  await secureStorage.setItem(GITHUB_BRANCH_KEY, config.branch)
}

/**
 * Load GitHub sync configuration
 */
export async function loadSyncConfig(): Promise<SyncConfig | null> {
  const token = await secureStorage.getItem(GITHUB_TOKEN_KEY)
  const repo = await secureStorage.getItem(GITHUB_REPO_KEY)
  const branch = await secureStorage.getItem(GITHUB_BRANCH_KEY)

  if (!token || !repo || !branch) {
    return null
  }

  return { token, repo, branch }
}

/**
 * Clear GitHub sync configuration
 */
export async function clearSyncConfig(): Promise<void> {
  await secureStorage.deleteItem(GITHUB_TOKEN_KEY)
  await secureStorage.deleteItem(GITHUB_REPO_KEY)
  await secureStorage.deleteItem(GITHUB_BRANCH_KEY)
}

/**
 * Test GitHub connection with current config
 */
export async function testConnection(): Promise<SyncResult> {
  const config = await loadSyncConfig()
  if (!config) {
    console.warn("[SyncManager] testConnection failed: No sync configuration found")
    return {
      success: false,
      message: "No sync configuration found",
      error: "Configuration missing",
    }
  }

  try {
    const result = await validatePAT(config.token, config.repo)
    if (result.valid) {
      return { success: true, message: "Connection successful!" }
    } else {
      console.warn("[SyncManager] testConnection failed:", result.error)
      return {
        success: false,
        message: "Connection failed",
        error: getUserFriendlyMessage(new Error(result.error || "Unknown error")),
      }
    }
  } catch (error) {
    console.warn("[SyncManager] testConnection failed:", error)
    return {
      success: false,
      message: "Connection failed",
      error: getUserFriendlyMessage(error),
    }
  }
}

/**
 * Determine sync direction based on local and remote timestamps
 *
 * Logic:
 * - If local is newer than remote → push
 * - If remote is newer than local → pull
 * - If both have changes since last sync → conflict
 * - If no changes → in_sync
 */
export async function determineSyncDirection(
  hasLocalChanges: boolean
): Promise<SyncDirectionResult> {
  try {
    const config = await loadSyncConfig()
    if (!config) {
      console.warn("[SyncManager] determineSyncDirection failed: No sync configuration")
      return {
        direction: "error",
        localTime: null,
        remoteTime: null,
        error: "No sync configuration",
      }
    }

    // Get local last sync time
    const localLastSync = await getLastSyncTime()

    // Get remote last modified time
    const remoteResult = await getLatestCommitTimestamp(
      config.token,
      config.repo,
      config.branch
    )

    if ("error" in remoteResult) {
      console.warn("[SyncManager] determineSyncDirection failed:", remoteResult.error)
      return {
        direction: "error",
        localTime: localLastSync,
        remoteTime: null,
        error: getUserFriendlyMessage(new Error(remoteResult.error)),
      }
    }

    const remoteTime = remoteResult.timestamp

    // Case 1: No local sync time (first sync)
    if (!localLastSync) {
      // If we have local changes and remote has data, that's a conflict
      if (hasLocalChanges && new Date(remoteTime).getTime() > 0) {
        return {
          direction: "conflict",
          localTime: null,
          remoteTime: remoteTime,
        }
      }
      // If we have local changes but remote is empty, push
      if (hasLocalChanges) {
        return { direction: "push", localTime: null, remoteTime: remoteTime }
      }
      // Otherwise pull from remote
      return { direction: "pull", localTime: null, remoteTime: remoteTime }
    }

    const localSyncMs = new Date(localLastSync).getTime()
    const remoteMs = new Date(remoteTime).getTime()

    // Case 2: Remote is newer than our last sync
    const remoteIsNewer = remoteMs > localSyncMs

    // Case 3: We have local changes since last sync
    const localHasChanges = hasLocalChanges

    if (remoteIsNewer && localHasChanges) {
      // Both sides have changes - conflict
      return {
        direction: "conflict",
        localTime: localLastSync,
        remoteTime: remoteTime,
      }
    }

    if (remoteIsNewer) {
      // Only remote has changes - pull
      return {
        direction: "pull",
        localTime: localLastSync,
        remoteTime: remoteTime,
      }
    }

    if (localHasChanges) {
      // Only local has changes - push
      return {
        direction: "push",
        localTime: localLastSync,
        remoteTime: remoteTime,
      }
    }

    // No changes on either side
    return {
      direction: "in_sync",
      localTime: localLastSync,
      remoteTime: remoteTime,
    }
  } catch (error) {
    console.warn("[SyncManager] determineSyncDirection failed:", error)
    return {
      direction: "error",
      localTime: null,
      remoteTime: null,
      error: getUserFriendlyMessage(error),
    }
  }
}

/**
 * Sync expenses to GitHub (upload) - splits into daily files
 * Uses differential sync to only upload changed files
 * Uses batch commit to upload all changes in a single commit
 * Also deletes files for days that no longer have expenses
 * Optionally includes settings in the sync if syncSettingsEnabled is true
 */
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
        message: "Sync not configured",
        error: "No configuration",
      }
    }

    // Load stored hashes for differential sync
    const storedHashes = await loadFileHashes()

    // Get list of existing files on GitHub
    const existingFiles = await listFiles(config.token, config.repo, config.branch)
    const existingExpenseFiles = existingFiles
      .filter((file) => getDayKeyFromFilename(file.name) !== null)
      .map((file) => ({
        ...file,
        dayKey: getDayKeyFromFilename(file.name)!,
      }))

    // Group expenses by day
    const groupedByDay = groupExpensesByDay(expenses)
    const localDayKeys = new Set(groupedByDay.keys())

    // =========================================================================
    // Determine the local data range to avoid deleting remote files we never downloaded
    // =========================================================================

    // Find the date range of local expenses
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

    // =========================================================================
    // Task 4.1: Collect all changes before committing
    // =========================================================================

    // Build list of files to upload (changed hashes)
    const filesToUpload: BatchFileUpload[] = []
    const uploadedFileHashes: Map<string, string> = new Map()
    let skippedFiles = 0

    for (const [dayKey, dayExpenses] of groupedByDay.entries()) {
      const filename = getFilenameForDay(dayKey)
      const csvContent = exportToCSV(dayExpenses)
      const contentHash = computeContentHash(csvContent)

      // Check if content has changed (hash-based file exclusion)
      if (storedHashes[filename] === contentHash) {
        // Content unchanged, skip upload
        skippedFiles++
        continue
      }

      // Content changed or new file, add to upload list
      filesToUpload.push({
        path: filename,
        content: csvContent,
      })
      // Store hash for later update (only if commit succeeds)
      uploadedFileHashes.set(filename, contentHash)
    }

    // Build list of files to delete (exist on remote but not locally)
    // IMPORTANT: Only delete files within our local date range to avoid
    // deleting remote files we never downloaded (e.g., data older than 7 days)
    const filesToDelete: BatchFileDelete[] = []
    for (const file of existingExpenseFiles) {
      // Only consider deleting if:
      // 1. The file's day is not in our local data
      // 2. The file's day is WITHIN our local date range (we know about this day)
      // This prevents deleting files for days we never downloaded
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

    // =========================================================================
    // Settings sync: Check if settings should be included
    // =========================================================================
    let shouldSyncSettings = false
    let settingsContent: string | undefined
    let newSettingsHash: string | undefined

    if (syncSettingsEnabled && settings) {
      // Compute hash of current settings
      newSettingsHash = computeSettingsHash(settings)
      const storedSettingsHash = await getSettingsHash()

      // Only sync if settings have changed (hash-based skip)
      if (storedSettingsHash !== newSettingsHash) {
        shouldSyncSettings = true
        settingsContent = JSON.stringify(settings, null, 2)
        // Add settings to the batch upload
        filesToUpload.push({
          path: "settings.json",
          content: settingsContent,
        })
      }
    }

    // =========================================================================
    // Task 4.2: Replace individual calls with single batchCommit call
    // =========================================================================

    // If no changes to make, return early with success
    if (filesToUpload.length === 0 && filesToDelete.length === 0) {
      return {
        success: true,
        message: `No changes to sync: ${skippedFiles} file(s) unchanged`,
        filesUploaded: 0,
        filesSkipped: skippedFiles,
        filesDeleted: 0,
        settingsSynced: false,
        settingsSkipped: syncSettingsEnabled && settings ? true : undefined,
      }
    }

    // Generate commit message
    const commitMessage = generateCommitMessage(
      filesToUpload.length,
      filesToDelete.length
    )

    // Execute batch commit with all uploads and deletions
    const batchResult = await batchCommit(config.token, config.repo, config.branch, {
      uploads: filesToUpload,
      deletions: filesToDelete,
      message: commitMessage,
    })

    // =========================================================================
    // Task 4.3: Update hash storage only after successful batch commit
    // =========================================================================

    if (batchResult.success) {
      // On success: update hashes for uploaded files, remove hashes for deleted files
      const updatedHashes: FileHashMap = {}

      // Keep hashes for unchanged files
      for (const [dayKey] of groupedByDay.entries()) {
        const filename = getFilenameForDay(dayKey)
        if (storedHashes[filename] && !uploadedFileHashes.has(filename)) {
          // File was skipped (unchanged), keep its hash
          updatedHashes[filename] = storedHashes[filename]
        }
      }

      // Add hashes for newly uploaded files
      for (const [filename, hash] of uploadedFileHashes.entries()) {
        updatedHashes[filename] = hash
      }

      // Note: deleted files are simply not included in updatedHashes

      await saveFileHashes(updatedHashes)

      // Update settings hash if settings were synced
      if (shouldSyncSettings && newSettingsHash) {
        await saveSettingsHash(newSettingsHash)
        await clearSettingsChanged()
      }

      // Fetch the actual commit timestamp from GitHub to ensure perfect sync
      let commitTimestamp: string | undefined
      if (batchResult.commitSha) {
        // We just made a commit, so the remote time is now AUTHORITATIVE
        // We must use this exact timestamp to avoid "remote is newer" false positives
        try {
          const timestampResult = await getLatestCommitTimestamp(
            config.token,
            config.repo,
            config.branch
          )
          if ("timestamp" in timestampResult) {
            commitTimestamp = timestampResult.timestamp
            // Save the authoritative server timestamp as the last sync time
            await saveLastSyncTime(commitTimestamp)
          }
        } catch (e) {
          console.warn("Failed to fetch commit timestamp after sync:", e)
        }
      }

      const message: string[] = []
      // Count expense files only (exclude settings.json)
      const expenseFilesUploaded = filesToUpload.filter(
        (f) => f.path !== "settings.json"
      ).length
      if (expenseFilesUploaded > 0)
        message.push(`${expenseFilesUploaded} file(s) uploaded`)
      if (skippedFiles > 0) message.push(`${skippedFiles} file(s) unchanged`)
      if (filesToDelete.length > 0)
        message.push(`${filesToDelete.length} file(s) deleted`)
      if (shouldSyncSettings) message.push("settings synced")

      return {
        success: true,
        message: `Synced ${expenses.length} expenses: ${message.join(", ")}`,
        filesUploaded: expenseFilesUploaded,
        filesSkipped: skippedFiles,
        filesDeleted: filesToDelete.length,
        settingsSynced: shouldSyncSettings,
        settingsSkipped: syncSettingsEnabled && settings && !shouldSyncSettings,
        commitTimestamp,
      }
    } else {
      // On failure: preserve existing hashes (don't update anything)
      return {
        success: false,
        message: "Batch commit failed",
        error: batchResult.error,
        filesUploaded: 0,
        filesSkipped: skippedFiles,
        filesDeleted: 0,
        settingsSynced: false,
      }
    }
  } catch (error) {
    console.warn("[SyncManager] syncUp failed:", error)
    return {
      success: false,
      message: "Sync failed",
      error: getUserFriendlyMessage(error),
    }
  }
}

/**
 * Sync expenses from GitHub (download) - downloads last N days of files
 * Optionally downloads settings if syncSettingsEnabled is true
 */
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
}> {
  try {
    const config = await loadSyncConfig()
    if (!config) {
      return {
        success: false,
        message: "Sync not configured",
        error: "No configuration",
      }
    }

    // List all files in the repository
    const files = await listFiles(config.token, config.repo, config.branch)

    // Filter for expense files (expenses-YYYY-MM-DD.csv)
    const expenseFiles = files
      .filter((file) => getDayKeyFromFilename(file.name) !== null)
      .map((file) => ({
        ...file,
        dayKey: getDayKeyFromFilename(file.name)!,
      }))
      .sort((a, b) => b.dayKey.localeCompare(a.dayKey)) // Sort descending (newest first)

    if (expenseFiles.length === 0) {
      // No expense files, but we might still have settings to download
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
          console.warn("Failed to download settings:", settingsError)
          // Continue without settings - don't fail the whole sync
        }
      }

      return {
        success: false,
        message: "No expense files found in repository",
        error: "No files found",
        settings: downloadedSettings,
        settingsDownloaded,
      }
    }

    // Take only the requested number of days
    const filesToDownload = expenseFiles.slice(0, daysToDownload)
    const hasMore = expenseFiles.length > daysToDownload

    // Download and merge selected files
    const allExpenses: Expense[] = []
    let downloadedFiles = 0
    for (const file of filesToDownload) {
      const fileData = await downloadCSV(
        config.token,
        config.repo,
        config.branch,
        file.path
      )

      if (fileData) {
        const expenses = importFromCSV(fileData.content)
        allExpenses.push(...expenses)
        downloadedFiles++
      }
    }

    // Download settings if enabled
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
        console.warn("Failed to download settings:", settingsError)
        // Continue without settings - don't fail the whole sync
      }
    }

    const messageParts = [
      `Downloaded ${allExpenses.length} expenses from ${downloadedFiles} file(s)`,
    ]
    if (settingsDownloaded) {
      messageParts.push("settings downloaded")
    }

    // Save the remote timestamp as last sync time after successful pull
    // This prevents false conflicts when pushing local changes later
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
      // Continue - the pull was still successful
    }

    return {
      success: true,
      message: messageParts.join(", "),
      expenses: allExpenses,
      settings: downloadedSettings,
      hasMore,
      settingsDownloaded,
    }
  } catch (error) {
    console.warn("[SyncManager] syncDown failed:", error)
    return {
      success: false,
      message: "Download failed",
      error: getUserFriendlyMessage(error),
    }
  }
}

/**
 * Download additional days of expenses (for "Load More" functionality)
 */
export async function syncDownMore(
  currentExpenses: Expense[],
  additionalDays: number = 7
): Promise<{
  success: boolean
  message: string
  expenses?: Expense[]
  error?: string
  hasMore?: boolean
}> {
  try {
    const config = await loadSyncConfig()
    if (!config) {
      return {
        success: false,
        message: "Sync not configured",
        error: "No configuration",
      }
    }

    // Get the oldest date from current expenses
    const oldestDate = currentExpenses.reduce((oldest, expense) => {
      const expenseDate = new Date(expense.date)
      return expenseDate < oldest ? expenseDate : oldest
    }, new Date())

    // List all files in the repository
    const files = await listFiles(config.token, config.repo, config.branch)

    // Filter for expense files older than the oldest current expense
    const expenseFiles = files
      .filter((file) => getDayKeyFromFilename(file.name) !== null)
      .map((file) => ({
        ...file,
        dayKey: getDayKeyFromFilename(file.name)!,
      }))
      .filter((file) => file.dayKey < format(oldestDate, "yyyy-MM-dd"))
      .sort((a, b) => b.dayKey.localeCompare(a.dayKey)) // Sort descending (newest first)

    if (expenseFiles.length === 0) {
      return {
        success: true,
        message: "No more expenses to load",
        expenses: currentExpenses,
        hasMore: false,
      }
    }

    // Take only the requested number of additional days
    const filesToDownload = expenseFiles.slice(0, additionalDays)
    const hasMore = expenseFiles.length > additionalDays

    // Download and merge selected files
    const newExpenses: Expense[] = []
    let downloadedFiles = 0

    for (const file of filesToDownload) {
      const fileData = await downloadCSV(
        config.token,
        config.repo,
        config.branch,
        file.path
      )

      if (fileData) {
        const expenses = importFromCSV(fileData.content)
        newExpenses.push(...expenses)
        downloadedFiles++
      }
    }

    // Merge with current expenses
    const allExpenses = [...currentExpenses, ...newExpenses]

    return {
      success: true,
      message: `Loaded ${newExpenses.length} more expenses from ${downloadedFiles} file(s)`,
      expenses: allExpenses,
      hasMore,
    }
  } catch (error) {
    console.warn("[SyncManager] syncDownMore failed:", error)
    return {
      success: false,
      message: "Load more failed",
      error: getUserFriendlyMessage(error),
    }
  }
}

const LAST_SYNC_TIME_KEY = "last_sync_time"

/**
 * Get last sync timestamp
 */
async function getLastSyncTime(): Promise<string | null> {
  return await secureStorage.getItem(LAST_SYNC_TIME_KEY)
}

// ============================================================================
// Fetch All Remote Expenses (for git-style sync)
// ============================================================================

/**
 * Fetch ALL remote expenses from the repository
 * Unlike syncDown which only fetches recent days, this fetches all expense files
 * to ensure complete data for merge operations.
 */
export async function fetchAllRemoteExpenses(): Promise<FetchAllRemoteResult> {
  try {
    const config = await loadSyncConfig()
    if (!config) {
      return {
        success: false,
        error: "No sync configuration found",
      }
    }

    // List all files in the repository
    let files: { name: string; path: string; sha: string }[]
    try {
      files = await listFiles(config.token, config.repo, config.branch)
    } catch (listError) {
      // Catch network errors during fetch
      const errorMessage = String(listError)
      if (
        errorMessage.includes("Failed to fetch") ||
        errorMessage.includes("Network request failed") ||
        errorMessage.includes("TypeError")
      ) {
        return {
          success: false,
          error: "No internet connection. Cannot fetch remote expenses.",
        }
      }
      return {
        success: false,
        error: `Failed to list remote files: ${errorMessage}`,
      }
    }

    // Filter for expense files (expenses-YYYY-MM-DD.csv)
    const expenseFiles = files.filter((file) => getDayKeyFromFilename(file.name) !== null)

    if (expenseFiles.length === 0) {
      // No expense files found - return empty array (not an error)
      return {
        success: true,
        expenses: [],
        filesDownloaded: 0,
      }
    }

    // Download and parse ALL expense files (not just recent window)
    const allExpenses: Expense[] = []
    let downloadedFiles = 0
    const downloadErrors: string[] = []

    for (const file of expenseFiles) {
      try {
        const fileData = await downloadCSV(
          config.token,
          config.repo,
          config.branch,
          file.path
        )

        if (fileData) {
          const expenses = importFromCSV(fileData.content)
          allExpenses.push(...expenses)
          downloadedFiles++
        }
      } catch (fileError) {
        // Log but continue with other files - one bad file shouldn't fail entire fetch
        console.warn(`Failed to download ${file.path}:`, fileError)
        downloadErrors.push(file.path)
      }
    }

    // If we couldn't download ANY files, that's an error
    if (downloadedFiles === 0 && expenseFiles.length > 0) {
      return {
        success: false,
        error: `Failed to download any expense files. ${downloadErrors.length} file(s) failed.`,
      }
    }

    return {
      success: true,
      expenses: allExpenses,
      filesDownloaded: downloadedFiles,
    }
  } catch (error) {
    // Catch network errors during fetch
    console.warn("[SyncManager] fetchAllRemoteExpenses failed:", error)
    return {
      success: false,
      error: getUserFriendlyMessage(error),
    }
  }
}

/**
 * Save last sync timestamp
 */
async function saveLastSyncTime(timestamp: string): Promise<void> {
  await secureStorage.setItem(LAST_SYNC_TIME_KEY, timestamp)
}

/**
 * Merge expenses using timestamps to resolve conflicts
 *
 * IMPORTANT: Conflict resolution uses expense.updatedAt timestamps, NOT filenames.
 * Filenames (expenses-YYYY-MM-DD.csv) are based on expense.date (when expense occurred),
 * but conflict resolution uses expense.updatedAt (when expense was last modified).
 *
 * Rules:
 * 1. For expenses in both: keep the one with the latest updatedAt
 * 2. For expenses only in remote:
 *    - If lastSyncTime exists and is newer than the item, it was deleted locally → skip it
 *    - Otherwise, it's new on remote → add it
 * 3. For expenses only in local: keep them (they're new locally or synced before)
 */
export function mergeExpensesWithTimestamps(
  local: Expense[],
  remote: Expense[],
  lastSyncTime: string | null
): { merged: Expense[]; newFromRemote: number; updatedFromRemote: number } {
  const localMap = new Map(local.map((e) => [e.id, e]))
  const remoteMap = new Map(remote.map((e) => [e.id, e]))
  const merged: Expense[] = []
  let newFromRemote = 0
  let updatedFromRemote = 0

  // Process all unique IDs
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()])

  for (const id of allIds) {
    const localItem = localMap.get(id)
    const remoteItem = remoteMap.get(id)

    if (localItem && remoteItem) {
      // Conflict: exists in both - keep the newer one based on updatedAt
      const localTime = new Date(localItem.updatedAt).getTime()
      const remoteTime = new Date(remoteItem.updatedAt).getTime()
      if (remoteTime > localTime) {
        merged.push(remoteItem)
        updatedFromRemote++
      } else {
        merged.push(localItem)
      }
    } else if (localItem) {
      // Only in local - keep it
      merged.push(localItem)
    } else if (remoteItem) {
      // Only in remote - check if it was deleted locally
      if (lastSyncTime) {
        const lastSync = new Date(lastSyncTime).getTime()
        const itemUpdated = new Date(remoteItem.updatedAt).getTime()

        // If last sync is newer than the item, it means we saw this item before
        // and it's gone now from local, so it was deleted - don't restore it
        if (lastSync > itemUpdated) {
          continue
        }
      }
      // It's a new remote item or we don't have sync history - add it
      merged.push(remoteItem)
      newFromRemote++
    }
  }

  // Sort by creation date (newest first)
  const sortedMerged = merged.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  return {
    merged: sortedMerged,
    newFromRemote,
    updatedFromRemote,
  }
}

/**
 * Perform smart merge of local and remote expenses
 * Returns the merged result without uploading
 */
export async function smartMerge(
  localExpenses: Expense[],
  remoteExpenses: Expense[]
): Promise<{
  merged: Expense[]
  newFromRemote: number
  updatedFromRemote: number
}> {
  const lastSyncTime = await getLastSyncTime()
  return mergeExpensesWithTimestamps(localExpenses, remoteExpenses, lastSyncTime)
}

/**
 * Get the count of files that will be uploaded/deleted in the next sync
 * This compares current content hashes with stored hashes to determine changes
 */
export async function getPendingSyncCount(expenses: Expense[]): Promise<{
  filesChanged: number
  filesUnchanged: number
  filesToDelete: number
}> {
  try {
    const storedHashes = await loadFileHashes()
    const groupedByDay = groupExpensesByDay(expenses)

    let filesChanged = 0
    let filesUnchanged = 0

    // Check each day's expenses against stored hashes
    for (const [dayKey, dayExpenses] of groupedByDay.entries()) {
      const filename = getFilenameForDay(dayKey)
      const csvContent = exportToCSV(dayExpenses)
      const contentHash = computeContentHash(csvContent)

      if (storedHashes[filename] === contentHash) {
        filesUnchanged++
      } else {
        filesChanged++
      }
    }

    // Count files to delete (exist in stored hashes but not in local data)
    const localFilenames = new Set(Array.from(groupedByDay.keys()).map(getFilenameForDay))
    const filesToDelete = Object.keys(storedHashes).filter(
      (filename) => !localFilenames.has(filename)
    ).length

    return { filesChanged, filesUnchanged, filesToDelete }
  } catch (error) {
    console.warn("Failed to compute pending sync count:", error)
    // Return all as changed if we can't compute (safe fallback)
    const groupedByDay = groupExpensesByDay(expenses)
    return {
      filesChanged: groupedByDay.size,
      filesUnchanged: 0,
      filesToDelete: 0,
    }
  }
}

/**
 * Migrate from old single-file format to new daily-file format
 * This checks if the old expenses.csv exists and migrates it to daily files
 */
export async function migrateToDailyFiles(): Promise<{
  migrated: boolean
  message: string
}> {
  try {
    const config = await loadSyncConfig()
    if (!config) {
      return { migrated: false, message: "No sync configuration" }
    }

    // Check if old expenses.csv exists
    const oldFile = await downloadCSV(
      config.token,
      config.repo,
      config.branch,
      "expenses.csv"
    )

    if (!oldFile) {
      // No old file, nothing to migrate
      return { migrated: false, message: "No old file to migrate" }
    }

    // Parse old file
    const expenses = importFromCSV(oldFile.content)

    if (expenses.length === 0) {
      return { migrated: false, message: "Old file is empty" }
    }

    // Upload as daily files
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

// ============================================================================
// Git-Style Sync (fetch-merge-push workflow)
// ============================================================================

/**
 * Resolution choice for a true conflict
 */
export interface ConflictResolution {
  expenseId: string
  choice: "local" | "remote"
}

/**
 * Result of a git-style sync operation
 */
export interface GitStyleSyncResult {
  success: boolean
  message: string
  /** The merge result containing all details about what was merged */
  mergeResult?: MergeResult
  /** Number of files uploaded to remote */
  filesUploaded: number
  /** Number of files skipped (unchanged) */
  filesSkipped: number
  /** Number of files deleted from remote */
  filesDeleted?: number
  /** Error message if sync failed */
  error?: string
  /** Timestamp of the commit if one was created */
  commitTimestamp?: string
  /** Whether settings were included in sync */
  settingsSynced?: boolean
  /** Whether settings were skipped (unchanged) */
  settingsSkipped?: boolean
  /** Error message if settings sync failed */
  settingsError?: string
  /** Merged categories from local and remote (caller should apply to store) */
  mergedCategories?: import("../types/category").Category[]
  /** Merged settings after combining remote and local (caller should apply to store) */
  mergedSettings?: AppSettings
}

/**
 * Callback type for handling true conflicts during sync
 * Returns resolutions for each conflict, or undefined to cancel sync
 */
export type OnConflictCallback = (
  conflicts: TrueConflict[]
) => Promise<ConflictResolution[] | undefined>

/**
 * Perform a git-style sync: fetch → merge → resolve conflicts → push
 *
 * This implements the unified sync flow where:
 * 1. All remote expenses are fetched first
 * 2. Local and remote are merged using ID-based merging
 * 3. Conflicts are auto-resolved by timestamp
 * 4. True conflicts are presented to user via callback
 * 5. Merged result is pushed to remote
 * 6. Local store and sync time are updated
 * 7. Optionally syncs settings if enabled
 *
 * @param localExpenses - Current local expenses (including soft-deleted)
 * @param onConflict - Optional callback to handle true conflicts
 * @param settings - Optional settings to sync
 * @param syncSettingsEnabled - Whether to include settings in sync
 * @returns GitStyleSyncResult with sync details
 */
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

    // =========================================================================
    // Step 1: Fetch all remote expenses (Requirement 1.1, 1.2)
    // =========================================================================
    const fetchResult = await fetchAllRemoteExpenses()

    if (!fetchResult.success) {
      // Requirement 1.3: If fetch fails, abort sync
      return {
        success: false,
        message: "Failed to fetch remote expenses",
        error: fetchResult.error,
        filesUploaded: 0,
        filesSkipped: 0,
      }
    }

    const remoteExpenses = fetchResult.expenses || []

    // =========================================================================
    // Step 2: Merge local and remote (Requirement 2.1, 3.1)
    // =========================================================================
    let mergeResult = mergeExpenses(localExpenses, remoteExpenses)

    // =========================================================================
    // Step 3: Handle true conflicts (Requirement 4.2, 4.3, 4.4)
    // =========================================================================
    if (mergeResult.trueConflicts.length > 0) {
      if (!onConflict) {
        // No conflict handler provided - cannot proceed with conflicts
        return {
          success: false,
          message: `Sync has ${mergeResult.trueConflicts.length} conflict(s) that require resolution`,
          error: "Conflicts detected but no conflict handler provided",
          mergeResult,
          filesUploaded: 0,
          filesSkipped: 0,
        }
      }

      // Call the conflict callback to get user's resolution choices
      const resolutions = await onConflict(mergeResult.trueConflicts)

      if (!resolutions) {
        // User cancelled - abort sync
        return {
          success: false,
          message: "Sync cancelled by user",
          error: "User cancelled conflict resolution",
          mergeResult,
          filesUploaded: 0,
          filesSkipped: 0,
        }
      }

      // Apply the resolutions to the merge result
      const resolutionMap = new Map(resolutions.map((r) => [r.expenseId, r.choice]))
      mergeResult = applyConflictResolutions(mergeResult, resolutionMap)

      // Check if all conflicts were resolved
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

    // =========================================================================
    // Step 4: Push merged result (Requirement 6.1, 6.2)
    // =========================================================================
    const mergedExpenses = mergeResult.merged

    // Load stored hashes for differential sync
    const storedHashes = await loadFileHashes()

    // Get list of existing files on GitHub
    const existingFiles = await listFiles(config.token, config.repo, config.branch)
    const existingExpenseFiles = existingFiles
      .filter((file) => getDayKeyFromFilename(file.name) !== null)
      .map((file) => ({
        ...file,
        dayKey: getDayKeyFromFilename(file.name)!,
      }))

    // Group merged expenses by day
    const groupedByDay = groupExpensesByDay(mergedExpenses)
    const localDayKeys = new Set(groupedByDay.keys())

    // Determine the local data range to avoid deleting remote files we never downloaded
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

    // Build list of files to upload (changed hashes)
    const filesToUpload: BatchFileUpload[] = []
    const uploadedFileHashes: Map<string, string> = new Map()
    let skippedFiles = 0

    for (const [dayKey, dayExpenses] of groupedByDay.entries()) {
      const filename = getFilenameForDay(dayKey)
      const csvContent = exportToCSV(dayExpenses)
      const contentHash = computeContentHash(csvContent)

      // Check if content has changed (hash-based file exclusion)
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

    // Build list of files to delete (exist on remote but not locally)
    // IMPORTANT: Only delete files within our local date range (Requirement 5.4)
    const filesToDelete: BatchFileDelete[] = []
    for (const file of existingExpenseFiles) {
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

    // =========================================================================
    // Settings sync: Download remote, merge categories + payment instruments, then push
    // =========================================================================
    let shouldSyncSettings = false
    let newSettingsHash: string | undefined
    let mergedCategories: import("../types/category").Category[] | undefined
    let settingsToSync: AppSettings | undefined
    let mergedSettings: AppSettings | undefined

    if (syncSettingsEnabled && settings) {
      // Download remote settings to merge categories
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
        console.warn("Failed to download remote settings for merge:", e)
        // Continue without remote settings - will just push local
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
        // Keep syncSettings enabled locally since we are in the settings-sync flow.
        syncSettings: true,
        categories: mergedCategories ?? settings.categories,
        // Union/merge instruments so sync-down hydrates and sync-up doesn't lose remote.
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

      // Compute hash of settings to sync
      newSettingsHash = computeSettingsHash(settingsToSync)
      const storedSettingsHash = await getSettingsHash()

      // If remote exists and already matches what we'd sync, treat as synced locally
      // (prevents a redundant commit on first sync-down to a fresh device).
      if (remoteSettings) {
        const remoteHash = computeSettingsHash(remoteSettings)
        if (remoteHash === newSettingsHash) {
          await saveSettingsHash(newSettingsHash)
          await clearSettingsChanged()
        }
      }

      // Only sync if settings have changed (hash-based skip)
      if (storedSettingsHash !== newSettingsHash) {
        shouldSyncSettings = true
        const settingsContent = JSON.stringify(settingsToSync, null, 2)
        // Add settings to the batch upload
        filesToUpload.push({
          path: "settings.json",
          content: settingsContent,
        })
      }
    }

    // If no changes to make, return success with merge info
    if (filesToUpload.length === 0 && filesToDelete.length === 0) {
      // Still update sync time since we successfully fetched and merged
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

      return {
        success: true,
        message: buildSyncMessage(mergeResult, 0, skippedFiles, 0),
        mergeResult,
        filesUploaded: 0,
        filesSkipped: skippedFiles,
        filesDeleted: 0,
        settingsSynced: false,
        settingsSkipped: syncSettingsEnabled && settings ? true : undefined,
        mergedCategories,
        mergedSettings,
      }
    }

    // Generate commit message
    const commitMessage = generateCommitMessage(
      filesToUpload.length,
      filesToDelete.length
    )

    // Execute batch commit
    const batchResult = await batchCommit(config.token, config.repo, config.branch, {
      uploads: filesToUpload,
      deletions: filesToDelete,
      message: commitMessage,
    })

    if (!batchResult.success) {
      return {
        success: false,
        message: "Failed to push merged expenses",
        error: batchResult.error,
        mergeResult,
        filesUploaded: 0,
        filesSkipped: skippedFiles,
      }
    }

    // =========================================================================
    // Step 5: Update hashes and sync time
    // =========================================================================
    const updatedHashes: FileHashMap = {}

    // Keep hashes for unchanged files
    for (const [dayKey] of groupedByDay.entries()) {
      const filename = getFilenameForDay(dayKey)
      if (storedHashes[filename] && !uploadedFileHashes.has(filename)) {
        updatedHashes[filename] = storedHashes[filename]
      }
    }

    // Add hashes for newly uploaded files
    for (const [filename, hash] of uploadedFileHashes.entries()) {
      updatedHashes[filename] = hash
    }

    await saveFileHashes(updatedHashes)

    // Update settings hash if settings were synced
    if (shouldSyncSettings && newSettingsHash) {
      await saveSettingsHash(newSettingsHash)
      await clearSettingsChanged()
    }

    // Fetch and save the commit timestamp
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

    // =========================================================================
    // Step 6: Build result with detailed reporting
    // =========================================================================
    // Count expense files only (exclude settings.json from file count)
    const expenseFilesUploaded = filesToUpload.filter(
      (f) => f.path !== "settings.json"
    ).length

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
      commitTimestamp,
      settingsSynced: shouldSyncSettings,
      settingsSkipped: syncSettingsEnabled && settings && !shouldSyncSettings,
      mergedCategories,
      mergedSettings,
    }
  } catch (error) {
    console.warn("[SyncManager] gitStyleSync failed:", error)
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

/**
 * Build a human-readable sync message from merge result and file counts
 */
function buildSyncMessage(
  mergeResult: MergeResult,
  filesUploaded: number,
  filesSkipped: number,
  filesDeleted: number,
  settingsSynced?: boolean
): string {
  const parts: string[] = []

  // Report items added from remote (Requirement 7.1)
  if (mergeResult.addedFromRemote.length > 0) {
    parts.push(`${mergeResult.addedFromRemote.length} added from remote`)
  }

  // Report items updated from remote (Requirement 7.2)
  if (mergeResult.updatedFromRemote.length > 0) {
    parts.push(`${mergeResult.updatedFromRemote.length} updated from remote`)
  }

  // Report local changes pushed (Requirement 7.3)
  const localChangesPushed =
    mergeResult.addedFromLocal.length + mergeResult.updatedFromLocal.length
  if (localChangesPushed > 0) {
    parts.push(`${localChangesPushed} local changes pushed`)
  }

  // Report auto-resolved conflicts (Requirement 7.4)
  if (mergeResult.autoResolved.length > 0) {
    parts.push(`${mergeResult.autoResolved.length} auto-resolved`)
  }

  // Report file operations
  if (filesUploaded > 0) {
    parts.push(`${filesUploaded} file(s) uploaded`)
  }
  if (filesSkipped > 0) {
    parts.push(`${filesSkipped} file(s) unchanged`)
  }
  if (filesDeleted > 0) {
    parts.push(`${filesDeleted} file(s) deleted`)
  }

  // Report settings sync
  if (settingsSynced) {
    parts.push("settings synced")
  }

  if (parts.length === 0) {
    return "Already in sync"
  }

  return `Sync complete: ${parts.join(", ")}`
}

/**
 * Export saveLastSyncTime for use in state machine
 */
export { saveLastSyncTime }
