import { useCallback, useMemo, useRef } from "react"
import { Alert } from "react-native"
import { useTranslation } from "react-i18next"
import {
  useExpenses,
  useSettings,
  useNotifications,
  useProviderManagement,
  ProviderCardStatus,
} from "../stores/hooks"
import { useSyncMachine, TrueConflict, ConflictResolution } from "./use-sync-machine"
import {
  applyQueuedOpsToExpenses,
  clearSyncOpsUpTo,
  getSyncOpsSince,
  getSyncQueueWatermark,
} from "../services/sync-queue"
import { loadDirtyDays, saveDirtyDays } from "../services/expense-dirty-days"
import { providerSettingsStore } from "../services/sync/provider-settings-store"

function useConflictDialog() {
  const { t } = useTranslation()

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

  return { showConflictDialog }
}

export function useSyncHandler() {
  const { t } = useTranslation()
  const { state, replaceAllExpenses, clearDirtyDaysAfterSync } = useExpenses()
  const { settings, hasUnsyncedChanges, clearSyncConfig, clearSettingsChangeFlag } =
    useSettings()
  const { addNotification } = useNotifications()
  const { hasActiveProvider, providerCards, markReconciled } = useProviderManagement()
  const syncMachine = useSyncMachine()
  const { showConflictDialog } = useConflictDialog()

  const syncQueueWatermarkRef = useRef<number | null>(null)

  const isSyncing = syncMachine.isSyncing

  const pendingCount = useMemo(() => {
    const uniqueDirtyDays = new Set([...state.dirtyDays, ...state.deletedDays])
    const expenseChanges = uniqueDirtyDays.size
    const settingsChanges = settings.syncSettings && hasUnsyncedChanges ? 1 : 0
    return expenseChanges + settingsChanges
  }, [state.dirtyDays, state.deletedDays, hasUnsyncedChanges, settings.syncSettings])

  const needsFirstSync =
    hasActiveProvider &&
    providerCards.some((c) => c.status === ProviderCardStatus.ActiveUnreconciled)

  const syncButtonText = useMemo(() => {
    if (isSyncing) return t("settings.autoSync.syncing")
    if (needsFirstSync) return t("settings.autoSync.firstSync")
    if (pendingCount > 0) return `${t("settings.autoSync.syncNow")} (${pendingCount})`
    return t("settings.autoSync.syncNow")
  }, [isSyncing, needsFirstSync, pendingCount, t])

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
          const localFilesUpdated =
            (result.mergeResult?.addedFromLocal.length ?? 0) +
            (result.mergeResult?.updatedFromLocal.length ?? 0)
          const remoteFilesUpdated =
            (result.mergeResult?.addedFromRemote.length ?? 0) +
            (result.mergeResult?.updatedFromRemote.length ?? 0)
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

          const activeConfig = await providerSettingsStore.getActiveConfig()
          if (activeConfig) {
            markReconciled(activeConfig.id)
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
    hasUnsyncedChanges,
    syncMachine,
    settings,
    clearSyncConfig,
    showConflictDialog,
    addNotification,
    t,
    clearDirtyDaysAfterSync,
    clearSettingsChangeFlag,
    replaceAllExpenses,
    markReconciled,
  ])

  return {
    handleSync,
    isSyncing,
    syncButtonText,
    pendingCount,
    needsFirstSync,
    hasActiveProvider,
  }
}
