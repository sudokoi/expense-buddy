import { Expense } from "../types/expense"
import { SyncNotification } from "../services/sync-manager"
import {
  AppSettings,
  computeSettingsHash,
  DEFAULT_SETTINGS,
} from "../services/settings-manager"
import { shouldAutoSyncForTiming } from "../services/auto-sync-service"
import { syncOrchestrator } from "../services/sync/sync-engine"

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
  /** Whether expense queue has pending operations after sync */
  pendingExpenseOps?: boolean
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
 * Signal an auto-sync for the "on_change" timing.
 *
 * This now sits entirely behind the SyncOrchestrator: it gates on the
 * configured timing and then fires the orchestrator's idempotent, debounced
 * signal. The orchestrator owns the machine, coalesces bursts, gates background
 * runs until the active provider is reconciled, and routes merged
 * results/notifications/settings back into the stores via its bindings — so the
 * caller no longer threads expenses or callbacks through here.
 */
export async function performAutoSyncOnChange(): Promise<void> {
  if (await shouldAutoSyncForTiming("on_change")) {
    syncOrchestrator.requestSync("on_change")
  }
}

/**
 * Signal an auto-sync for the "on_launch" timing.
 *
 * Like {@link performAutoSyncOnChange}, this delegates to the orchestrator. The
 * activation-triggered first reconciliation (which unblocks background runs) is
 * driven separately by `syncOrchestrator.rebindProvider()` on provider
 * activation; this is purely the background launch signal.
 */
export async function performAutoSyncOnLaunch(): Promise<void> {
  if (await shouldAutoSyncForTiming("on_launch")) {
    syncOrchestrator.requestSync("on_launch")
  }
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
