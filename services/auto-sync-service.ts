import { createActor, waitFor } from "xstate"
import { Expense } from "../types/expense"
import { AppSettings, loadSettings } from "./settings-manager"
import { syncMachine } from "./sync-machine"
import { createProvider } from "./sync/provider-registry"
import { getActiveProviderConfig } from "./sync-config"
import type { SyncNotification } from "../types/sync"
import i18next from "i18next"
import { loadDirtyDays } from "./expense-dirty-days"
import {
  applyQueuedOpsToExpenses,
  applyQueuedOpsToSettings,
  clearSyncOpsUpTo,
  getMinSyncedWatermark,
  getProviderWatermark,
  getSyncOpsSince,
  getSyncQueueWatermark,
  isProviderReconciled,
  markProviderReconciled,
  setProviderWatermark,
} from "./sync-queue"

// Register provider factories at import time
import "./sync"

/**
 * Main auto-sync orchestration function
 * Uses the XState sync machine for background sync operations with provider-based flow
 */
export async function performAutoSyncIfEnabled(localExpenses: Expense[]): Promise<{
  synced: boolean
  expenses?: Expense[]
  notification?: SyncNotification
  downloadedSettings?: AppSettings
  error?: string
  errorCode?: string
  pendingExpenseOps?: boolean
}> {
  try {
    let appSettings = await loadSettings()

    if (!appSettings.autoSyncEnabled) {
      return { synced: false }
    }

    const activeProviderConfig = await getActiveProviderConfig()
    if (!activeProviderConfig) {
      return { synced: false }
    }

    const provider = createProvider(activeProviderConfig)
    const providerId = activeProviderConfig.id

    let currentExpenses = localExpenses
    let followUpRemaining = appSettings.autoSyncTiming === "on_change" ? 3 : 0
    let pendingExpenseOps = false
    let lastNotification: SyncNotification | undefined
    let lastDownloadedSettings: AppSettings | undefined

    while (true) {
      let watermark = await getProviderWatermark(providerId)
      if (watermark === null) {
        watermark = await getSyncQueueWatermark()
        await setProviderWatermark(providerId, watermark)
      }

      const dirtyDaysState = await loadDirtyDays()
      const dirtyDays = dirtyDaysState.state.dirtyDays ?? []
      const deletedDays = dirtyDaysState.state.deletedDays ?? []

      const actor = createActor(syncMachine, {
        input: { provider },
      })
      actor.start()

      actor.send({
        type: "SYNC",
        localExpenses: currentExpenses,
        dirtyDays,
        deletedDays,
        settings: appSettings.syncSettings ? appSettings : undefined,
        syncSettingsEnabled: appSettings.syncSettings,
        callbacks: {
          onAuthError: (info) => {
            console.warn(
              "[AutoSync] Auth error:",
              info.errorCode,
              "shouldSignOut:",
              info.shouldSignOut
            )
          },
        },
      })

      const finalSnapshot = await waitFor(
        actor,
        (snapshot) =>
          snapshot.matches("success") ||
          snapshot.matches("inSync") ||
          snapshot.matches("error") ||
          snapshot.matches("conflict"),
        { timeout: 60000 }
      )

      actor.stop()

      const context = finalSnapshot.context

      if (finalSnapshot.matches("conflict")) {
        return {
          synced: false,
          error: i18next.t("githubSync.manager.conflictManualSync"),
        }
      }

      if (finalSnapshot.matches("error")) {
        return {
          synced: false,
          error: context.error || i18next.t("githubSync.manager.syncFailed"),
          errorCode: context.errorCode,
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
      if (hasSettingsOps) {
        const settingsBase = appSettings
        reconciledSettings = applyQueuedOpsToSettings(settingsBase, opsAfter)
      }

      const lastAppliedId =
        opsAfter.length > 0 ? opsAfter[opsAfter.length - 1].id : watermark
      await setProviderWatermark(providerId, lastAppliedId)

      if (!(await isProviderReconciled(providerId))) {
        await markProviderReconciled(providerId)
      }

      const minWatermark = await getMinSyncedWatermark()
      if (minWatermark > 0) {
        await clearSyncOpsUpTo(minWatermark)
      }

      if (mergeResult) {
        const localFilesUpdated =
          (mergeResult.addedFromLocal.length ?? 0) +
          (mergeResult.updatedFromLocal.length ?? 0)
        const remoteFilesUpdated =
          (mergeResult.addedFromRemote.length ?? 0) +
          (mergeResult.updatedFromRemote.length ?? 0)
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
            message: i18next.t("settings.notifications.pendingChanges"),
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
    console.error("[AutoSync] Failed:", error)
    return {
      synced: false,
      error: String(error),
    }
  }
}

export async function shouldAutoSyncForTiming(
  timing: "on_launch" | "on_change"
): Promise<boolean> {
  const settings = await loadSettings()
  return settings.autoSyncEnabled && settings.autoSyncTiming === timing
}
