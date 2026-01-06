import { createActor, waitFor } from "xstate"
import { Expense } from "../types/expense"
import { loadSyncConfig, SyncNotification } from "./sync-manager"
import { AppSettings, loadSettings } from "./settings-manager"
import { syncMachine } from "./sync-machine"

/**
 * Main auto-sync orchestration function
 * Uses the XState sync machine for background sync operations
 */
export async function performAutoSyncIfEnabled(localExpenses: Expense[]): Promise<{
  synced: boolean
  expenses?: Expense[]
  notification?: SyncNotification
  downloadedSettings?: AppSettings
  error?: string
}> {
  try {
    // Load current app settings to check if auto-sync and settings sync are enabled
    const appSettings = await loadSettings()

    // Check if auto-sync is enabled
    if (!appSettings.autoSyncEnabled) {
      return { synced: false }
    }

    // Check if GitHub sync is configured
    const config = await loadSyncConfig()
    if (!config) {
      return { synced: false }
    }

    // Create and start the sync machine actor for background operation
    const actor = createActor(syncMachine)
    actor.start()

    // Calculate if there are local changes (simplified - assume there are if called)
    const hasLocalChanges = localExpenses.length > 0

    // Send the SYNC event with the current state
    actor.send({
      type: "SYNC",
      localExpenses,
      settings: appSettings.syncSettings ? appSettings : undefined,
      syncSettingsEnabled: appSettings.syncSettings,
      hasLocalChanges,
    })

    // Wait for the machine to reach a final state
    const finalSnapshot = await waitFor(
      actor,
      (snapshot) =>
        snapshot.matches("success") ||
        snapshot.matches("inSync") ||
        snapshot.matches("error") ||
        snapshot.matches("conflict"),
      { timeout: 60000 } // 60 second timeout
    )

    actor.stop()

    const state = finalSnapshot.value
    const context = finalSnapshot.context

    if (state === "success") {
      // Build notification from sync result
      let notification: SyncNotification | undefined
      if (context.syncResult) {
        notification = {
          newItemsCount: 0,
          updatedItemsCount: context.syncResult.filesUploaded || 0,
          totalCount: localExpenses.length,
          message: context.syncResult.message,
        }
      } else if (context.downloadedExpenses) {
        notification = {
          newItemsCount: context.downloadedExpenses.length,
          updatedItemsCount: 0,
          totalCount: context.downloadedExpenses.length,
          message: `Downloaded ${context.downloadedExpenses.length} expenses`,
        }
      }

      return {
        synced: true,
        expenses: context.downloadedExpenses || localExpenses,
        notification,
        downloadedSettings: context.downloadedSettings,
      }
    } else if (state === "inSync") {
      return { synced: true, expenses: localExpenses }
    } else if (state === "conflict") {
      // For auto-sync, we don't show conflict dialogs - just skip
      return {
        synced: false,
        error: "Conflict detected - manual sync required",
      }
    } else {
      return {
        synced: false,
        error: context.error || "Sync failed",
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
  const settings = await loadSettings()
  return settings.autoSyncEnabled && settings.autoSyncTiming === timing
}
