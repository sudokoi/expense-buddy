/**
 * Shared sync action hook
 *
 * Encapsulates the full git-style sync flow (fetch → merge → push) including
 * conflict resolution and post-sync reconciliation (clearing dirty days,
 * settings change flags, and applying queued ops that landed during the sync).
 *
 * The pending sync count is read from shared store state, so it stays correct
 * no matter which screen triggers the sync — every consumer sees the same value.
 */
import { useCallback, useMemo, useRef } from "react"
import { Alert } from "react-native"
import { useTranslation } from "react-i18next"
import { useExpenses, useNotifications, useSettings } from "../stores/hooks"
import { useSyncMachine, TrueConflict, ConflictResolution } from "./use-sync-machine"
import {
  applyQueuedOpsToExpenses,
  applyQueuedOpsToSettings,
  clearSyncOpsUpTo,
  getSyncOpsSince,
  getSyncQueueWatermark,
} from "../services/sync-queue"
import { loadDirtyDays, saveDirtyDays } from "../services/expense-dirty-days"

export interface UseSyncActionReturn {
  /** Run a full sync with conflict resolution and post-sync reconciliation. */
  handleSync: () => Promise<void>
  /** Whether a sync is currently in progress. */
  isSyncing: boolean
  /** Number of pending local changes that still need to be synced. */
  pendingCount: number
}

export function useSyncAction(): UseSyncActionReturn {
  const { t } = useTranslation()

  const { state, replaceAllExpenses, clearDirtyDaysAfterSync } = useExpenses()
  const { addNotification } = useNotifications()
  const {
    settings,
    hasUnsyncedChanges: hasUnsyncedSettingsChanges,
    clearSyncConfig,
    clearSettingsChangeFlag,
    replaceSettings,
  } = useSettings()

  const syncMachine = useSyncMachine()
  const isSyncing = syncMachine.isSyncing

  const syncQueueWatermarkRef = useRef<number | null>(null)

  // Number of pending local changes (expense day buckets + settings flag).
  const pendingCount = useMemo(() => {
    const uniqueDirtyDays = new Set([...state.dirtyDays, ...state.deletedDays])
    const expenseChanges = uniqueDirtyDays.size
    const settingsChanges = settings.syncSettings && hasUnsyncedSettingsChanges ? 1 : 0
    return expenseChanges + settingsChanges
  }, [
    state.dirtyDays,
    state.deletedDays,
    settings.syncSettings,
    hasUnsyncedSettingsChanges,
  ])

  /**
   * Show conflict resolution dialog for true conflicts.
   * Returns user's resolution choices or undefined if cancelled.
   */
  const showConflictDialog = useCallback(
    (conflicts: TrueConflict[]): Promise<ConflictResolution[] | undefined> => {
      return new Promise((resolve) => {
        const conflictCount = conflicts.length
        const conflictSummary = conflicts
          .slice(0, 3)
          .map((c) => {
            const localNote = c.localVersion.note || "Unnamed"
            const remoteNote = c.remoteVersion.note || "Unnamed"
            const localAmount = `${c.localVersion.amount}`
            const remoteAmount = `${c.remoteVersion.amount}`

            return `• Local: ${localNote} (${localAmount})\n  Remote: ${remoteNote} (${remoteAmount})`
          })
          .join("\n\n")
        const moreText = conflictCount > 3 ? `\n\n...and ${conflictCount - 3} more` : ""

        Alert.alert(
          t("settings.conflicts.title", {
            count: conflictCount,
            s: conflictCount > 1 ? "s" : "",
          }),
          t("settings.conflicts.message", {
            s: conflictCount > 1 ? "s" : "",
            summary: `${conflictSummary}${moreText}`,
          }),
          [
            {
              text: t("common.cancel"),
              style: "cancel",
              onPress: () => resolve(undefined),
            },
            {
              text: t("settings.conflicts.keepLocal"),
              onPress: () => {
                const resolutions: ConflictResolution[] = conflicts.map((c) => ({
                  expenseId: c.expenseId,
                  choice: "local" as const,
                }))
                resolve(resolutions)
              },
            },
            {
              text: t("settings.conflicts.keepRemote"),
              onPress: () => {
                const resolutions: ConflictResolution[] = conflicts.map((c) => ({
                  expenseId: c.expenseId,
                  choice: "remote" as const,
                }))
                resolve(resolutions)
              },
            },
          ]
        )
      })
    },
    [t]
  )

  // Handle sync using XState machine with callbacks
  const handleSync = useCallback(async () => {
    const dirtyDaysState = await loadDirtyDays()
    await saveDirtyDays({
      ...dirtyDaysState.state,
      dirtyDays: state.dirtyDays,
      deletedDays: state.deletedDays,
      updatedAt: new Date().toISOString(),
    })
    syncQueueWatermarkRef.current = await getSyncQueueWatermark()
    syncMachine.sync({
      localExpenses: state.expenses,
      settings: settings.syncSettings ? settings : undefined,
      syncSettingsEnabled: settings.syncSettings,
      callbacks: {
        onAuthError: ({ shouldSignOut }) => {
          if (shouldSignOut) {
            clearSyncConfig()
          }
        },
        onConflict: async (conflicts: TrueConflict[]) => {
          const resolutions = await showConflictDialog(conflicts)
          if (resolutions) {
            syncMachine.resolveConflicts(resolutions)
          } else {
            syncMachine.cancel()
          }
        },
        onSuccess: async (result) => {
          const localFilesUpdated = result.syncResult?.localFilesUpdated ?? 0
          const remoteFilesUpdated = result.syncResult?.remoteFilesUpdated ?? 0
          addNotification(
            t("settings.notifications.syncComplete", {
              localCount: localFilesUpdated,
              remoteCount: remoteFilesUpdated,
            }),
            "success"
          )

          const watermark = syncQueueWatermarkRef.current
          let opsAfter = watermark !== null ? await getSyncOpsSince(watermark) : []
          if (watermark !== null && opsAfter.length === 0) {
            const latestWatermark = await getSyncQueueWatermark()
            if (latestWatermark > watermark) {
              opsAfter = await getSyncOpsSince(watermark)
            }
          }

          const baseExpenses = result.mergeResult?.merged ?? state.expenses
          const reconciledExpenses = applyQueuedOpsToExpenses(baseExpenses, opsAfter)
          const pendingExpenseOps = opsAfter.some((op) => op.type.startsWith("expense."))
          const pendingSettingsOps = opsAfter.some(
            (op) => op.type.startsWith("settings.") || op.type.startsWith("category.")
          )

          let settingsBase = settings
          if (result.syncResult?.mergedSettings) {
            settingsBase = result.syncResult.mergedSettings
          } else if (result.syncResult?.mergedCategories) {
            settingsBase = {
              ...settingsBase,
              categories: result.syncResult.mergedCategories,
            }
          }

          const reconciledSettings = applyQueuedOpsToSettings(settingsBase, opsAfter)

          if (watermark !== null) {
            const lastAppliedId =
              opsAfter.length > 0 ? opsAfter[opsAfter.length - 1].id : watermark
            await clearSyncOpsUpTo(lastAppliedId)
          }

          if (!pendingExpenseOps) {
            clearDirtyDaysAfterSync()
          }
          if (settings.syncSettings && !pendingSettingsOps) {
            clearSettingsChangeFlag()
          }

          if (reconciledExpenses.length > 0) {
            replaceAllExpenses(reconciledExpenses)
          }

          if (settings.syncSettings && result.syncResult?.mergedSettings) {
            replaceSettings(reconciledSettings)
          }
        },
        onInSync: () => {
          addNotification(t("settings.notifications.alreadyInSync"), "success")
        },
        onError: (error) => {
          addNotification(error, "error")
        },
      },
    })
  }, [
    state.dirtyDays,
    state.deletedDays,
    state.expenses,
    syncMachine,
    settings,
    clearSyncConfig,
    showConflictDialog,
    addNotification,
    t,
    clearDirtyDaysAfterSync,
    clearSettingsChangeFlag,
    replaceAllExpenses,
    replaceSettings,
  ])

  return { handleSync, isSyncing, pendingCount }
}
