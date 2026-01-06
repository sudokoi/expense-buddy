import * as SecureStore from "expo-secure-store"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { Platform } from "react-native"
import { Expense } from "../types/expense"
import { exportToCSV, importFromCSV } from "./csv-handler"
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

const GITHUB_TOKEN_KEY = "github_pat"
const GITHUB_REPO_KEY = "github_repo"
const GITHUB_BRANCH_KEY = "github_branch"

export interface SyncConfig {
  token: string
  repo: string
  branch: string
}

export interface SyncResult {
  success: boolean
  message: string
  error?: string
  // Differential sync reporting fields
  filesUploaded?: number
  filesSkipped?: number
  filesDeleted?: number
  // Settings sync reporting fields
  settingsSynced?: boolean
  settingsSkipped?: boolean
  settingsError?: string
  // Timestamp of the commit if one was created
  commitTimestamp?: string
}

export interface SyncNotification {
  newItemsCount: number
  updatedItemsCount: number
  totalCount: number
  message: string
}

// Helper functions for secure storage with platform check
async function secureSetItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(key, value)
  } else {
    await SecureStore.setItemAsync(key, value)
  }
}

async function secureGetItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return await AsyncStorage.getItem(key)
  } else {
    return await SecureStore.getItemAsync(key)
  }
}

async function secureDeleteItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(key)
  } else {
    await SecureStore.deleteItemAsync(key)
  }
}

/**
 * Save GitHub sync configuration securely
 */
export async function saveSyncConfig(config: SyncConfig): Promise<void> {
  await secureSetItem(GITHUB_TOKEN_KEY, config.token)
  await secureSetItem(GITHUB_REPO_KEY, config.repo)
  await secureSetItem(GITHUB_BRANCH_KEY, config.branch)
}

/**
 * Load GitHub sync configuration
 */
export async function loadSyncConfig(): Promise<SyncConfig | null> {
  const token = await secureGetItem(GITHUB_TOKEN_KEY)
  const repo = await secureGetItem(GITHUB_REPO_KEY)
  const branch = await secureGetItem(GITHUB_BRANCH_KEY)

  if (!token || !repo || !branch) {
    return null
  }

  return { token, repo, branch }
}

/**
 * Clear GitHub sync configuration
 */
export async function clearSyncConfig(): Promise<void> {
  await secureDeleteItem(GITHUB_TOKEN_KEY)
  await secureDeleteItem(GITHUB_REPO_KEY)
  await secureDeleteItem(GITHUB_BRANCH_KEY)
}

/**
 * Test GitHub connection with current config
 */
export async function testConnection(): Promise<SyncResult> {
  const config = await loadSyncConfig()
  if (!config) {
    return {
      success: false,
      message: "No sync configuration found",
      error: "Configuration missing",
    }
  }

  const result = await validatePAT(config.token, config.repo)
  if (result.valid) {
    return { success: true, message: "Connection successful!" }
  } else {
    return {
      success: false,
      message: "Connection failed",
      error: result.error,
    }
  }
}

/**
 * Sync direction types for the unified sync button
 */
export type SyncDirection = "push" | "pull" | "conflict" | "in_sync" | "error"

/**
 * Result of determining sync direction
 */
export interface SyncDirectionResult {
  direction: SyncDirection
  localTime: string | null
  remoteTime: string | null
  error?: string
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
      return {
        direction: "error",
        localTime: localLastSync,
        remoteTime: null,
        error: remoteResult.error,
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
    return {
      direction: "error",
      localTime: null,
      remoteTime: null,
      error: String(error),
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
    const filesToDelete: BatchFileDelete[] = []
    for (const file of existingExpenseFiles) {
      if (!localDayKeys.has(file.dayKey)) {
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
    return { success: false, message: "Sync failed", error: String(error) }
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
            downloadedSettings = JSON.parse(settingsResult.content) as AppSettings
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
          downloadedSettings = JSON.parse(settingsResult.content) as AppSettings
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

    return {
      success: true,
      message: messageParts.join(", "),
      expenses: allExpenses,
      settings: downloadedSettings,
      hasMore,
      settingsDownloaded,
    }
  } catch (error) {
    return { success: false, message: "Download failed", error: String(error) }
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
    return {
      success: false,
      message: "Load more failed",
      error: String(error),
    }
  }
}

const LAST_SYNC_TIME_KEY = "last_sync_time"

/**
 * Get last sync timestamp
 */
async function getLastSyncTime(): Promise<string | null> {
  return await secureGetItem(LAST_SYNC_TIME_KEY)
}

/**
 * Save last sync timestamp
 */
async function saveLastSyncTime(timestamp?: string): Promise<void> {
  const now = timestamp || new Date().toISOString()
  await secureSetItem(LAST_SYNC_TIME_KEY, now)
}

/**
 * Bidirectional sync with timestamp-based conflict resolution
 * Optionally includes settings sync if settings and syncSettingsEnabled are provided
 */
export async function autoSync(
  localExpenses: Expense[],
  settings?: AppSettings,
  syncSettingsEnabled?: boolean
): Promise<
  SyncResult & {
    expenses?: Expense[]
    notification?: SyncNotification
    downloadedSettings?: AppSettings
  }
> {
  try {
    const lastSyncTime = await getLastSyncTime()
    const downloadResult = await syncDown(7, syncSettingsEnabled)

    if (downloadResult.success && downloadResult.expenses) {
      const remoteExpenses = downloadResult.expenses
      const mergeResult = mergeExpensesWithTimestamps(
        localExpenses,
        remoteExpenses,
        lastSyncTime
      )

      // Upload merged data (with settings if enabled)
      const uploadResult = await syncUp(mergeResult.merged, settings, syncSettingsEnabled)

      if (uploadResult.success) {
        // If we got a commit timestamp, use it. Otherwise use current time.
        await saveLastSyncTime(uploadResult.commitTimestamp)

        // Create notification if there are new or updated items from remote
        let notification: SyncNotification | undefined
        if (mergeResult.newFromRemote > 0 || mergeResult.updatedFromRemote > 0) {
          const totalSynced = mergeResult.newFromRemote + mergeResult.updatedFromRemote
          notification = {
            newItemsCount: mergeResult.newFromRemote,
            updatedItemsCount: mergeResult.updatedFromRemote,
            totalCount: totalSynced,
            message:
              totalSynced === 1
                ? "1 expense synced from GitHub"
                : `${totalSynced} expenses synced from GitHub`,
          }
        }

        return {
          success: true,
          message: `Synced: ${mergeResult.merged.length} expenses (${localExpenses.length} local, ${remoteExpenses.length} remote)`,
          expenses: mergeResult.merged,
          notification,
          downloadedSettings: downloadResult.settings,
          settingsSynced: uploadResult.settingsSynced,
          settingsSkipped: uploadResult.settingsSkipped,
        }
      } else {
        // Upload failed - report partial success if settings were downloaded
        if (downloadResult.settingsDownloaded && downloadResult.settings) {
          return {
            success: false,
            message: "Expenses upload failed, but settings were downloaded",
            error: uploadResult.error,
            downloadedSettings: downloadResult.settings,
          }
        }
        return {
          success: false,
          message: "Upload after merge failed",
          error: uploadResult.error,
        }
      }
    } else {
      // No remote expense data, just upload local
      const uploadResult = await syncUp(localExpenses, settings, syncSettingsEnabled)
      if (uploadResult.success) {
        // If we got a commit timestamp, use it. Otherwise use current time.
        await saveLastSyncTime(uploadResult.commitTimestamp)
      }

      // Even if expense download failed, we might have settings
      return {
        success: uploadResult.success,
        message: uploadResult.message,
        error: uploadResult.error,
        downloadedSettings: downloadResult.settings,
        settingsSynced: uploadResult.settingsSynced,
        settingsSkipped: uploadResult.settingsSkipped,
      }
    }
  } catch (error) {
    return {
      success: false,
      message: "Auto-sync failed",
      error: String(error),
    }
  }
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
function mergeExpensesWithTimestamps(
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

export interface ConflictInfo {
  localWins: number // Local records that are newer
  remoteWins: number // Remote records that are newer
  newFromRemote: number // New records from remote
  newFromLocal: number // New records from local (not on remote)
  deletedLocally: number // Records deleted locally that exist on remote
}

/**
 * Analyze what would happen if we merge local and remote expenses
 * This helps show users what conflicts exist before merging
 */
export async function analyzeConflicts(localExpenses: Expense[]): Promise<{
  success: boolean
  conflicts?: ConflictInfo
  remoteExpenses?: Expense[]
  error?: string
}> {
  try {
    const config = await loadSyncConfig()
    if (!config) {
      return { success: false, error: "No sync configuration" }
    }

    const downloadResult = await syncDown()
    if (!downloadResult.success || !downloadResult.expenses) {
      return {
        success: false,
        error: downloadResult.error || "Download failed",
      }
    }

    const remoteExpenses = downloadResult.expenses
    const lastSyncTime = await getLastSyncTime()

    const localMap = new Map(localExpenses.map((e) => [e.id, e]))
    const remoteMap = new Map(remoteExpenses.map((e) => [e.id, e]))

    let localWins = 0
    let remoteWins = 0
    let newFromRemote = 0
    let newFromLocal = 0
    let deletedLocally = 0

    const allIds = new Set([...localMap.keys(), ...remoteMap.keys()])

    for (const id of allIds) {
      const localItem = localMap.get(id)
      const remoteItem = remoteMap.get(id)

      if (localItem && remoteItem) {
        const localTime = new Date(localItem.updatedAt).getTime()
        const remoteTime = new Date(remoteItem.updatedAt).getTime()
        if (remoteTime > localTime) {
          remoteWins++
        } else if (localTime > remoteTime) {
          localWins++
        }
        // If equal timestamps, no conflict
      } else if (localItem && !remoteItem) {
        newFromLocal++
      } else if (remoteItem && !localItem) {
        if (lastSyncTime) {
          const lastSync = new Date(lastSyncTime).getTime()
          const itemUpdated = new Date(remoteItem.updatedAt).getTime()
          if (lastSync > itemUpdated) {
            deletedLocally++
          } else {
            newFromRemote++
          }
        } else {
          newFromRemote++
        }
      }
    }

    return {
      success: true,
      conflicts: {
        localWins,
        remoteWins,
        newFromRemote,
        newFromLocal,
        deletedLocally,
      },
      remoteExpenses,
    }
  } catch (error) {
    return { success: false, error: String(error) }
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
