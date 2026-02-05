import { createActor, waitFor } from "xstate"
import { Expense } from "../types/expense"
import { loadSyncConfig, SyncNotification, type GitStyleSyncResult } from "./sync-manager"
import { AppSettings, loadSettings } from "./settings-manager"
import { syncMachine } from "./sync-machine"
import i18next from "i18next"
import {
  applyQueuedOpsToExpenses,
  applyQueuedOpsToSettings,
  clearSyncOpsUpTo,
  getSyncOpsSince,
  getSyncQueueWatermark,
} from "./sync-queue"

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
  pendingExpenseOps?: boolean
}> {
  try {
    // Load current app settings to check if auto-sync and settings sync are enabled
    let appSettings = await loadSettings()

    // Check if auto-sync is enabled
    if (!appSettings.autoSyncEnabled) {
      return { synced: false }
    }

    // Check if GitHub sync is configured
    const config = await loadSyncConfig()
    if (!config) {
      return { synced: false }
    }

    let currentExpenses = localExpenses
    let followUpRemaining = appSettings.autoSyncTiming === "on_change" ? 3 : 0
    let pendingExpenseOps = false
    let lastNotification: SyncNotification | undefined
    let lastDownloadedSettings: AppSettings | undefined

    while (true) {
      const watermark = await getSyncQueueWatermark()

      // Create and start the sync machine actor for background operation
      const actor = createActor(syncMachine)
      actor.start()

      // Send the SYNC event with the current state
      // Note: git-style sync doesn't need hasLocalChanges - it always does fetch-merge-push
      actor.send({
        type: "SYNC",
        localExpenses: currentExpenses,
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

      const context = finalSnapshot.context
      const syncResult = context.syncResult as GitStyleSyncResult | undefined

      if (finalSnapshot.matches("conflict")) {
        return {
          synced: false,
          error: "Conflict detected - manual sync required",
        }
      }

      if (finalSnapshot.matches("error")) {
        return {
          synced: false,
          error: context.error || "Sync failed",
        }
      }

      const mergeResult = context.mergeResult
      const baseExpenses = mergeResult?.merged ?? currentExpenses
      let opsAfter = await getSyncOpsSince(watermark)
      if (opsAfter.length === 0) {
        const latestWatermark = await getSyncQueueWatermark()
        if (latestWatermark > watermark) {
          opsAfter = await getSyncOpsSince(watermark)
        }
      }
      const hasSettingsOps = opsAfter.some(
        (op) => op.type.startsWith("settings.") || op.type.startsWith("category.")
      )
      const pendingOpsAny = opsAfter.length > 0
      pendingExpenseOps = opsAfter.some((op) => op.type.startsWith("expense."))
      const reconciledExpenses = applyQueuedOpsToExpenses(baseExpenses, opsAfter)

      let reconciledSettings: AppSettings | undefined
      if (syncResult?.mergedSettings || syncResult?.mergedCategories || hasSettingsOps) {
        let settingsBase = appSettings
        if (syncResult?.mergedSettings) {
          settingsBase = syncResult.mergedSettings
        } else if (syncResult?.mergedCategories) {
          settingsBase = { ...settingsBase, categories: syncResult.mergedCategories }
        }
        reconciledSettings = applyQueuedOpsToSettings(settingsBase, opsAfter)
      }

      const lastAppliedId =
        opsAfter.length > 0 ? opsAfter[opsAfter.length - 1].id : watermark
      await clearSyncOpsUpTo(lastAppliedId)

      if (syncResult) {
        const localFilesUpdated = syncResult.localFilesUpdated ?? 0
        const remoteFilesUpdated = syncResult.remoteFilesUpdated ?? 0
        lastNotification = {
          localFilesUpdated,
          remoteFilesUpdated,
          message: i18next.t("settings.notifications.syncComplete", {
            localCount: localFilesUpdated,
            remoteCount: remoteFilesUpdated,
          }),
        }
      }

      lastDownloadedSettings = reconciledSettings
      currentExpenses = reconciledExpenses
      if (reconciledSettings) {
        appSettings = reconciledSettings
      }

      if (!pendingOpsAny || followUpRemaining <= 0) {
        if (pendingOpsAny) {
          lastNotification = {
            localFilesUpdated: 0,
            remoteFilesUpdated: 0,
            message: "Pending changes detected. Please sync manually.",
          }
        }
        return {
          synced: true,
          expenses: reconciledExpenses,
          notification: lastNotification,
          downloadedSettings: lastDownloadedSettings,
          pendingExpenseOps,
        }
      }

      followUpRemaining -= 1
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
