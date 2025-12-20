import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { Expense } from "../types/expense";
import { exportToCSV, importFromCSV } from "./csv-handler";
import {
  uploadCSV,
  downloadCSV,
  validatePAT,
  listFiles,
  deleteFile,
} from "./github-sync";
import {
  groupExpensesByDay,
  getFilenameForDay,
  getDayKeyFromFilename,
} from "./daily-file-manager";
import {
  computeContentHash,
  loadFileHashes,
  saveFileHashes,
  FileHashMap,
} from "./hash-storage";
import { format } from "date-fns";

const GITHUB_TOKEN_KEY = "github_pat";
const GITHUB_REPO_KEY = "github_repo";
const GITHUB_BRANCH_KEY = "github_branch";
const AUTO_SYNC_ENABLED_KEY = "auto_sync_enabled";
const AUTO_SYNC_TIMING_KEY = "auto_sync_timing";

export interface SyncConfig {
  token: string;
  repo: string;
  branch: string;
}

export interface SyncResult {
  success: boolean;
  message: string;
  error?: string;
  // Differential sync reporting fields
  filesUploaded?: number;
  filesSkipped?: number;
  filesDeleted?: number;
}

export type AutoSyncTiming = "on_launch" | "on_change";

export interface AutoSyncSettings {
  enabled: boolean;
  timing: AutoSyncTiming;
}

export interface SyncNotification {
  newItemsCount: number;
  updatedItemsCount: number;
  totalCount: number;
  message: string;
}

// Helper functions for secure storage with platform check
async function secureSetItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function secureGetItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return await AsyncStorage.getItem(key);
  } else {
    return await SecureStore.getItemAsync(key);
  }
}

async function secureDeleteItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

/**
 * Save GitHub sync configuration securely
 */
export async function saveSyncConfig(config: SyncConfig): Promise<void> {
  await secureSetItem(GITHUB_TOKEN_KEY, config.token);
  await secureSetItem(GITHUB_REPO_KEY, config.repo);
  await secureSetItem(GITHUB_BRANCH_KEY, config.branch);
}

/**
 * Load GitHub sync configuration
 */
export async function loadSyncConfig(): Promise<SyncConfig | null> {
  const token = await secureGetItem(GITHUB_TOKEN_KEY);
  const repo = await secureGetItem(GITHUB_REPO_KEY);
  const branch = await secureGetItem(GITHUB_BRANCH_KEY);

  if (!token || !repo || !branch) {
    return null;
  }

  return { token, repo, branch };
}

/**
 * Clear GitHub sync configuration
 */
export async function clearSyncConfig(): Promise<void> {
  await secureDeleteItem(GITHUB_TOKEN_KEY);
  await secureDeleteItem(GITHUB_REPO_KEY);
  await secureDeleteItem(GITHUB_BRANCH_KEY);
}

/**
 * Save auto-sync settings
 */
export async function saveAutoSyncSettings(
  settings: AutoSyncSettings
): Promise<void> {
  await secureSetItem(AUTO_SYNC_ENABLED_KEY, settings.enabled.toString());
  await secureSetItem(AUTO_SYNC_TIMING_KEY, settings.timing);
}

/**
 * Load auto-sync settings
 */
export async function loadAutoSyncSettings(): Promise<AutoSyncSettings> {
  const enabled = await secureGetItem(AUTO_SYNC_ENABLED_KEY);
  let timing = await secureGetItem(AUTO_SYNC_TIMING_KEY);

  // Migrate old "on_expense_entry" to "on_change"
  if (timing === "on_expense_entry") {
    timing = "on_change";
    await secureSetItem(AUTO_SYNC_TIMING_KEY, timing);
  }

  return {
    enabled: enabled === "true",
    timing: (timing as AutoSyncTiming) || "on_launch",
  };
}

/**
 * Test GitHub connection with current config
 */
export async function testConnection(): Promise<SyncResult> {
  const config = await loadSyncConfig();
  if (!config) {
    return {
      success: false,
      message: "No sync configuration found",
      error: "Configuration missing",
    };
  }

  const result = await validatePAT(config.token, config.repo);
  if (result.valid) {
    return { success: true, message: "Connection successful!" };
  } else {
    return {
      success: false,
      message: "Connection failed",
      error: result.error,
    };
  }
}

/**
 * Sync expenses to GitHub (upload) - splits into daily files
 * Uses differential sync to only upload changed files
 * Also deletes files for days that no longer have expenses
 */
export async function syncUp(expenses: Expense[]): Promise<SyncResult> {
  try {
    const config = await loadSyncConfig();
    if (!config) {
      return {
        success: false,
        message: "Sync not configured",
        error: "No configuration",
      };
    }

    // Load stored hashes for differential sync
    const storedHashes = await loadFileHashes();
    const updatedHashes: FileHashMap = {};

    // Get list of existing files on GitHub
    const existingFiles = await listFiles(
      config.token,
      config.repo,
      config.branch
    );
    const existingExpenseFiles = existingFiles
      .filter((file) => getDayKeyFromFilename(file.name) !== null)
      .map((file) => ({
        ...file,
        dayKey: getDayKeyFromFilename(file.name)!,
      }));

    // Group expenses by day
    const groupedByDay = groupExpensesByDay(expenses);
    const localDayKeys = new Set(groupedByDay.keys());

    let uploadedFiles = 0;
    let skippedFiles = 0;
    let failedFiles = 0;
    let deletedFiles = 0;

    // If no expenses, delete all existing files
    if (expenses.length === 0 && existingExpenseFiles.length > 0) {
      for (const file of existingExpenseFiles) {
        const result = await deleteFile(
          config.token,
          config.repo,
          config.branch,
          file.path,
          file.sha
        );

        if (result.success) {
          deletedFiles++;
        } else {
          failedFiles++;
        }
      }

      // Clear all stored hashes since we deleted everything
      await saveFileHashes({});

      return {
        success: failedFiles === 0,
        message: `Deleted all ${deletedFiles} expense file(s) from GitHub`,
        filesUploaded: 0,
        filesSkipped: 0,
        filesDeleted: deletedFiles,
      };
    }

    // Upload each day's file (with differential sync)
    for (const [dayKey, dayExpenses] of groupedByDay.entries()) {
      const filename = getFilenameForDay(dayKey);
      const csvContent = exportToCSV(dayExpenses);
      const contentHash = computeContentHash(csvContent);

      // Check if content has changed
      if (storedHashes[filename] === contentHash) {
        // Content unchanged, skip upload
        skippedFiles++;
        updatedHashes[filename] = contentHash;
        continue;
      }

      // Content changed or new file, upload it
      const result = await uploadCSV(
        config.token,
        config.repo,
        config.branch,
        csvContent,
        filename
      );

      if (result.success) {
        uploadedFiles++;
        updatedHashes[filename] = contentHash;
      } else {
        failedFiles++;
        // Keep old hash if upload failed
        if (storedHashes[filename]) {
          updatedHashes[filename] = storedHashes[filename];
        }
      }
    }

    // Delete files for days that no longer have expenses
    for (const file of existingExpenseFiles) {
      if (!localDayKeys.has(file.dayKey)) {
        const result = await deleteFile(
          config.token,
          config.repo,
          config.branch,
          file.path,
          file.sha
        );

        if (result.success) {
          deletedFiles++;
          // Remove from hashes (don't add to updatedHashes)
        }
      }
    }

    // Save updated hashes
    await saveFileHashes(updatedHashes);

    const message: string[] = [];
    if (uploadedFiles > 0) message.push(`${uploadedFiles} file(s) uploaded`);
    if (skippedFiles > 0) message.push(`${skippedFiles} file(s) unchanged`);
    if (deletedFiles > 0) message.push(`${deletedFiles} file(s) deleted`);

    if (failedFiles === 0) {
      return {
        success: true,
        message: `Synced ${expenses.length} expenses: ${message.join(", ")}`,
        filesUploaded: uploadedFiles,
        filesSkipped: skippedFiles,
        filesDeleted: deletedFiles,
      };
    } else if (uploadedFiles > 0 || deletedFiles > 0 || skippedFiles > 0) {
      return {
        success: true,
        message: `Partially synced: ${message.join(
          ", "
        )}, ${failedFiles} failed`,
        filesUploaded: uploadedFiles,
        filesSkipped: skippedFiles,
        filesDeleted: deletedFiles,
      };
    } else {
      return {
        success: false,
        message: "Upload failed",
        error: "All files failed to upload",
        filesUploaded: 0,
        filesSkipped: 0,
        filesDeleted: 0,
      };
    }
  } catch (error) {
    return { success: false, message: "Sync failed", error: String(error) };
  }
}

/**
 * Sync expenses from GitHub (download) - downloads last N days of files
 */
export async function syncDown(daysToDownload: number = 7): Promise<{
  success: boolean;
  message: string;
  expenses?: Expense[];
  error?: string;
  hasMore?: boolean;
}> {
  try {
    const config = await loadSyncConfig();
    if (!config) {
      return {
        success: false,
        message: "Sync not configured",
        error: "No configuration",
      };
    }

    // List all files in the repository
    const files = await listFiles(config.token, config.repo, config.branch);

    // Filter for expense files (expenses-YYYY-MM-DD.csv)
    const expenseFiles = files
      .filter((file) => getDayKeyFromFilename(file.name) !== null)
      .map((file) => ({
        ...file,
        dayKey: getDayKeyFromFilename(file.name)!,
      }))
      .sort((a, b) => b.dayKey.localeCompare(a.dayKey)); // Sort descending (newest first)

    if (expenseFiles.length === 0) {
      return {
        success: false,
        message: "No expense files found in repository",
        error: "No files found",
      };
    }

    // Take only the requested number of days
    const filesToDownload = expenseFiles.slice(0, daysToDownload);
    const hasMore = expenseFiles.length > daysToDownload;

    // Download and merge selected files
    const allExpenses: Expense[] = [];
    let downloadedFiles = 0;

    for (const file of filesToDownload) {
      const fileData = await downloadCSV(
        config.token,
        config.repo,
        config.branch,
        file.path
      );

      if (fileData) {
        const expenses = importFromCSV(fileData.content);
        allExpenses.push(...expenses);
        downloadedFiles++;
      }
    }

    return {
      success: true,
      message: `Downloaded ${allExpenses.length} expenses from ${downloadedFiles} file(s)`,
      expenses: allExpenses,
      hasMore,
    };
  } catch (error) {
    return { success: false, message: "Download failed", error: String(error) };
  }
}

/**
 * Download additional days of expenses (for "Load More" functionality)
 */
export async function syncDownMore(
  currentExpenses: Expense[],
  additionalDays: number = 7
): Promise<{
  success: boolean;
  message: string;
  expenses?: Expense[];
  error?: string;
  hasMore?: boolean;
}> {
  try {
    const config = await loadSyncConfig();
    if (!config) {
      return {
        success: false,
        message: "Sync not configured",
        error: "No configuration",
      };
    }

    // Get the oldest date from current expenses
    const oldestDate = currentExpenses.reduce((oldest, expense) => {
      const expenseDate = new Date(expense.date);
      return expenseDate < oldest ? expenseDate : oldest;
    }, new Date());

    // List all files in the repository
    const files = await listFiles(config.token, config.repo, config.branch);

    // Filter for expense files older than the oldest current expense
    const expenseFiles = files
      .filter((file) => getDayKeyFromFilename(file.name) !== null)
      .map((file) => ({
        ...file,
        dayKey: getDayKeyFromFilename(file.name)!,
      }))
      .filter((file) => file.dayKey < format(oldestDate, "yyyy-MM-dd"))
      .sort((a, b) => b.dayKey.localeCompare(a.dayKey)); // Sort descending (newest first)

    if (expenseFiles.length === 0) {
      return {
        success: true,
        message: "No more expenses to load",
        expenses: currentExpenses,
        hasMore: false,
      };
    }

    // Take only the requested number of additional days
    const filesToDownload = expenseFiles.slice(0, additionalDays);
    const hasMore = expenseFiles.length > additionalDays;

    // Download and merge selected files
    const newExpenses: Expense[] = [];
    let downloadedFiles = 0;

    for (const file of filesToDownload) {
      const fileData = await downloadCSV(
        config.token,
        config.repo,
        config.branch,
        file.path
      );

      if (fileData) {
        const expenses = importFromCSV(fileData.content);
        newExpenses.push(...expenses);
        downloadedFiles++;
      }
    }

    // Merge with current expenses
    const allExpenses = [...currentExpenses, ...newExpenses];

    return {
      success: true,
      message: `Loaded ${newExpenses.length} more expenses from ${downloadedFiles} file(s)`,
      expenses: allExpenses,
      hasMore,
    };
  } catch (error) {
    return {
      success: false,
      message: "Load more failed",
      error: String(error),
    };
  }
}

const LAST_SYNC_TIME_KEY = "last_sync_time";

/**
 * Get last sync timestamp
 */
async function getLastSyncTime(): Promise<string | null> {
  return await secureGetItem(LAST_SYNC_TIME_KEY);
}

/**
 * Save last sync timestamp
 */
async function saveLastSyncTime(): Promise<void> {
  const now = new Date().toISOString();
  await secureSetItem(LAST_SYNC_TIME_KEY, now);
}

/**
 * Bidirectional sync with timestamp-based conflict resolution
 */
export async function autoSync(
  localExpenses: Expense[]
): Promise<
  SyncResult & { expenses?: Expense[]; notification?: SyncNotification }
> {
  try {
    const lastSyncTime = await getLastSyncTime();
    const downloadResult = await syncDown();

    if (downloadResult.success && downloadResult.expenses) {
      const remoteExpenses = downloadResult.expenses;
      const mergeResult = mergeExpensesWithTimestamps(
        localExpenses,
        remoteExpenses,
        lastSyncTime
      );

      // Upload merged data
      const uploadResult = await syncUp(mergeResult.merged);

      if (uploadResult.success) {
        await saveLastSyncTime();

        // Create notification if there are new or updated items from remote
        let notification: SyncNotification | undefined;
        if (
          mergeResult.newFromRemote > 0 ||
          mergeResult.updatedFromRemote > 0
        ) {
          const totalSynced =
            mergeResult.newFromRemote + mergeResult.updatedFromRemote;
          notification = {
            newItemsCount: mergeResult.newFromRemote,
            updatedItemsCount: mergeResult.updatedFromRemote,
            totalCount: totalSynced,
            message:
              totalSynced === 1
                ? "1 expense synced from GitHub"
                : `${totalSynced} expenses synced from GitHub`,
          };
        }

        return {
          success: true,
          message: `Synced: ${mergeResult.merged.length} expenses (${localExpenses.length} local, ${remoteExpenses.length} remote)`,
          expenses: mergeResult.merged,
          notification,
        };
      } else {
        return {
          success: false,
          message: "Upload after merge failed",
          error: uploadResult.error,
        };
      }
    } else {
      // No remote data, just upload local
      const uploadResult = await syncUp(localExpenses);
      if (uploadResult.success) {
        await saveLastSyncTime();
      }
      return {
        success: uploadResult.success,
        message: uploadResult.message,
        error: uploadResult.error,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: "Auto-sync failed",
      error: String(error),
    };
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
  const localMap = new Map(local.map((e) => [e.id, e]));
  const remoteMap = new Map(remote.map((e) => [e.id, e]));
  const merged: Expense[] = [];
  let newFromRemote = 0;
  let updatedFromRemote = 0;

  // Process all unique IDs
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);

  for (const id of allIds) {
    const localItem = localMap.get(id);
    const remoteItem = remoteMap.get(id);

    if (localItem && remoteItem) {
      // Conflict: exists in both - keep the newer one based on updatedAt
      const localTime = new Date(localItem.updatedAt).getTime();
      const remoteTime = new Date(remoteItem.updatedAt).getTime();
      if (remoteTime > localTime) {
        merged.push(remoteItem);
        updatedFromRemote++;
      } else {
        merged.push(localItem);
      }
    } else if (localItem) {
      // Only in local - keep it
      merged.push(localItem);
    } else if (remoteItem) {
      // Only in remote - check if it was deleted locally
      if (lastSyncTime) {
        const lastSync = new Date(lastSyncTime).getTime();
        const itemUpdated = new Date(remoteItem.updatedAt).getTime();

        // If last sync is newer than the item, it means we saw this item before
        // and it's gone now from local, so it was deleted - don't restore it
        if (lastSync > itemUpdated) {
          continue;
        }
      }
      // It's a new remote item or we don't have sync history - add it
      merged.push(remoteItem);
      newFromRemote++;
    }
  }

  // Sort by creation date (newest first)
  const sortedMerged = merged.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return {
    merged: sortedMerged,
    newFromRemote,
    updatedFromRemote,
  };
}

/**
 * Get the count of files that will be uploaded/deleted in the next sync
 * This compares current content hashes with stored hashes to determine changes
 */
export async function getPendingSyncCount(expenses: Expense[]): Promise<{
  filesChanged: number;
  filesUnchanged: number;
  filesToDelete: number;
}> {
  try {
    const storedHashes = await loadFileHashes();
    const groupedByDay = groupExpensesByDay(expenses);

    let filesChanged = 0;
    let filesUnchanged = 0;

    // Check each day's expenses against stored hashes
    for (const [dayKey, dayExpenses] of groupedByDay.entries()) {
      const filename = getFilenameForDay(dayKey);
      const csvContent = exportToCSV(dayExpenses);
      const contentHash = computeContentHash(csvContent);

      if (storedHashes[filename] === contentHash) {
        filesUnchanged++;
      } else {
        filesChanged++;
      }
    }

    // Count files to delete (exist in stored hashes but not in local data)
    const localFilenames = new Set(
      Array.from(groupedByDay.keys()).map(getFilenameForDay)
    );
    const filesToDelete = Object.keys(storedHashes).filter(
      (filename) => !localFilenames.has(filename)
    ).length;

    return { filesChanged, filesUnchanged, filesToDelete };
  } catch (error) {
    console.warn("Failed to compute pending sync count:", error);
    // Return all as changed if we can't compute (safe fallback)
    const groupedByDay = groupExpensesByDay(expenses);
    return {
      filesChanged: groupedByDay.size,
      filesUnchanged: 0,
      filesToDelete: 0,
    };
  }
}

/**
 * Migrate from old single-file format to new daily-file format
 * This checks if the old expenses.csv exists and migrates it to daily files
 */
export async function migrateToDailyFiles(): Promise<{
  migrated: boolean;
  message: string;
}> {
  try {
    const config = await loadSyncConfig();
    if (!config) {
      return { migrated: false, message: "No sync configuration" };
    }

    // Check if old expenses.csv exists
    const oldFile = await downloadCSV(
      config.token,
      config.repo,
      config.branch,
      "expenses.csv"
    );

    if (!oldFile) {
      // No old file, nothing to migrate
      return { migrated: false, message: "No old file to migrate" };
    }

    // Parse old file
    const expenses = importFromCSV(oldFile.content);

    if (expenses.length === 0) {
      return { migrated: false, message: "Old file is empty" };
    }

    // Upload as daily files
    const result = await syncUp(expenses);

    if (result.success) {
      return {
        migrated: true,
        message: `Migrated ${expenses.length} expenses to daily files`,
      };
    } else {
      return {
        migrated: false,
        message: `Migration failed: ${result.error}`,
      };
    }
  } catch (error) {
    return {
      migrated: false,
      message: `Migration error: ${String(error)}`,
    };
  }
}
