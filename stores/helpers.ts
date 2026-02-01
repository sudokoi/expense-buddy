import { Expense } from "../types/expense"
import { SyncNotification } from "../services/sync-manager"
import {
  AppSettings,
  computeSettingsHash,
  DEFAULT_SETTINGS,
} from "../services/settings-manager"
import {
  performAutoSyncIfEnabled,
  shouldAutoSyncForTiming,
} from "../services/auto-sync-service"
import { clearDirtyDays } from "../services/expense-dirty-days"

/**
 * Result of an auto-sync operation
 */
export interface AutoSyncResult {
  /** Whether sync was performed */
  synced: boolean
  /** Updated expenses after merge (if sync was successful) */
  expenses?: Expense[]
  /** Notification to display to user */
  notification?: SyncNotification
  /** Downloaded settings from remote (if settings sync is enabled) */
  downloadedSettings?: AppSettings
  /** Error message if sync failed */
  error?: string
}

/**
 * Callbacks for handling auto-sync results
 * These allow the caller to update store state based on sync results
 */
export interface AutoSyncCallbacks {
  /** Called when expenses should be replaced with merged results */
  onExpensesReplaced: (expenses: Expense[]) => void
  /** Called when dirty-day state should be cleared */
  onDirtyDaysCleared: () => void
  /** Called when a sync notification should be displayed */
  onSyncNotification: (notification: SyncNotification) => void
  /** Called when settings were downloaded from remote */
  onSettingsDownloaded?: (settings: AppSettings) => void
}

/**
 * Perform auto-sync if enabled and timing matches "on_change"
 *
 * This helper encapsulates the common auto-sync pattern used across expense store actions.
 * It checks if auto-sync should run, performs the sync, and invokes callbacks to update state.
 *
 * @param expenses - Current expenses to sync
 * @param callbacks - Callbacks for handling sync results
 * @returns AutoSyncResult with sync status and any updated data
 */
export async function performAutoSyncOnChange(
  expenses: Expense[],
  callbacks: AutoSyncCallbacks
): Promise<AutoSyncResult> {
  const shouldSync = await shouldAutoSyncForTiming("on_change")
  if (!shouldSync) {
    return { synced: false }
  }

  const result = await performAutoSyncIfEnabled(expenses)

  if (result.synced && result.expenses) {
    callbacks.onExpensesReplaced(result.expenses)
    await clearDirtyDays()
    callbacks.onDirtyDaysCleared()

    if (result.notification) {
      callbacks.onSyncNotification(result.notification)
    }

    if (result.downloadedSettings && callbacks.onSettingsDownloaded) {
      callbacks.onSettingsDownloaded(result.downloadedSettings)
    }
  }

  return result
}

/**
 * Perform auto-sync if enabled and timing matches "on_launch"
 *
 * Similar to performAutoSyncOnChange but for app launch timing.
 *
 * @param expenses - Current expenses to sync
 * @param callbacks - Callbacks for handling sync results
 * @returns AutoSyncResult with sync status and any updated data
 */
export async function performAutoSyncOnLaunch(
  expenses: Expense[],
  callbacks: AutoSyncCallbacks
): Promise<AutoSyncResult> {
  const shouldSync = await shouldAutoSyncForTiming("on_launch")
  if (!shouldSync) {
    return { synced: false }
  }

  const result = await performAutoSyncIfEnabled(expenses)

  if (result.synced && result.expenses) {
    callbacks.onExpensesReplaced(result.expenses)
    await clearDirtyDays()
    callbacks.onDirtyDaysCleared()

    if (result.notification) {
      callbacks.onSyncNotification(result.notification)
    }

    if (result.downloadedSettings && callbacks.onSettingsDownloaded) {
      callbacks.onSettingsDownloaded(result.downloadedSettings)
    }
  } else if (result.downloadedSettings && callbacks.onSettingsDownloaded) {
    // Settings can be downloaded even if expenses weren't synced
    callbacks.onSettingsDownloaded(result.downloadedSettings)
  }

  return result
}

/**
 * Settings sync state enum
 * - "synced": Current settings match the last synced version
 * - "modified": Local changes pending sync
 */
export type SettingsSyncState = "synced" | "modified"

/**
 * Compute settings sync state by comparing current settings hash against synced hash
 *
 * This helper determines whether local settings have been modified since the last sync.
 * It's used by the settings store to track whether settings need to be uploaded.
 *
 * @param currentSettings - Current app settings
 * @param syncedHash - Hash of settings from last successful sync (null if never synced)
 * @returns "synced" if settings match, "modified" if local changes exist
 */
export function computeSettingsSyncState(
  currentSettings: AppSettings,
  syncedHash: string | null
): SettingsSyncState {
  const currentHash = computeSettingsHash(currentSettings)

  if (!syncedHash) {
    // No previous sync - check if settings differ from defaults
    const defaultHash = computeSettingsHash(DEFAULT_SETTINGS)
    return currentHash === defaultHash ? "synced" : "modified"
  }

  return currentHash === syncedHash ? "synced" : "modified"
}
