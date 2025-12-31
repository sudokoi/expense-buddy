import { Expense } from "../types/expense"
import {
  autoSync,
  loadAutoSyncSettings,
  loadSyncConfig,
  SyncNotification,
} from "./sync-manager"
import { AppSettings, loadSettings } from "./settings-manager"

/**
 * Main auto-sync orchestration function
 * Checks if auto-sync is enabled and performs sync if configured
 */
export async function performAutoSyncIfEnabled(localExpenses: Expense[]): Promise<{
  synced: boolean
  expenses?: Expense[]
  notification?: SyncNotification
  downloadedSettings?: AppSettings
  error?: string
}> {
  try {
    // Check if auto-sync is enabled
    const autoSyncSettings = await loadAutoSyncSettings()
    if (!autoSyncSettings.enabled) {
      return { synced: false }
    }

    // Check if GitHub sync is configured
    const config = await loadSyncConfig()
    if (!config) {
      return { synced: false }
    }

    // Load current app settings to check if settings sync is enabled
    const appSettings = await loadSettings()

    // Perform the sync with settings if enabled
    const result = await autoSync(
      localExpenses,
      appSettings.syncSettings ? appSettings : undefined,
      appSettings.syncSettings
    )

    if (result.success && result.expenses) {
      return {
        synced: true,
        expenses: result.expenses,
        notification: result.notification,
        downloadedSettings: result.downloadedSettings,
      }
    } else {
      return {
        synced: false,
        error: result.error || result.message,
        downloadedSettings: result.downloadedSettings,
      }
    }
  } catch (error) {
    console.error("Auto-sync failed:", error)
    return {
      synced: false,
      error: String(error),
    }
  }
}

/**
 * Check if auto-sync should run for the given timing
 */
export async function shouldAutoSyncForTiming(
  timing: "on_launch" | "on_change"
): Promise<boolean> {
  const settings = await loadAutoSyncSettings()
  return settings.enabled && settings.timing === timing
}
