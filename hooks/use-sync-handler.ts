import { useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import {
  useExpenses,
  useSettings,
  useNotifications,
  useProviderManagement,
  ProviderCardStatus,
} from "../stores/hooks"
import { useSyncEngine } from "./use-sync-engine"
import { loadDirtyDays, saveDirtyDays } from "../services/expense-dirty-days"

/**
 * Drives the manual "Sync now" button. All sync orchestration — read → merge →
 * write, watermark advancement, dirty-day clearing, applying the merged result
 * (via the orchestrator's `onMerged` binding), conflict resolution (via the
 * `conflictResolver` binding), and success notifications (via `onNotify`) — is
 * owned by the {@link useSyncEngine} orchestrator. This hook only persists the
 * latest dirty-day set, triggers the run, clears the local settings-change flag
 * on success, and surfaces errors.
 */
export function useSyncHandler() {
  const { t } = useTranslation()
  const { state } = useExpenses()
  const { settings, hasUnsyncedChanges, clearSettingsChangeFlag } = useSettings()
  const { addNotification } = useNotifications()
  const { hasActiveProvider, providerCards } = useProviderManagement()
  const { isSyncing, manualSync } = useSyncEngine()

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
    // Make sure the persisted dirty-day set reflects the latest in-memory state
    // before the orchestrator loads it for the run.
    const dirtyDaysState = await loadDirtyDays()
    await saveDirtyDays({
      ...dirtyDaysState.state,
      dirtyDays: state.dirtyDays,
      deletedDays: state.deletedDays,
      updatedAt: new Date().toISOString(),
    })

    const result = await manualSync()

    if (result.skipped) return

    if (result.error) {
      addNotification(result.error, "error")
      return
    }

    if (result.pendingConflicts && result.pendingConflicts.length > 0) {
      // The resolver was cancelled or not all conflicts were resolved; the
      // orchestrator left the remote untouched. Nothing else to do here.
      return
    }

    // Success / in-sync. The merged result, dirty-day clearing, watermark, and
    // the success toast are handled by the orchestrator. Only the local
    // settings-change flag is the orchestrator's blind spot, so clear it here
    // when settings sync is on and there are no still-pending expense ops.
    if (settings.syncSettings && !result.pendingExpenseOps) {
      clearSettingsChangeFlag()
    }
  }, [
    state.dirtyDays,
    state.deletedDays,
    manualSync,
    addNotification,
    settings.syncSettings,
    clearSettingsChangeFlag,
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
