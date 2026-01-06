import { createActor, waitFor } from "xstate"
import { Expense } from "../types/expense"
import { loadSyncConfig, SyncNotification } from "./sync-manager"
import { AppSettings, loadSettings } from "./settings-manager"
import { syncMachine } from "./sync-machine"

/**
 * Main auto-sync orchestration function
 * Uses the XState sync machine for background sync operations
 *
 * Updated for git-style sync: uses unified fetch-merge-push flow
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

    // Send the SYNC event with the current state
    // Note: git-style sync doesn't need hasLocalChanges - it always does fetch-merge-push
    actor.send({
      type: "SYNC",
      localExpenses,
      settings: appSettings.syncSettings ? appSettings : undefined,
      syncSettingsEnabled: appSettings.syncSettings,
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
      // Build notification from merge result
      let notification: SyncNotification | undefined
      const mergeResult = context.mergeResult

      if (mergeResult) {
        const addedCount = mergeResult.addedFromRemote.length
        const updatedCount = mergeResult.updatedFromRemote.length
        const totalMerged = mergeResult.merged.length

        notification = {
          newItemsCount: addedCount,
          updatedItemsCount: updatedCount,
          totalCount: totalMerged,
          message: context.syncResult?.message || "Sync complete",
        }

        // Return merged expenses (includes both local and remote changes)
        return {
          synced: true,
          expenses: mergeResult.merged,
          notification,
        }
      } else if (context.syncResult) {
        notification = {
          newItemsCount: 0,
          updatedItemsCount: context.syncResult.filesUploaded || 0,
          totalCount: localExpenses.length,
          message: context.syncResult.message,
        }

        return {
          synced: true,
          expenses: localExpenses,
          notification,
        }
      }

      return { synced: true, expenses: localExpenses }
    } else if (state === "inSync") {
      return { synced: true, expenses: localExpenses }
    } else if (state === "conflict") {
      // For auto-sync, we don't show conflict dialogs - just skip
      // User needs to manually sync to resolve conflicts
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
