import { useSelector } from "@xstate/react"
import { useCallback, useMemo } from "react"
import { Expense } from "../types/expense"
import { AppSettings } from "../services/settings-manager"
import {
  SyncMachineState,
  SyncCallbacks,
  ConflictResolver,
  TrueConflict,
  MergeResult,
} from "../services/sync-machine"
import { useStoreContext } from "../stores/store-provider"

export type { SyncCallbacks, ConflictResolver, TrueConflict, MergeResult }

export interface SyncParams {
  localExpenses: Expense[]
  dirtyDays?: string[]
  deletedDays?: string[]
  settings?: AppSettings
  syncSettingsEnabled: boolean
  callbacks?: SyncCallbacks
  conflictResolver?: ConflictResolver
}

export interface UseSyncMachineReturn {
  state: SyncMachineState
  isIdle: boolean
  isSyncing: boolean
  isConflict: boolean
  isPushing: boolean
  isSuccess: boolean
  isError: boolean
  isInSync: boolean
  isAwaitingInitialReconciliation: boolean
  isReconcilingFirstSync: boolean

  error?: string
  errorCode?: string
  mergeResult?: MergeResult
  pendingConflicts?: TrueConflict[]

  sync: (params: SyncParams) => void
  resolveConflicts: (
    resolutions: { expenseId: string; choice: "local" | "remote" }[]
  ) => void
  cancel: () => void
  reset: () => void
}

export function useSyncMachine(): UseSyncMachineReturn {
  const { syncActor } = useStoreContext()

  const snapshot = useSelector(syncActor, (state) => state)

  const state = snapshot.value as SyncMachineState

  const isIdle = state === "idle"
  const isSyncing = state === "syncing"
  const isConflict = state === "conflict"
  const isPushing = state === "pushing"
  const isSuccess = state === "success"
  const isError = state === "error"
  const isInSync = state === "inSync"
  const isAwaitingInitialReconciliation = state === "awaitingInitialReconciliation"
  const isReconcilingFirstSync = state === "reconcilingFirstSync"

  const sync = useCallback(
    (params: SyncParams) => {
      syncActor.send({
        type: "SYNC",
        localExpenses: params.localExpenses,
        dirtyDays: params.dirtyDays,
        deletedDays: params.deletedDays,
        settings: params.settings,
        syncSettingsEnabled: params.syncSettingsEnabled,
        callbacks: params.callbacks,
        conflictResolver: params.conflictResolver,
      })
    },
    [syncActor]
  )

  const resolveConflicts = useCallback(
    (resolutions: { expenseId: string; choice: "local" | "remote" }[]) => {
      syncActor.send({
        type: "RESOLVE_CONFLICTS",
        resolutions,
      })
    },
    [syncActor]
  )

  const cancel = useCallback(() => {
    syncActor.send({ type: "CANCEL" })
  }, [syncActor])

  const reset = useCallback(() => {
    syncActor.send({ type: "RESET" })
  }, [syncActor])

  const contextData = useMemo(
    () => ({
      error: snapshot.context.error,
      errorCode: snapshot.context.errorCode,
      mergeResult: snapshot.context.mergeResult,
      pendingConflicts: snapshot.context.pendingConflicts,
    }),
    [snapshot.context]
  )

  return {
    state,
    isIdle,
    isSyncing,
    isConflict,
    isPushing,
    isSuccess,
    isError,
    isInSync,
    isAwaitingInitialReconciliation,
    isReconcilingFirstSync,
    ...contextData,
    sync,
    resolveConflicts,
    cancel,
    reset,
  }
}
